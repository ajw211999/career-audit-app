import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/lib/types';

// Protected by middleware (dashboard cookie). Re-triggers generation for an
// audit that errored. Uses the server-side WEBHOOK_SECRET so the browser never
// has to know it.
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fire-and-forget: /api/generate will mark the row as processing and run.
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
