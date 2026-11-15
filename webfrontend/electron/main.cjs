// main.cjs — processo principal do app desktop (Electron): janela, modelos locais, terminais e arquivos.
// Também sobe o servidor local da porta 8080, que o celular usa para o terminal e para a pasta compartilhada.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const pty = require("node-pty");
const express = require("express");
const { createWorkflowStore } = require("./workflowStore.cjs");
const workspaceFs = require("./workspaceFs.cjs");
const remoteTerminal = require("./remoteTerminal.cjs");
const pastaCompartilhada = require("./pastaCompartilhada.cjs");

const workflowStore = () => createWorkflowStore(path.join(app.getPath("userData"), "workflows"));
ipcMain.handle("workflow:load", (_event, owner, chatId) => workflowStore().load(owner, chatId));
ipcMain.handle("workflow:save", (_event, owner, chatId, workflow) => workflowStore().save(owner, chatId, workflow));
ipcMain.handle("workflow:delete", (_event, owner, chatId) => workflowStore().remove(owner, chatId));


// Habilita Web Speech API e acesso ao microfone no Chromium do Electron
app.commandLine.appendSwitch("enable-features", "WebSpeechAPI");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const terminals = new Map();

// Llama.cpp State
let llamaInstance = null;
let currentModel = null;
let currentSession = null;
let activeModelPath = null;
const activeDownloads = new Map();

// Serializes load/prompt/delete: a single session can't run prompts
// concurrently, and swapping the model mid-prompt disposes it underneath.
let llamaQueue = Promise.resolve();
function withLlamaLock(fn) {
  const run = llamaQueue.then(fn, fn);
  llamaQueue = run.catch(() => {});
  return run;
}

async function disposeCurrentModel() {
  const model = currentModel;
  currentModel = null;
  currentSession = null;
  activeModelPath = null;
  if (model) {
    try {
      await model.dispose();
    } catch (err) {
      console.error("Erro ao descartar modelo antigo:", err);
    }
  }
}

async function runLlamaPrompt(payload, onTextChunk, signal) {
  if (!currentSession) {
    throw new Error("Nenhum modelo carregado");
  }

  let promptText = payload;
  let history = [];

  if (typeof payload === "object" && payload !== null) {
    promptText = payload.prompt;
    history = payload.history || [];
  }

  if (!promptText || typeof promptText !== "string") {
    throw new Error("Prompt inválido");
  }

  const systemPrompt =
    typeof payload?.systemPrompt === "string" ? payload.systemPrompt.trim() : "";

  if (typeof currentSession.setChatHistory === "function") {
    const chatHistory = history.map((msg) => {
      if (msg.role === "assistant") {
        return {
          type: "model",
          response: [msg.content || ""],
        };
      }

      return {
        type: "user",
        text: msg.content || "",
      };
    });
    currentSession.setChatHistory(
      systemPrompt ? [{ type: "system", text: systemPrompt }, ...chatHistory] : chatHistory,
    );
  }

  // Old history may be shifted out, but the current prompt must fit whole:
  // its beginning carries the upstream agents' handoff.
  if (currentModel) {
    const contextSize = currentSession.context.contextSize;
    const inputTokens = currentModel.tokenize(
      [systemPrompt, promptText].join("\n"),
    ).length;
    if (inputTokens > contextSize - 512) {
      throw new Error(
        `O prompt tem cerca de ${inputTokens} tokens e o contexto do modelo local comporta ${contextSize}. ` +
          "Conecte menos arquivos ou divida a etapa em mais agentes.",
      );
    }
  }

  return currentSession.prompt(promptText, {
    // Stop returns the partial text instead of throwing, so the session
    // stays usable for the next prompt.
    signal,
    stopOnAbortSignal: true,
    onTextChunk(chunk) {
      const text =
        typeof chunk === "string"
          ? chunk
          : (chunk?.text ?? String(chunk ?? ""));

      if (text && onTextChunk) {
        onTextChunk(text);
      }
    },
  });
}

