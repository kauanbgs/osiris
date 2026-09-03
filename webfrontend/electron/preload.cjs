const {
  contextBridge,
  ipcRenderer
} = require('electron')

contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    // WINDOW CONTROLS
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // TERMINAL CONTROLS
    terminalCreate: (id, mode) =>
      ipcRenderer.invoke('terminal-create', id, mode),

    terminalWrite: (id, data) =>
      ipcRenderer.send('terminal-write', id, data),

    terminalResize: (id, cols, rows) =>
      ipcRenderer.send('terminal-resize', { id, cols, rows }),

    terminalClose: (id) =>
      ipcRenderer.send('terminal-close', id),

    onTerminalData: (callback) => {
      const listener = (_event, id, data) => {
        callback(id, data)
      }

      ipcRenderer.on('terminal-data', listener)

      return () => {
        ipcRenderer.removeListener('terminal-data', listener)
      }
    },

    onTerminalExit: (callback) => {
      const listener = (_event, id, exitCode) => {
        callback(id, exitCode)
      }

      ipcRenderer.on('terminal-exit', listener)

      return () => {
        ipcRenderer.removeListener('terminal-exit', listener)
      }
    }
  }
)

contextBridge.exposeInMainWorld('llama', {
  getStatus: () => ipcRenderer.invoke('llama:get-status'),
  listLocalModels: () => ipcRenderer.invoke('llama:list-local-models'),
  loadModel: (modelPath) => ipcRenderer.invoke('llama:load-model', modelPath),
  downloadModel: (url, filename) => ipcRenderer.invoke('llama:download-model', { url, filename }),
  cancelDownload: (url) => ipcRenderer.invoke('llama:cancel-download', url),
  prompt: (text) => ipcRenderer.invoke('llama:prompt', text),
  importFile: () => ipcRenderer.invoke('llama:import-file'),
  deleteModel: (modelPath) => ipcRenderer.invoke('llama:delete-model', modelPath),

  onDownloadProgress: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('llama:download-progress', listener)
    return () => ipcRenderer.removeListener('llama:download-progress', listener)
  },

  onDownloadComplete: (callback) => {
    const listener = (_event, data) => callback(data)
    ipcRenderer.on('llama:download-complete', listener)
    return () => ipcRenderer.removeListener('llama:download-complete', listener)
  },

  prompt: (prompt) => {
    return ipcRenderer.invoke("llama:prompt", prompt);
  },

  onStream: (callback) => {
    const listener = (_event, data) => {
      callback(data);
    };

    ipcRenderer.on("llama:stream", listener);

    return () => {
      ipcRenderer.removeListener(
        "llama:stream",
        listener
      );
    };
  },
})