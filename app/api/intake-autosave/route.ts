import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { SNAPSHOT_QUESTION_IDS } from '@/lib/snapshot-questions';

// Autosave for the snapshot intake. The token is a bearer credential, so the
// write surface is deliberately tiny: answer fields only, from the question
// whitelist, only while the row is still editable. Delivery email and name
// always come from the Kajabi purchase and can never be written here.

const MAX_ANSWER_CHARS = 4000;

// Per-token rate limit (per lambda instance; a cost/abuse damper, not a
// security boundary — the whitelist is the security boundary).
const hits = new Map<string, { count: number; windowStart: number }>();
function rateLimited(token: string): boolean {
  const now = Date.now();
  const h = hits.get(token);
  if (!h || now - h.windowStart > 60_000) {
    hits.set(token, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > 30;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    return NextResponse.json({ success: false }, { status: 429 });
  }

  const incoming = body.answers ?? {};
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (!SNAPSHOT_QUESTION_IDS.has(k)) continue;
    clean[k] = String(v ?? '').slice(0, MAX_ANSWER_CHARS);
  }
  if (Object.keys(clean).length === 0) {
    return NextResponse.json({ success: true });
  }

  const supabase = createClient();
  const { data: row } = await supabase
    .from('audits')
    .select('id, status, intake_json')
    .eq('intake_token', token)
    .eq('tier', 'snapshot')
    .maybeSingle();

  if (!row || (row.status !== 'draft' && row.status !== 'needs_info')) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  const merged = {
    ...((row.intake_json as Record<string, string>) || {}),
    ...clean,
  };

  const { error } = await supabase
    .from('audits')
    .update({ intake_json: merged })
    .eq('id', row.id)
    .in('status', ['draft', 'needs_info']);

  if (error) {
    console.error('autosave failed:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
