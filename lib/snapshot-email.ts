import { Resend } from 'resend';

// Lazy so importing this module never requires the key (Next's build-time
// page-data collection imports API routes with no env configured).
let _resend: Resend | null = null;
function resendClient(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Every customer email: plain text, plain voice, reply-to goes to the
// monitored support inbox so "I never got my link" lands somewhere a human
// (or Marcus's daily sweep) actually reads, not a noreply void.
// All copy below is customer-facing and signed off by Antoine (07-26). Two
// rules to keep: it is Antoine's own voice, first person, signed "Antoine";
// and nothing claims he personally read or reviewed an individual report, so
// the copy stays true when the approve gate flips to auto-send.

const FROM = () =>
  `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`;
const REPLY_TO = () => process.env.SUPPORT_REPLY_TO || process.env.RESEND_FROM_EMAIL!;

const appUrl = () => (process.env.APP_URL || '').replace(/\/$/, '');

export function intakeLinkUrl(token: string): string {
  return `${appUrl()}/intake/${token}`;
}

/** Sent by the webhook (and /start resend): here is your intake link. */
export async function sendIntakeLinkEmail(params: {
  clientName: string;
  clientEmail: string;
  token: string;
}) {
  const firstName = params.clientName.split(' ')[0] || 'there';
  await resendClient().emails.send({
    from: FROM(),
    to: params.clientEmail,
    replyTo: REPLY_TO(),
    subject: 'Your Career Clarity Snapshot: start here',
    text: `${firstName},

Thanks for grabbing the Career Clarity Snapshot.

Your next step takes about 5 minutes: answer the intake questions so the report is about you, not about people like you.

Start here (this link is yours alone, and it saves as you go):
${intakeLinkUrl(params.token)}

You can stop halfway and come back. Same link.

Once you submit, your Snapshot is usually in your inbox within a day.

Questions? Just reply to this email.

Antoine`,
  });
}

/** Sent immediately on intake submission: we got it, it's being built. */
export async function sendSubmissionConfirmationEmail(params: {
  clientName: string;
  clientEmail: string;
}) {
  const firstName = params.clientName.split(' ')[0] || 'there';
  await resendClient().emails.send({
    from: FROM(),
    to: params.clientEmail,
    replyTo: REPLY_TO(),
    subject: 'Got your answers. Your Snapshot is being built.',
    text: `${firstName},

Your answers are in and your Career Clarity Snapshot is being built now.

Your report is usually in your inbox within a day.

Questions? Just reply to this email.

Antoine`,
  });
}

/** Sent when answers are too thin to generate a report worth the money. */
export async function sendNeedsInfoEmail(params: {
  clientName: string;
  clientEmail: string;
  token: string;
  thinQuestionLabels: string[];
}) {
  const firstName = params.clientName.split(' ')[0] || 'there';
  const list = params.thinQuestionLabels.map((l) => `- ${l}`).join('\n');
  await resendClient().emails.send({
    from: FROM(),
    to: params.clientEmail,
    replyTo: REPLY_TO(),
    subject: 'One more pass and your Snapshot will be worth it',
    text: `${firstName},

Before your Snapshot gets built, I want to be straight with you: a few of your answers are too short to give you anything better than generic advice, and generic advice is not what you paid for.

Worth another minute or two each:
${list}

Specifics are what make this work. One real number beats three adjectives.

Your answers are saved. Pick it back up here:
${intakeLinkUrl(params.token)}

Resubmit and your Snapshot is usually in your inbox within a day.

Antoine`,
  });
}

/** Reminder for paid-but-never-submitted (sent by the box-side sweep). */
export async function sendIntakeReminderEmail(params: {
  clientName: string;
  clientEmail: string;
  token: string;
  daysSincePurchase: number;
}) {
  const firstName = params.clientName.split(' ')[0] || 'there';
  await resendClient().emails.send({
    from: FROM(),
    to: params.clientEmail,
    replyTo: REPLY_TO(),
    subject:
      params.daysSincePurchase >= 7
        ? 'Your Snapshot is still waiting on you'
        : 'Your Career Clarity Snapshot is waiting',
    text: `${firstName},

You bought the Career Clarity Snapshot${
      params.daysSincePurchase >= 3 ? ` ${params.daysSincePurchase} days ago` : ' recently'
    } and the intake is still open. No report can be built until you answer the questions. It takes about 5 minutes.

Pick it up here (your answers so far are saved):
${intakeLinkUrl(params.token)}

Submit today and your report is usually in your inbox within a day.

Antoine`,
  });
}

/** The finished report. Signed by Antoine; no claim of a per-report human review. */
export async function sendSnapshotReportEmail(params: {
  clientName: string;
  clientEmail: string;
  pdfBuffer: Buffer;
}) {
  const firstName = params.clientName.split(' ')[0] || 'there';
  await resendClient().emails.send({
    from: FROM(),
    to: params.clientEmail,
    replyTo: REPLY_TO(),
    subject: `Your Career Clarity Snapshot is ready, ${firstName}`,
    text: `${firstName},

Your Career Clarity Snapshot is attached.

Read Section 2 first. Your zone sets the clock for everything else.

Then go straight to Section 4 and put the first move on your calendar for this week. The Snapshot only works if the moves happen.

It was built from your answers on my Career Clarity Audit framework.

If anything is unclear, just reply to this email.

Antoine`,
    attachments: [
      {
        filename: `${params.clientName.replace(/\s+/g, '-')}-Career-Clarity-Snapshot.pdf`,
        content: params.pdfBuffer,
      },
    ],
  });
}
