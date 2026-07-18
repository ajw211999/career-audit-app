// Mechanical voice lint for generated Snapshot reports. Prompting alone does
// not reliably hold Claude to the ban list, and one AI-tell screenshot in the
// comments costs more than a regeneration. The generate route runs this and
// regenerates once on failure; a second failure goes to pending_review with
// the violations recorded so a human sees them.

export interface LintResult {
  clean: boolean;
  violations: string[];
}

const BANNED_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // Em/en dashes are Antoine's known AI tell. The double-hyphen also reads
  // as a dash in print.
  { re: /—/g, label: 'em dash' },
  { re: /–/g, label: 'en dash' },
  { re: /(?<!-)--(?!-)/g, label: 'double-hyphen dash' },
  // "it's not just X, it's Y" family.
  {
    re: /\b(?:it'?s|this is|that'?s) not (?:just|only|merely)\b[^.]{0,80}\b(?:it'?s|this is|that'?s)\b/gi,
    label: '"not just X, it\'s Y" construction',
  },
  { re: /\bgame.?changer/gi, label: '"game-changer"' },
  { re: /\bunlock(?:ing|ed|s)?\b/gi, label: '"unlock"' },
  { re: /\bunleash/gi, label: '"unleash"' },
  { re: /\bdive (?:in|into|deep)/gi, label: '"dive in"' },
  { re: /\bdelve/gi, label: '"delve"' },
  { re: /\bseamless/gi, label: '"seamless"' },
  { re: /\belevate\b/gi, label: '"elevate"' },
  { re: /\bempower/gi, label: '"empower"' },
  { re: /\bfast-paced world/gi, label: '"fast-paced world"' },
  { re: /\bthe landscape of\b/gi, label: '"the landscape of"' },
  { re: /\bnavigat\w* (?:your|the) journey/gi, label: '"navigate the journey"' },
  // Leftover template debris. {{UPSELL_CODE}} is whitelisted by the strip
  // below; any other bracket token is a failure.
  { re: /\[[^\]\n]{1,60}\]/g, label: 'square-bracket placeholder' },
];

export function lintReport(text: string): LintResult {
  // The single permitted token.
  const scrubbed = text.replaceAll('{{UPSELL_CODE}}', '');
  const violations: string[] = [];
  for (const { re, label } of BANNED_PATTERNS) {
    re.lastIndex = 0;
    const matches = scrubbed.match(re);
    if (matches && matches.length > 0) {
      violations.push(`${label} (x${matches.length})`);
    }
  }
  // Any un-whitelisted {{TOKEN}} left over (the $197 outreach tokens have no
  // business in a Snapshot, which contains no outreach templates).
  const strayTokens = scrubbed.match(/\{\{[^}]+\}\}/g);
  if (strayTokens) {
    violations.push(`unexpected template token: ${strayTokens[0]}`);
  }
  return { clean: violations.length === 0, violations };
}
