import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('employee_session')
    let hasValidSession = false

    if (sessionCookie) {
        try {
            JSON.parse(sessionCookie.value)
            hasValidSession = true
        } catch {
            hasValidSession = false
        }
    }
    const isAuthPage = request.nextUrl.pathname.startsWith('/auth') && !request.nextUrl.pathname.startsWith('/auth/signout')
    const isProtectedPage = request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/employees') ||
        request.nextUrl.pathname.startsWith('/projects') ||
        request.nextUrl.pathname === '/'

    // Redirect to login if accessing protected page without session
    if (isProtectedPage && !hasValidSession) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Redirect to dashboard if accessing auth page with active session
    if (isAuthPage && hasValidSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect root to dashboard
    if (request.nextUrl.pathname === '/' && hasValidSession) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
