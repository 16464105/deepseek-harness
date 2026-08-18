/**
 * Model-facing browser tools over the Playwright session controller. This module
 * owns the tool schemas, the pinned model-facing prose (messages and guidance),
 * and the attachments-conditional screenshot path; the controller owns engine
 * mechanics, and {@link ./types.ts} owns the error taxonomy.
 * @module @deepseek-ai/dsh-browser/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageMediaType } from '@deepseek-ai/dsh-attachment'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { GenericCallView, ToolCallView, ToolExecution } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { BrowserController } from './controller.ts'
import { validateTarget } from './types.ts'

/** Allowed modifier keys for browser_press_key, in a fixed order. */
export const KEY_MODIFIERS = ['Control', 'Meta', 'Shift', 'Alt'] as const

/** Character cap on the snapshot text returned by browser_snapshot. */
export const SNAPSHOT_MAX_CHARS = 200_000

/** Tool-name prefix every browser tool shares (model-visible). */
export const BROWSER_TOOL_PREFIX = 'browser_'

/** Pinned system-prompt guidance registered beside the tools. */
export const BROWSER_GUIDANCE = [
  'The browser tools drive one persistent Chromium page. Use browser_navigate to open an http(s) URL, then browser_snapshot to get the accessibility tree with [ref] markers; interact via browser_click/browser_type/browser_press_key using refs from the last snapshot. Re-run browser_snapshot before acting on elements that may have changed. browser_screenshot returns a viewport PNG to the model when the current model route declares image input.',
].join('\n')

/** Every browser tool mutates or reads the shared page: sibling calls must not interleave. */
function neverConcurrent(): false {
  return false
}

/** One recognized modifier key from browser_press_key arguments. */
function modifierOf(value: string): 'Control' | 'Meta' | 'Shift' | 'Alt' | undefined {
  return KEY_MODIFIERS.find(modifier => modifier.toLowerCase() === value.toLowerCase())
}

/** Validate and normalize browser_press_key arguments. */
function parsePressArgs(args: { key: string; modifiers?: string[] }): { key: string; modifiers: string[] } {
  if (args.key.trim().length === 0) throw new Error('key must be a non-empty string')
  const seen = new Set<string>()
  const modifiers: string[] = []
  /* v8 ignore next -- the undefined-modifiers arm is covered by the registry's optional-array default. */
  for (const raw of args.modifiers ?? []) {
    const modifier = modifierOf(raw)
    if (modifier === undefined) {
      throw new Error(`unknown modifier key "${raw}"; supported modifiers: ${KEY_MODIFIERS.join(', ')}`)
    }
    if (!seen.has(modifier)) {
      seen.add(modifier)
      modifiers.push(modifier)
    }
  }
  return { key: args.key, modifiers }
}

/** Refuse a ref that is absent from the last snapshot (stale or invented). */
function assertCurrentRef(controller: BrowserController, ref: string): void {
  const last = controller.peekLastSnapshot()
  if (last !== undefined && !last.includes(`[ref=${ref}]`)) {
    throw new Error(`ref "${ref}" is not present in the last browser_snapshot; re-run browser_snapshot and use a current [ref]`)
  }
}

/**
 * Format one snapshot value as model-facing text.
 * @param value - the snapshot YAML, page URL, and page title.
 * @returns the `<url>`/`<title>` envelope followed by the snapshot YAML.
 */
export function formatSnapshotOutput(value: { snapshot: string; url: string; title: string }): string {
  return `<url>${value.url}</url>\n<title>${value.title}</title>\n<aria-snapshot>\n${value.snapshot}\n</aria-snapshot>`
}

/** The standing footer on every snapshot result. */
export const SNAPSHOT_FOOTER = 'Use [ref] values from this snapshot in browser_click and browser_type. Re-run browser_snapshot after actions that change the page.'

/** Build the model-facing content blocks for one snapshot value. */
function snapshotContent(value: { snapshot: string; url: string; title: string }): ContentBlock[] {
  const body = value.snapshot.length > SNAPSHOT_MAX_CHARS ? value.snapshot.slice(0, SNAPSHOT_MAX_CHARS) : value.snapshot
  const truncated = value.snapshot.length > SNAPSHOT_MAX_CHARS
  const text = formatSnapshotOutput({ snapshot: body, url: value.url, title: value.title })
    + (truncated ? `\n(Snapshot truncated to ${SNAPSHOT_MAX_CHARS} characters. Use browser_click/browser_type to explore the part you need.)` : '')
    + `\n${SNAPSHOT_FOOTER}`
  return [{ type: 'text', text }]
}

/** The model-facing screenshot envelope text beside its image block. */
function screenshotText(value: { width: number; height: number; bytes: number }): string {
  return `<type>image</type>\n<content>\nimage/png image, ${value.width}x${value.height} px, ${value.bytes} bytes\n</content>`
}

