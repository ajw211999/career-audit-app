import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { ApiResponse } from '@/lib/types';

// Protected by middleware (dashboard cookie). Re-triggers generation for an
// audit that errored. Uses the server-side WEBHOOK_SECRET so the browser never
// has to know it.
//
// Critical: we MUST flip the row to 'processing' before returning, otherwise
// the dashboard's poll loop can see the stale 'error' state and revert the
// optimistic UI update, causing the Retry button to flicker back.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // Synchronously transition state so the UI poll sees 'processing' on
    // its next tick instead of the stale 'error' row.
    const { error: updateError } = await supabase
      .from('audits')
      .update({ status: 'processing', error_message: null })
      .eq('id', params.id);

    if (updateError) throw updateError;

    // Fire-and-forget: /api/generate will run Claude and flip to pending_review.
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditId: params.id,
        secret: process.env.WEBHOOK_SECRET,
      }),
    });

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Retry failed' },
      { status: 500 }
    );
  }
}
