import { db } from '@/lib/db'
import {
  conversations, contacts, deals, messages, pipeline_stages,
  broadcasts, automation_logs, automations,
} from '@/lib/db/schema'
import { eq, gte, lt, and, desc, asc, sql, count } from 'drizzle-orm'
import {
  daysAgoStart,
  DOW_SHORT_MON_FIRST,
  lastNDayKeys,
  localDayKey,
  mondayIndex,
  startOfLocalDay,
} from './date-utils'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  PipelineStageSlice,
  ResponseTimeBucket,
  ResponseTimeSummary,
} from './types'

// userId is now required — RLS was handled by Supabase; we enforce manually.

// --- 1. Metric cards ---------------------------------------------------

export async function loadMetrics(userId: string): Promise<MetricsBundle> {
  const todayStart = startOfLocalDay().toISOString()
  const yesterdayStart = daysAgoStart(1).toISOString()

  const [
    openConvCount,
    newConvTodayCount,
    newConvYesterdayCount,
    newContactsTodayCount,
    newContactsYesterdayCount,
    openDealsRows,
    messagesTodayCount,
    messagesYesterdayCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.user_id, userId), eq(conversations.status, 'open'))),
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.user_id, userId), eq(conversations.status, 'open'), gte(conversations.created_at, todayStart))),
    db.select({ count: count() }).from(conversations)
      .where(and(eq(conversations.user_id, userId), eq(conversations.status, 'open'), gte(conversations.created_at, yesterdayStart), lt(conversations.created_at, todayStart))),
    db.select({ count: count() }).from(contacts)
      .where(and(eq(contacts.user_id, userId), gte(contacts.created_at, todayStart))),
    db.select({ count: count() }).from(contacts)
      .where(and(eq(contacts.user_id, userId), gte(contacts.created_at, yesterdayStart), lt(contacts.created_at, todayStart))),
    db.select({ value: deals.value }).from(deals)
      .where(and(eq(deals.user_id, userId), eq(deals.status, 'open'))),
    db.select({ count: count() }).from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(and(eq(conversations.user_id, userId), eq(messages.sender_type, 'agent'), gte(messages.created_at, todayStart))),
    db.select({ count: count() }).from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(and(eq(conversations.user_id, userId), eq(messages.sender_type, 'agent'), gte(messages.created_at, yesterdayStart), lt(messages.created_at, todayStart))),
  ])

  const openDealsValue = openDealsRows.reduce((sum, d) => sum + (d.value ?? 0), 0)

  return {
    activeConversations: {
      current: openConvCount[0]?.count ?? 0,
      previous: (newConvTodayCount[0]?.count ?? 0) - (newConvYesterdayCount[0]?.count ?? 0),
    },
    newContactsToday: {
      current: newContactsTodayCount[0]?.count ?? 0,
      previous: newContactsYesterdayCount[0]?.count ?? 0,
    },
    openDealsValue,
    openDealsCount: openDealsRows.length,
    messagesSentToday: {
      current: messagesTodayCount[0]?.count ?? 0,
      previous: messagesYesterdayCount[0]?.count ?? 0,
    },
  }
}

// --- 2. Conversations over time ---------------------------------------

export async function loadConversationsSeries(
  userId: string,
  rangeDays: number,
): Promise<ConversationsSeriesPoint[]> {
  const start = daysAgoStart(rangeDays - 1).toISOString()

  const rows = await db.select({ created_at: messages.created_at, sender_type: messages.sender_type })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
    .where(and(eq(conversations.user_id, userId), gte(messages.created_at, start)))
    .orderBy(asc(messages.created_at))

  const keys = lastNDayKeys(rangeDays)
  const buckets = new Map<string, { incoming: number; outgoing: number }>()
  for (const k of keys) buckets.set(k, { incoming: 0, outgoing: 0 })

  for (const row of rows) {
    const key = localDayKey(row.created_at ?? '')
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (row.sender_type === 'customer') bucket.incoming += 1
    else bucket.outgoing += 1
  }

  return keys.map((day) => ({ day, ...(buckets.get(day) ?? { incoming: 0, outgoing: 0 }) }))
}

// --- 3. Pipeline donut -------------------------------------------------

