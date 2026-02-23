import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { spawn } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !app.isPackaged

let mainWindow
let serverProcess

function startServer() {
    const serverPath = isDev
        ? path.join(__dirname, 'server.js')
        : path.join(process.resourcesPath, 'app', 'server.js')
    serverProcess = spawn(process.execPath, [serverPath], {
        env: { ...process.env, PORT: '3001' },
        stdio: 'inherit'
    })
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#06090f',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0c111c',
            symbolColor: '#7e97b8',
            height: 32
        },
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: 'NetScanner AI'
    })

    const url = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, 'dist', 'index.html')}`
    mainWindow.loadURL(url)

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url)
        return { action: 'deny' }
    })
}

app.whenReady().then(() => {
    if (!isDev) startServer()
    // In dev, user runs `npm run dev` which starts both server and vite
    setTimeout(createWindow, isDev ? 0 : 2000)
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill()
    if (process.platform !== 'darwin') app.quit()
})
