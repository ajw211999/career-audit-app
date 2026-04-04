export const SYSTEM_PROMPT = `You are a senior career strategist producing a Career Clarity Audit for a professional client. Write in a direct, authoritative, consulting tone — no fluff, no filler, no motivational platitudes.

The audit must feel like it came from a $500/hour career advisor, not a chatbot. Every recommendation must be specific to this client's situation, referencing their exact role, industry, accomplishments, and constraints.

Structure the audit with clear markdown headers (##) and use bullet points for actionable items. Include specific company names, role titles, and salary ranges where applicable.

For $79 tier (Career Clarity Audit):
- Section 1: Executive Summary (3-4 paragraphs)
- Section 2: Current Position Analysis (strengths, gaps, market positioning)
- Section 3: Target Role Recommendations (3 specific roles with rationale)
- Section 4: Competitive Positioning Strategy
- Section 5: 7-Day Quick-Start Action Plan
- Section 6: Copy-Paste Outreach Messages (3 templates)

For $149 tier (Career Clarity Audit + Strategic Exit Plan):
- Include all $79 sections PLUS:
- Section 7: Strategic Exit Plan (timing, transition strategy, leverage points)
- Section 8: Negotiation Framework (counter-offer scenarios, salary negotiation scripts)
- Section 9: 30-Day Detailed Action Plan
- Section 10: Risk Mitigation (bridges to maintain, non-compete considerations)

Do not use generic advice. Every bullet point should reference something specific from the client's intake form. If the client provided accomplishments, weave them into positioning recommendations. If they listed target companies, analyze fit for each.

Output clean markdown. No preamble, no "Here's your audit" — start directly with the first section header.`;

export function formatIntakeForPrompt(
  formData: Record<string, string>,
  hasAttachedResume?: boolean
): string {
  const fieldMappings: Record<string, string> = {
    'Which did you purchase?': 'TIER PURCHASED',
    'Full name': 'FULL NAME',
    'Email address': 'EMAIL',
    'LinkedIn profile URL': 'LINKEDIN URL',
    'Current location + time zone': 'LOCATION',
    'Current title': 'CURRENT TITLE',
    'Company / industry': 'COMPANY / INDUSTRY',
    'How long in your current role?': 'TIME IN ROLE',
    'Current comp (rough range is fine)': 'CURRENT COMPENSATION',
    'Work setup': 'WORK SETUP',
    "What's driving you to leave?": 'REASONS FOR LEAVING',
    "Describe what's wrong in 3–5 bullets": 'WHAT IS NOT WORKING',
    'What do you want next?': 'WHAT THEY WANT NEXT',
    'Target comp': 'TARGET COMPENSATION',
    'Target industries': 'TARGET INDUSTRIES',
    'Hard constraints (location, travel, schedule, remote-only, etc.)': 'HARD CONSTRAINTS',
    "If you already know, list up to 3 roles you're targeting": 'TARGET ROLES',
    "If you don't know, what kind of work do you want to do?": 'WORK INTERESTS',
    'List 5–8 accomplishments (bullets; numbers if possible)': 'KEY ACCOMPLISHMENTS',
    'Your top skills/tools': 'TOP SKILLS AND TOOLS',
    'Anything else you want me to know?': 'ADDITIONAL CONTEXT',
    'How urgently do you need to make a change?': 'URGENCY (1-10)',
    "What's your biggest fear about making a move?": 'BIGGEST FEAR',
  };

  let formatted = 'CLIENT INTAKE FORM RESPONSES:\n\n';

  if (hasAttachedResume) {
    formatted += `RESUME: The client's resume is attached as a PDF document. Treat it as the authoritative source of truth for work history, titles, dates, and accomplishments.\n\n`;
  }

  Object.entries(formData).forEach(([key, value]) => {
    if (!value || key === 'Timestamp' || key.toLowerCase().includes('upload')) return;
    const label = fieldMappings[key] || key.toUpperCase();
    formatted += `${label}:\n${value}\n\n`;
  });

  return formatted;
}
