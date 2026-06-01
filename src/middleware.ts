import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

const protectedRoutes = ['/dashboard', '/budget', '/transactions', '/accounts', '/insights', '/goals', '/events', '/debt', '/household', '/profile', '/settings']
const publicRoutes = ['/login', '/register']
// Always reachable regardless of auth/onboarding state
const exemptRoutes = ['/forgot-password', '/reset-password', '/verify-email', '/privacy', '/terms']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = protectedRoutes.some((r) => path === r || path.startsWith(r + '/'))
  const isPublic = publicRoutes.includes(path)
  const isExempt = exemptRoutes.some((r) => path === r || path.startsWith(r + '/'))

  const token = req.cookies.get('session')?.value
  const session = await decrypt(token)
  const isAuthenticated = !!session?.userId

  // Exempt routes (password reset, email verify, legal) bypass all gating
  if (isExempt) return NextResponse.next()

  // Unauthenticated users can't access protected routes
  if (isProtected && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  // Authenticated users who haven't completed onboarding go to /onboarding
  if (isAuthenticated && !session.onboardingComplete && path !== '/onboarding') {
    return NextResponse.redirect(new URL('/onboarding', req.nextUrl))
  }

  // Authenticated + onboarded users don't need login/register/onboarding
  if (isAuthenticated && session.onboardingComplete && (isPublic || path === '/onboarding')) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
