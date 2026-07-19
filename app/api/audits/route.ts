import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { Audit, ApiResponse } from '@/lib/types';

// Next 14 statically caches parameterless GET route handlers at build time —
// without this, the dashboard list freezes at whatever rows existed at deploy.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json<ApiResponse<Audit[]>>({
      success: true,
      data: data as Audit[],
    });
  } catch (error) {
    console.error('List audits error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch audits' },
      { status: 500 }
    );
  }
}
