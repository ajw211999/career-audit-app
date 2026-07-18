import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generatePDF } from '@/lib/pdf';
import { sendAuditEmail } from '@/lib/email';
import { sendSnapshotReportEmail } from '@/lib/snapshot-email';
import { REVIEWER_NOTE_START } from '@/lib/snapshot-prompt';
import type { Audit, ApiResponse } from '@/lib/types';

// Approve triggers PDF render (Puppeteer) + Resend send. Give it room.
export const maxDuration = 300;

/**
 * Strip internal blocks before anything customer-facing is rendered:
 * - the crisis reviewer note (must NEVER reach the customer PDF)
 * - the voice-lint failure banner
 * Then substitute the one permitted token with the real coupon code.
 */
function prepareCustomerContent(content: string): string {
  let out = content;
  // Reviewer note: a **[REVIEWER NOTE FOR ANTOINE...]** header plus its
  // paragraph(s), up to the first section heading.
  const noteIdx = out.indexOf(REVIEWER_NOTE_START);
  if (noteIdx !== -1) {
    const sectionIdx = out.indexOf('## ', noteIdx);
    out =
      out.slice(0, Math.max(0, out.lastIndexOf('**', noteIdx))) +
      (sectionIdx !== -1 ? out.slice(sectionIdx) : '');
  }
  out = out.replace(/^\*\*\[VOICE LINT FAILED[^\]]*\]\*\*\n*/i, '');
  out = out.replaceAll(
    '{{UPSELL_CODE}}',
    process.env.UPSELL_COUPON_CODE || 'SNAPSHOT39'
  );
  return out.trim();
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { id } = params;

  // Read the body BEFORE claiming, so a malformed request can't strand a row
  // in 'approved'.
  const body = await request.json().catch(() => ({}));
  const editedContent = (body as { auditContent?: string }).auditContent;

  // Atomic claim pending_review -> approved: a double-clicked Approve or a
  // second tab no-ops instead of double-emailing the customer.
  const { data: claimed, error: claimError } = await supabase
    .from('audits')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending_review')
    .select('*')
    .maybeSingle();

  if (claimError) {
    console.error('Approve claim error:', claimError);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to approve' },
      { status: 500 }
    );
  }
  if (!claimed) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Not awaiting review (already approved or sent?)' },
      { status: 409 }
    );
  }

  const typedAudit = claimed as Audit;
  const storedContent = editedContent || typedAudit.audit_content;

  if (!storedContent) {
    // Nothing to send — release the claim.
    await supabase
      .from('audits')
      .update({ status: 'pending_review', approved_at: null })
      .eq('id', id)
      .eq('status', 'approved');
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'No audit content to approve' },
      { status: 400 }
    );
  }

  try {
    if (editedContent) {
      await supabase
        .from('audits')
        .update({ audit_content: editedContent })
        .eq('id', id);
    }

    const isSnapshot = typedAudit.tier === 'snapshot';
    const customerContent = isSnapshot
      ? prepareCustomerContent(storedContent)
      : storedContent;

    const pdfBuffer = await generatePDF(
      customerContent,
      typedAudit.client_name,
      typedAudit.tier
    );

    if (isSnapshot) {
      await sendSnapshotReportEmail({
        clientName: typedAudit.client_name,
        clientEmail: typedAudit.client_email,
        pdfBuffer,
      });
    } else {
      await sendAuditEmail({
        clientName: typedAudit.client_name,
        clientEmail: typedAudit.client_email,
        tier: typedAudit.tier,
        pdfBuffer,
      });
    }

    // Past this point the customer HAS the email: never revert to
    // pending_review (a re-approve would send it twice). Best-effort mark
    // sent; if this write fails the row stays 'approved', which the
    // dashboard shows as approved-but-unsent for a human to reconcile.
    await supabase
      .from('audits')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Approve error:', error);

    // Failure BEFORE the send completed: safe to release the claim so the
    // reviewer can retry. (PDF render and Resend throw before delivery; a
    // post-send failure is caught by the block above, not here.)
    try {
      await supabase
        .from('audits')
        .update({ status: 'pending_review', approved_at: null })
        .eq('id', id)
        .eq('status', 'approved');
    } catch {
      // Ignore revert failures
    }

    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed to send audit' },
      { status: 500 }
    );
  }
}
