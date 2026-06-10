"use client"

import { authClient } from '@/lib/auth/client'

const REST_BASE = '/api/rest'

// ── Fetch-based select builder (mirrors SelectBuilder in compat.ts) ──────────
class FetchSelectBuilder<T = Record<string, unknown>> {
  private _table: string
  private _params: URLSearchParams = new URLSearchParams()
  private _single = false

  constructor(table: string, columns = '*') {
    this._table = table
    if (columns !== '*') this._params.set('select', columns)
  }

  eq(col: string, val: unknown) { this._params.set(`eq[${col}]`, String(val)); return this }
  neq(col: string, val: unknown) { this._params.set(`neq[${col}]`, String(val)); return this }
  in(col: string, vals: unknown[]) { this._params.set(`in[${col}]`, vals.join(',')); return this }
  ilike(col: string, pat: string) { this._params.set(`ilike[${col}]`, pat); return this }
  gte(col: string, val: unknown) { this._params.set(`gte[${col}]`, String(val)); return this }
  lte(col: string, val: unknown) { this._params.set(`lte[${col}]`, String(val)); return this }
  gt(col: string, val: unknown) { this._params.set(`gt[${col}]`, String(val)); return this }
  lt(col: string, val: unknown) { this._params.set(`lt[${col}]`, String(val)); return this }
  is(col: string, val: null) { this._params.set(`is[${col}]`, 'null'); return this }
  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) this._params.set(`neq[${col}]`, 'null')
    return this
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this._params.set('order', `${col}.${opts?.ascending === false ? 'desc' : 'asc'}`)
    return this
  }
  limit(n: number) { this._params.set('limit', String(n)); return this }
  range(from: number, to: number) {
    this._params.set('range', `${from}-${to}`)
    return this
  }

  select(cols: string, _opts?: { count?: 'exact'; head?: boolean }) {
    if (cols !== '*') this._params.set('select', cols)
    return this as FetchSelectBuilder<T>
  }

  async single(): Promise<{ data: T | null; error: { message: string } | null }> {
    this._params.set('single', 'true')
    return this._exec()
  }

  async maybeSingle(): Promise<{ data: T | null; error: { message: string } | null }> {
    const res = await this._exec<T[]>()
    if (res.error) return { data: null, error: res.error }
    const arr = Array.isArray(res.data) ? res.data : []
    return { data: arr[0] ?? null, error: null }
  }

  private async _exec<R = T[]>(): Promise<{ data: R | null; error: { message: string } | null; count?: number | null }> {
    const qs = this._params.toString()
    try {
      const r = await fetch(`${REST_BASE}/${this._table}${qs ? '?' + qs : ''}`, { credentials: 'include' })
      return r.json()
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }

  then(
    resolve: (v: { data: T[] | null; error: { message: string } | null; count?: number | null }) => void,
    reject: (e: unknown) => void,
  ) {
    return this._exec<T[]>().then(resolve, reject)
  }
}

// ── Fetch-based mutation builder ─────────────────────────────────────────────
class FetchMutationBuilder<T = Record<string, unknown>> {
  private _table: string
  private _op: 'insert' | 'update' | 'delete' | 'upsert'
  private _data?: unknown
  private _params: URLSearchParams = new URLSearchParams()

  constructor(table: string, op: 'insert' | 'update' | 'delete' | 'upsert', data?: unknown) {
    this._table = table
    this._op = op
    this._data = data
  }

  eq(col: string, val: unknown) { this._params.set(`eq[${col}]`, String(val)); return this }
  select(_cols?: string) { return this }
  single() { return this._exec() }

  then(
    resolve: (v: { data: T | null; error: { message: string } | null }) => void,
    reject: (e: unknown) => void,
  ) {
    return this._exec().then(resolve, reject)
  }

  private async _exec(): Promise<{ data: T | null; error: { message: string } | null }> {
    const qs = this._params.toString()
    const url = `${REST_BASE}/${this._table}${qs ? '?' + qs : ''}`
    try {
      let method: string
      let body: string | undefined
      if (this._op === 'insert' || this._op === 'upsert') {
        method = 'POST'
        if (this._op === 'upsert') this._params.set('upsert', 'true')
        body = JSON.stringify(this._data)
      } else if (this._op === 'update') {
        method = 'PATCH'
        body = JSON.stringify(this._data)
      } else {
        method = 'DELETE'
      }
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
        credentials: 'include',
      })
      return r.json()
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }
}

// ── Table proxy ──────────────────────────────────────────────────────────────
class FetchTableProxy {
  constructor(private _table: string) {}

  select(cols = '*', opts?: { count?: 'exact'; head?: boolean }) {
    return new FetchSelectBuilder(this._table, cols)
  }
  insert(data: unknown) { return new FetchMutationBuilder(this._table, 'insert', data) }
  update(data: unknown) { return new FetchMutationBuilder(this._table, 'update', data) }
  delete() { return new FetchMutationBuilder(this._table, 'delete') }
  upsert(data: unknown, _opts?: { onConflict?: string }) {
    return new FetchMutationBuilder(this._table, 'upsert', data)
  }
}

// ── No-op Realtime stub ──────────────────────────────────────────────────────
function noopChannel() {
  const ch = {
    on: (..._args: unknown[]) => ch,
    subscribe: () => ch,
    unsubscribe: () => ch,
  }
  return ch
}

// ── Main export ──────────────────────────────────────────────────────────────
export function createClient() {
  return {
    from(table: string) {
      return new FetchTableProxy(table)
    },

    // Realtime stub — app uses polling; these exist so old code doesn't crash
    channel: (_name: string) => noopChannel(),
    removeChannel: (_ch: unknown) => {},

    auth: {
      getSession: async () => {
        const session = await authClient.getSession()
        return { data: { session: session.data?.session ?? null }, error: session.error ?? null }
      },
      onAuthStateChange: (_callback: (event: string, session: unknown) => void) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) return { error: { message: result.error.message } }
        return { data: { session: result.data?.session }, error: null }
      },
      signOut: async () => {
        await authClient.signOut()
        return { error: null }
      },
      getUser: async () => {
        const session = await authClient.getSession()
        return { data: { user: session.data?.user ?? null }, error: null }
      },
      updateUser: async (attrs: { password?: string }) => {
        if (attrs.password) {
          const result = await authClient.changePassword({
            newPassword: attrs.password,
            currentPassword: '',
            revokeOtherSessions: false,
          })
          return result.error ? { error: { message: result.error.message } } : { data: {}, error: null }
        }
        return { data: {}, error: null }
      },
      resetPasswordForEmail: async (email: string) => {
        try {
          await authClient.forgetPassword({ email, redirectTo: `${window.location.origin}/update-password` })
          return { error: null }
        } catch (e) {
          return { error: { message: (e as Error).message } }
        }
      },
    },

    storage: {
      from: (_bucket: string) => ({
        upload: async (_path: string, _file: File) => ({
          data: null,
          error: { message: 'Storage via R2 — use /api/storage/upload' },
        }),
        getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
        remove: async (_paths: string[]) => ({ data: null, error: null }),
      }),
    },
  }
}
