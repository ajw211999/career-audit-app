import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import type { ApiResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const {
      formData,
      resumeUrl,
      resumeFileBase64,
      resumeMimeType,
      resumeFilename,
    } = body;
    const supabase = createClient();

    // Extract key fields from form data
    const clientName = formData['Full name'] || formData['Name'] || 'Unknown';
    const clientEmail = formData['Email address'] || formData['Email'] || '';
    const tier = formData['Which did you purchase?']?.includes('149') ? '149' : '79';

    // Dedup: skip if same email submitted within last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('audits')
      .select('id')
      .eq('client_email', clientEmail)
      .gte('created_at', tenMinAgo)
      .single();

    if (existing) {
      return NextResponse.json<ApiResponse<null>>({ success: true });
    }

    // Create audit record
    const { data: audit, error: insertError } = await supabase
      .from('audits')
      .insert({
        client_name: clientName,
        client_email: clientEmail,
        tier,
        status: 'processing',
        intake_json: formData,
        resume_url: resumeUrl || null,
        resume_file_base64: resumeFileBase64 || null,
        resume_mime_type: resumeMimeType || null,
        resume_filename: resumeFilename || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Fire-and-forget: trigger generation as separate serverless invocation
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditId: audit.id,
        secret: process.env.WEBHOOK_SECRET,
      }),
    });

    return NextResponse.json<ApiResponse<{ auditId: string }>>({
      success: true,
      data: { auditId: audit.id },
    });
  } catch (error) {
    console.error('Intake error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
