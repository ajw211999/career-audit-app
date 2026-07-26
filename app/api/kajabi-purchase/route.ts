import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendIntakeLinkEmail } from '@/lib/snapshot-email';

// Kajabi purchase webhook for the Career Clarity Snapshot offer.
//
// Hard-won constraints from the box's production webhook history:
// - Kajabi probes the target URL with HEAD/GET and marks the hook dead on a
//   405 (07-11 incident). Both verbs must answer 200.
// - Kajabi does not sign payloads. Auth is the unguessable ?key= token.
// - Kajabi retries failed deliveries for hours, and two UI-created hooks can
//   deliver the same purchase twice. The kajabi_transaction_id UNIQUE
//   constraint is the idempotency key: a duplicate delivery re-sends the
//   EXISTING intake link instead of minting a second one.
// - This is the accelerator lane only. The thank-you-page /start flow is the
//   primary lane, and the box-side hourly reconciliation is the backstop, so
//   a dropped delivery here never strands a buyer.

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key');
  if (!key || key !== process.env.KAJABI_WEBHOOK_KEY) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  // Flat UI-webhook shape: {event, offer:{id,title}, member:{email,name},
  // payment_transaction:{id,...}}
  const offer = (body.offer ?? {}) as Record<string, unknown>;
  const member = (body.member ?? {}) as Record<string, unknown>;
  const txn = (body.payment_transaction ??
    body.transaction ??
    {}) as Record<string, unknown>;

  const offerId = String(offer.id ?? '');
  const email = String(member.email ?? '').trim().toLowerCase();
  const name = String(member.name ?? '').trim();

  // Only the Snapshot offer creates rows here; every other offer's purchase
  // is someone else's pipeline. Return 200 so Kajabi never marks us dead.
  if (offerId !== process.env.KAJABI_SNAPSHOT_OFFER_ID) {
    return NextResponse.json({ success: true, ignored: true });
  }
  if (!email) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const txnId = txn.id != null ? `kajabi-txn-${String(txn.id)}` : null;
  const supabase = createClient();

  // A duplicate delivery re-sends the buyer's existing link, which is the
  // right answer for a Kajabi retry hours later. It is the wrong answer for
  // two events firing on the same purchase seconds apart, where the first
  // delivery already emailed them. So only resend once the row has had time
  // to be missed.
  const RESEND_AFTER_MS = 10 * 60 * 1000;
  type ExistingRow = {
    id: string;
    intake_token: string;
    client_name: string;
    client_email: string;
    status: string;
    created_at: string;
  };
  const resendIfStale = async (row: ExistingRow) => {
    if (row.status !== 'draft') return false;
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age < RESEND_AFTER_MS) return false;
    await sendIntakeLinkEmail({
      clientName: row.client_name,
      clientEmail: row.client_email,
      token: row.intake_token,
    });
    return true;
  };
  const COLS =
    'id, intake_token, client_name, client_email, status, created_at, kajabi_transaction_id';

  // Idempotency, first pass: this exact transaction has been seen before.
  if (txnId) {
    const { data: existing } = await supabase
      .from('audits')
      .select(COLS)
      .eq('kajabi_transaction_id', txnId)
      .maybeSingle();
    if (existing?.intake_token) {
      const resent = await resendIfStale(existing as ExistingRow);
      return NextResponse.json({ success: true, duplicate: true, resent });
    }
  }

  // Idempotency, second pass: same purchase arriving as a different event.
  // Kajabi can be wired to deliver both payment.succeeded and an order/cart
  // event, and order-shaped payloads carry no payment transaction. A null
  // transaction id slips past the UNIQUE constraint every time, so without
  // this a single purchase mints one row per event, with an intake link and a
  // generated report for each.
  //
  // Match only a row this buyer has not started filling in, inside a short
  // window. Someone genuinely buying a second Snapshot later still gets their
  // own row, because the window is short and started rows never match.
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: sameBuyer } = await supabase
    .from('audits')
    .select(COLS)
    .eq('tier', 'snapshot')
    .eq('client_email', email)
    .eq('status', 'draft')
    .is('submitted_at', null)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sameBuyer?.intake_token) {
    // Backfill the id so later retries take the cheap first-pass route.
    if (txnId && !sameBuyer.kajabi_transaction_id) {
      await supabase
        .from('audits')
        .update({ kajabi_transaction_id: txnId })
        .eq('id', sameBuyer.id);
    }
    const resent = await resendIfStale(sameBuyer as ExistingRow);
    return NextResponse.json({
      success: true,
      duplicate: true,
      matchedBy: 'same-buyer-window',
      resent,
    });
  }

  const { data: created, error } = await supabase
    .from('audits')
    .insert({
      client_name: name || email,
      client_email: email,
      tier: 'snapshot',
      status: 'draft',
      intake_json: {},
      kajabi_transaction_id: txnId,
      paid_at: new Date().toISOString(),
    })
    .select('id, intake_token')
    .single();

  if (error) {
    // Unique-violation race (Kajabi retried while the first insert was in
    // flight): the row exists, the first request owns the email. Still 200.
    if (error.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true });
    }
    console.error('kajabi-purchase insert failed:', error);
    // Non-200 makes Kajabi retry, which is what we want for a real failure.
    return NextResponse.json({ success: false }, { status: 500 });
  }

  try {
    await sendIntakeLinkEmail({
      clientName: name || email,
      clientEmail: email,
      token: created.intake_token as string,
    });
  } catch (e) {
    // Row exists; the /start lane and the reconciliation sweep can still
    // deliver the link. Log and accept.
    console.error('intake link email failed:', e);
  }

  return NextResponse.json({ success: true });
}
