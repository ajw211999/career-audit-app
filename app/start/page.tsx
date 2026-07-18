'use client';

import { useState } from 'react';

// Thank-you page target + self-serve link recovery. Kajabi's checkout
// thank-you page links here so email delivery is never the only path to the
// intake.

export default function StartPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Something went wrong. Try again.');
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold">Start your Career Clarity Snapshot</h1>
      <p className="mt-4 text-base leading-relaxed">
        Enter the email you used at checkout and we will send you your personal
        intake link. The intake takes about 5 minutes, saves as you go, and your
        Snapshot is delivered the same day you finish it.
      </p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <label htmlFor="email" className="text-sm font-medium">
          Checkout email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-base"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? 'Sending…' : 'Send my intake link'}
        </button>
      </form>
      {message && (
        <p className="mt-6 rounded border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          {message}
        </p>
      )}
      {error && (
        <p className="mt-6 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </p>
      )}
    </main>
  );
}
