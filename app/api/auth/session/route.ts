import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getSession();
        if (session) {
            return NextResponse.json({ authenticated: true, user: session.user });
        }
        return NextResponse.json({ authenticated: false }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ authenticated: false }, { status: 500 });
    }
}
