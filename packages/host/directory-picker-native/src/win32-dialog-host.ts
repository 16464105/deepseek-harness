/**
 * Real-process half of the Win32 dialog driver: spawn the dialog child
 * process (source or built plane) and close a dialog thread's windows. The
 * module itself loads everywhere (the import chain from native-picker.ts is
 * static); what stays win32-only is koffi, imported dynamically inside the
 * bindings' functions. The driver's logic is tested against fakes of this
 * surface instead.
 */

import { spawn, type StdioOptions } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { Win32DialogWorkerData } from './win32-dialog-worker.ts'

/**
 * Redirect an `app.asar` path into `app.asar.unpacked` for the given
 * platform's path separators. Packaged Electron apps run JavaScript from
 * inside `app.asar`, but a spawned child process cannot load the worker from
 * there (native modules and the CJS entry must live on the real
 * filesystem), so the packager mirrors the entry into `app.asar.unpacked`.
 * Source launches never contain `app.asar`, so the replace is a no-op.
 * @param workerPath - the worker entry path inside the packaged app.
 * @param platform - the host platform; selects the path separator.
 * @returns the worker entry path a child process can actually load.
 */
export function unpackedWorkerPath(workerPath: string, platform: NodeJS.Platform): string {
  const separator = platform === 'win32' ? '\\' : '/'
  return workerPath.replace(`${separator}app.asar${separator}`, `${separator}app.asar.unpacked${separator}`)
}

/**
 * Resolve the dialog worker's built entry next to this module, redirecting
 * it out of `app.asar` for the current platform.
 * @returns the worker entry path a child process can actually load.
 */
export function workerPath(): string {
  return unpackedWorkerPath(fileURLToPath(new URL('./worker.cjs', import.meta.url)), process.platform)
}

/**
 * Spawn the dialog child process. Built consumers launch the bundled CJS
 * entry next to this module under plain node; unbuilt (source) consumers
 * bootstrap tsx first, mirroring the dsh CLI's source launch. The dialog is
 * the child's first window, so Windows activates it without a foreground
 * call.
 * @param data - the child payload (dialog title).
 * @returns the spawned child process.
 */
export function spawnDialogWorker(data: Win32DialogWorkerData): ReturnType<typeof spawn> {
  const env = { ...process.env, DSH_DIALOG_TITLE: data.title, ELECTRON_RUN_AS_NODE: '1' }
  // stderr is piped so the driver can attach the child's real failure to
  // its error when the worker dies without an IPC message (the packaged
  // desktop has no console to inherit into). stdout is unused.
  const stdio: StdioOptions = ['ignore', 'ignore', 'pipe', 'ipc']
  /* v8 ignore next 3 -- the built-output arm: tests always run unbuilt (src/) */
  if (!import.meta.url.endsWith('.ts')) {
    return spawn(process.execPath, [workerPath()], { env, stdio, windowsHide: true })
  }
  return spawn(process.execPath, ['--import', import.meta.resolve('tsx/esm'), fileURLToPath(new URL('./win32-dialog-worker.ts', import.meta.url))], { env, stdio, windowsHide: true })
}

export { closeThreadWindows } from './win32-dialog-bindings.ts'
