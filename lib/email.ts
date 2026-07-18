import { Resend } from 'resend';

// Lazy so importing this module never requires the key (Next's build-time
// page-data collection imports API routes with no env configured).
let _resend: Resend | null = null;
function resendClient(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

interface SendAuditEmailParams {
  clientName: string;
  clientEmail: string;
  tier: string;
  pdfBuffer: Buffer;
}

export async function sendAuditEmail({
  clientName,
  clientEmail,
  tier,
  pdfBuffer,
}: SendAuditEmailParams) {
  const firstName = clientName.split(' ')[0];
  const tierLabel =
    tier === '497'
      ? 'Career Clarity Audit + Strategic Exit Plan'
      : 'Career Clarity Audit';
  const pdfFilename = `${clientName.replace(/\s+/g, '-')}-${tierLabel.replace(/\s+/g, '-')}.pdf`;

  const emailBody =
    tier === '497'
      ? `${firstName},

Your full Career Clarity Audit + Strategic Exit Plan is attached.

Start with Section 5 — the 7-Day Plan. It's sequenced for a reason and Day 1 takes less than 45 minutes.

The copy-paste messages in Section 6 are ready to send. Just fill in each recipient's name where marked.

If anything in the document needs clarification or you want to talk through a specific section, reply here.

Antoine Wade
NxtGen Heights
nxtgenheights.com`
      : `${firstName},

Your Career Clarity Audit is attached.

Start with Section 5 — the 7-Day Plan. Day 1 takes less than 45 minutes and builds momentum for everything that follows.

The copy-paste messages in Section 6 are ready to send. Just fill in each recipient's name where marked.

If anything needs clarification, reply here.

Antoine Wade
NxtGen Heights
nxtgenheights.com`;

  await resendClient().emails.send({
    from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
    to: clientEmail,
    subject: `Your Career Clarity Audit is ready, ${firstName}`,
    text: emailBody,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
      },
    ],
  });
}
