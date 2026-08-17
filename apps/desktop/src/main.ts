/** Electron application shell for the DeepSeek Harness desktop profile. */

import { join } from 'node:path'
import { inspect } from 'node:util'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'
import { runProfile, type RunProfileOptions } from '@deepseek-ai/dsh/profile-boot'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { isApplicationNavigation, isExternalWebUrl } from './navigation.ts'

const PROFILE = 'desktop'
let mainWindow: BrowserWindow | undefined
let host: Awaited<ReturnType<typeof runProfile>> | undefined
let quitting = false

function focusWindow(): void {
  if (mainWindow === undefined) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function secureWindow(url: string): BrowserWindow {
  const applicationOrigin = new URL(url).origin
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#ffffff',
    title: 'DeepSeek Harness',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (isExternalWebUrl(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    if (!isApplicationNavigation(target, applicationOrigin)) event.preventDefault()
  })
  window.once('ready-to-show', () => { window.show() })
  window.on('closed', () => { mainWindow = undefined })
  return window
}

function webServerOf(active: Awaited<ReturnType<typeof runProfile>>): WebServer | undefined {
  return active.ctx.get<'webServer'>('webServer')
}

async function startHost(): Promise<string> {
  process.env.DSH_HOME ??= join(app.getPath('userData'), 'harness')
  process.chdir(app.getPath('home'))
  const options: RunProfileOptions = {
    environment: loadLayeredEnv('dsh-desktop'),
    profile: PROFILE,
    patchFiles: [],
    args: [],
    watchUserPatches: false,
  }
  host = await runProfile(options)
  const webServer = webServerOf(host)
  if (webServer === undefined) throw new Error('desktop: webServer did not mount')
  return `http://127.0.0.1:${String(webServer.port)}`
}

async function launch(): Promise<void> {
  const url = await startHost()
  mainWindow = secureWindow(url)
  await mainWindow.loadURL(url)
}

async function stopHost(): Promise<void> {
  const active = host
  host = undefined
  await active?.ctx.fiber.dispose()
}

const primary = app.requestSingleInstanceLock()
if (!primary) {
  app.quit()
} else {
  app.on('second-instance', focusWindow)
  app.on('activate', () => {
    if (mainWindow === undefined && host !== undefined) {
      const webServer = webServerOf(host)
      if (webServer !== undefined) {
        const url = `http://127.0.0.1:${String(webServer.port)}`
        mainWindow = secureWindow(url)
        void mainWindow.loadURL(url)
      }
    } else {
      focusWindow()
    }
  })
  app.on('window-all-closed', () => { app.quit() })
  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void stopHost().finally(() => { app.exit(0) })
  })
  void app.whenReady().then(launch).catch(async (error: unknown) => {
    console.error(inspect(error, { depth: 8, maxArrayLength: 20 }))
    await dialog.showMessageBox({
      type: 'error',
      title: 'DeepSeek Harness could not start',
      message: error instanceof Error ? error.message : String(error),
    })
    app.quit()
  })
}
