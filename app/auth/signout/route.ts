import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
    const cookieStore = cookies()
    cookieStore.delete('employee_session')

    // Also try to sign out from Supabase if possible, or just clear the cookie
    // Since we are in a route handler, we can use libs but keeping it simple to just clear cookie
    // which is the source of truth for our middleware.

    return NextResponse.redirect(new URL('/auth/login', request.url))
}
