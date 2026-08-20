/**
 * Containment tests for lexical canonical paths and filesystem-identity aliases.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, parse } from 'node:path'
import { isPathUnder } from '../src/containment.ts'

let base: string

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'dsh-fssbx-containment-'))
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

describe('filesystem sandbox containment', () => {
  it('accepts equal paths, descendants, and a filesystem-root boundary', async () => {
    expect(await isPathUnder(base, base)).toBe(true)
    expect(await isPathUnder(join(base, 'child'), base)).toBe(true)
    expect(await isPathUnder(base, parse(base).root)).toBe(true)
  })

  it('uses case-insensitive lexical comparison for Windows-style containment', async () => {
    expect(await isPathUnder(join(base.toUpperCase(), 'child'), base.toLowerCase(), false)).toBe(true)
    expect(await isPathUnder(join(base, 'case-sensitive-child'), base, true)).toBe(true)
  })

  it('recognizes an alias-equivalent root by filesystem identity for a missing target', async () => {
    const realRoot = join(base, 'real')
    const aliasRoot = join(base, 'alias')
    await mkdir(realRoot)
    await symlink(realRoot, aliasRoot)
    expect(await isPathUnder(join(await realpath(realRoot), 'missing', 'file.txt'), aliasRoot)).toBe(true)
  })

  it('denies unrelated and missing roots', async () => {
    const allowed = join(base, 'allowed')
    const outside = join(base, 'outside')
    await mkdir(allowed)
    await mkdir(outside)
    expect(await isPathUnder(join(outside, 'file.txt'), allowed)).toBe(false)
    expect(await isPathUnder(join(outside, 'file.txt'), join(base, 'missing-root'))).toBe(false)
  })

  it('treats a regular-file path segment as a missing target, not containment', async () => {
    const allowed = join(base, 'allowed')
    const blocker = join(base, 'blocker')
    await mkdir(allowed)
    await writeFile(blocker, 'not a directory')
    expect(await isPathUnder(join(blocker, 'child.txt'), allowed)).toBe(false)
  })

  it('falls back to plain stat when bigint stat fails like Electron asar', async () => {
    const allowed = join(base, 'allowed')
    const realRoot = join(base, 'real')
    const aliasRoot = join(base, 'alias')
    await mkdir(allowed)
    await mkdir(realRoot)
    await symlink(realRoot, aliasRoot)
    vi.resetModules()
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...actual,
        async stat(path: string, opts?: { bigint?: boolean }) {
          if (opts?.bigint) throw new TypeError('Cannot mix BigInt and other types, use explicit conversions')
          return await actual.stat(path)
        },
      }
    })

    try {
      const { isPathUnder: isolatedIsPathUnder } = await import('../src/containment.ts')
      expect(await isolatedIsPathUnder(join(await realpath(realRoot), 'missing', 'file.txt'), aliasRoot)).toBe(true)
    } finally {
      vi.doUnmock('node:fs/promises')
      vi.resetModules()
    }
  })
})
