import type { SnapshotQuestion } from './types';

// Career Clarity Snapshot intake. Name and email come from the Kajabi
// purchase, never from this form (the magic link is a bearer credential;
// letting the form set delivery email would let a leaked link redirect
// someone's report).
//
// All labels/help text are customer copy — Antoine signs off before launch.

export const SNAPSHOT_QUESTIONS: SnapshotQuestion[] = [
  // ── Section 1: Where you are now ──────────────────────────────────
  {
    id: 'current_title',
    section: 'Where you are now',
    label: 'What is your current job title?',
    type: 'text',
    required: true,
    placeholder: 'Example: Senior Operations Manager',
  },
  {
    id: 'industry',
    section: 'Where you are now',
    label: 'What industry are you in?',
    type: 'select',
    required: true,
    options: [
      'Healthcare',
      'Government / Public sector',
      'Education',
      'Finance / Banking / Insurance',
      'Technology',
      'Manufacturing / Logistics',
      'Retail / Hospitality',
      'Nonprofit',
      'Construction / Trades',
      'Media / Marketing',
      'Other',
    ],
  },
  {
    id: 'years_in_role',
    section: 'Where you are now',
    label: 'How long have you been in your current role?',
    type: 'select',
    required: true,
    options: ['Under 1 year', '1-3 years', '3-7 years', '7-15 years', '15+ years'],
  },
  {
    id: 'comp_range',
    section: 'Where you are now',
    label: 'What do you make right now, all-in?',
    help: 'Salary plus any bonus. This stays private and only shapes your recommendations.',
    type: 'select',
    required: true,
    options: [
      'Under $50k',
      '$50k-$75k',
      '$75k-$100k',
      '$100k-$150k',
      '$150k-$200k',
      'Over $200k',
    ],
  },
  {
    id: 'work_setup',
    section: 'Where you are now',
    label: 'How do you work today?',
    type: 'select',
    required: true,
    options: ['Fully on-site', 'Hybrid', 'Fully remote'],
  },

  // ── Section 2: What's driving the move ────────────────────────────
  {
    id: 'move_drivers',
    section: "What's driving the move",
    label: 'Why are you looking? Pick everything that applies.',
    type: 'multiselect',
    required: true,
    options: [
      'Underpaid for what I do',
      'No path up from here',
      'Burned out',
      'My industry or role feels at risk',
      'Bad manager or toxic culture',
      'Laid off or expecting a layoff',
      'I want work that means something',
      'Ready for a bigger challenge',
    ],
  },
  {
    id: 'whats_wrong',
    section: "What's driving the move",
    label: 'In your own words, what is not working?',
    help: 'Two or three honest sentences. The more specific you are, the sharper your Snapshot gets.',
    type: 'textarea',
    required: true,
    minLength: 80,
    placeholder: 'Example: I have been passed over twice for a director role that went to outside hires...',
  },
  {
    id: 'success_12mo',
    section: "What's driving the move",
    label: 'It is 12 months from now and the move worked. What does your work life look like?',
    help: 'Title, money, schedule, how you feel on a Tuesday morning. Paint the picture.',
    type: 'textarea',
    required: true,
    minLength: 80,
  },

  // ── Section 3: What you're working with ───────────────────────────
  {
    id: 'accomplishments',
    section: "What you're working with",
    label: 'Your top 3-5 wins at work, with numbers where you have them.',
    help: 'Money saved, teams led, projects shipped, problems fixed. Rough numbers beat no numbers.',
    type: 'textarea',
    required: true,
    minLength: 100,
    placeholder: 'Example: Cut vendor costs 18% ($240k/yr). Led a team of 12 through a system migration...',
  },
  {
    id: 'target_comp',
    section: "What you're working with",
    label: 'What number are you aiming for, and what are your hard limits?',
    help: 'Target pay, plus anything non-negotiable: location, remote, schedule, industry you will not touch.',
    type: 'textarea',
    required: true,
    minLength: 20,
  },

  // ── Section 4: The clock ──────────────────────────────────────────
  {
    id: 'search_duration',
    section: 'The clock',
    label: 'How long have you been looking, actively or quietly?',
    type: 'select',
    required: true,
    options: [
      'Not started, just thinking',
      'Under 3 months',
      '3-6 months',
      '6-12 months',
      'Over a year',
    ],
  },
  {
    id: 'urgency',
    section: 'The clock',
    label: 'How urgent is this, honestly? 1 means someday, 10 means I need out now.',
    type: 'scale',
    required: true,
  },
  {
    id: 'biggest_fear',
    section: 'The clock',
    label: 'What is your biggest fear about making this move?',
    help: 'Say the real one. This is where the Snapshot earns its money.',
    type: 'textarea',
    required: true,
    minLength: 40,
  },
];

export const SNAPSHOT_SECTIONS: string[] = Array.from(
  new Set(SNAPSHOT_QUESTIONS.map((q) => q.section))
);

/** Answer-field whitelist for the autosave endpoint. */
export const SNAPSHOT_QUESTION_IDS: Set<string> = new Set(
  SNAPSHOT_QUESTIONS.map((q) => q.id)
);

/**
 * Thin-answer guard, run before generation. Returns the list of questions
 * whose answers are missing or under the minimum — empty list means the
 * intake is rich enough to generate a report worth $39.
 */
export function findThinAnswers(
  answers: Record<string, string>
): SnapshotQuestion[] {
  return SNAPSHOT_QUESTIONS.filter((q) => {
    const raw = (answers[q.id] ?? '').trim();
    if (!raw) return q.required;
    if (q.minLength && raw.length < q.minLength) return true;
    return false;
  });
}

/** Format the snapshot answers for the generation prompt. */
export function formatSnapshotIntake(answers: Record<string, string>): string {
  const lines: string[] = ['CLIENT INTAKE (Career Clarity Snapshot):', ''];
  let currentSection = '';
  for (const q of SNAPSHOT_QUESTIONS) {
    if (q.section !== currentSection) {
      currentSection = q.section;
      lines.push(`## ${currentSection}`);
    }
    const answer = (answers[q.id] ?? '').trim() || '(not answered)';
    lines.push(`${q.label}`);
    lines.push(`> ${answer}`);
    lines.push('');
  }
  return lines.join('\n');
}
