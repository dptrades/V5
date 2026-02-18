import { NextResponse } from 'next/server';
import { createSignupToken } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const { name, email, disclaimerAccepted } = await req.json();

        if (!name || !email || !disclaimerAccepted) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create Stateless Signup Token
        // This token holds the user details securely (signed) to pass to the next step
        const signupToken = await createSignupToken({ email, name });

        // Return the token to the client so it can pass it back during key verification
        return NextResponse.json({
            success: true,
            message: 'Proceed to Access Key verification',
            signupToken
        });
    } catch (error) {
        console.error('Auth Error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