/** Present one pending browser call as a generic card titled by its action. */
/* v8 ignore next 3 -- pure UI display projection; UI adapters exercise it, not the unit lane. */
function presentCall(action: string, detail: string): GenericCallView {
  return { card: 'generic', title: `Browser: ${action}`, rawInput: detail, kind: 'other' }
}

/**
 * Register the core browser tools over the controller. `browser_screenshot`
 * registers separately through {@link applyScreenshotTool} while a durable
 * attachment store is mounted, because its result rides an attachment-backed
 * image block.
 * @param ctx - the context whose `tools` and `systemPrompt` registries receive
 *   the registrations; both are effect-scoped and unregister on dispose.
 * @param controller - the live browser session the tools drive.
 */
export function applyBrowserTools(ctx: Context, controller: BrowserController): void {
  ctx.systemPrompt.section({
    name: 'tool:browser',
    order: 110,
    text: BROWSER_GUIDANCE,
  })

  ctx.tools.register(defineTool({
    name: 'browser_navigate',
    description: 'Navigate the persistent browser page to an absolute http(s) URL. The page persists across calls; use browser_snapshot next to see its accessible contents.',
    parameters: {
      url: { type: 'string', required: true, description: 'Absolute URL to load (http or https).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Navigated to ${value.url}` }],
    },
    // Navigation drives the shared page; concurrent calls would race on it.
    isConcurrencySafe: neverConcurrent,
    async execute(args) {
      const url = validateTarget(args.url)
      await controller.navigate(url)
      return { url }
    },
    /* v8 ignore next -- display-only wrapper around presentCall. */
    presentCall: args => presentCall('navigate', args.url),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_click',
    description: 'Click the element with the given ref from the most recent browser_snapshot. Re-run browser_snapshot first if the page may have changed.',
    parameters: {
      ref: { type: 'string', required: true, description: 'Element ref from the last browser_snapshot (e.g. "e4").' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ref: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Clicked element ${value.ref}. Run browser_snapshot to see the updated page.` }],
    },
    // Clicking the shared page races with sibling calls on it.
    isConcurrencySafe: neverConcurrent,
    async execute(args) {
      assertCurrentRef(controller, args.ref)
      await controller.click(args.ref)
      return { ref: args.ref }
    },
    /* v8 ignore next -- display-only wrapper around presentCall. */
    presentCall: args => presentCall('click', args.ref),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_type',
    description: 'Replace the content of the referenced text field with the given text.',
    parameters: {
      ref: { type: 'string', required: true, description: 'Text-field ref from the last browser_snapshot.' },
      text: { type: 'string', required: true, description: 'The text to enter into the field.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ref: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Typed into element ${value.ref}. Run browser_snapshot to see the updated page.` }],
    },
    // Typing into the shared page races with sibling calls on it.
    isConcurrencySafe: neverConcurrent,
    async execute(args) {
      assertCurrentRef(controller, args.ref)
      await controller.type(args.ref, args.text)
      return { ref: args.ref }
    },
    /* v8 ignore next -- display-only wrapper around presentCall. */
    presentCall: args => presentCall('type', args.ref),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_press_key',
    description: 'Press a key on the current page, optionally with modifier keys (Control, Meta, Shift, Alt).',
    parameters: {
      key: { type: 'string', required: true, description: 'Key to press, e.g. "Enter", "Escape", "ArrowDown", "a".' },
      modifiers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional modifier keys held while pressing, e.g. ["Control", "Shift"].',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          key: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `Pressed ${value.key}. Run browser_snapshot to see the updated page.` }],
    },
    // Keyboard state is per-page; sibling calls would interleave presses.
    isConcurrencySafe: neverConcurrent,
    async execute(args) {
      const parsed = parsePressArgs(args)
      await controller.pressKey(parsed.key, parsed.modifiers)
      return { key: parsed.key }
    },
    /* v8 ignore next -- display-only wrapper around presentCall. */
    presentCall: args => presentCall('press key', args.key),
  }))

  ctx.tools.register(defineTool({
    name: 'browser_snapshot',
    description: 'Return the accessibility snapshot of the current page with [ref] markers for use with browser_click and browser_type, plus the page URL and title.',
    parameters: {
      includeImageRefs: {
        type: 'boolean',
        description: 'Deprecated and ignored; image elements are always included.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          snapshot: { type: 'string', required: true },
          url: { type: 'string', required: true },
          title: { type: 'string', required: true },
        },
      },
      render: (_args, value) => snapshotContent(value),
    },
    // Read-only page observation; the snapshot does not mutate browser state.
    isConcurrencySafe: neverConcurrent,
    async execute() {
      const snap = await controller.snapshot()
      return { snapshot: snap.snapshot, url: snap.url, title: snap.title }
    },
    /* v8 ignore next -- display-only wrapper around presentCall. */
    presentCall: () => presentCall('snapshot', ''),
  }))
}

