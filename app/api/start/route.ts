import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendIntakeLinkEmail } from '@/lib/snapshot-email';

// Find-my-link: the buyer-facing recovery lane (and the thank-you page's
// target). Enter your purchase email, the system re-emails your intake link.
// The link is a bearer credential, so it is ONLY ever sent to the purchase
// email on file — never returned in the response body.
//
// Rows are created by the Kajabi webhook or the box-side hourly
// reconciliation; this route never mints one, so a typo'd or malicious email
// cannot fabricate a purchase.

// Naive in-memory rate limit: fine per-lambda, backstopped by the fact that
// the route only ever emails the address on file.
const hits = new Map<string, { count: number; windowStart: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > 60_000) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > 5;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: 'Too many attempts. Give it a minute and try again.' },
      { status: 429 }
    );
  }

  let email = '';
  try {
    const body = await request.json();
    email = String(body.email ?? '').trim().toLowerCase();
  } catch {
    /* fall through to validation */
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { success: false, error: 'Enter the email you used at checkout.' },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const { data: rows } = await supabase
    .from('audits')
    .select('id, intake_token, client_name, client_email, status')
    .eq('tier', 'snapshot')
    .eq('client_email', email)
    .order('created_at', { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (row?.intake_token && (row.status === 'draft' || row.status === 'needs_info')) {
    try {
      await sendIntakeLinkEmail({
        clientName: row.client_name,
        clientEmail: row.client_email,
        token: row.intake_token,
      });
    } catch (e) {
      console.error('start: resend failed', e);
    }
  }

  // Uniform response regardless of outcome: no purchase-email enumeration,
  // and a buyer whose purchase hasn't synced yet gets honest expectations.
  return NextResponse.json({
    success: true,
    message:
      'If that email has a Career Clarity Snapshot purchase, your intake link is on its way to it now. Purchases can take up to an hour to sync after checkout. Nothing after an hour? Reply to any of our emails and a human will sort it out.',
  });
}
