const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')
const pty = require('node-pty')

const terminals = new Map()

// Llama.cpp State
let llamaInstance = null
let currentModel = null
let currentSession = null
let activeModelPath = null
const activeDownloads = new Map()

async function getLlamaModule() {
  if (!llamaInstance) {
    const { getLlama } = await import('node-llama-cpp')
    llamaInstance = await getLlama()
  }
  return llamaInstance
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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    for (const [id, terminal] of terminals.entries()) {
      terminal.kill()
    }
    terminals.clear()
  })
}

// ===============================
// LLAMA.CPP & MODEL IPC HANDLERS
// ===============================

function getModelsDir() {
  const modelsDir = path.join(os.homedir(), '.osiris', 'models')
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true })
  }
  return modelsDir
}

ipcMain.handle('llama:get-status', () => {
  return {
    isLoaded: Boolean(currentSession),
    activeModelPath: activeModelPath,
    activeModelName: activeModelPath ? path.basename(activeModelPath) : null
  }
})

ipcMain.handle('llama:list-local-models', () => {
  const modelsDir = getModelsDir()
  const files = fs.readdirSync(modelsDir)
  const models = []

  for (const filename of files) {
    if (filename.endsWith('.gguf')) {
      const fullPath = path.join(modelsDir, filename)
      const stats = fs.statSync(fullPath)
      models.push({
        filename,
        fullPath,
        sizeBytes: stats.size,
        sizeMB: (stats.size / (1024 * 1024)).toFixed(1),
        sizeGB: (stats.size / (1024 * 1024 * 1024)).toFixed(2),
        isActive: activeModelPath === fullPath
      })
    }
  }

  return models
})

