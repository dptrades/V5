import { NextResponse } from 'next/server';
import { login, verifySignupToken, saveUser } from '@/lib/auth';
import { env } from '@/lib/env';

export async function POST(req: Request) {
    try {
        const { email, code, signupToken } = await req.json();

        if (!email || !code || !signupToken) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Verify the Stateless Signup Token
        const payload = await verifySignupToken(signupToken);

        if (!payload) {
            return NextResponse.json({ error: 'Session expired. Please start over.' }, { status: 400 });
        }

        // 2. Security Check: Ensure email matches the token
        if (payload.email !== email) {
            return NextResponse.json({ error: 'Email mismatch. Please start over.' }, { status: 400 });
        }

        // 3. Verify the Access Key
        if (code !== env.TRADER_ACCESS_KEY) {
            return NextResponse.json({ error: 'Invalid Trader Access Key' }, { status: 401 });
        }

        // 4. Persist User Data (Vercel KV)
        await saveUser({ name: payload.name, email: payload.email });

        // 5. Create Session (4 hours)
        await login({ name: payload.name, email: payload.email });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Verification Error:', error);
        return NextResponse.json({ error: 'Failed to verify access key' }, { status: 500 });
    }
}
