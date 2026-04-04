import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateAudit } from '@/lib/claude';
import { formatIntakeForPrompt } from '@/lib/prompt';
import type { Audit, ApiResponse } from '@/lib/types';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  let auditId: string | undefined;

  try {
    const body = await request.json();

    if (body.secret !== process.env.WEBHOOK_SECRET) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    auditId = body.auditId;
    const supabase = createClient();

    // Fetch the audit record
    const { data: audit, error: fetchError } = await supabase
      .from('audits')
      .select('*')
      .eq('id', auditId)
      .single();

    if (fetchError || !audit) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Audit not found' },
        { status: 404 }
      );
    }

    const typedAudit = audit as Audit;

    // Set status back to processing (handles Retry case)
    await supabase
      .from('audits')
      .update({ status: 'processing', error_message: null })
      .eq('id', auditId);

    // Format intake and generate
    const hasPdfResume =
      !!typedAudit.resume_file_base64 &&
      typedAudit.resume_mime_type === 'application/pdf';
    const formattedIntake = formatIntakeForPrompt(
      typedAudit.intake_json,
      hasPdfResume
    );
    const auditContent = await generateAudit({
      formattedIntake,
      tier: typedAudit.tier,
      resumeBase64: typedAudit.resume_file_base64,
      resumeMimeType: typedAudit.resume_mime_type,
    });

    // Update to pending review
    await supabase
      .from('audits')
      .update({
        status: 'pending_review',
        audit_content: auditContent,
        processed_at: new Date().toISOString(),
      })
      .eq('id', auditId);

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Generation error:', error);

    // Attempt to mark as error in Supabase
    if (auditId) {
      try {
        const supabase = createClient();
        await supabase
          .from('audits')
          .update({
            status: 'error',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', auditId);
      } catch {
        // Ignore error update failures
      }
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Generation failed' },
      { status: 500 }
    );
  }
}
