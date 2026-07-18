import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase';
import { triggerGeneration } from '@/lib/trigger-generation';
import type { ApiResponse } from '@/lib/types';

// Protected by middleware (dashboard cookie). Re-triggers generation for an
// audit that errored. Uses the server-side WEBHOOK_SECRET so the browser never
// has to know it.
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // CAS error -> submitted: double-clicked Retry buttons race here and
    // only one wins. The synchronous flip also keeps the dashboard's poll
    // loop from reverting its optimistic update (it renders 'submitted' as
    // queued-for-generation).
    const { data: claimed, error: updateError } = await supabase
      .from('audits')
      .update({ status: 'submitted', error_message: null })
      .eq('id', params.id)
      .eq('status', 'error')
      .select('id')
      .maybeSingle();

    if (updateError) throw updateError;
    if (!claimed) {
      // Not in 'error' (already retried, or mid-generation): nothing to do.
      return NextResponse.json<ApiResponse<null>>({ success: true });
    }

    waitUntil(
      triggerGeneration(params.id).catch((e) =>
        // Row sits in 'submitted'; the sweeper picks it up.
        console.error('retry trigger failed:', e)
      )
    );

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Retry failed' },
      { status: 500 }
    );
  }
}
