import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from './prompt';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GenerateAuditParams {
  formattedIntake: string;
  tier: string;
  resumeBase64?: string | null;
  resumeMimeType?: string | null;
}

export async function generateAudit({
  formattedIntake,
  tier,
  resumeBase64,
  resumeMimeType,
}: GenerateAuditParams): Promise<string> {
  const tierLabel =
    tier === '149'
      ? 'TIER PURCHASED: $149 (Full Audit + Exit Plan)'
      : 'TIER PURCHASED: $79 (Career Clarity Audit)';

  const userText = `${formattedIntake}\n\n${tierLabel}\n\nProduce the complete Career Clarity Audit deliverable now. If a resume PDF is attached above, treat it as the authoritative source for work history, titles, dates, and accomplishments — cross-reference it against the intake form and weave specific details from the resume into your positioning recommendations.`;

  // Only PDF resumes can be passed as a Claude document block.
  // Non-PDFs (docx, etc.) fall through and Claude uses intake text only.
  const hasPdfResume = !!resumeBase64 && resumeMimeType === 'application/pdf';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    // 12288 fits the $149 tier's 11 sections (~10-11k tokens observed) with
    // headroom, and keeps total runtime well under the 300s Vercel ceiling.
    // 16384 was pushing right up against the timeout.
    max_tokens: 12288,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: hasPdfResume
          ? [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: resumeBase64 as string,
                },
              },
              { type: 'text', text: userText },
            ]
          : userText,
      },
    ],
  });

  const first = message.content[0];
  if (first.type !== 'text') throw new Error('Unexpected response type');
  return sanitizeOutreachPlaceholders(first.text);
}

/**
 * Claude Sonnet 4.5 has a very strong prior from training data that outreach
 * templates use [Name] / [Company] style brackets — strong enough that no
 * amount of prompt instruction reliably overrides it. This post-processor is
 * the belt-and-suspenders cleanup that runs after generation:
 *
 *   1. Rewrites every known square-bracket recipient variable to the
 *      {{RECIPIENT FIRST NAME}} / {{RECIPIENT COMPANY}} format Antoine's
 *      workflow expects.
 *   2. Strips any "BRACKET AUDIT COMPLETE" self-congratulation line Claude
 *      sometimes appends (which is also usually a false claim).
 *
 * It intentionally does NOT touch unknown bracket patterns — only the ones
 * we've observed in real outputs — so it can't mangle legitimate content
 * like the Section 5 Day 6 resume formula.
 */
function sanitizeOutreachPlaceholders(text: string): string {
  let out = text;

  // Recipient name variants — order matters, match most specific first.
  const nameToken = '{{RECIPIENT FIRST NAME}}';
  out = out.replace(/\[Recruiter First Name\]/gi, nameToken);
  out = out.replace(/\[Recruiter Name\]/gi, nameToken);
  out = out.replace(/\[Recipient First Name\]/gi, nameToken);
  out = out.replace(/\[Recipient Name\]/gi, nameToken);
  out = out.replace(/\[First Name\]/gi, nameToken);
  out = out.replace(/\[Name\]/gi, nameToken);

  // Recipient company variants.
  const companyToken = '{{RECIPIENT COMPANY}}';
  out = out.replace(/\[Recipient Company(?: Name)?\]/gi, companyToken);
  out = out.replace(/\[Company Name\]/gi, companyToken);
  out = out.replace(/\[their company\]/gi, companyToken);
  out = out.replace(/\[Company\]/gi, companyToken);

  // Other per-recipient variables that sometimes slip in.
  out = out.replace(/\[original subject line\]/gi, '{{ORIGINAL SUBJECT LINE}}');
  out = out.replace(/\[X time\]/gi, '{{TIME AT COMPANY}}');

  // Strip "BRACKET AUDIT COMPLETE" self-congratulation lines. Matches
  // optional markdown formatting (**, __, #) and any trailing commentary.
  out = out.replace(/^\s*[*_#]*\s*BRACKET AUDIT[^\n]*$/gim, '');

  // Collapse any triple+ blank lines created by the strip above.
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim();
}
