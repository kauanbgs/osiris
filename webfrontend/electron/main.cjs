const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const os = require("os");
const fs = require("fs");
const pty = require("node-pty");
const express = require("express");


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

async function runLlamaPrompt(payload, onTextChunk) {
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

  if (
    history.length > 0 &&
    typeof currentSession.setChatHistory === "function"
  ) {
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
    currentSession.setChatHistory(chatHistory);
  } else if (
    history.length === 0 &&
    typeof currentSession.setChatHistory === "function"
  ) {
    currentSession.setChatHistory([]);
  }

  return currentSession.prompt(promptText, {
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

async function loadModelFromPath(modelPath) {
  try {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Arquivo de modelo não encontrado: ${modelPath}`);
    }

    const llama = await getLlamaModule();
    const { LlamaChatSession } = await import("node-llama-cpp");

    if (currentModel) {
      try {
        await currentModel.dispose();
      } catch (err) {
        console.error("Erro ao descartar modelo antigo:", err);
      }
    }

    currentModel = await llama.loadModel({
      modelPath: modelPath,
    });

    const context = await currentModel.createContext();
    currentSession = new LlamaChatSession({
      contextSequence: context.getSequence(),
    });

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

ipcMain.handle("llama:prompt", async (event, payload) => {
  const sender = event.sender;

  try {
    const response = await runLlamaPrompt(payload, (chunk) => {
      if (!sender.isDestroyed()) {
        sender.send("llama:stream", {
          type: "chunk",
          text: chunk,
        });
      }
    });

    if (!sender.isDestroyed()) {
      sender.send("llama:stream", {
        type: "done",
      });
    }

    return response;
  } catch (error) {
    if (!sender.isDestroyed()) {
      sender.send("llama:stream", {
        type: "error",
        error: error.message,
      });
    }

    throw error;
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
  if (activeModelPath === modelPath) {
    if (currentModel) {
      try {
        await currentModel.dispose();
      } catch (e) {}
      currentModel = null;
      currentSession = null;
      activeModelPath = null;
    }
  }

  if (fs.existsSync(modelPath)) {
    fs.unlinkSync(modelPath);
  }
  return true;
});

// ===============================
// TERMINAL IPC HANDLERS
// ===============================

ipcMain.handle("terminal-create", (event, id, mode) => {
  if (!id || terminals.has(id)) return;

  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  const shell =
    process.platform === "win32"
      ? "powershell.exe"
      : process.env.SHELL || "/bin/bash";

  const terminal = pty.spawn(shell, [], {
    name: "xterm-256color",
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM: "xterm-256color",
    },
  });

  terminals.set(id, terminal);

  terminal.onData((data) => {
    if (!win.isDestroyed()) {
      win.webContents.send("terminal-data", id, data);
    }
  });

  terminal.onExit(({ exitCode }) => {
    terminals.delete(id);
    if (!win.isDestroyed()) {
      win.webContents.send("terminal-exit", id, exitCode);
    }
  });

  if (mode === "claude") {
    setTimeout(() => {
      terminal.write("claude\r");
    }, 400);
  }
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
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt não informado",
      });
    }

    const response = await runLlamaPrompt(prompt);

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

const AI_SERVER_PORT = 8080;

function startAiServer() {
  aiServer.listen(AI_SERVER_PORT, "0.0.0.0", () => {
    console.log(
      `Osiris AI Server disponível na rede na porta ${AI_SERVER_PORT}`,
    );
  });
}
