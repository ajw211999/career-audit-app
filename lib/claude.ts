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
  return first.text;
}