async function getLlamaModule() {
  if (!llamaInstance) {
    const { getLlama } = await import("node-llama-cpp");
    llamaInstance = await getLlama();
  }
  return llamaInstance;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
    titleBarOverlay: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: false,
    },
  });

  // Concede permissão de microfone automaticamente (request handler + check handler)
  // O check handler é síncrono e bloqueia antes mesmo do request chegar
  const allowedPerms = [
    "media",
    "microphone",
    "camera",
    "audioCapture",
    "videoCapture",
    "mediaKeySystem",
  ];

  win.webContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(allowedPerms.includes(permission));
    },
  );

  win.webContents.session.setPermissionCheckHandler((_wc, permission) => {
    return allowedPerms.includes(permission);
  });

  // Permite que links em novas abas no webview naveguem no próprio webview
  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() === "webview") {
      contents.setWindowOpenHandler(({ url }) => {
        contents.loadURL(url);
        return { action: "deny" };
      });
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("closed", () => {
    for (const [id, terminal] of terminals.entries()) {
      terminal.kill();
    }
    terminals.clear();
  });
}

// ===============================
// LLAMA.CPP & MODEL IPC HANDLERS
// ===============================

function getModelsDir() {
  const modelsDir = path.join(os.homedir(), ".osiris", "models");
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  return modelsDir;
}

ipcMain.handle("llama:get-status", () => {
  return {
    isLoaded: Boolean(currentSession),
    activeModelPath: activeModelPath,
    activeModelName: activeModelPath ? path.basename(activeModelPath) : null,
  };
});

function listLocalModels() {
  const modelsDir = getModelsDir();
  const files = fs.readdirSync(modelsDir);
  const models = [];

  for (const filename of files) {
    if (filename.endsWith(".gguf")) {
      const fullPath = path.join(modelsDir, filename);
      const stats = fs.statSync(fullPath);
      models.push({
        filename,
        fullPath,
        sizeBytes: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(1),
        sizeGB: (stats.size / (1024 * 1024 * 1024)).toFixed(2),
        isActive: activeModelPath === fullPath,
      });
    }
  }

  return models;
}

ipcMain.handle("llama:list-local-models", () => listLocalModels());