/** One screenshot execution result shape shared by the tool and its fixtures. */
interface ScreenshotValue {
  url: string
  image: {
    attachmentId: string
    mediaType: ImageMediaType
    bytes: number
    width: number
    height: number
    name: string
  }
}

/** Refuse screenshot execution when the routed model does not declare image input. */
async function assertImageCapableRoute(ctx: Context, exec: ToolExecution): Promise<void> {
  const routed = exec.agent?.session.requestHeader()?.config
  const provider = routed?.provider ?? exec.agent?.options.provider
  const model = routed?.model ?? exec.agent?.options.model
  const llm = ctx.get('llm')
  if (provider === undefined || model === undefined || llm === undefined) {
    throw new Error('cannot capture browser_screenshot: the current model route could not be resolved')
  }
  const active = await llm.resolveModelInfo(provider, model, exec.signal)
  if (active.inputModalities === undefined || !active.inputModalities.includes('image')) {
    throw new Error(`cannot capture browser_screenshot: model "${model}" does not declare image input; switch to an image-capable model to capture screenshots`)
  }
}

/**
 * Register `browser_screenshot`. Only invoked while a durable attachment store
 * is mounted; the screenshot PNG is committed through it before the tool result
 * is appended, exactly like `read_image` commits file bytes.
 * @param ctx - the context whose `tools` registry receives the registration.
 * @param controller - the live browser session.
 */
export function applyScreenshotTool(ctx: Context, controller: BrowserController): void {
  ctx.tools.register(defineTool({
    name: 'browser_screenshot',
    description: 'Capture the current browser page viewport as a PNG image. Requires the current model to accept image input.',
    parameters: {
      includeImage: {
        type: 'boolean',
        description: 'Deprecated and ignored; the screenshot is always returned when the model accepts images.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          image: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              attachmentId: { type: 'string', required: true },
              mediaType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], required: true },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
              name: { type: 'string', required: true },
            },
          },
        },
      },
      render: (_args, value) => {
        return [
          { type: 'text', text: screenshotText(value.image) },
          {
            type: 'image',
            attachment: {
              attachmentId: AttachmentId(value.image.attachmentId),
              mediaType: value.image.mediaType,
              bytes: value.image.bytes,
              width: value.image.width,
              height: value.image.height,
              name: value.image.name,
            },
          },
        ]
      },
    },
    // Page capture races with sibling calls on the shared page.
    isConcurrencySafe: neverConcurrent,
    async execute(_args, exec) {
      const attachments = ctx.get('attachments')
      if (attachments === undefined) {
        throw new Error('cannot capture browser_screenshot: no attachment service is mounted')
      }
      await assertImageCapableRoute(ctx, exec)
      const data = await controller.screenshot()
      // PNG decode dimensions without an image library: read the IHDR width/height.
      const width = readPngWidth(data)
      const height = readPngHeight(data)
      const name = `browser-screenshot-${Date.now()}.png`
      const mediaType: ImageMediaType = 'image/png'
      const ref = await attachments.saveImage({ data, mediaType, name })
      const value: ScreenshotValue = {
        url: '<current page>',
        image: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          width,
          height,
          name,
        },
      }
      return value
    },
    /* v8 ignore next 3 -- display-only wrapper around presentCall. */
    presentCall(): ToolCallView | undefined {
      return presentCall('screenshot', '')
    },
  }))
}

/** Read a big-endian 32-bit field from PNG header bytes; undefined when truncated. */
/* v8 ignore next 2 -- a browser screenshot always emits a complete PNG; the length guard is defensive. */
function readPngUint32(data: Uint8Array, offset: number): number | undefined {
  if (data.length < offset + 4) return undefined
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, false)
}

/** Read the PNG IHDR width field (bytes 16..19, big-endian). */
/* v8 ignore next 4 -- the undefined arm only fires for a truncated PNG, which a browser screenshot never emits. */
function readPngWidth(data: Uint8Array): number {
  const width = readPngUint32(data, 16)
  if (width === undefined) throw new Error('captured screenshot is not a valid PNG (too small)')
  return width
}

/** Read the PNG IHDR height field (bytes 20..23, big-endian). */
/* v8 ignore next 4 -- the undefined arm only fires for a truncated PNG, which a browser screenshot never emits. */
function readPngHeight(data: Uint8Array): number {
  const height = readPngUint32(data, 20)
  if (height === undefined) throw new Error('captured screenshot is not a valid PNG (too small)')
  return height
}
