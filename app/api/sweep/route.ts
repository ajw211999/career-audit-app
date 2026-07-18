import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { triggerGeneration } from '@/lib/trigger-generation';
import { sendIntakeReminderEmail } from '@/lib/snapshot-email';

// Vercel cron (every 10 minutes): the recovery lane for the generation
// pipeline. Anything that should be generating but has sat still too long
// gets re-triggered:
// - 'submitted' >15 min: the post-response trigger died (deploy, crash,
//   lambda freeze).
// - 'processing' >20 min: a generate invocation died mid-flight (maxDuration
//   is 300s, so 20 minutes of 'processing' is a corpse, not a slow run).
//   Flipped back to 'submitted' so the CAS claim can run again; the
//   generation_count cap bounds total spend regardless of how many times a
//   row cycles here.
//
// Vercel sends Authorization: Bearer ${CRON_SECRET} to cron routes when the
// env var is set.

export const maxDuration = 300;

const STUCK_SUBMITTED_MIN = 15;
const STUCK_PROCESSING_MIN = 20;
const MAX_PER_SWEEP = 5;

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const supabase = createClient();
  const now = Date.now();
  const submittedCutoff = new Date(now - STUCK_SUBMITTED_MIN * 60_000).toISOString();
  const processingCutoff = new Date(now - STUCK_PROCESSING_MIN * 60_000).toISOString();

  // Dead 'processing' rows go back to 'submitted' (CAS claim requires it).
  // processed_at is null while a generation is in flight for the first time;
  // use the claim-time heuristic: status flipped when the row was last
  // updated, which Supabase doesn't track — so age the row on submitted_at
  // and skip anything too young to judge.
  const { data: deadProcessing } = await supabase
    .from('audits')
    .update({ status: 'submitted' })
    .eq('status', 'processing')
    .lt('submitted_at', processingCutoff)
    .select('id');

  const { data: stuck } = await supabase
    .from('audits')
    .select('id, submitted_at')
    .eq('status', 'submitted')
    .lt('submitted_at', submittedCutoff)
    .order('submitted_at', { ascending: true })
    .limit(MAX_PER_SWEEP);

  const retried: string[] = [];
  for (const row of stuck ?? []) {
    try {
      await triggerGeneration(row.id);
      retried.push(row.id);
    } catch (e) {
      console.error(`sweep: retrigger ${row.id} failed`, e);
    }
  }

  // Paid-but-never-submitted reminders: first after 24h, then every 48h,
  // three max. Plain voice, includes the refund escape hatch, so a stalled
  // buyer becomes a nudged buyer instead of a 60-day chargeback.
  const dayAgo = new Date(now - 24 * 3600_000).toISOString();
  const twoDaysAgo = new Date(now - 48 * 3600_000).toISOString();
  const { data: stalled } = await supabase
    .from('audits')
    .select('id, client_name, client_email, intake_token, paid_at, reminder_count, last_reminder_at')
    .eq('tier', 'snapshot')
    .in('status', ['draft', 'needs_info'])
    .lt('paid_at', dayAgo)
    .lt('reminder_count', 3)
    .or(`last_reminder_at.is.null,last_reminder_at.lt.${twoDaysAgo}`)
    .limit(MAX_PER_SWEEP);

  let reminded = 0;
  for (const row of stalled ?? []) {
    if (!row.intake_token) continue;
    try {
      const days = Math.floor(
        (now - new Date(row.paid_at as string).getTime()) / (24 * 3600_000)
      );
      await sendIntakeReminderEmail({
        clientName: row.client_name,
        clientEmail: row.client_email,
        token: row.intake_token,
        daysSincePurchase: days,
      });
      await supabase
        .from('audits')
        .update({
          reminder_count: (row.reminder_count ?? 0) + 1,
          last_reminder_at: new Date(now).toISOString(),
        })
        .eq('id', row.id);
      reminded += 1;
    } catch (e) {
      console.error(`sweep: reminder ${row.id} failed`, e);
    }
  }

  return NextResponse.json({
    success: true,
    reclaimed: (deadProcessing ?? []).length,
    retried: retried.length,
    reminded,
  });
}
