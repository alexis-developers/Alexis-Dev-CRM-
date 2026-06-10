import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { messages, conversations } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const lastMessageId = searchParams.get('lastMessageId')
  const lastConvUpdated = searchParams.get('lastConvUpdated')

  // Fetch new messages since lastMessageId
  let newMessages: typeof messages.$inferSelect[] = []
  if (lastMessageId) {
    const lastMsg = await db.query.messages.findFirst({
      where: eq(messages.id, lastMessageId),
      columns: { created_at: true },
    })
    if (lastMsg?.created_at) {
      newMessages = await db.query.messages.findMany({
        where: gt(messages.created_at, lastMsg.created_at),
        orderBy: (m, { asc }) => [asc(m.created_at)],
        limit: 50,
      })
    }
  }

  // Fetch conversations updated after lastConvUpdated
  let updatedConversations: typeof conversations.$inferSelect[] = []
  if (lastConvUpdated) {
    updatedConversations = await db.query.conversations.findMany({
      where: and(
        eq(conversations.user_id, session.user.id),
        gt(conversations.updated_at, lastConvUpdated)
      ),
      orderBy: (c, { desc }) => [desc(c.updated_at)],
      limit: 20,
    })
  }

  return NextResponse.json({ newMessages, updatedConversations })
}