export async function loadPipelineDonut(userId: string): Promise<PipelineDonutData> {
  const [stagesRows, dealsRows] = await Promise.all([
    db.select({ id: pipeline_stages.id, name: pipeline_stages.name, color: pipeline_stages.color })
      .from(pipeline_stages)
      .innerJoin(deals, eq(pipeline_stages.id, deals.stage_id))
      .where(eq(deals.user_id, userId))
      .groupBy(pipeline_stages.id)
      .orderBy(asc(pipeline_stages.position)),
    db.select({ stage_id: deals.stage_id, value: deals.value })
      .from(deals)
      .where(and(eq(deals.user_id, userId), eq(deals.status, 'open'))),
  ])

  const byStage = new Map<string, { count: number; total: number }>()
  for (const d of dealsRows) {
    if (!d.stage_id) continue
    const row = byStage.get(d.stage_id) ?? { count: 0, total: 0 }
    row.count += 1
    row.total += d.value ?? 0
    byStage.set(d.stage_id, row)
  }

  const slices: PipelineStageSlice[] = stagesRows
    .map((s) => ({
      id: s.id,
      name: s.name ?? '',
      color: s.color || '#64748b',
      dealCount: byStage.get(s.id)?.count ?? 0,
      totalValue: byStage.get(s.id)?.total ?? 0,
    }))
    .filter((s) => s.totalValue > 0 || s.dealCount > 0)

  return {
    stages: slices,
    totalValue: slices.reduce((sum, s) => sum + s.totalValue, 0),
  }
}

// --- 4. Response time by day of week ----------------------------------

export async function loadResponseTime(userId: string): Promise<ResponseTimeSummary> {
  const fourteenDaysAgo = daysAgoStart(13).toISOString()

  const rows = await db
    .select({ conversation_id: messages.conversation_id, sender_type: messages.sender_type, created_at: messages.created_at })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
    .where(and(eq(conversations.user_id, userId), gte(messages.created_at, fourteenDaysAgo)))
    .orderBy(asc(messages.conversation_id), asc(messages.created_at))

  interface Sample { customerAt: Date; responseAt: Date }
  const samples: Sample[] = []

  let currentConv = ''
  let pendingCustomer: Date | null = null
  for (const row of rows) {
    if (row.conversation_id !== currentConv) {
      currentConv = row.conversation_id ?? ''
      pendingCustomer = null
    }
    const ts = new Date(row.created_at ?? '')
    if (row.sender_type === 'customer') {
      if (!pendingCustomer) pendingCustomer = ts
    } else if (pendingCustomer) {
      samples.push({ customerAt: pendingCustomer, responseAt: ts })
      pendingCustomer = null
    }
  }

  const now = new Date()
  const thisWeekStart = daysAgoStart(mondayIndex(now))
  const lastWeekStart = daysAgoStart(mondayIndex(now) + 7)

  const byDow = new Map<number, number[]>()
  for (let i = 0; i < 7; i++) byDow.set(i, [])
  const thisWeekMins: number[] = []
  const lastWeekMins: number[] = []

  for (const s of samples) {
    const diffMin = (s.responseAt.getTime() - s.customerAt.getTime()) / 60_000
    if (diffMin < 0) continue
    const dow = mondayIndex(s.customerAt)
    byDow.get(dow)!.push(diffMin)
    if (s.customerAt >= thisWeekStart) thisWeekMins.push(diffMin)
    else if (s.customerAt >= lastWeekStart && s.customerAt < thisWeekStart) lastWeekMins.push(diffMin)
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length

  const buckets: ResponseTimeBucket[] = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    avgMinutes: avg(byDow.get(dow) ?? []),
    samples: (byDow.get(dow) ?? []).length,
  }))

  void DOW_SHORT_MON_FIRST

  return {
    buckets,
    thisWeekAvg: avg(thisWeekMins),
    lastWeekAvg: avg(lastWeekMins),
  }
}

// --- 5. Activity feed --------------------------------------------------

