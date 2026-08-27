/**
 * Electron-main directory chooser: abort before and after the modal wait,
 * cancel vs empty vs selected paths, and parenting on the focused window.
 */

import { describe, expect, it, vi } from 'vitest'
import { pickElectronDirectory, type ElectronDirectoryApi } from '../src/electron-dialog.ts'
import { DIALOG_TITLE } from '../src/win32-dialog.ts'

function api(result: { canceled: boolean; filePaths: string[] }, focused: object | null = null): {
  load: () => Promise<ElectronDirectoryApi>
  showOpenDialog: ReturnType<typeof vi.fn>
} {
  const showOpenDialog = vi.fn(async () => result)
  return {
    showOpenDialog,
    load: async () => ({
      dialog: { showOpenDialog },
      BrowserWindow: { getFocusedWindow: () => focused },
    }),
  }
}

const live = (): AbortSignal => new AbortController().signal

describe('pickElectronDirectory', () => {
  it('rejects an already-aborted signal without loading Electron', async () => {
    const load = vi.fn<() => Promise<ElectronDirectoryApi>>()
    const controller = new AbortController()
    controller.abort()
    await expect(pickElectronDirectory(controller.signal, load)).rejects.toThrow('native directory picker aborted')
    expect(load).not.toHaveBeenCalled()
  })

  it('opens the directory chooser on the focused window and returns the path', async () => {
    const window = { id: 1 }
    const { load, showOpenDialog } = api({ canceled: false, filePaths: ['C:\\work'] }, window)
    await expect(pickElectronDirectory(live(), load)).resolves.toBe('C:\\work')
    expect(showOpenDialog).toHaveBeenCalledWith(window, {
      title: DIALOG_TITLE,
      properties: ['openDirectory', 'createDirectory'],
    })
  })

  it('opens without a parent when no window is focused', async () => {
    const { load, showOpenDialog } = api({ canceled: false, filePaths: ['D:\\proj'] })
    await expect(pickElectronDirectory(live(), load)).resolves.toBe('D:\\proj')
    expect(showOpenDialog).toHaveBeenCalledWith(undefined, expect.objectContaining({ title: DIALOG_TITLE }))
  })

  it('maps cancel and a missing path to null', async () => {
    const cancelled = api({ canceled: true, filePaths: ['C:\\ignored'] })
    await expect(pickElectronDirectory(live(), cancelled.load)).resolves.toBeNull()

    const empty = api({ canceled: false, filePaths: [] })
    await expect(pickElectronDirectory(live(), empty.load)).resolves.toBeNull()
  })

  it('rejects when the caller aborts during the modal wait', async () => {
    const controller = new AbortController()
    const showOpenDialog = vi.fn(async () => {
      controller.abort()
      return { canceled: false, filePaths: ['C:\\late'] }
    })
    const load = async (): Promise<ElectronDirectoryApi> => ({
      dialog: { showOpenDialog },
      BrowserWindow: { getFocusedWindow: () => null },
    })
    await expect(pickElectronDirectory(controller.signal, load)).rejects.toThrow('native directory picker aborted')
  })

  it('rejects an already-aborted signal through the default Electron loader', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(pickElectronDirectory(controller.signal)).rejects.toThrow('native directory picker aborted')
  })
})
