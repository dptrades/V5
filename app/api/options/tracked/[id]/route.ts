import { NextRequest, NextResponse } from 'next/server';
import { deleteTrackedOption } from '@/lib/tracking';

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params;
        const id = decodeURIComponent(rawId);
        
        const success = deleteTrackedOption(id);

        if (success) {
            return NextResponse.json({ success: true, message: 'Option removed from tracking' });
        } else {
            return NextResponse.json({ error: 'Option not found' }, { status: 404 });
        }
    } catch (e: any) {
        console.error('[API Delete Tracked] Error:', e);
        return NextResponse.json({ error: 'Failed to delete tracked option' }, { status: 500 });
    }
}
