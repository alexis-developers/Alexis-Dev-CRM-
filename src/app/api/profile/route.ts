import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json(null, { status: 401 })

  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || session.user.id

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, userId),
  })

  return NextResponse.json(profile ?? null)
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  await db.update(profiles)
    .set({
      full_name: body.full_name,
      avatar_url: body.avatar_url,
      updated_at: new Date().toISOString(),
    })
    .where(eq(profiles.user_id, session.user.id))

  const updated = await db.query.profiles.findFirst({
    where: eq(profiles.user_id, session.user.id),
  })

  return NextResponse.json(updated)
}