ipcMain.handle('llama:load-model', async (_, modelPath) => {
  try {
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Arquivo de modelo não encontrado: ${modelPath}`)
    }

    const llama = await getLlamaModule()
    const { LlamaChatSession } = await import('node-llama-cpp')

    if (currentModel) {
      try {
        await currentModel.dispose()
      } catch (err) {
        console.error('Erro ao descartar modelo antigo:', err)
      }
    }

    currentModel = await llama.loadModel({
      modelPath: modelPath
    })

    const context = await currentModel.createContext()
    currentSession = new LlamaChatSession({
      contextSequence: context.getSequence()
    })

    activeModelPath = modelPath

    return {
      success: true,
      activeModelPath,
      activeModelName: path.basename(modelPath)
    }
  } catch (err) {
    console.error('Erro ao carregar modelo:', err)
    throw new Error(err.message || 'Falha ao carregar o modelo GGUF')
  }
})

ipcMain.handle('llama:prompt', async (_, promptText) => {
  if (!currentSession) {
    throw new Error('Nenhum modelo GGUF está carregado. Vá para a aba "Modelos" para carregar ou baixar um modelo.')
  }
  try {
    const response = await currentSession.prompt(promptText)
    return response
  } catch (err) {
    console.error('Erro na geração de resposta Llama:', err)
    throw new Error(err.message || 'Erro durante a inferência do modelo')
  }
})

ipcMain.handle('llama:download-model', async (event, { url, filename }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const modelsDir = getModelsDir()
  const destinationPath = path.join(modelsDir, filename)
  const tempPath = destinationPath + '.tmp'

  if (fs.existsSync(destinationPath)) {
    return { success: true, modelPath: destinationPath, alreadyExists: true }
  }

  try {
    const response = await fetch(url, { redirect: 'follow' })
    if (!response.ok) {
      throw new Error(`Erro de download HTTP ${response.status}: ${response.statusText}`)
    }

    const contentLength = response.headers.get('content-length')
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
    let downloadedBytes = 0

    const fileStream = fs.createWriteStream(tempPath)
    const reader = response.body.getReader()

    activeDownloads.set(url, { tempPath, reader })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      downloadedBytes += value.length
      fileStream.write(Buffer.from(value))

      const progress = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0

      if (win && !win.isDestroyed()) {
        win.webContents.send('llama:download-progress', {
          url,
          filename,
          downloadedBytes,
          totalBytes,
          progress
        })
      }
    }

    fileStream.end()
    fs.renameSync(tempPath, destinationPath)
    activeDownloads.delete(url)

    if (win && !win.isDestroyed()) {
      win.webContents.send('llama:download-complete', {
        url,
        filename,
        modelPath: destinationPath
      })
    }

    return { success: true, modelPath: destinationPath }
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath) } catch (e) {}
    }
    activeDownloads.delete(url)
    console.error('Erro no download do modelo:', err)
    throw new Error(err.message || 'Falha no download do modelo')
  }
})

ipcMain.handle('llama:cancel-download', (_, url) => {
  const item = activeDownloads.get(url)
  if (item) {
    try {
      item.reader?.cancel()
    } catch (e) {}
    if (fs.existsSync(item.tempPath)) {
      try { fs.unlinkSync(item.tempPath) } catch (e) {}
    }
    activeDownloads.delete(url)
    return true
  }
  return false
})

ipcMain.handle('llama:import-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showOpenDialog(win, {
    title: 'Selecionar modelo .GGUF',
    filters: [{ name: 'Modelos GGUF', extensions: ['gguf'] }],
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const selectedPath = result.filePaths[0]
  const filename = path.basename(selectedPath)
  const modelsDir = getModelsDir()
  const targetPath = path.join(modelsDir, filename)

  if (selectedPath !== targetPath && !fs.existsSync(targetPath)) {
    fs.copyFileSync(selectedPath, targetPath)
  }

  return {
    filename,
    fullPath: targetPath
  }
})

ipcMain.handle('llama:delete-model', async (_, modelPath) => {
  if (activeModelPath === modelPath) {
    if (currentModel) {
      try { await currentModel.dispose() } catch (e) {}
      currentModel = null
      currentSession = null
      activeModelPath = null
    }
  }

  if (fs.existsSync(modelPath)) {
    fs.unlinkSync(modelPath)
  }
  return true
})

// ===============================
// TERMINAL IPC HANDLERS
// ===============================

ipcMain.handle('terminal-create', (event, id, mode) => {
  if (!id || terminals.has(id)) return

  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return

  const shell =
    process.platform === 'win32'
      ? 'powershell.exe'
      : process.env.SHELL || '/bin/bash'

  const terminal = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: os.homedir(),
    env: {
      ...process.env,
      TERM: 'xterm-256color'
    }
  })

  terminals.set(id, terminal)

  terminal.onData((data) => {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal-data', id, data)
    }
  })

  terminal.onExit(({ exitCode }) => {
    terminals.delete(id)
    if (!win.isDestroyed()) {
      win.webContents.send('terminal-exit', id, exitCode)
    }
  })

  if (mode === 'claude') {
    setTimeout(() => {
      terminal.write('claude\r')
    }, 400)
  }
})

ipcMain.on('terminal-write', (event, id, data) => {
  if (!id) return
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.write(data)
  }
})

ipcMain.on('terminal-resize', (event, payload) => {
  const id = payload?.id
  const cols = payload?.cols
  const rows = payload?.rows

  if (!id) return
  const terminal = terminals.get(id)
  if (!terminal) return

  if (
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    cols > 0 &&
    rows > 0
  ) {
    terminal.resize(cols, rows)
  }
})

ipcMain.on('terminal-close', (event, id) => {
  if (!id) return
  const terminal = terminals.get(id)
  if (terminal) {
    terminal.kill()
    terminals.delete(id)
  }
})

// ===============================
// WINDOW CONTROLS IPC HANDLERS
// ===============================

ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

ipcMain.handle('window-is-maximized', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win?.isMaximized() ?? false
})

// ===============================
// APP LIFECYCLE
// ===============================

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  for (const terminal of terminals.values()) {
    terminal.kill()
  }
  terminals.clear()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})