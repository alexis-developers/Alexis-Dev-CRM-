/**
 * Supabase-compatible query builder on top of Drizzle/SQLite.
 * Supports the subset of the PostgREST API actually used in this codebase.
 */
import { eq, ne, inArray, like, and, or, desc, asc, sql, type SQL } from 'drizzle-orm'
import { db } from './index'
import * as schema from './schema'
import type { SQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core'

type TableName = keyof typeof schema

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

function getTable(name: string): SQLiteTable | null {
  return (schema as AnyRecord)[name] ?? null
}

function getColumn(table: SQLiteTable, col: string): SQLiteColumn | null {
  return (table as AnyRecord)[col] ?? null
}

interface SupabaseResponse<T> {
  data: T | null
  error: { message: string; code?: string } | null
  count?: number | null
}

class SelectBuilder<T = AnyRecord> {
  private _table: SQLiteTable
  private _tableName: string
  private _filters: SQL[] = []
  private _orderBy: SQL[] = []
  private _limit: number | null = null
  private _offset: number | null = null
  private _columns: string[] | null = null
  private _countOnly = false

  constructor(tableName: string, table: SQLiteTable) {
    this._tableName = tableName
    this._table = table
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (opts?.count === 'exact') this._countOnly = true
    if (columns !== '*') {
      this._columns = columns.split(',').map((c) => c.trim().split(':')[0].trim())
    }
    return this as SelectBuilder<T>
  }

  eq(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(eq(col, value as SQL.Aliased))
    return this
  }

  neq(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(ne(col, value as SQL.Aliased))
    return this
  }

  in(column: string, values: unknown[]) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(inArray(col, values as SQL.Aliased[]))
    return this
  }

  ilike(column: string, pattern: string) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(like(col, pattern))
    return this
  }

  gte(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(sql`${col} >= ${value}`)
    return this
  }

  lte(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(sql`${col} <= ${value}`)
    return this
  }

  gt(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(sql`${col} > ${value}`)
    return this
  }

  lt(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(sql`${col} < ${value}`)
    return this
  }

  is(column: string, value: null) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(sql`${col} IS ${value}`)
    return this
  }

  not(column: string, op: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col && op === 'is') this._filters.push(sql`${col} IS NOT ${value}`)
    return this
  }

  order(column: string, opts?: { ascending?: boolean }) {
    const col = getColumn(this._table, column)
    if (col) this._orderBy.push(opts?.ascending === false ? desc(col) : asc(col))
    return this
  }

  limit(n: number) {
    this._limit = n
    return this
  }

  range(from: number, to: number) {
    this._offset = from
    this._limit = to - from + 1
    return this
  }

  private buildWhere(): SQL | undefined {
    if (this._filters.length === 0) return undefined
    if (this._filters.length === 1) return this._filters[0]
    return and(...this._filters)
  }

  async execute(): Promise<SupabaseResponse<T[]>> {
    try {
      if (this._countOnly) {
        const where = this.buildWhere()
        const result = where
          ? await db.select({ count: sql<number>`count(*)` }).from(this._table).where(where)
          : await db.select({ count: sql<number>`count(*)` }).from(this._table)
        return { data: [] as T[], error: null, count: Number(result[0]?.count ?? 0) }
      }

      const where = this.buildWhere()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db.select().from(this._table)
      if (where) q = q.where(where)
      if (this._orderBy.length) q = q.orderBy(...this._orderBy)
      if (this._limit !== null) q = q.limit(this._limit)
      if (this._offset !== null) q = q.offset(this._offset)
      const rows = await q
      return { data: rows as T[], error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }

  then(
    resolve: (v: SupabaseResponse<T[]>) => void,
    reject: (e: unknown) => void
  ) {
    return this.execute().then(resolve, reject)
  }

  async single(): Promise<SupabaseResponse<T>> {
    const where = this.buildWhere()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db.select().from(this._table)
      if (where) q = q.where(where)
      if (this._orderBy.length) q = q.orderBy(...this._orderBy)
      q = q.limit(1)
      const rows = await q
      if (!rows || rows.length === 0) {
        return { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
      }
      return { data: rows[0] as T, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }

  async maybeSingle(): Promise<SupabaseResponse<T | null>> {
    const where = this.buildWhere()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = db.select().from(this._table)
      if (where) q = q.where(where)
      if (this._orderBy.length) q = q.orderBy(...this._orderBy)
      q = q.limit(1)
      const rows = await q
      return { data: (rows[0] as T) ?? null, error: null }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }
}

class MutationBuilder<T = AnyRecord> {
  private _table: SQLiteTable
  private _filters: SQL[] = []
  private _data: AnyRecord | null = null
  private _operation: 'insert' | 'update' | 'delete' | 'upsert' = 'insert'
  private _onConflict: string | null = null
  private _returning = false

  constructor(table: SQLiteTable) {
    this._table = table
  }

  setOperation(op: typeof this._operation, data?: AnyRecord) {
    this._operation = op
    if (data) this._data = data
    return this
  }

  eq(column: string, value: unknown) {
    const col = getColumn(this._table, column)
    if (col) this._filters.push(eq(col, value as SQL.Aliased))
    return this
  }

  select(_cols?: string) {
    this._returning = true
    return this
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setConflict(field: string) {
    this._onConflict = field
    return this
  }

  private buildWhere(): SQL | undefined {
    if (this._filters.length === 0) return undefined
    if (this._filters.length === 1) return this._filters[0]
    return and(...this._filters)
  }

  async execute(): Promise<SupabaseResponse<T>> {
    try {
      if (this._operation === 'delete') {
        const where = this.buildWhere()
        if (where) {
          await db.delete(this._table).where(where)
        } else {
          await db.delete(this._table)
        }
        return { data: null, error: null }
      }

      if (this._operation === 'insert' || this._operation === 'upsert') {
        let stmt = db.insert(this._table).values(this._data as AnyRecord)
        if (this._operation === 'upsert' && this._onConflict) {
          const col = getColumn(this._table, this._onConflict)
          if (col) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            stmt = (stmt as any).onConflictDoUpdate({ target: col, set: this._data as AnyRecord })
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await (stmt as any).returning()
        return { data: rows[0] as T ?? null, error: null }
      }

      if (this._operation === 'update') {
        const where = this.buildWhere()
        let q = db.update(this._table).set(this._data as AnyRecord)
        if (where) q = q.where(where) as typeof q
        const rows = await q.returning()
        return { data: (rows[0] as T) ?? null, error: null }
      }

      return { data: null, error: { message: 'Unknown operation' } }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } }
    }
  }

  single() {
    return this.execute()
  }

  then(
    resolve: (v: SupabaseResponse<T>) => void,
    reject: (e: unknown) => void
  ) {
    return this.execute().then(resolve, reject)
  }
}

class TableProxy {
  private _tableName: string
  private _table: SQLiteTable

  constructor(tableName: string, table: SQLiteTable) {
    this._tableName = tableName
    this._table = table
  }

  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    const b = new SelectBuilder(this._tableName, this._table)
    return b.select(columns, opts)
  }

  insert(data: AnyRecord | AnyRecord[]) {
    const rows = Array.isArray(data) ? data : [data]
    const b = new MutationBuilder(this._table)
    b.setOperation('insert', rows[0])
    return b
  }

  update(data: AnyRecord) {
    const b = new MutationBuilder(this._table)
    b.setOperation('update', data)
    return b
  }

  delete() {
    const b = new MutationBuilder(this._table)
    b.setOperation('delete')
    return b
  }

  upsert(data: AnyRecord, opts?: { onConflict?: string }) {
    const b = new MutationBuilder(this._table)
    b.setOperation('upsert', data)
    if (opts?.onConflict) b.setConflict(opts.onConflict)
    return b
  }
}

export function createCompatClient() {
  return {
    from(tableName: string) {
      const table = getTable(tableName)
      if (!table) {
        throw new Error(`Table "${tableName}" not found in schema`)
      }
      return new TableProxy(tableName, table)
    },
  }
}
