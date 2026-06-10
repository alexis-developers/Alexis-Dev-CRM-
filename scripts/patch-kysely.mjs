/**
 * Patches kysely's index.js to export DEFAULT_MIGRATION_LOCK_TABLE and
 * DEFAULT_MIGRATION_TABLE, which are required by @better-auth/kysely-adapter
 * but were made internal in kysely 0.29.x.
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const indexPath = resolve(__dirname, '../node_modules/kysely/dist/index.js')

const patch = `
// Compatibility exports for @better-auth/kysely-adapter
export const DEFAULT_MIGRATION_TABLE = 'kysely_migration';
export const DEFAULT_MIGRATION_LOCK_TABLE = 'kysely_migration_lock';
`

try {
  const content = readFileSync(indexPath, 'utf8')
  if (!content.includes('DEFAULT_MIGRATION_LOCK_TABLE')) {
    writeFileSync(indexPath, content + patch)
    console.log('✓ Patched kysely/dist/index.js')
  } else {
    console.log('✓ kysely already patched — skipping')
  }
} catch (e) {
  console.warn('⚠ Could not patch kysely:', e.message)
}
