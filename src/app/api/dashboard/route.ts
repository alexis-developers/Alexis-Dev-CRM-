import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  loadMetrics,
  loadConversationsSeries,
  loadPipelineDonut,
  loadResponseTime,
  loadActivity,
} from '@/lib/dashboard/queries'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const section = searchParams.get('section')
  const rangeDays = parseInt(searchParams.get('range') ?? '30', 10)
  const userId = session.user.id

  try {
    if (section === 'metrics') {
      return NextResponse.json(await loadMetrics(userId))
    }
    if (section === 'series') {
      return NextResponse.json(await loadConversationsSeries(userId, rangeDays))
    }
    if (section === 'pipeline') {
      return NextResponse.json(await loadPipelineDonut(userId))
    }
    if (section === 'response-time') {
      return NextResponse.json(await loadResponseTime(userId))
    }
    if (section === 'activity') {
      return NextResponse.json(await loadActivity(userId, 50))
    }

    // Load all at once
    const [metrics, series, pipeline, responseTime, activity] = await Promise.all([
      loadMetrics(userId),
      loadConversationsSeries(userId, rangeDays),
      loadPipelineDonut(userId),
      loadResponseTime(userId),
      loadActivity(userId, 50),
    ])
    return NextResponse.json({ metrics, series, pipeline, responseTime, activity })
  } catch (err) {
    console.error('[dashboard] query error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
