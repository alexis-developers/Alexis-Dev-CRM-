import * as schema from './schema'

type AnyDrizzle = any

// Module-level singleton — set once per isolate (CF) or process (local dev)
let _db: AnyDrizzle | null = null

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

// Called by middleware on Cloudflare — sets the D1 binding once per isolate
export function initDbForCloudflare(d1: any): void {
  if (!_db) {
    const { drizzle } = require('drizzle-orm/d1')
    _db = drizzle(d1, { schema })
  }
}

// Async getter — safe in all contexts
export async function getDb(): Promise<AnyDrizzle> {
  if (_db) return _db

  if (process.env.NODE_ENV === 'development') {
    _db = initLocalDb()
    return _db
  }

  // Cloudflare: lazy init via getCloudflareContext (fallback if middleware missed it)
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const ctx = await getCloudflareContext({ async: true } as any)
    const { drizzle } = await import('drizzle-orm/d1')
    _db = drizzle((ctx as any).env.DB, { schema })
  } catch {
    // If opennext is unavailable, try local
    _db = initLocalDb()
  }
  return _db
}

// Synchronous proxy — works on local dev (after initLocalDb) and on CF (after middleware)
export const db: AnyDrizzle = new Proxy({} as AnyDrizzle, {
  get(_, prop: string | symbol) {
    if (!_db) {
      if (process.env.NODE_ENV === 'development') {
        _db = initLocalDb()
      } else {
        throw new Error(
          `[db] Not initialized. Ensure the middleware ran initDbForCloudflare() before accessing 'db.${String(prop)}'.`
        )
      }
    }
    return _db[prop]
  },
})

export type DB = typeof db
