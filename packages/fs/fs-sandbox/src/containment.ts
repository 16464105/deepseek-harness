/**
 * Path-containment mechanics for the filesystem sandbox. Canonical spellings
 * take the fast lexical path; filesystem identity supplies the conservative
 * fallback for alias-equivalent roots such as Windows 8.3 names and casing.
 * @module @deepseek-ai/dsh-fs-sandbox/containment
 */

import type { BigIntStats, Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, sep } from 'node:path'

const MISSING_CODES: ReadonlySet<NodeJS.ErrnoException['code']> = new Set(['ENOENT', 'ENOTDIR'])

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return MISSING_CODES.has(code)
}

/** The exact TypeError Electron's asar stat patch throws when it mixes plain-number fields with a bigint request. */
function isBigIntMixingError(error: unknown): boolean {
  return error instanceof TypeError && error.message.includes('Cannot mix BigInt and other types')
}

function comparablePath(path: string, caseSensitive: boolean): string {
  return caseSensitive ? path : path.toLowerCase()
}

function isLexicallyUnder(path: string, root: string, caseSensitive: boolean): boolean {
  const comparableTarget = comparablePath(path, caseSensitive)
  const comparableRoot = comparablePath(root, caseSensitive)
  if (comparableTarget === comparableRoot) return true
  const prefix = comparableRoot.endsWith(sep) ? comparableRoot : comparableRoot + sep
  return comparableTarget.startsWith(prefix)
}

/** Widen a plain `Stats` to the bigint identity fields containment compares. */
function bigintIdentity(info: Stats): BigIntStats {
  return {
    dev: BigInt(info.dev),
    ino: BigInt(info.ino),
    mode: BigInt(info.mode),
    nlink: BigInt(info.nlink),
    uid: BigInt(info.uid),
    gid: BigInt(info.gid),
    rdev: BigInt(info.rdev),
    size: BigInt(info.size),
    blksize: BigInt(info.blksize),
    blocks: BigInt(info.blocks),
    atimeMs: BigInt(Math.floor(info.atimeMs)),
    mtimeMs: BigInt(Math.floor(info.mtimeMs)),
    ctimeMs: BigInt(Math.floor(info.ctimeMs)),
    birthtimeMs: BigInt(Math.floor(info.birthtimeMs)),
    atimeNs: BigInt(Math.floor(info.atimeMs)) * 1_000_000n,
    mtimeNs: BigInt(Math.floor(info.mtimeMs)) * 1_000_000n,
    ctimeNs: BigInt(Math.floor(info.ctimeMs)) * 1_000_000n,
    birthtimeNs: BigInt(Math.floor(info.birthtimeMs)) * 1_000_000n,
    atime: info.atime,
    mtime: info.mtime,
    ctime: info.ctime,
    birthtime: info.birthtime,
    isFile: () => info.isFile(),
    isDirectory: () => info.isDirectory(),
    isBlockDevice: () => info.isBlockDevice(),
    isCharacterDevice: () => info.isCharacterDevice(),
    isSymbolicLink: () => info.isSymbolicLink(),
    isFIFO: () => info.isFIFO(),
    isSocket: () => info.isSocket(),
  }
}

async function statIfPresent(path: string): Promise<BigIntStats | undefined> {
  try {
    return await stat(path, { bigint: true })
  } catch (error: unknown) {
    // Electron's asar patch cannot serve bigint stats; fall back to the plain
    // form so containment still works for packaged paths.
    if (isBigIntMixingError(error)) {
      try {
        return bigintIdentity(await stat(path))
      } catch (fallbackError: unknown) {
        /* v8 ignore else -- a non-missing stat failure requires a host permission or I/O fault after resolve reached this ancestor. */
        if (isMissing(fallbackError)) return undefined
        /* v8 ignore next -- requires a host permission or I/O fault after resolve already reached this ancestor. */
        throw fallbackError
      }
    }
    /* v8 ignore else -- a non-missing stat failure requires a host permission or I/O fault after resolve reached this ancestor. */
    if (isMissing(error)) return undefined
    /* v8 ignore next -- requires a host permission or I/O fault after resolve already reached this ancestor. */
    throw error
  }
}

function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

/**
 * Determine whether a canonical target is a writable root or lies beneath it.
 * The lexical fast path handles normal canonical spellings. When spellings
 * differ, walk the target's existing ancestors and compare filesystem identity
 * with the root; this recognizes Windows long-name/8.3 aliases and casing
 * without weakening containment to a textual approximation.
 * @param path - canonical target key, which may end in a missing suffix.
 * @param root - canonical writable root.
 * @param caseSensitive - whether lexical comparison preserves case; defaults
 *   to the host filesystem convention used by supported platforms.
 * @returns whether the target is the root or a descendant of it.
 */
export async function isPathUnder(
  path: string,
  root: string,
  caseSensitive = process.platform !== 'win32',
): Promise<boolean> {
  if (isLexicallyUnder(path, root, caseSensitive)) return true

  const rootInfo = await statIfPresent(root)
  if (!rootInfo) return false

  let ancestor = path
  while (true) {
    const ancestorInfo = await statIfPresent(ancestor)
    if (ancestorInfo && sameIdentity(ancestorInfo, rootInfo)) return true
    const parent = dirname(ancestor)
    if (parent === ancestor) return false
    ancestor = parent
  }
}