export async function loadActivity(userId: string, limit = 20): Promise<ActivityItem[]> {
  const [recentMessages, recentContacts, recentDeals, recentBroadcasts, recentAutoLogs] = await Promise.all([
    db.select({
      id: messages.id,
      content_text: messages.content_text,
      created_at: messages.created_at,
      conversation_id: messages.conversation_id,
    })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversation_id, conversations.id))
      .where(and(eq(conversations.user_id, userId), eq(messages.sender_type, 'customer')))
      .orderBy(desc(messages.created_at))
      .limit(10),

    db.select({ id: contacts.id, name: contacts.name, phone: contacts.phone, created_at: contacts.created_at })
      .from(contacts)
      .where(eq(contacts.user_id, userId))
      .orderBy(desc(contacts.created_at))
      .limit(10),

    db.select({ id: deals.id, title: deals.title, updated_at: deals.updated_at, stage_id: deals.stage_id })
      .from(deals)
      .where(eq(deals.user_id, userId))
      .orderBy(desc(deals.updated_at))
      .limit(10),

    db.select({ id: broadcasts.id, name: broadcasts.name, status: broadcasts.status, total_recipients: broadcasts.total_recipients, created_at: broadcasts.created_at })
      .from(broadcasts)
      .where(eq(broadcasts.user_id, userId))
      .orderBy(desc(broadcasts.created_at))
      .limit(5),

    db.select({
      id: automation_logs.id,
      trigger_event: automation_logs.trigger_event,
      status: automation_logs.status,
      created_at: automation_logs.created_at,
      contact_id: automation_logs.contact_id,
      automation_id: automation_logs.automation_id,
    })
      .from(automation_logs)
      .where(eq(automation_logs.user_id, userId))
      .orderBy(desc(automation_logs.created_at))
      .limit(10),
  ])

  // Fetch related contact names for messages and auto logs
  const convContactMap = new Map<string, string>()
  const uniqueConvIds = [...new Set(recentMessages.map(m => m.conversation_id).filter(Boolean))] as string[]
  if (uniqueConvIds.length) {
    const convRows = await db.select({ id: conversations.id, contact_id: conversations.contact_id })
      .from(conversations)
      .where(sql`${conversations.id} IN (${sql.join(uniqueConvIds.map(id => sql`${id}`), sql`, `)})`)
    const contactIds = [...new Set(convRows.map(c => c.contact_id).filter(Boolean))] as string[]
    if (contactIds.length) {
      const contactRows = await db.select({ id: contacts.id, name: contacts.name, phone: contacts.phone })
        .from(contacts)
        .where(sql`${contacts.id} IN (${sql.join(contactIds.map(id => sql`${id}`), sql`, `)})`)
      const contactMap = new Map(contactRows.map(c => [c.id, c]))
      for (const conv of convRows) {
        if (conv.contact_id) {
          const c = contactMap.get(conv.contact_id)
          if (c) convContactMap.set(conv.id, c.name || c.phone || 'Desconhecido')
        }
      }
    }
  }

  const automationNameMap = new Map<string, string>()
  const uniqueAutoIds = [...new Set(recentAutoLogs.map(l => l.automation_id).filter(Boolean))] as string[]
  if (uniqueAutoIds.length) {
    const autoRows = await db.select({ id: automations.id, name: automations.name })
      .from(automations)
      .where(sql`${automations.id} IN (${sql.join(uniqueAutoIds.map(id => sql`${id}`), sql`, `)})`)
    for (const a of autoRows) automationNameMap.set(a.id, a.name)
  }

  const items: ActivityItem[] = []

  for (const m of recentMessages) {
    const who = convContactMap.get(m.conversation_id ?? '') ?? 'Desconhecido'
    items.push({ id: `msg-${m.id}`, kind: 'message', text: `Nova mensagem de ${who}`, at: m.created_at ?? '', href: `/inbox?c=${m.conversation_id}` })
  }
  for (const c of recentContacts) {
    items.push({ id: `contact-${c.id}`, kind: 'contact', text: `Novo contato: ${c.name || c.phone}`, at: c.created_at ?? '', href: '/contacts' })
  }
  for (const d of recentDeals) {
    items.push({ id: `deal-${d.id}`, kind: 'deal', text: `Negócio "${d.title}" atualizado`, at: d.updated_at ?? '', href: '/pipelines' })
  }
  for (const b of recentBroadcasts) {
    const label = b.status === 'sent' ? `enviada para ${b.total_recipients} contatos` : `${b.status} (${b.total_recipients} destinatários)`
    items.push({ id: `broadcast-${b.id}`, kind: 'broadcast', text: `Transmissão "${b.name}" ${label}`, at: b.created_at ?? '', href: '/broadcasts' })
  }
  for (const l of recentAutoLogs) {
    const autoName = automationNameMap.get(l.automation_id ?? '') ?? 'Automação'
    items.push({ id: `auto-${l.id}`, kind: 'automation', text: `Automação "${autoName}" ${l.status === 'failed' ? 'falhou' : 'disparada'}`, at: l.created_at ?? '' })
  }

  return items.sort((a, b) => (a.at > b.at ? -1 : 1)).slice(0, limit)
}
