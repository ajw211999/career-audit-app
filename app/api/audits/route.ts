import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { Audit, ApiResponse } from '@/lib/types';

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
