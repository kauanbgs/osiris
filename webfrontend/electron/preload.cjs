const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  loadWorkflow: (owner, chatId) => ipcRenderer.invoke("workflow:load", owner, chatId),
  saveWorkflow: (owner, chatId, workflow) => ipcRenderer.invoke("workflow:save", owner, chatId, workflow),
  deleteWorkflow: (owner, chatId) => ipcRenderer.invoke("workflow:delete", owner, chatId),
  // WINDOW CONTROLS
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("window-is-maximized"),

  // FILE SYSTEM
  writeFile: (filePath, content) =>
    ipcRenderer.invoke("fs:write-file", { filePath, content }),
  // Arquivo individual
  selectFile: () =>
    ipcRenderer.invoke("fs:select-file"),

  // Pasta inteira
  selectFolder: () =>
    ipcRenderer.invoke("fs:select-folder"),

  // Pasta de projeto: leitura da arvore e escrita confinada a ela
  selectWorkspace: () => ipcRenderer.invoke("fs:select-workspace"),
  workspaceWrite: (rootPath, relPath, content) =>
    ipcRenderer.invoke("fs:workspace-write", { rootPath, relPath, content }),
  workspaceMkdir: (rootPath, relPath) =>
    ipcRenderer.invoke("fs:workspace-mkdir", { rootPath, relPath }),
  workspaceDelete: (rootPath, relPath) =>
    ipcRenderer.invoke("fs:workspace-delete", { rootPath, relPath }),

  // Sincronizacao com o disco: avisa quando um arquivo muda fora do Osiris
  watchFiles: (watchId, { rootPath, filePaths }) =>
    ipcRenderer.invoke("fs:watch", { watchId, rootPath, filePaths }),
  unwatchFiles: (watchId) => ipcRenderer.invoke("fs:unwatch", watchId),
  scanWorkspace: (rootPath) => ipcRenderer.invoke("fs:scan-workspace", rootPath),
  onFileChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("fs:changed", listener);
    return () => ipcRenderer.removeListener("fs:changed", listener);
  },

  // Ler conteúdo de um arquivo
  readFile: (filePath) =>
    ipcRenderer.invoke("fs:read-file", filePath),

  // TERMINAL CONTROLS
  terminalCreate: (id, mode, cwd) => ipcRenderer.invoke("terminal-create", id, mode, cwd),

  terminalWrite: (id, data) => ipcRenderer.send("terminal-write", id, data),

  terminalResize: (id, cols, rows) =>
    ipcRenderer.send("terminal-resize", { id, cols, rows }),

  terminalClose: (id) => ipcRenderer.send("terminal-close", id),

  onTerminalData: (callback) => {
    const listener = (_event, id, data) => {
      callback(id, data);
    };

    ipcRenderer.on("terminal-data", listener);

    return () => {
      ipcRenderer.removeListener("terminal-data", listener);
    };
  },

  onTerminalExit: (callback) => {
    const listener = (_event, id, exitCode) => {
      callback(id, exitCode);
    };

    ipcRenderer.on("terminal-exit", listener);

    return () => {
      ipcRenderer.removeListener("terminal-exit", listener);
    };
  },

  // BROWSER & ENVIRONMENT
  isElectron: true,
});

contextBridge.exposeInMainWorld("llama", {
  getStatus: () => ipcRenderer.invoke("llama:get-status"),
  listLocalModels: () => ipcRenderer.invoke("llama:list-local-models"),
  loadModel: (modelPath) => ipcRenderer.invoke("llama:load-model", modelPath),
  downloadModel: (url, filename) =>
    ipcRenderer.invoke("llama:download-model", { url, filename }),
  cancelDownload: (url) => ipcRenderer.invoke("llama:cancel-download", url),
  prompt: (payload) => {
    return ipcRenderer.invoke("llama:prompt", payload);
  },
  abort: (requestId) => ipcRenderer.invoke("llama:abort", requestId),
  importFile: () => ipcRenderer.invoke("llama:import-file"),
  deleteModel: (modelPath) =>
    ipcRenderer.invoke("llama:delete-model", modelPath),

  onDownloadProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("llama:download-progress", listener);
    return () =>
      ipcRenderer.removeListener("llama:download-progress", listener);
  },

  onDownloadComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("llama:download-complete", listener);
    return () =>
      ipcRenderer.removeListener("llama:download-complete", listener);
  },

  // Disparado quando outro dispositivo (app mobile) troca o modelo carregado.
  onModelChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on("llama:model-changed", listener);
    return () => ipcRenderer.removeListener("llama:model-changed", listener);
  },

  onStream: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on("llama:stream", listener);

    return () => {
      ipcRenderer.removeListener("llama:stream", listener);
    };
  },
});
