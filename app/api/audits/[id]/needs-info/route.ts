import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendNeedsInfoEmail } from '@/lib/snapshot-email';
import {
  SNAPSHOT_QUESTIONS,
  findThinAnswers,
} from '@/lib/snapshot-questions';
import type { Audit, ApiResponse } from '@/lib/types';

// Dashboard action (protected by middleware): the generated report is too
// weak to send because the answers underneath it are too thin. One click
// reopens the intake and emails the buyer a plain-voice "give us more"
// instead of shipping a horoscope. Snapshot rows only.

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    // CAS pending_review -> needs_info: reopens the magic link for editing.
    const { data: claimed, error } = await supabase
      .from('audits')
      .update({ status: 'needs_info' })
      .eq('id', params.id)
      .eq('tier', 'snapshot')
      .eq('status', 'pending_review')
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!claimed) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Not a snapshot awaiting review' },
        { status: 409 }
      );
    }

    const audit = claimed as Audit;
    // Point the buyer at the mechanically-thin answers when there are any;
    // otherwise nudge the three highest-leverage free-text questions.
    const thin = findThinAnswers(audit.intake_json);
    const labels =
      thin.length > 0
        ? thin.map((q) => q.label)
        : SNAPSHOT_QUESTIONS.filter((q) =>
            ['whats_wrong', 'accomplishments', 'biggest_fear'].includes(q.id)
          ).map((q) => q.label);

    if (audit.intake_token) {
      await sendNeedsInfoEmail({
        clientName: audit.client_name,
        clientEmail: audit.client_email,
        token: audit.intake_token,
        thinQuestionLabels: labels,
      });
    }

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('needs-info error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Failed' },
      { status: 500 }
    );
  }
}
