// Web e2e scenario: the Tencent provider projects its package-owned fixed
// model catalog through the real Host model directory into the composer's
// model picker, and the final round uses the real Host/session/attachment/
// provider chain while replacing only the external Tencent fetch response.
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import * as TencentCodeBuddy from '@deepseek-ai/dsh-llm-tencent-codebuddy'
import {
  assertFixtureInventory,
  captureStableAria,
  compareOrRefreshGolden,
  launchWebScaffold,
  watchConsole,
  webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE, connectFreshWorkspaceZh, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/tencent-codebuddy-models', import.meta.url))
const UI_EXPECTED = join(SNAPSHOT_DIR, 'ui.expected.md')
const IMAGE_REQUIRED_EXPECTED = join(SNAPSHOT_DIR, 'image-required.expected.md')
const IMAGE_ROUND_EXPECTED = join(SNAPSHOT_DIR, 'image-round.expected.md')
const MODE = webSnapshotMode()

const IMAGE_PROMPT = '请只回答图片中的文字。'
const IMAGE_REPLY = '探索未至之境 预览版'

interface TencentWireMessage {
  role?: unknown
  content?: unknown
}

function contentParts(message: TencentWireMessage): Record<string, unknown>[] {
  return Array.isArray(message.content)
    ? message.content.filter((part): part is Record<string, unknown> => (
      typeof part === 'object' && part !== null && !Array.isArray(part)
    ))
    : []
}

describe.skipIf(MODE === 'record')('web e2e: Tencent models come from the package-owned fixed catalog', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  let originalFetch: typeof globalThis.fetch | undefined
  let tencentPayload: { messages?: TencentWireMessage[] } | undefined

  beforeAll(async () => {
    scaffold = await launchWebScaffold({ agentInstructions: true })
    await scaffold.ctx.plugin(TencentCodeBuddy, {})
    await scaffold.ctx.credentials.set(
      credentialRef(TencentCodeBuddy.TENCENT_CODEBUDDY_API_KEY),
      'test-codebuddy-key',
    )
    const workspace = join(scaffold.workspaceCwd, 'workspace')
    await mkdir(workspace, { recursive: true })
    await writeFile(join(workspace, 'AGENTS.md'), 'codebuddy-image-context-probe\n')

    const hostFetch = globalThis.fetch
    originalFetch = hostFetch
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (!url.startsWith(TencentCodeBuddy.TENCENT_CODEBUDDY_BASE_URL)) {
        return await hostFetch(input, init)
      }
      const raw = typeof init?.body === 'string'
        ? init.body
        : input instanceof Request
          ? await input.clone().text()
          : undefined
      if (raw === undefined) throw new Error('Tencent e2e request carried no JSON body')
      tencentPayload = JSON.parse(raw) as { messages?: TencentWireMessage[] }
      const events = [
        'data: {"choices":[{"delta":{"role":"assistant","content":null,"reasoning_content":""}}]}',
        `data: ${JSON.stringify({ choices: [{ delta: { content: IMAGE_REPLY } }] })}`,
        'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":8}}',
        'data: [DONE]',
      ]
      const encoder = new TextEncoder()
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(`${event}\n\n`))
            await new Promise(resolve => setTimeout(resolve, 25))
          }
          controller.close()
        },
      })
      return new Response(body, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      })
    }
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    const failures: unknown[] = []
    if (originalFetch !== undefined) globalThis.fetch = originalFetch
    await browser?.close().catch((error: unknown) => failures.push(error))
    await scaffold?.close().catch((error: unknown) => failures.push(error))
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, 'Tencent model snapshot teardown failed')
  })

  it('offers the fixed catalog models in the picker', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-tencent-codebuddy-models'))
    const trigger = page.getByRole('button', { name: /^选择模型/ })
    await trigger.waitFor({ timeout: 15_000 })
    await trigger.click()
    await page.getByRole('menuitem', { name: /模型/ }).click()

    // The picker groups the direct DeepSeek catalog above the fixed Tencent
    // catalog; every Tencent id the package owns is offered.
    const models = page.getByRole('menuitemradio')
    const texts = await models.allTextContents()
    expect(texts[0]).toBe('DeepSeek-V4-Flash')
    expect(texts).toContain('Auto支持图片')
    expect(texts).toContain('Echo')
    expect(texts).toContain('GPT-5.6-Sol支持图片')
    expect(texts).toContain('Deepseek-V4-Pro-0813支持图片')
    const snapshot = await captureStableAria(page, '[role="menu"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(UI_EXPECTED, snapshot, MODE)
    await page.getByRole('menuitemradio', { name: 'Echo' }).click()
    await expect.poll(() => trigger.getAttribute('aria-label'))
      .toBe('选择模型，当前 Echo')
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps an image draft and guides a text-only model to an image-capable model', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-tencent-codebuddy-image-model'))
    const textarea = page.locator('textarea')
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.items.add(new File([new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x04, 0x00, 0x00, 0x00, 0xb5, 0x1c, 0x0c, 0x02, 0x00, 0x00, 0x00,
        0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0xda, 0x63, 0x64, 0xf8, 0x0f, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x27, 0x18, 0xe3, 0x66, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ])], 'draft.png', { type: 'image/png' }))
      document.dispatchEvent(new DragEvent('drop', {
        dataTransfer: data, bubbles: true, cancelable: true,
      }))
    })

    await page.getByAltText('draft.png').waitFor({ timeout: 10_000 })
    await page.getByText('请选择支持图片的模型继续').waitFor({ timeout: 10_000 })
    await expect.poll(() => textarea.isDisabled()).toBe(true)
    await expect.poll(() => textarea.getAttribute('placeholder'))
      .toBe('当前模型不支持图片，请选择支持图片的模型')
    // The fixed catalog's text-only entry is `echo`; `auto` accepts images.
    const plain = page.getByRole('menuitemradio', { name: /^Echo/ })
    const reasoning = page.getByRole('menuitemradio', { name: /^Auto/ })
    expect(await plain.isDisabled()).toBe(true)
    expect(await reasoning.isDisabled()).toBe(false)

    const snapshot = await captureStableAria(page, '[data-composer-card]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(IMAGE_REQUIRED_EXPECTED, snapshot, MODE)
    await reasoning.click()
    await expect.poll(() => textarea.isDisabled()).toBe(false)
    expect(await page.getByAltText('draft.png').count()).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps the image in Tencent current-user input when workspace context follows it', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-tencent-codebuddy-image-round'))
    const input = page.locator('textarea:enabled').first()
    const settled = scaffold.whenTurnSettled(60_000)
    const admitted = page.waitForResponse(response => response.url().endsWith('/api/session.prompt'))
    await input.fill(IMAGE_PROMPT)
    await page.getByRole('button', { name: '发送消息' }).click()
    const admission = await (await admitted).json() as {
      result: { ok: true; value: { accepted: true } } | { ok: false; error: { code: string; message: string } }
    }
    if (!admission.result.ok) {
      throw new Error(`Tencent image prompt was refused: ${admission.result.error.code}: ${admission.result.error.message}`)
    }
    await settled

    const messages = tencentPayload?.messages
    if (messages === undefined) throw new Error('Tencent e2e captured no provider request')
    const users = messages.filter(message => message.role === 'user')
    expect(users).toHaveLength(1)
    const parts = contentParts(users[0]!)
    expect(parts.some(part => part.type === 'image_url')).toBe(true)
    const text = parts.filter(part => part.type === 'text').map(part => part.text).join('\n')
    expect(text).toContain(IMAGE_PROMPT)
    expect(text).toContain('codebuddy-image-context-probe')

    await page.getByText(IMAGE_REPLY, { exact: true }).waitFor({ timeout: 10_000 })
    const snapshot = await captureStableAria(page, '[class*="centerCol"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(IMAGE_ROUND_EXPECTED, snapshot, MODE)
    expect(tripwire.pageErrors).toEqual([])
  }, 90_000)

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, [
      'image-required.expected.md',
      'image-round.expected.md',
      'ui.expected.md',
    ])
  })
})
