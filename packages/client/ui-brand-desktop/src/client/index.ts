/**
 * Desktop brand plugin, browser half: the fork's whale mark and product name
 * as occupants of the generic sidebar brand slots.
 *
 * The official occupant registers at the default priority, so this plugin
 * registers below it and wins the single-slot election without editing the
 * official package or the shared locale dictionaries.
 * @module @deepseek-ai/dsh-client-ui-brand-desktop/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { DesktopBrandMark, DesktopBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * Priority below the official occupant's default, so this deployment's mark
 * and name render instead of the upstream artwork.
 */
export const BRAND_PRIORITY = -10

/**
 * Fill the sidebar brand slots with this deployment's artwork.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register(
        { name: 'sidebar.brand.mark', priority: BRAND_PRIORITY },
        DesktopBrandMark,
      )
      yield ctx.slots.register(
        { name: 'sidebar.brand.name', priority: BRAND_PRIORITY },
        DesktopBrandName,
      )
    }))
}
