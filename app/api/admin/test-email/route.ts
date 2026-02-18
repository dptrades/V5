import { NextResponse } from 'next/server';
import { sendEmailAlert } from '@/lib/notifications';

export async function POST(request: Request) {
    try {
        console.log('[Admin] Sending test email...');

        const success = await sendEmailAlert({
            subject: '🧪 Test Notification: AntiGravity System',
            message: 'This is a test to verify that your email notifications are correctly configured. If you are reading this, the system is working!',
            stocks: [
                { symbol: 'TEST', signal: 'VERIFIED', strength: 100 }
            ]
        });

        if (success) {
            return NextResponse.json({ success: true, message: 'Test email sent successfully' });
        } else {
            return NextResponse.json({
                success: false,
                error: 'Failed to send email. Check logs and RESEND_API_KEY.'
            }, { status: 500 });
        }
    } catch (error) {
        console.error('[Admin] Test email error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
