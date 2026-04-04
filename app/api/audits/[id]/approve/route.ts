import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generatePDF } from '@/lib/pdf';
import { sendAuditEmail } from '@/lib/email';
import type { Audit, ApiResponse } from '@/lib/types';

// Approve triggers PDF render (Puppeteer) + Resend send. Give it room.
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    const { data: audit, error } = await supabase
      .from('audits')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !audit) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Audit not found' },
        { status: 404 }
      );
    }

    const typedAudit = audit as Audit;

    // Get edited content from request body (if edited before approving)
    const body = await request.json().catch(() => ({}));
    const finalContent = (body as { auditContent?: string }).auditContent || typedAudit.audit_content;

    if (!finalContent) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No audit content to approve' },
        { status: 400 }
      );
    }

    // Update content if edited
    if ((body as { auditContent?: string }).auditContent) {
      await supabase
        .from('audits')
        .update({ audit_content: finalContent })
        .eq('id', id);
    }

    // Mark as approved
    await supabase
      .from('audits')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Generate PDF
    const pdfBuffer = await generatePDF(
      finalContent,
      typedAudit.client_name,
      typedAudit.tier
    );

    // Send email with PDF
    await sendAuditEmail({
      clientName: typedAudit.client_name,
      clientEmail: typedAudit.client_email,
      tier: typedAudit.tier,
      pdfBuffer,
    });

    // Mark as sent
    await supabase
      .from('audits')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Approve error:', error);

    // Revert to pending_review on failure
    try {
      const supabase = createClient();
      await supabase
        .from('audits')
        .update({ status: 'pending_review' })
        .eq('id', params.id);
    } catch {
      // Ignore revert failures
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to send audit' },
      { status: 500 }
    );
  }
}
