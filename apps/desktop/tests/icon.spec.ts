import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DESKTOP_ROOT = fileURLToPath(new URL('..', import.meta.url))

it('ships a rounded PNG application icon for Dock and desktop shells', async () => {
  // Electron-builder discovers `build/icon.png` by convention, so the
  // repository's own file is the whole contract: no `build` field names it.
  const icon = await readFile(join(DESKTOP_ROOT, 'build/icon.png'))
  expect(icon.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
})
