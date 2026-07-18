import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@/lib/supabase';
import {
  SNAPSHOT_QUESTION_IDS,
  findThinAnswers,
} from '@/lib/snapshot-questions';
import { sendSubmissionConfirmationEmail } from '@/lib/snapshot-email';
import { triggerGeneration } from '@/lib/trigger-generation';

// Submit the snapshot intake. Validates server-side (the thin-answer guard
// runs here, not just in the browser), moves draft -> submitted atomically,
// confirms by email, and triggers generation AFTER the response is sent —
// never as a fire-and-forget fetch inside the request (Vercel freezes the
// lambda on return and the fetch dies; that was the old intake route's bug).

// The after() callback awaits generation, so this route needs the same
// ceiling as /api/generate. The buyer's response returns immediately; only
// the background tail runs long.
export const maxDuration = 300;

const MAX_ANSWER_CHARS = 4000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const submits = new Map<string, { count: number; windowStart: number }>();
function rateLimited(token: string): boolean {
  const now = Date.now();
  const h = submits.get(token);
  if (!h || now - h.windowStart > 24 * 3600_000) {
    submits.set(token, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > 5;
}

export async function POST(request: NextRequest) {
  let body: { token?: string; answers?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const token = String(body.token ?? '');
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ success: false }, { status: 404 });
  }
  if (rateLimited(token)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts today. Reply to any of our emails if you are stuck.' },
      { status: 429 }
    );
  }

  const supabase = createClient();
  const { data: row } = await supabase
    .from('audits')
    .select('id, status, intake_json, client_name, client_email')
    .eq('intake_token', token)
    .eq('tier', 'snapshot')
    .maybeSingle();

  if (!row || (row.status !== 'draft' && row.status !== 'needs_info')) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  // Merge the final client answers over what autosave already stored.
  const incoming = body.answers ?? {};
  const merged = { ...((row.intake_json as Record<string, string>) || {}) };
  for (const [k, v] of Object.entries(incoming)) {
    if (!SNAPSHOT_QUESTION_IDS.has(k)) continue;
    merged[k] = String(v ?? '').slice(0, MAX_ANSWER_CHARS);
  }

  // Thin-answer guard: a weak intake produces a horoscope, and a horoscope
  // gets screenshotted. Block at the door with specifics.
  const thin = findThinAnswers(merged);
  if (thin.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'A few answers need more before the report is worth building.',
        thin: thin.map((q) => ({
          id: q.id,
          message: q.minLength
            ? `Give this a little more. Specifics are what make the report about you.`
            : 'This one is required.',
        })),
      },
      { status: 422 }
    );
  }

  // Atomic transition: only one submit wins, double-clicks and replays no-op.
  const { data: updated, error } = await supabase
    .from('audits')
    .update({
      intake_json: merged,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .in('status', ['draft', 'needs_info'])
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('submit failed:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Your answers are saved. Try again.' },
      { status: 500 }
    );
  }
  if (!updated) {
    // Lost the race to another submit — that one is doing the work.
    return NextResponse.json({ success: true });
  }

  waitUntil(
    (async () => {
      try {
        await sendSubmissionConfirmationEmail({
          clientName: row.client_name,
          clientEmail: row.client_email,
        });
      } catch (e) {
        console.error('confirmation email failed:', e);
      }
      try {
        await triggerGeneration(row.id);
      } catch (e) {
        // The sweeper cron picks up stuck 'submitted' rows.
        console.error('generation trigger failed:', e);
      }
    })()
  );

  return NextResponse.json({ success: true });
}
