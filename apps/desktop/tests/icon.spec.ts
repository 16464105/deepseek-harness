import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const DESKTOP_ROOT = fileURLToPath(new URL('..', import.meta.url))

it('ships a rounded white-backed brand-blue application icon for Dock and desktop shells', async () => {
  const icon = await readFile(join(DESKTOP_ROOT, 'build/icon.svg'), 'utf8')
  expect(icon).toContain('fill="#FFFFFF"')
  expect(icon).toContain('fill="#4D6BFE"')
  expect(icon).toContain('viewBox="0 0 1024 1024"')
  expect(icon).toMatch(/rx="\d+"/)
  expect(icon).toMatch(/<rect x="\d+" y="\d+"/)

  const packageJson = JSON.parse(await readFile(join(DESKTOP_ROOT, 'package.json'), 'utf8')) as {
    build: { icon: string }
  }
  expect(packageJson.build.icon).toBe('build/icon.svg')
})
