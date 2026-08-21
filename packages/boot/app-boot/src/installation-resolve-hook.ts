/**
 * Process-wide ESM resolve fallback onto a closed-runtime installation.
 *
 * Loader `resolveImport` converts a config row's bare package name to a file
 * URL. Nested `import` statements inside that module still use Node's ESM
 * resolver. `$DSH_HOME/profiles/node_modules` symlinks into `app.asar` are
 * not readable by `getPackageJSONURL` (the path has no `.asar` segment until
 * the link is followed, and the archive is a file), so an out-of-tree plugin
 * cannot resolve an in-box peer through the parent-walk. This hook retries a
 * failed bare specifier against `createRequire(installAnchor)`, which Electron
 * can resolve inside the archive; the returned `file:` URL contains `.asar`
 * and loads through the same path in-box plugins already use.
 * @module @deepseek-ai/dsh-app-boot/installation-resolve-hook
 */

import module, { createRequire } from 'node:module'
import { isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Node's `ERR_MODULE_NOT_FOUND` from the ESM resolver (not CJS `MODULE_NOT_FOUND`). */
const ERR_MODULE_NOT_FOUND = 'ERR_MODULE_NOT_FOUND'

/** Absolute path or `file:` URL of a file inside the current installation. */
type InstallAnchor = string

type ResolveResult = { url: string; shortCircuit?: boolean }

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => ResolveResult | Promise<ResolveResult>,
) => ResolveResult | Promise<ResolveResult>

const registerHooks = (
  module as typeof module & { registerHooks?: (hooks: { resolve: ResolveHook }) => void }
).registerHooks

let installationRequire: NodeRequire | undefined
let hookInstalled = false

const SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/

function isBarePackage(specifier: string): boolean {
  return !specifier.startsWith('.') && !isAbsolute(specifier) && !SCHEME.test(specifier)
}

function asModuleError(error: unknown): NodeJS.ErrnoException | undefined {
  return error !== null && typeof error === 'object' && 'code' in error
    ? error as NodeJS.ErrnoException
    : undefined
}

function resolveFromInstallation(specifier: string, error: unknown): ResolveResult {
  const code = asModuleError(error)?.code
  if (code !== ERR_MODULE_NOT_FOUND && code !== 'MODULE_NOT_FOUND') throw error
  if (installationRequire === undefined || !isBarePackage(specifier)) throw error
  try {
    return { url: pathToFileURL(installationRequire.resolve(specifier)).href, shortCircuit: true }
  } catch (installationError) {
    // The installation also lacks this specifier; keep the original native
    // failure so the diagnostic names the importer, not this fallback.
    void installationError
    throw error
  }
}

/**
 * ESM resolve hook body: native resolve first, then the current installation.
 * @param specifier - the module specifier being resolved.
 * @param context - Node's resolve context, forwarded to `nextResolve`.
 * @param nextResolve - the next hook (Node's native resolver when this is alone).
 * @returns the resolved module URL.
 */
export function installationResolve(
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => ResolveResult | Promise<ResolveResult>,
): ResolveResult | Promise<ResolveResult> {
  try {
    const result = nextResolve(specifier, context)
    if (result instanceof Promise) {
      return result.catch((error: unknown) => resolveFromInstallation(specifier, error))
    }
    return result
  } catch (error) {
    return resolveFromInstallation(specifier, error)
  }
}

/**
 * Install the process-wide ESM resolve fallback for `installAnchor`.
 *
 * The hook is registered once per process; a later call only replaces the
 * require used on fallback. Node without `module.registerHooks` is a no-op
 * unless `installAnchor` names an `app.asar` path, which then fails loud
 * because packaged out-of-tree plugins cannot resolve in-box peers otherwise.
 * @param installAnchor - absolute path or `file:` URL of a file inside the
 *   installation (the same value `boot` / `mountRootInclude` take as
 *   `bareModuleBaseUrl`).
 */
export function installInstallationResolveHook(installAnchor: InstallAnchor): void {
  installationRequire = createRequire(installAnchor)
  if (hookInstalled) return
  /* v8 ignore next 8 -- Node ^22.19 || >=24 always ships registerHooks; the
   * asar throw is for a packaged host on an older Electron. */
  if (typeof registerHooks !== 'function') {
    if (installAnchor.includes('.asar')) {
      throw new Error(
        'dsh: packaged runtime requires Node module.registerHooks so out-of-tree plugins can resolve installation packages',
      )
    }
    return
  }
  hookInstalled = true
  registerHooks({ resolve: installationResolve })
}
