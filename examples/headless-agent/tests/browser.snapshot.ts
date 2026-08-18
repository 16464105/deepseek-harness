/**
 * Keyless browser-tools snapshot: boots the shipped headless profile with the
 * browser tools enabled and a deterministic mock adapter, drives
 * browser_navigate → browser_snapshot against a loopback fixture page in the
 * real Playwright Chromium, and pins the model-visible output. The snapshot
 * runner's CI lane installs Playwright Chromium, and the scenario skips when
 * no browser binary is available, so a developer machine without the install
 * stays green.
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

/** Playwright's chromium lookup roots; presence proves a binary without launching. */
function chromiumInstalled(): boolean {
  const candidates = [
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
    join(homedir(), '.cache', 'ms-playwright'),
  ]
  return candidates.some(root => existsSync(root))
}

const maybe = chromiumInstalled() ? describe : describe.skip

const dshBinScript = fileURLToPath(new URL('../../../apps/cli/src/bin.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const browserOverlayPath = fileURLToPath(new URL('./fixtures/browser.cordis.snapshot.yml', import.meta.url))
const browserMockLlmPath = fileURLToPath(new URL('./fixtures/browser-mock-llm.ts', import.meta.url))

/** Install the keyless adapter into the temporary headless profile. */
async function prepareBrowserMockFixture(cwd: string): Promise<void> {
  const fixtureDir = join(cwd, '.dsh', 'profiles', 'headless', 'snapshot-fixtures')
  await mkdir(fixtureDir, { recursive: true })
  await writeFile(join(fixtureDir, 'browser-mock-llm.ts'), await import('node:fs/promises').then(fs => fs.readFile(browserMockLlmPath, 'utf8')))
  await writeFile(join(fixtureDir, 'package.json'), '{"type":"module"}\n')
}

let fixtureServer: Server
let fixtureUrl: string

maybe('headless browser-tools snapshot', () => {
  it('drives the real Chromium through browser_navigate and browser_snapshot', async () => {
    fixtureServer = createServer((_req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body><h1>BROWSER FIXTURE</h1></body></html>')
    })
    await new Promise<void>(resolve => fixtureServer.listen(0, '127.0.0.1', resolve))
    const address = fixtureServer.address()
    if (address === null || typeof address === 'string') throw new Error('browser fixture server has no port')
    fixtureUrl = `http://127.0.0.1:${address.port}`

    try {
      const result = await runLoaderSmoke({
        label: 'headless browser-tools snapshot',
        tempDirPrefix: 'headless-browser-snapshot-',
        binScript: dshBinScript,
        configPath: browserOverlayPath,
        binArgs: ['--profile', 'headless', '--patch', browserOverlayPath, 'Open the browser fixture and describe it.'],
        tsconfigPath,
        env: {
          DSH_BROWSER_FIXTURE_URL: fixtureUrl,
          DSH_PERMISSION_MODE: 'danger-full-access',
          DSH_TELEMETRY_DISABLED: '1',
        },
        prepare: prepareBrowserMockFixture,
      })
      expect(result.stdout).toContain('BROWSER_SNAPSHOT_OK:heading-seen')
      expect(result.stderr).toBe('')
    } finally {
      await new Promise<void>(resolve => fixtureServer.close(() => { resolve() }))
    }
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