function loadModelFromPath(modelPath) {
  return withLlamaLock(async () => {
    try {
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Arquivo de modelo não encontrado: ${modelPath}`);
      }

      if (currentSession && activeModelPath === modelPath) {
        return {
          success: true,
          activeModelPath,
          activeModelName: path.basename(modelPath),
        };
      }

      const llama = await getLlamaModule();
      const { LlamaChatSession } = await import("node-llama-cpp");

      await disposeCurrentModel();

      const model = await llama.loadModel({
        modelPath: modelPath,
      });

      const context = await model.createContext();
      currentSession = new LlamaChatSession({
        contextSequence: context.getSequence(),
      });
      currentModel = model;
      activeModelPath = modelPath;

      return {
        success: true,
        activeModelPath,
        activeModelName: path.basename(modelPath),
      };
    } catch (err) {
      console.error("Erro ao carregar modelo:", err);
      throw new Error(err.message || "Falha ao carregar o modelo GGUF");
    }
  });
}

// Avisa as janelas (ex.: tela Modelos da web) quando o modelo muda pela rede.
async function loadModelAndNotify(modelPath) {
  const result = await loadModelFromPath(modelPath);
  broadcast("llama:model-changed", result);
  return result;
}

ipcMain.handle("llama:load-model", (_, modelPath) =>
  loadModelFromPath(modelPath),
);

// Running or queued prompts by request id, so the renderer can stop them.
const llamaPromptAborts = new Map();

ipcMain.handle("llama:abort", (_, requestId) => {
  llamaPromptAborts.get(requestId)?.abort();
});

ipcMain.handle("llama:prompt", async (event, payload) => {
  const sender = event.sender;
  const requestId = payload?.requestId;
  const abort = new AbortController();
  if (requestId) llamaPromptAborts.set(requestId, abort);

  try {
    const response = await withLlamaLock(() => {
      if (abort.signal.aborted) return "";
      return runLlamaPrompt(payload, (chunk) => {
        if (!sender.isDestroyed()) {
          sender.send("llama:stream", {
            type: "chunk",
            text: chunk,
            requestId,
          });
        }
      }, abort.signal);
    });

    if (!sender.isDestroyed()) {
      sender.send("llama:stream", {
        type: "done",
        requestId,
      });
    }

    return response;
  } catch (error) {
    if (!sender.isDestroyed()) {
      sender.send("llama:stream", {
        type: "error",
        error: error.message,
        requestId,
      });
    }

    throw error;
  } finally {
    if (requestId) llamaPromptAborts.delete(requestId);
  }
});

// Envia um evento para todas as janelas, assim a tela de Modelos acompanha
// também os downloads iniciados pelo app mobile.
function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

async function downloadModelFile(url, filename) {
  const modelsDir = getModelsDir();
  const destinationPath = path.join(modelsDir, filename);
  const tempPath = destinationPath + ".tmp";

  if (fs.existsSync(destinationPath)) {
    return { success: true, modelPath: destinationPath, alreadyExists: true };
  }

  if (activeDownloads.has(url)) {
    throw new Error("Este modelo já está sendo baixado.");
  }

  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(
        `Erro de download HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const contentLength = response.headers.get("content-length");
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    let downloadedBytes = 0;

    const fileStream = fs.createWriteStream(tempPath);
    const reader = response.body.getReader();

    const download = {
      tempPath,
      reader,
      filename,
      downloadedBytes: 0,
      totalBytes,
      progress: 0,
    };
    activeDownloads.set(url, download);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloadedBytes += value.length;
      fileStream.write(Buffer.from(value));

      const progress = totalBytes
        ? Math.round((downloadedBytes / totalBytes) * 100)
        : 0;

      download.downloadedBytes = downloadedBytes;
      download.progress = progress;

      broadcast("llama:download-progress", {
        url,
        filename,
        downloadedBytes,
        totalBytes,
        progress,
      });
    }

    await new Promise((resolve, reject) => {
      fileStream.on("error", reject);
      fileStream.end(resolve);
    });

    // cancelDownload() remove o item do mapa e interrompe o reader.
    if (!activeDownloads.has(url)) {
      throw new Error("Download cancelado.");
    }

    fs.renameSync(tempPath, destinationPath);
    activeDownloads.delete(url);

    broadcast("llama:download-complete", {
      url,
      filename,
      modelPath: destinationPath,
    });

    return { success: true, modelPath: destinationPath };
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    }
    activeDownloads.delete(url);
    console.error("Erro no download do modelo:", err);
    throw new Error(err.message || "Falha no download do modelo");
  }
}

ipcMain.handle("llama:download-model", (_, { url, filename }) =>
  downloadModelFile(url, filename),
);

function cancelDownload(url) {
  const item = activeDownloads.get(url);
  if (item) {
    activeDownloads.delete(url);
    try {
      item.reader?.cancel();
    } catch (e) {}
    if (fs.existsSync(item.tempPath)) {
      try {
        fs.unlinkSync(item.tempPath);
      } catch (e) {}
    }
    return true;
  }
  return false;
}

ipcMain.handle("llama:cancel-download", (_, url) => cancelDownload(url));

ipcMain.handle("llama:import-file", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    title: "Selecionar modelo .GGUF",
    filters: [{ name: "Modelos GGUF", extensions: ["gguf"] }],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  const filename = path.basename(selectedPath);
  const modelsDir = getModelsDir();
  const targetPath = path.join(modelsDir, filename);

  if (selectedPath !== targetPath && !fs.existsSync(targetPath)) {
    fs.copyFileSync(selectedPath, targetPath);
  }

  return {
    filename,
    fullPath: targetPath,
  };
});

