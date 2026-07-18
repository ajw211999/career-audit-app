import { createClient } from '@/lib/supabase';
import IntakeForm from './IntakeForm';

// Server component: resolves the magic-link token to a submission row with
// the service-role client (no Supabase credentials ever reach the browser)
// and hands the client form its saved answers.

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function IntakePage({
  params,
}: {
  params: { token: string };
}) {
  const token = params.token;
  if (!UUID_RE.test(token)) return <InvalidLink />;

  const supabase = createClient();
  const { data: row } = await supabase
    .from('audits')
    .select('id, client_name, status, intake_json, tier')
    .eq('intake_token', token)
    .eq('tier', 'snapshot')
    .maybeSingle();

  if (!row) return <InvalidLink />;

  const firstName = (row.client_name || '').split(' ')[0];

  if (
    row.status !== 'draft' &&
    row.status !== 'needs_info'
  ) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-bold">Your answers are in</h1>
        <p className="mt-4 leading-relaxed">
          {row.status === 'sent'
            ? 'Your Career Clarity Snapshot has been delivered. Check the inbox you used at checkout, and the spam folder if it is not there.'
            : 'Your Career Clarity Snapshot is being built and gets a human review before it goes out. Expect it in your inbox today.'}
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Need something? Reply to any of our emails.
        </p>
      </main>
    );
  }

  return (
    <IntakeForm
      token={token}
      firstName={firstName}
      initialAnswers={(row.intake_json as Record<string, string>) || {}}
      needsInfo={row.status === 'needs_info'}
    />
  );
}

function InvalidLink() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold">This link is not working</h1>
      <p className="mt-4 leading-relaxed">
        Double-check you used the full link from your email. If it still does
        not work, you can get a fresh one sent to your checkout email at{' '}
        <a className="underline" href="/start">
          the start page
        </a>
        .
      </p>
    </main>
  );
}
