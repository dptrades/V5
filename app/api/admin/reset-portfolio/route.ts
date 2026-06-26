import { NextResponse } from 'next/server';
import { resetPaperPortfolio } from '@/lib/paper-trading';

/**
 * POST: Reset portfolio (Close all simulated positions, restore cash to $1000)
 */
export async function POST() {
    console.log('[Admin] Resetting simulated portfolio...');

    try {
        resetPaperPortfolio();

        return NextResponse.json({
            success: true,
            message: 'Simulated portfolio reset successful. Cash balance restored to $1,000.'
        });

    } catch (error) {
        console.error('[Admin] Reset failed:', error);
        return NextResponse.json({
            error: 'Failed to reset simulated portfolio',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