ipcMain.handle("llama:delete-model", async (_, modelPath) => {
  await withLlamaLock(async () => {
    if (activeModelPath === modelPath) {
      await disposeCurrentModel();
    }
  });

  if (fs.existsSync(modelPath)) {
    fs.unlinkSync(modelPath);
  }
  return true;
});

// ===============================
// TERMINAL IPC HANDLERS
// ===============================

ipcMain.handle("terminal-create", (event, id, mode, cwd) => {
  if (!id || terminals.has(id)) return { ok: true, existing: true };

  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { ok: false, error: "Janela nao encontrada." };

  const shell =
    process.platform === "win32"
      ? "powershell.exe"
      : process.env.SHELL || "/bin/bash";

  const startDir =
    typeof cwd === "string" && cwd && fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()
      ? cwd
      : os.homedir();

  let terminal;
  try {
    terminal = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: startDir,
      env: {
        ...process.env,
        TERM: "xterm-256color",
      },
    });
  } catch (err) {
    console.error("Erro ao abrir terminal:", err);
    if (!win.isDestroyed()) {
      const CRLF = String.fromCharCode(13, 10);
      const RED = String.fromCharCode(27) + "[31m";
      const RESET = String.fromCharCode(27) + "[0m";
      win.webContents.send(
        "terminal-data",
        id,
        CRLF + RED + "Nao foi possivel abrir o terminal: " + err.message + RESET + CRLF,
      );
    }
    return { ok: false, error: err.message };
  }

  terminals.set(id, terminal);

  terminal.onData((data) => {
    if (!win.isDestroyed()) {
      win.webContents.send("terminal-data", id, data);
    }
  });

  terminal.onExit(({ exitCode }) => {
    // Evita que uma sessão antiga remova uma sessão nova com o mesmo ID.
    if (terminals.get(id) !== terminal) return;
    terminals.delete(id);
    if (!win.isDestroyed()) {
      win.webContents.send("terminal-exit", id, exitCode);
    }
  });

  if (mode === "claude") {
    setTimeout(() => {
      if (terminals.get(id) === terminal) terminal.write("claude" + String.fromCharCode(13));
    }, 400);
  }

  return { ok: true };
});

ipcMain.on("terminal-write", (event, id, data) => {
  if (!id) return;
  const terminal = terminals.get(id);
  if (terminal) {
    terminal.write(data);
  }
});

ipcMain.on("terminal-resize", (event, payload) => {
  const id = payload?.id;
  const cols = payload?.cols;
  const rows = payload?.rows;

  if (!id) return;
  const terminal = terminals.get(id);
  if (!terminal) return;

  if (
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    cols > 0 &&
    rows > 0
  ) {
    terminal.resize(cols, rows);
  }
});

ipcMain.on("terminal-close", (event, id) => {
  if (!id) return;
  const terminal = terminals.get(id);
  if (terminal) {
    terminal.kill();
    terminals.delete(id);
  }
});

// ===============================
// FILE SYSTEM IPC HANDLERS
// ===============================



ipcMain.handle("fs:write-file", async (_, { filePath, content }) => {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Caminho de arquivo inválido.");
  }

  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, content, "utf-8");
    return { success: true, filePath };
  } catch (err) {
    console.error("Erro ao escrever arquivo:", err);
    throw new Error(
      `Não foi possível escrever em "${filePath}": ${err.message}`,
    );
  }
});

ipcMain.handle(
  "fs:select-file",
  async () => {
    const result =
      await dialog.showOpenDialog({
        properties: ["openFile"],
      });

    if (
      result.canceled ||
      !result.filePaths.length
    ) {
      return null;
    }

    const filePath =
      result.filePaths[0];

    const content =
      await fs.promises.readFile(
        filePath,
        "utf-8"
      );

    return {
      fileName:
        require("path").basename(
          filePath
        ),

      filePath,

      fileContent: content,
    };
  }
);

