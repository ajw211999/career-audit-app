import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { generateAudit, generateSnapshot } from '@/lib/claude';
import { formatIntakeForPrompt } from '@/lib/prompt';
import { formatSnapshotIntake } from '@/lib/snapshot-questions';
import { CRISIS_MARKER } from '@/lib/snapshot-prompt';
import { lintReport } from '@/lib/lint';
import { notifyTelegram } from '@/lib/notify';
import type { Audit, ApiResponse } from '@/lib/types';

// Vercel Pro allows up to 300s. Claude with an attached resume PDF and a
// full 11-section $497-tier deliverable can easily exceed 120s.
export const maxDuration = 300;

// How many Claude calls one submission may ever consume, across retries,
// sweeper re-triggers, and lint regenerations. A hard cost ceiling.
const MAX_GENERATIONS = 4;

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

    // Atomic claim: only rows waiting for generation can be claimed, and only
    // one concurrent caller wins. Retried webhooks, sweeper overlap, and
    // dashboard double-clicks all no-op here instead of double-spending.
    const { data: claimed, error: claimError } = await supabase
      .from('audits')
      .update({ status: 'processing', error_message: null })
      .eq('id', auditId)
      .in('status', ['submitted', 'error'])
      .lt('generation_count', MAX_GENERATIONS)
      .select('*')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimed) {
      // Already claimed, already done, or over the cap — all fine, all no-op.
      return NextResponse.json<ApiResponse<null>>({ success: true });
    }

    const audit = claimed as Audit;

    let content: string;
    let crisis = false;

    if (audit.tier === 'snapshot') {
      const formatted = formatSnapshotIntake(audit.intake_json);

      let attempt = await generateSnapshot({ formattedIntake: formatted });
      let generations = 1;

      // Mechanical voice lint with one regeneration. A second failure still
      // ships to pending_review — a human sees the violations there, and
      // during the gated phase every report is read anyway.
      let lint = lintReport(attempt);
      if (!lint.clean && audit.generation_count + generations < MAX_GENERATIONS) {
        attempt = await generateSnapshot({
          formattedIntake: formatted,
          voiceFeedback: lint.violations.join(', '),
        });
        generations += 1;
        lint = lintReport(attempt);
      }

      crisis = attempt.includes(CRISIS_MARKER);
      // The marker is bookkeeping, not content. The reviewer note itself
      // stays in audit_content so the dashboard shows it; the approve route
      // strips it before the customer PDF.
      content = attempt.replace(CRISIS_MARKER, '').trim();
      if (!lint.clean) {
        content = `**[VOICE LINT FAILED - FIX BEFORE APPROVING: ${lint.violations.join(', ')}]**\n\n${content}`;
      }

      await supabase
        .from('audits')
        .update({
          status: 'pending_review',
          audit_content: content,
          crisis_flag: crisis,
          generation_count: audit.generation_count + generations,
          processed_at: new Date().toISOString(),
        })
        .eq('id', auditId);

      if (crisis) {
        // Expedite, don't delay: the pre-drafted decision is "review this
        // one first, deliver on time, consider a personal note".
        await notifyTelegram(
          `Snapshot CRISIS FLAG: ${audit.client_name}'s report is in review. ` +
            `Read the reviewer note before approving — deliver on time, ` +
            `consider adding a personal line. This row never auto-sends.`
        );
      }
    } else {
      // $197/$497 human-audit pipeline, unchanged.
      const hasPdfResume =
        !!audit.resume_file_base64 &&
        audit.resume_mime_type === 'application/pdf';
      const formattedIntake = formatIntakeForPrompt(
        audit.intake_json,
        hasPdfResume
      );
      content = await generateAudit({
        formattedIntake,
        tier: audit.tier,
        resumeBase64: audit.resume_file_base64,
        resumeMimeType: audit.resume_mime_type,
      });

      await supabase
        .from('audits')
        .update({
          status: 'pending_review',
          audit_content: content,
          generation_count: audit.generation_count + 1,
          processed_at: new Date().toISOString(),
        })
        .eq('id', auditId);
    }

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Generation error:', error);

    if (auditId) {
      try {
        const supabase = createClient();
        // generation_count already advanced on the claim path? No — bump it
        // here so a permanently-failing row cannot burn the API forever: the
        // claim requires count < MAX_GENERATIONS.
        const { data: row } = await supabase
          .from('audits')
          .select('generation_count')
          .eq('id', auditId)
          .maybeSingle();
        await supabase
          .from('audits')
          .update({
            status: 'error',
            error_message:
              error instanceof Error ? error.message : 'Unknown error',
            generation_count: (row?.generation_count ?? 0) + 1,
          })
          .eq('id', auditId)
          .eq('status', 'processing');
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
