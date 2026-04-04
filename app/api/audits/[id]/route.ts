import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { Audit, ApiResponse } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Audit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<Audit>>({
      success: true,
      data: data as Audit,
    });
  } catch (error) {
    console.error('Get audit error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to fetch audit' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('audits')
      .update({ audit_content: body.audit_content })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json<ApiResponse<Audit>>({
      success: true,
      data: data as Audit,
    });
  } catch (error) {
    console.error('Update audit error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to update audit' },
      { status: 500 }
    );
  }
}
