import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase';
import { triggerGeneration } from '@/lib/trigger-generation';
import type { ApiResponse } from '@/lib/types';

// The after() callback awaits generation (same ceiling as /api/generate).
export const maxDuration = 300;

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
    // Google's auto-collected email column is "Email Address" on newer forms
    // and "Email address" on older ones — match any key containing "email".
    const emailKey = Object.keys(formData).find((k) =>
      k.toLowerCase().includes('email')
    );
    const clientEmail = (emailKey && formData[emailKey]) || '';
    // Form options are "Career Clarity Audit ($197)" / "Audit + Exit Plan ($497)"
    const tier = formData['Which did you purchase?']?.includes('497') ? '497' : '197';

    // Dedup: skip if same email submitted within last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('audits')
      .select('id')
      .eq('client_email', clientEmail)
      .gte('created_at', tenMinAgo)
      .limit(1)
      .maybeSingle();

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
        // 'submitted' = waiting for generation. /api/generate atomically
        // claims submitted -> processing; the sweeper re-triggers any row
        // stuck here, so a lost trigger is recoverable instead of terminal.
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        intake_json: formData,
        resume_url: resumeUrl || null,
        resume_file_base64: resumeFileBase64 || null,
        resume_mime_type: resumeMimeType || null,
        resume_filename: resumeFilename || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Trigger generation without blocking the response. A bare fire-and-forget
    // fetch dies when Vercel freezes the lambda on return; waitUntil() keeps
    // the invocation alive until generation finishes, and the sweeper cron
    // re-triggers the row if this invocation dies anyway.
    waitUntil(
      triggerGeneration(audit.id).catch((e) =>
        console.error('generation trigger failed:', e)
      )
    );

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
