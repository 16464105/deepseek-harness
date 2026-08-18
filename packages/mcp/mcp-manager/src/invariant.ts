/** Package-owned invariant companion. @module @deepseek-ai/dsh-mcp-manager/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-mcp-manager'
export const name = 'mcp-manager-invariant'
export const inject = ['invariants']
// No runtime invariant: MCP server configuration is enforced by the settings schema and the manager's route validation.
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
