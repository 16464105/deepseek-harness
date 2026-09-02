/**
 * Electron-main directory chooser used by the packaged desktop Host.
 *
 * The koffi child-process worker cannot load from `app.asar` (a spawned
 * `ELECTRON_RUN_AS_NODE` process has no archive reader for the worker's
 * own `require('koffi')` once the entry is rewritten into
 * `app.asar.unpacked`). Electron's `dialog.showOpenDialog` runs in the
 * main process and is the Host-display chooser the desktop already owns.
 */

import { DIALOG_TITLE } from './win32-dialog.ts'

/** The slice of Electron's main dialog API this picker calls. */
export interface ElectronDirectoryDialog {
  /** Open a modal directory chooser; `browserWindow` may be omitted. */
  showOpenDialog: (
    browserWindow: object | undefined,
    options: { title: string; properties: ReadonlyArray<'openDirectory' | 'createDirectory'> },
  ) => Promise<{ canceled: boolean; filePaths: string[] }>
}

/** The slice of Electron's `BrowserWindow` this picker reads. */
export interface ElectronDirectoryWindows {
  /** The window that should parent the chooser, if any. */
  getFocusedWindow: () => object | null
}

/** Loaded Electron main bindings used by {@link pickElectronDirectory}. */
export interface ElectronDirectoryApi {
  dialog: ElectronDirectoryDialog
  BrowserWindow: ElectronDirectoryWindows
}

/**
 * Load Electron's main-process dialog bindings.
 * @returns the dialog and window surfaces.
 */
/* v8 ignore next 5 -- Electron is a desktop-host builtin; the loader is a one-line import the unit lane cannot instantiate. */
async function loadElectronDirectoryApi(): Promise<ElectronDirectoryApi> {
  const specifier = 'electron'
  return await import(specifier) as ElectronDirectoryApi
}

/**
 * Open Electron's native directory chooser on the focused window.
 * @param signal - caller lifetime; an already-aborted signal rejects
 *   without opening a dialog. Abort during the modal wait is observed
 *   after the chooser returns.
 * @param load - replaces the Electron main-process import in tests.
 * @returns the selected absolute path, or null when the user cancels.
 */
export async function pickElectronDirectory(
  signal: AbortSignal,
  load: () => Promise<ElectronDirectoryApi> = loadElectronDirectoryApi,
): Promise<string | null> {
  if (signal.aborted) throw new Error('native directory picker aborted')
  const electron = await load()
  const parent = electron.BrowserWindow.getFocusedWindow() ?? undefined
  const result = await electron.dialog.showOpenDialog(parent, {
    title: DIALOG_TITLE,
    properties: ['openDirectory', 'createDirectory'],
  })
  // A dialog await is a suspension point: the caller may abort while it is open.
  // oxlint-disable-next-line typescript/no-unnecessary-condition -- aborted is mutable across the await.
  if (signal.aborted) throw new Error('native directory picker aborted')
  if (result.canceled) return null
  return result.filePaths[0] ?? null
}
