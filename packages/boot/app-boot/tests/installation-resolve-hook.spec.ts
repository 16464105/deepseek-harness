/**
 * Process-wide ESM resolve fallback: an importer outside the installation
 * still loads a package that only the installation can see.
 *
 * Successful and missing-package imports run in a child `node --import tsx/esm`
 * process. Vitest's module runner does not invoke `module.registerHooks`, so
 * an in-process `import()` would not exercise the hook the packaged Host uses.
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { installationResolve, installInstallationResolveHook } from '../src/installation-resolve-hook.ts'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'dsh-install-hook-'))
const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url))
const hookUrl = pathToFileURL(fileURLToPath(new URL('../src/installation-resolve-hook.ts', import.meta.url))).href
const tsconfigPath = join(repoRoot, 'tsconfig.json')

function importUnderHook(installAnchor: string, moduleUrl: string): { status: number | null; stdout: string; stderr: string } {
  const script = `
    import { installInstallationResolveHook } from ${JSON.stringify(hookUrl)}
    installInstallationResolveHook(${JSON.stringify(installAnchor)})
    const mod = await import(${JSON.stringify(moduleUrl)})
    console.log(JSON.stringify({ marker: mod.marker ?? null }))
  `
  return spawnSync(process.execPath, ['--import', 'tsx/esm', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    cwd: repoRoot,
    env: { ...process.env, TSX_TSCONFIG_PATH: tsconfigPath },
  })
}

function stageIsolatedPeer(): { installAnchor: string; pluginUrl: string; marker: string; missingUrl: string } {
  const root = tmp()
  const marker = `dsh-install-hook-peer-${randomBytes(8).toString('hex')}`
  const installDir = join(root, 'install')
  const peerDir = join(installDir, 'node_modules', marker)
  mkdirSync(peerDir, { recursive: true })
  writeFileSync(join(installDir, 'package.json'), JSON.stringify({
    name: 'dsh-install-hook-app',
    type: 'module',
    dependencies: { [marker]: '1.0.0' },
  }))
  writeFileSync(join(peerDir, 'package.json'), JSON.stringify({
    name: marker,
    type: 'module',
    exports: { '.': './index.js' },
  }))
  writeFileSync(join(peerDir, 'index.js'), `export const marker = ${JSON.stringify(marker)}\n`)
  const pluginDir = join(root, 'plugin')
  mkdirSync(pluginDir, { recursive: true })
  writeFileSync(join(pluginDir, 'package.json'), JSON.stringify({ name: 'dsh-install-hook-plugin', type: 'module' }))
  writeFileSync(join(pluginDir, 'index.js'), `import { marker } from ${JSON.stringify(marker)}\nexport { marker }\n`)
  writeFileSync(join(pluginDir, 'missing.js'), 'import "dsh-install-hook-absent-package"\n')
  return {
    installAnchor: join(installDir, 'package.json'),
    pluginUrl: pathToFileURL(join(pluginDir, 'index.js')).href,
    marker,
    missingUrl: pathToFileURL(join(pluginDir, 'missing.js')).href,
  }
}

describe('installInstallationResolveHook', { concurrent: false }, () => {
  it('leaves an installation-only peer unresolved until the hook is installed', async () => {
    const staged = stageIsolatedPeer()
    const notFound = Object.assign(new Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' })
    expect(() => installationResolve(staged.marker, undefined, () => { throw notFound })).toThrow(notFound)
    await expect(import(staged.pluginUrl)).rejects.toMatchObject({ code: 'ERR_MODULE_NOT_FOUND' })
  })

  it('resolves an installation-only peer from an out-of-tree importer', () => {
    const staged = stageIsolatedPeer()
    const result = importUnderHook(staged.installAnchor, staged.pluginUrl)
    expect(result.stderr, result.stderr).not.toMatch(/ERR_MODULE_NOT_FOUND|Cannot find package/)
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ marker: staged.marker })
  })

  it('still fails when the installation also lacks the package', () => {
    const staged = stageIsolatedPeer()
    const result = importUnderHook(staged.installAnchor, staged.missingUrl)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/Cannot find package 'dsh-install-hook-absent-package'/)
  })

  it('retries a failed bare specifier against the current installation', () => {
    const staged = stageIsolatedPeer()
    installInstallationResolveHook(staged.installAnchor)
    installInstallationResolveHook(staged.installAnchor)
    const native = Object.assign(new Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' })
    const resolved = installationResolve('unused', undefined, (specifier) => {
      if (specifier === staged.marker) throw native
      return { url: 'file:///native-win' }
    })
    expect(resolved).toEqual({ url: 'file:///native-win' })
    expect(installationResolve(staged.marker, undefined, () => {
      throw native
    })).toMatchObject({
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- partial-match expectation for a resolved file URL.
      url: expect.stringContaining(staged.marker),
      shortCircuit: true,
    })
  })

  it('does not retry relative, absolute, scheme, or non-not-found failures', () => {
    const staged = stageIsolatedPeer()
    installInstallationResolveHook(staged.installAnchor)
    const notFound = Object.assign(new Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' })
    expect(() => installationResolve('./rel', undefined, () => { throw notFound })).toThrow(notFound)
    expect(() => installationResolve('/abs', undefined, () => { throw notFound })).toThrow(notFound)
    expect(() => installationResolve('node:fs', undefined, () => { throw notFound })).toThrow(notFound)
    const other = Object.assign(new Error('denied'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' })
    expect(() => installationResolve(staged.marker, undefined, () => { throw other })).toThrow(other)
    expect(() => installationResolve(staged.marker, undefined, () => { throw 'string-error' })).toThrow('string-error')
    try {
      void installationResolve(staged.marker, undefined, () => { throw null })
      expect.unreachable('null error')
    } catch (error) {
      expect(error).toBeNull()
    }
    const opaque = { foo: 1 }
    try {
      void installationResolve(staged.marker, undefined, () => { throw opaque })
      expect.unreachable('opaque error')
    } catch (error) {
      expect(error).toBe(opaque)
    }
    expect(() => installationResolve('dsh-install-hook-absent-package', undefined, () => { throw notFound })).toThrow(notFound)
    const cjsMiss = Object.assign(new Error('cjs'), { code: 'MODULE_NOT_FOUND' })
    expect(installationResolve(staged.marker, undefined, () => { throw cjsMiss }))
      .toMatchObject({
        // oxlint-disable-next-line typescript/no-unsafe-assignment -- partial-match expectation for a resolved file URL.
        url: expect.stringContaining(staged.marker),
        shortCircuit: true,
      })
  })

  it('retries after a rejected nextResolve promise', async () => {
    const staged = stageIsolatedPeer()
    installInstallationResolveHook(staged.installAnchor)
    const notFound = Object.assign(new Error('missing'), { code: 'ERR_MODULE_NOT_FOUND' })
    await expect(installationResolve('file:///ok', undefined, async () => ({ url: 'file:///ok' })))
      .resolves.toEqual({ url: 'file:///ok' })
    await expect(installationResolve(staged.marker, undefined, async () => { throw notFound }))
      .resolves.toMatchObject({ url: expect.stringContaining(staged.marker) as unknown as string, shortCircuit: true })
  })
})
