import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('employee_session')
    const isAuthPage = request.nextUrl.pathname.startsWith('/auth')
    const isProtectedPage = request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/employees') ||
        request.nextUrl.pathname.startsWith('/projects') ||
        request.nextUrl.pathname === '/'

    // Redirect to login if accessing protected page without session
    if (isProtectedPage && !session) {
        return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Redirect to dashboard if accessing auth page with active session
    if (isAuthPage && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect root to dashboard
    if (request.nextUrl.pathname === '/' && session) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
