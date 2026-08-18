// Web e2e scenario: the shipped settings surface manages the current
// workspace's Skill catalog and persistent MCP server definitions. No model
// call is needed; a stray stream fails loud because the scaffold mounts no
// replay adapter.
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
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

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/settings-skill-mcp', import.meta.url))
const SKILL_EXPECTED = join(SNAPSHOT_DIR, 'skill.expected.md')
const MCP_EXPECTED = join(SNAPSHOT_DIR, 'mcp.expected.md')
const MODE = webSnapshotMode()
const INITIAL_SKILL = 'workspace-review'
const REFRESHED_SKILL = 'release-helper'
const MCP_SERVER = 'local_demo'

async function writeSkill(workspaceCwd: string, name: string, description: string): Promise<void> {
  const directory = join(workspaceCwd, 'workspace', '.agents', 'skills', name)
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, 'SKILL.md'), [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    'Use this Skill for the named workspace task.',
    '',
  ].join('\n'))
}

async function slashOptions(page: Page): Promise<string[]> {
  const menu = page.getByRole('listbox', { name: '触发候选建议' })
  await menu.waitFor({ timeout: 10_000 })
  return await menu.getByRole('option').allTextContents()
}

describe('web e2e: Skill and MCP settings management', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>

  beforeAll(async () => {
    await mkdir(SNAPSHOT_DIR, { recursive: true })
    scaffold = await launchWebScaffold({})
    await writeSkill(scaffold.workspaceCwd, INITIAL_SKILL, 'Review the connected workspace')
    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    try {
      await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    } catch (error) {
      await saveFailureShot(page, 'web-e2e-settings-management-boot')
      const body = await page.locator('body').innerText().catch(() => '<unreadable>')
      throw new Error(`settings management client boot failed: ${body}\n${tripwire.pageErrors.join('\n')}`, { cause: error })
    }
    await connectFreshWorkspaceZh(page, scaffold.workspaceCwd)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('refreshes workspace Skills and controls their chat-picker visibility', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-settings-skill-management'))
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.getByRole('button', { name: 'Skills', exact: true }).click()
    await dialog.getByRole('heading', { name: 'Skill 管理', exact: true }).waitFor({ timeout: 10_000 })
    const initialRow = dialog.getByRole('listitem').filter({ hasText: INITIAL_SKILL })
    await initialRow.waitFor({ timeout: 10_000 })
    expect(await initialRow.getByRole('checkbox').isChecked()).toBe(true)

    await writeSkill(scaffold.workspaceCwd, REFRESHED_SKILL, 'Prepare a local release')
    await dialog.getByRole('button', { name: '刷新目录', exact: true }).click()
    const refreshedRow = dialog.getByRole('listitem').filter({ hasText: REFRESHED_SKILL })
    await refreshedRow.waitFor({ timeout: 10_000 })

    const snapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(SKILL_EXPECTED, snapshot, MODE)

    await initialRow.getByRole('checkbox').uncheck()
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    const composer = page.locator('textarea:enabled').last()
    await composer.fill('/')
    await expect.poll(() => slashOptions(page), { timeout: 15_000 })
      .not.toEqual(expect.arrayContaining([expect.stringContaining(INITIAL_SKILL)]))
    expect(await slashOptions(page)).toEqual(expect.arrayContaining([
      expect.stringContaining(REFRESHED_SKILL),
    ]))
    await composer.fill('')

    await page.getByRole('button', { name: '设置', exact: true }).click()
    const reopened = page.getByRole('dialog', { name: '设置' })
    await reopened.getByRole('button', { name: 'Skills', exact: true }).click()
    const hiddenRow = reopened.getByRole('listitem').filter({ hasText: INITIAL_SKILL })
    await hiddenRow.waitFor({ timeout: 10_000 })
    await hiddenRow.getByRole('checkbox').check()
    await reopened.getByRole('button', { name: '关闭', exact: true }).click()
  }, 90_000)

  it('persists, redacts, disables, and removes an MCP server', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-settings-mcp-management'))
    await page.getByRole('button', { name: '设置', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '设置' })
    await dialog.getByRole('button', { name: 'MCP', exact: true }).click()
    await dialog.getByRole('heading', { name: 'MCP 管理', exact: true }).waitFor({ timeout: 10_000 })
    await dialog.getByText('尚未配置 MCP 服务器。', { exact: true }).waitFor({ timeout: 10_000 })

    await dialog.getByRole('button', { name: '添加服务器', exact: true }).click()
    await dialog.getByLabel('服务器名称', { exact: true }).fill(MCP_SERVER)
    await dialog.getByLabel('启动命令', { exact: true }).fill(process.execPath)
    await dialog.getByLabel('参数', { exact: true }).fill('-e\nprocess.exit(1)')
    await dialog.getByLabel('工作目录', { exact: true }).fill(scaffold.workspaceCwd)
    await dialog.getByLabel('环境变量', { exact: true }).fill('DEMO_TOKEN=local-demo')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()

    const row = dialog.getByRole('listitem').filter({ hasText: MCP_SERVER })
    await row.waitFor({ timeout: 15_000 })
    await expect.poll(() => row.getByText('正在重连', { exact: true }).count(), { timeout: 15_000 }).toBe(1)
    await row.getByText('已保存敏感配置', { exact: true }).waitFor({ timeout: 10_000 })

    await row.getByRole('button', { name: `编辑 ${MCP_SERVER}`, exact: true }).click()
    expect(await dialog.getByLabel('环境变量', { exact: true }).inputValue()).toBe('')
    await dialog.getByRole('button', { name: '取消', exact: true }).last().click()
    await row.getByRole('checkbox').click()
    await row.getByText('已停用', { exact: true }).first().waitFor({ timeout: 10_000 })

    const snapshot = await captureStableAria(page, '[role="dialog"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(MCP_EXPECTED, snapshot, MODE)

    await row.getByRole('button', { name: `删除 ${MCP_SERVER}`, exact: true }).click()
    const confirmation = row.getByText(`确定删除 ${MCP_SERVER}？`, { exact: true }).locator('..')
    await confirmation.getByRole('button', { name: '删除', exact: true }).click()
    await dialog.getByText('尚未配置 MCP 服务器。', { exact: true }).waitFor({ timeout: 10_000 })
    await dialog.getByRole('button', { name: '关闭', exact: true }).click()
    expect(tripwire.pageErrors).toEqual([])
    expect(tripwire.warnings).toEqual([])
  }, 90_000)

  it('keeps the snapshot directory minimal', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, ['mcp.expected.md', 'skill.expected.md'])
  })
})
