import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { env } from './lib/env'

const SECRET_KEY = env.JWT_SECRET || "";
const key = new TextEncoder().encode(SECRET_KEY);

export async function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value

    // Paths that don't require authentication
    if (
        request.nextUrl.pathname.startsWith('/api/auth') ||
        request.nextUrl.pathname.startsWith('/api/live-price') ||
        request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.includes('.') // Static files
    ) {
        return NextResponse.next()
    }

    if (!session) {
        // If it's an API route, return 401
        if (request.nextUrl.pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        // If it's a page, we handle it client-side in layout/page for better UX (showing the overlay)
        // but we still want to ensure cookies are cleared if invalid
        return NextResponse.next()
    }

    try {
        await jwtVerify(session, key);
        return NextResponse.next()
    } catch (error) {
        // Invalid session, clear cookie
        const response = NextResponse.next()
        response.cookies.delete('session')
        return response
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
