import { NextResponse, type NextRequest } from 'next/server'
import { proxy, config as proxyConfig } from './proxy'

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // On Cloudflare Pages, initialize D1 before any route handler runs
  if (process.env.CF_PAGES) {
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = await getCloudflareContext({ async: true } as any)
      const { initDbForCloudflare } = await import('./lib/db')
      initDbForCloudflare((ctx as any).env.DB)
    } catch {
      // Not a critical failure — route handlers will retry via getDb()
    }
  }

  return proxy(request) ?? NextResponse.next()
}

export const config = proxyConfig
