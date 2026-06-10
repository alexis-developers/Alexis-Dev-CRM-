"use client"

import { useCallback, useEffect, useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
} from 'lucide-react'

import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

type RangeDays = 7 | 30 | 90

async function fetchDashboard(section: string, range?: number) {
  const params = new URLSearchParams({ section })
  if (range) params.set('range', String(range))
  const res = await fetch(`/api/dashboard?${params}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({ 7: null, 30: null, 90: null })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const loadAll = useCallback(() => {
    fetchDashboard('metrics')
      .then(setMetrics).catch((e) => console.error('[dashboard] metrics:', e))
      .finally(() => setMetricsLoading(false))

    fetchDashboard('series', 30)
      .then((s: ConversationsSeriesPoint[]) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((e) => console.error('[dashboard] series:', e))
      .finally(() => setSeriesLoading(false))

    fetchDashboard('pipeline')
      .then(setPipeline).catch((e) => console.error('[dashboard] pipeline:', e))
      .finally(() => setPipelineLoading(false))

    fetchDashboard('response-time')
      .then(setResponseTime).catch((e) => console.error('[dashboard] response-time:', e))
      .finally(() => setResponseTimeLoading(false))

    fetchDashboard('activity')
      .then(setActivity).catch((e) => console.error('[dashboard] activity:', e))
      .finally(() => setActivityLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const handleRangeChange = useCallback((r: RangeDays) => {
    setRange(r)
    if (series[r] !== null) return
    setSeriesLoading(true)
    fetchDashboard('series', r)
      .then((s: ConversationsSeriesPoint[]) => setSeries((prev) => ({ ...prev, [r]: s })))
      .catch((e) => console.error('[dashboard] series:', e))
      .finally(() => setSeriesLoading(false))
  }, [series])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel</h1>
        <p className="mt-1 text-sm text-slate-400">
          Análise em tempo real de conversas, contatos, negócios, transmissões e automações.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="Conversas Ativas"
              value={metrics.activeConversations.current.toLocaleString()}
              icon={MessageSquare}
              delta={{ sign: metrics.activeConversations.previous, label: deltaLabel(metrics.activeConversations.previous, 'hoje vs ontem') }}
            />
            <MetricCard
              title="Novos Contatos Hoje"
              value={metrics.newContactsToday.current.toLocaleString()}
              icon={UserPlus}
              delta={{ sign: metrics.newContactsToday.current - metrics.newContactsToday.previous, label: deltaLabel(metrics.newContactsToday.current - metrics.newContactsToday.previous, 'vs ontem') }}
            />
            <MetricCard
              title="Valor de Negócios Abertos"
              value={formatCurrency(metrics.openDealsValue)}
              icon={DollarSign}
              subtitle={`${metrics.openDealsCount} ${metrics.openDealsCount === 1 ? 'negócio aberto' : 'negócios abertos'}`}
            />
            <MetricCard
              title="Mensagens Enviadas Hoje"
              value={metrics.messagesSentToday.current.toLocaleString()}
              icon={Send}
              delta={{ sign: metrics.messagesSentToday.current - metrics.messagesSentToday.previous, label: deltaLabel(metrics.messagesSentToday.current - metrics.messagesSentToday.previous, 'vs ontem') }}
            />
          </>
        )}
      </div>

      <QuickActions />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart series={series} loading={seriesLoading} range={range} onRangeChange={handleRangeChange} />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut data={pipeline} loading={pipelineLoading} />
        </div>
      </div>

      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  )
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

function deltaLabel(delta: number, suffix: string): string {
  if (delta === 0) return `Sem alteração ${suffix}`
  return `${delta > 0 ? '+' : ''}${delta.toLocaleString()} ${suffix}`
}
