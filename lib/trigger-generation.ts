// Server-side generation trigger, shared by intake-submit (inside after())
// and the sweeper cron. Always AWAITED by callers — a fire-and-forget fetch
// dies when Vercel freezes the lambda, which is exactly the bug this
// replaces. Failures are safe: the row stays in 'submitted' and the sweeper
// retries it.

export async function triggerGeneration(auditId: string): Promise<void> {
  const base = (process.env.APP_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('APP_URL not configured');
  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.WEBHOOK_SECRET,
      auditId,
    }),
  });
  if (!res.ok) {
    throw new Error(`generate returned ${res.status}`);
  }
}
