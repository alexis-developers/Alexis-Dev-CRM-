import * as schema from './schema'

type AnyDrizzle = any

// Module-level singleton — one instance per Worker isolate / Node.js process
let _db: AnyDrizzle | null = null

// ─── Local dev (Node.js + better-sqlite3) ────────────────────────────────────

function initLocalDb(): AnyDrizzle {
  const Database = require('better-sqlite3')
  const { drizzle } = require('drizzle-orm/better-sqlite3')
  const path = require('path')
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'local.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

// ─── Cloudflare D1 (sync init — CF context is available when route handlers run) ──

function initCloudflareDb(): AnyDrizzle {
  const { getCloudflareContext } = require('@opennextjs/cloudflare')
  const ctx = getCloudflareContext()
  const { drizzle } = require('drizzle-orm/d1')
  return drizzle(ctx.env.DB, { schema })
}

// ─── Called from middleware (optional early-init) ─────────────────────────────

export function initDbForCloudflare(d1: any): void {
  if (!_db) {
    const { drizzle } = require('drizzle-orm/d1')
    _db = drizzle(d1, { schema })
  }
}

// ─── Async getter — safe in all contexts ─────────────────────────────────────

export async function getDb(): Promise<AnyDrizzle> {
  if (_db) return _db

  if (process.env.NODE_ENV === 'development') {
    _db = initLocalDb()
    return _db
  }

  // CF Workers: try sync init first (globalThis.__openNextCloudflareContext is already set)
  try {
    _db = initCloudflareDb()
    return _db
  } catch {
    // Fallback: async context (edge cases)
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = await getCloudflareContext({ async: true } as any)
    const { drizzle } = await import('drizzle-orm/d1')
    _db = drizzle((ctx as any).env.DB, { schema })
    return _db
  }
}

// ─── Synchronous proxy ───────────────────────────────────────────────────────
// Works on local dev immediately.
// Works on CF after the first DB access (lazy sync init via getCloudflareContext).

export const db: AnyDrizzle = new Proxy({} as AnyDrizzle, {
  get(_, prop: string | symbol) {
    if (!_db) {
      if (process.env.NODE_ENV === 'development') {
        _db = initLocalDb()
      } else {
        // CF Workers: sync init — CF context is ready when route handlers run
        try {
          _db = initCloudflareDb()
        } catch (err) {
          throw new Error(
            `[db] Cloudflare context not available yet. Property: ${String(prop)}. Cause: ${err}`
          )
        }
      }
    }
    return _db[prop]
  },
})

export type DB = typeof db
