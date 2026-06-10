import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE = 'better-auth.session_token'

function hasSession(request: NextRequest): boolean {
  return !!request.cookies.get(SESSION_COOKIE)?.value
}

export function middleware(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname
  const isLoggedIn = hasSession(request)

  // Auth pages — redirect to dashboard if already logged in
  const authPages = ['/login', '/signup', '/forgot-password']
  if (isLoggedIn && authPages.includes(path)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Protected pages — redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings', '/trocar-senha']
  if (!isLoggedIn && protectedPaths.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Public API routes — no auth required
  const publicApiPaths = [
    '/api/auth',
    '/api/preco',
    '/api/efi/',
    '/api/invites/check',
    '/api/licenses/validate',
  ]
  const isPublicApi = publicApiPaths.some((p) => path.startsWith(p)) || path.includes('/webhook')

  // Block unauthenticated API calls
  if (!isLoggedIn && path.startsWith('/api/') && !isPublicApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
