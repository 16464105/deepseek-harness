import { defineConfig } from 'tsdown'

/**
 * The dsh CLI ships the `bin` referenced by package.json plus the profile boot
 * entry shared with the desktop application. The root tsdown builds only its
 * standard package entries, so this override names both explicitly.
 * Declarations come from `tsc -b` (dts: false), matching every package.
 */
export default defineConfig({
  entry: ['lib/types/bin.js', 'lib/types/profile-boot.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
