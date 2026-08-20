/**
 * Child-process entry for the Win32 folder dialog: blocks THIS process
 * inside the modal `Show` so the host event loop stays live, reporting over
 * the IPC channel. Spawned as a child process (not a worker thread) so the
 * dialog is the process's first window and Windows activates it without a
 * manual foreground call. Protocol: `{kind:'showing',threadId}` right
 * before the blocking call (the driver's abort lever needs the native
 * thread id), then exactly one of `{kind:'done',path}` or
 * `{kind:'error',message}`.
 */

import { loadWin32DialogBindings } from './win32-dialog-bindings.ts'
import { runFolderDialog } from './win32-dialog-logic.ts'

/** The driver-to-child payload: the dialog title (passed via env). */
export interface Win32DialogWorkerData { title: string }

/** One notice or outcome posted back to the driver. */
export type Win32DialogWorkerMessage =
  | { kind: 'showing'; threadId: number }
  | { kind: 'done'; path: string | null }
  | { kind: 'error'; message: string }

const title = process.env.DSH_DIALOG_TITLE ?? ''
// node's internal `send` reads `this.connected`, so bind the receiver. A
// missing channel is a spawn misconfiguration that no message can report;
// fail fast with a nonzero exit the driver's exit path surfaces.
const send = process.send?.bind(process)
if (send === undefined) {
  console.error('win32-dialog-worker: spawned without an IPC channel')
  process.exit(1)
}

const post = (message: Win32DialogWorkerMessage): void => {
  const isFinal = message.kind !== 'showing'
  send.call(process, message, () => {
    // Keep IPC open after `showing`; the driver needs it for the final result.
    // On the final message, close the channel from inside the flush callback
    // (the message is already on the pipe), then the disconnect handler
    // below exits the process. A forced process.exit here would race the
    // pipe drain on Windows/Electron; the driver also watches the exit as a
    // backstop.
    /* v8 ignore next 3 -- the live child channel is unavailable in the unit lane. */
    if (isFinal && process.connected) process.disconnect()
  })
}

// A settled driver (or a dead parent) must not orphan a dialog still on screen.
/* v8 ignore next 3 -- the handler exits(0), which would kill the unit lane; built-worker.e2e.ts owns the real disconnect lifecycle. */
process.on('disconnect', () => process.exit(0))

// The driver pipes this child's stderr and attaches it to the error when no
// IPC message ever arrives. Mirror the failure onto stderr AND the IPC
// channel so the driver always learns the real cause: an uncaught exception
// otherwise leaves the process alive with no dialog and no report.
const fail = (error: unknown): void => {
  const text = error instanceof Error ? (error.stack ?? error.message) : String(error)
  console.error(`win32-dialog-worker failed: ${text}`)
  // The channel may already be gone (parent died / closed); sending then
  // throws ERR_IPC_CHANNEL_CLOSED, which would recurse into this handler.
  if (process.connected) {
    post({ kind: 'error', message: text } satisfies Win32DialogWorkerMessage)
  } else {
    // No channel to report through and no handler keeps us alive; the
    // stderr line above is the driver's only trace.
    process.exit(1)
  }
}
process.on('uncaughtException', fail)
process.on('unhandledRejection', fail)

// No top-level await: the built worker ships as CJS, which cannot carry TLA.
void (async () => {
  try {
    if (title === '') throw new Error('win32-dialog-worker: DSH_DIALOG_TITLE is required')
    const bindings = await loadWin32DialogBindings()
    const path = runFolderDialog(bindings, title, (threadId) => {
      post({ kind: 'showing', threadId } satisfies Win32DialogWorkerMessage)
    })
    post({ kind: 'done', path } satisfies Win32DialogWorkerMessage)
  } catch (error: unknown) {
    fail(error)
  }
})()