// ======================================================
// ESCOLHER PASTA
// ======================================================

ipcMain.handle("fs:select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  const folderPath = result.filePaths[0];

  async function readDirectory(directoryPath) {
    const entries = await fs.promises.readdir(directoryPath, {
      withFileTypes: true,
    });

    const items = [];

    for (const entry of entries) {
      // Ignora algumas pastas pesadas/desnecessárias.
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      const fullPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: fullPath,
          type: "folder",
          children: await readDirectory(fullPath),
        });
      } else {
        items.push({
          name: entry.name,
          path: fullPath,
          type: "file",
        });
      }
    }

    // Pastas primeiro, depois arquivos.
    items.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }

      return a.type === "folder" ? -1 : 1;
    });

    return items;
  }

  const tree = await readDirectory(folderPath);

  return {
    folderName: path.basename(folderPath),
    folderPath,
    tree,
  };
});

// ======================================================
// PASTA DE PROJETO (workspace) - toda escrita fica dentro da pasta escolhida
// ======================================================

ipcMain.handle("fs:select-workspace", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths.length) return null;
  return workspaceFs.scanWorkspace(result.filePaths[0]);
});

ipcMain.handle("fs:workspace-write", async (_, { rootPath, relPath, content }) => {
  const filePath = await workspaceFs.writeIn(rootPath, relPath, content);
  return { success: true, filePath };
});

ipcMain.handle("fs:workspace-mkdir", async (_, { rootPath, relPath }) => {
  const folderPath = await workspaceFs.mkdirIn(rootPath, relPath);
  return { success: true, folderPath };
});

ipcMain.handle("fs:workspace-delete", async (_, { rootPath, relPath }) => {
  return { success: await workspaceFs.deleteIn(rootPath, relPath) };
});

// Observa arquivos/pastas no disco e avisa a janela quando mudam (ex.: salvos no VS Code).
const fileWatchers = new Map();

