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

  // Idempotency: same transaction already seen -> resend that row's link.
  if (txnId) {
    const { data: existing } = await supabase
      .from('audits')
      .select('id, intake_token, client_name, client_email, status')
      .eq('kajabi_transaction_id', txnId)
      .maybeSingle();
    if (existing?.intake_token) {
      if (existing.status === 'draft') {
        await sendIntakeLinkEmail({
          clientName: existing.client_name,
          clientEmail: existing.client_email,
          token: existing.intake_token,
        });
      }
      return NextResponse.json({ success: true, duplicate: true });
    }
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