ipcMain.handle("fs:watch", (event, { watchId, rootPath, filePaths }) => {
  fileWatchers.get(watchId)?.();
  fileWatchers.delete(watchId);
  const sender = event.sender;
  try {
    const close = workspaceFs.createWatcher({ rootPath, filePaths }, (payload) => {
      if (!sender.isDestroyed()) sender.send("fs:changed", { watchId, ...payload });
    });
    fileWatchers.set(watchId, close);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("fs:unwatch", (_, watchId) => {
  fileWatchers.get(watchId)?.();
  fileWatchers.delete(watchId);
});

ipcMain.handle("fs:scan-workspace", (_, rootPath) => workspaceFs.scanWorkspace(rootPath));

// ======================================================
// LER ARQUIVO
// ======================================================

ipcMain.handle("fs:read-file", async (_, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Caminho inválido.");
  }

  try {
    const content = await fs.promises.readFile(filePath, "utf-8");

    return {
      fileName: path.basename(filePath),
      filePath,
      fileContent: content,
    };
  } catch (err) {
    console.error("Erro ao ler arquivo:", err);

    throw new Error(
      `Não foi possível ler "${filePath}": ${err.message}`,
    );
  }
});

// ===============================
// WINDOW CONTROLS IPC HANDLERS
// ===============================

app.whenReady().then(() => {
  createWindow();
  startAiServer();
  iniciarPonteComApi();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.on("window-minimize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.minimize();
});

ipcMain.on("window-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.on("window-close", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win?.close();
});

ipcMain.handle("window-is-maximized", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win?.isMaximized() ?? false;
});

const aiServer = express();

aiServer.use(
  express.json({
    limit: "1mb",
  }),
);

aiServer.get("/api/status", (req, res) => {
  res.json({
    online: true,
    modelLoaded: Boolean(currentSession),
    activeModelName: activeModelPath ? path.basename(activeModelPath) : null,
  });
});

aiServer.post("/api/prompt", async (req, res) => {
  try {
    const payload = req.body || {};
    const prompt = payload.prompt;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt não informado",
      });
    }

    // O celular pode pedir um modelo local pelo nome do arquivo: se for
    // diferente do ativo, troca antes de responder.
    if (payload.model && path.basename(String(payload.model)) === payload.model) {
      const requestedPath = resolveLocalModelPath(payload.model);
      if (requestedPath && activeModelPath !== requestedPath) {
        await loadModelAndNotify(requestedPath);
      }
    }

    const response = await runLlamaPrompt({
      prompt,
      systemPrompt:
        typeof payload.systemPrompt === "string" ? payload.systemPrompt : "",
      history: Array.isArray(payload.history) ? payload.history : [],
    });

    res.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("Erro na API local:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ===============================
// MODELOS VIA REDE (app mobile)
// ===============================

// Só modelos do catálogo podem ser baixados pela rede: o celular escolhe pelo
// nome do arquivo e nunca envia uma URL.
const modelCatalog = require("./modelCatalog.json");

function findCatalogModel(filename) {
  return modelCatalog.find((model) => model.filename === filename);
}

// Aceita apenas nomes de arquivo .gguf que existam na pasta de modelos.
function resolveLocalModelPath(filename) {
  if (
    typeof filename !== "string" ||
    !filename.endsWith(".gguf") ||
    path.basename(filename) !== filename
  ) {
    return null;
  }
  const fullPath = path.join(getModelsDir(), filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}

aiServer.get("/api/models", (req, res) => {
  try {
    const installed = listLocalModels().map(({ fullPath, ...model }) => model);
    const installedNames = new Set(installed.map((model) => model.filename));
    const downloads = {};

    for (const download of activeDownloads.values()) {
      downloads[download.filename] = {
        progress: download.progress,
        downloadedBytes: download.downloadedBytes,
        totalBytes: download.totalBytes,
      };
    }

    res.json({
      activeModelName: activeModelPath ? path.basename(activeModelPath) : null,
      modelLoaded: Boolean(currentSession),
      installed,
      catalog: modelCatalog.map(({ url, ...model }) => ({
        ...model,
        installed: installedNames.has(model.filename),
      })),
      downloads,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

aiServer.post("/api/models/download", (req, res) => {
  const model = findCatalogModel(req.body?.filename);

  if (!model) {
    return res.status(400).json({ error: "Modelo fora do catálogo." });
  }

  if (resolveLocalModelPath(model.filename)) {
    return res.json({ status: "installed" });
  }

  if (activeDownloads.has(model.url)) {
    return res.status(202).json({ status: "downloading" });
  }

  // O download pode levar minutos: responde na hora e o celular acompanha
  // o progresso por GET /api/models.
  downloadModelFile(model.url, model.filename).catch((error) => {
    console.error("Download pela rede falhou:", error.message);
  });

  res.status(202).json({ status: "downloading" });
});

aiServer.post("/api/models/cancel", (req, res) => {
  const model = findCatalogModel(req.body?.filename);

  if (!model) {
    return res.status(400).json({ error: "Modelo fora do catálogo." });
  }

  res.json({ cancelled: cancelDownload(model.url) });
});

aiServer.post("/api/models/load", async (req, res) => {
  const modelPath = resolveLocalModelPath(req.body?.filename);

  if (!modelPath) {
    return res.status(404).json({ error: "Modelo não encontrado no desktop." });
  }

  try {
    const result = await loadModelAndNotify(modelPath);
    res.json({
      activeModelName: result.activeModelName,
      modelLoaded: true,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================
// TERMINAL VIA REDE (app mobile)
// ===============================

const API_URL = process.env.VITE_API_URL || process.env.API_URL || "http://163.176.45.118:5000/api/osiris";

// O celular consulta o PC a cada poucos segundos (ex.: pasta compartilhada). Para não perguntar
// à API toda vez, guarda por 30 s de quem é cada token; um logout leva no máximo isso para valer aqui.
const VALIDADE_CACHE_CONTA_MS = 30 * 1000;
const cacheContas = new Map();

async function fetchUserId(token) {
  const agora = Date.now();
  const salvo = cacheContas.get(token);
  if (salvo && salvo.expira > agora) return salvo.idUsuario;

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  const data = response.ok ? await response.json() : null;
  const idUsuario = data?.user?.id_user ?? null;

  if (cacheContas.size > 100) cacheContas.clear();
  if (idUsuario !== null) cacheContas.set(token, { idUsuario, expira: agora + VALIDADE_CACHE_CONTA_MS });
  else cacheContas.delete(token);
  return idUsuario;
}

async function readDesktopToken() {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return null;
  return win.webContents.executeJavaScript('localStorage.getItem("osiris_token")');
}

// A porta 8080 fica aberta na rede e qualquer um pode criar conta na API. Por isso
// só a conta logada aqui no desktop pode usar o terminal e a pasta compartilhada deste PC.
async function verificarMesmaConta(authorization) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!token) return { status: 401, error: "Faça login no aplicativo." };

  try {
    const remoteUser = await fetchUserId(token);
    if (remoteUser === null) return { status: 401, error: "Sessão expirada. Faça login novamente." };

    const desktopToken = await readDesktopToken();
    const desktopUser = desktopToken ? await fetchUserId(desktopToken) : null;
    if (desktopUser === null) return { status: 403, error: "Faça login no app desktop para acessar este PC." };
    if (desktopUser !== remoteUser) return { status: 403, error: "Entre com a mesma conta do app desktop para acessar este PC." };

    return null;
  } catch (error) {
    console.error("Não foi possível validar o acesso remoto:", error.message);
    return { status: 503, error: "O desktop não conseguiu falar com a API para validar o acesso." };
  }
}

// Envolve uma rota do servidor local: confere a conta e transforma erros em respostas JSON.
function rotaProtegida(acao) {
  return async (req, res) => {
    const negado = await verificarMesmaConta(req.headers.authorization);
    if (negado) return res.status(negado.status).json({ error: negado.error });
    try {
      return await acao(req, res);
    } catch (error) {
      return res.status(error.status || 500).json({ error: error.message || "Erro inesperado no desktop." });
    }
  };
}

// O celular usa esta rota para saber se pode usar este PC (indicador de conexão do terminal).
aiServer.get("/api/acesso", rotaProtegida(async (req, res) => {
  res.json({ liberado: true });
}));

aiServer.post("/api/terminal/exec", rotaProtegida(async (req, res) => {
  const { command, timeout_ms: timeoutMs, cwd } = req.body || {};
  const invalid = remoteTerminal.validateCommand(command);
  if (invalid) return res.status(400).json({ error: invalid });

  res.json(await remoteTerminal.runCommand(command, timeoutMs, cwd));
}));

// ===============================
// PASTA COMPARTILHADA (app mobile)
// ===============================

const pastaDados = () => app.getPath("userData");

ipcMain.handle("pasta:compartilhar", async (_event, caminhoPasta) => {
  const pasta = await pastaCompartilhada.salvarPastaCompartilhada(pastaDados(), caminhoPasta);
  return { pasta };
});

async function pastaOuErro() {
  const raiz = await pastaCompartilhada.lerPastaCompartilhada(pastaDados());
  if (!raiz) {
    const erro = new Error("Nenhuma pasta foi compartilhada no app desktop.");
    erro.status = 404;
    throw erro;
  }
  return raiz;
}

aiServer.get("/api/pasta-compartilhada", rotaProtegida(async (req, res) => {
  const raiz = await pastaCompartilhada.lerPastaCompartilhada(pastaDados());
  if (!raiz) return res.json({ workspace: null });
  res.json({
    workspace: {
      folderName: path.basename(raiz),
      files: await pastaCompartilhada.listarItens(raiz),
    },
  });
}));

aiServer.get("/api/pasta-compartilhada/arquivo", rotaProtegida(async (req, res) => {
  res.json(await pastaCompartilhada.lerArquivo(await pastaOuErro(), req.query.path));
}));

aiServer.put("/api/pasta-compartilhada/arquivo", rotaProtegida(async (req, res) => {
  const { path: caminhoRelativo, content } = req.body || {};
  await pastaCompartilhada.gravarArquivo(await pastaOuErro(), caminhoRelativo, content);
  res.json({ message: "Arquivo salvo com sucesso." });
}));

aiServer.delete("/api/pasta-compartilhada/arquivo", rotaProtegida(async (req, res) => {
  await pastaCompartilhada.apagarArquivo(await pastaOuErro(), req.query.path);
  res.json({ message: "Arquivo excluído com sucesso." });
}));

// ===============================
// PONTE COM A API (pedidos de fora da rede local)
// ===============================
// O celular fora do Wi-Fi, o Workflow do celular e o terminal do navegador falam com a API,
// e a API repassa ao desktop logado na mesma conta. Aqui o desktop busca esses pedidos e responde.

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function atenderPedidoDaApi(pedido) {
  const dados = pedido?.dados || {};
  try {
    switch (pedido?.tipo) {
      case "terminal": {
        const invalido = remoteTerminal.validateCommand(dados.command);
        if (invalido) return { erro: { status: 400, message: invalido } };
        return { resultado: await remoteTerminal.runCommand(dados.command, dados.timeout_ms, dados.cwd) };
      }
      case "listarPasta": {
        const raiz = await pastaCompartilhada.lerPastaCompartilhada(pastaDados());
        if (!raiz) return { resultado: { workspace: null } };
        return {
          resultado: {
            workspace: { folderName: path.basename(raiz), files: await pastaCompartilhada.listarItens(raiz) },
          },
        };
      }
      case "lerArquivo":
        return { resultado: await pastaCompartilhada.lerArquivo(await pastaOuErro(), dados.path) };
      case "gravarArquivo":
        await pastaCompartilhada.gravarArquivo(await pastaOuErro(), dados.path, dados.content);
        return { resultado: { ok: true } };
      case "apagarArquivo":
        await pastaCompartilhada.apagarArquivo(await pastaOuErro(), dados.path);
        return { resultado: { ok: true } };
      default:
        return { erro: { status: 400, message: "Pedido desconhecido para o app desktop." } };
    }
  } catch (error) {
    return { erro: { status: error.status || 500, message: error.message || "Erro no app desktop." } };
  }
}

async function devolverRespostaParaApi(token, idPedido, resposta) {
  try {
    await fetch(`${API_URL}/desktop/pedidos/${encodeURIComponent(idPedido)}/resposta`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(resposta),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("Não foi possível devolver a resposta para a API:", error.message);
  }
}

// Fica perguntando à API se há pedidos para a conta logada neste desktop.
async function iniciarPonteComApi() {
  for (;;) {
    let token = null;
    try {
      token = await readDesktopToken();
    } catch {
      token = null;
    }
    if (!token) {
      await esperar(5000);
      continue;
    }

    try {
      const resposta = await fetch(`${API_URL}/desktop/pedidos/proximo`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(40000),
      });
      if (resposta.status === 204) continue;
      if (!resposta.ok) {
        await esperar(resposta.status === 401 ? 10000 : 5000);
        continue;
      }
      const { pedido } = await resposta.json();
      if (!pedido?.id) continue;
      // Atende sem travar a busca do próximo pedido (um comando demorado não segura os outros).
      atenderPedidoDaApi(pedido).then((resultado) => devolverRespostaParaApi(token, pedido.id, resultado));
    } catch {
      await esperar(5000);
    }
  }
}

const AI_SERVER_PORT = 8080;

function startAiServer() {
  aiServer.listen(AI_SERVER_PORT, "0.0.0.0", () => {
    console.log(
      `Osiris AI Server disponível na rede na porta ${AI_SERVER_PORT}`,
    );
  });
}
