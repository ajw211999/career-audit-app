'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SNAPSHOT_QUESTIONS,
  SNAPSHOT_SECTIONS,
} from '@/lib/snapshot-questions';
import type { SnapshotQuestion } from '@/lib/types';

// The application-style intake. Answers autosave (debounced) against the
// magic-link token, so closing the tab and coming back on another device
// just works. Multi-select answers are stored as '; '-joined strings to keep
// intake_json a flat Record<string, string> like the $197 pipeline expects.

const AUTOSAVE_DEBOUNCE_MS = 1200;

export default function IntakeForm({
  token,
  firstName,
  initialAnswers,
  needsInfo,
}: {
  token: string;
  firstName: string;
  initialAnswers: Record<string, string>;
  needsInfo: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dirtyRef = useRef<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const dirty = dirtyRef.current;
    if (Object.keys(dirty).length === 0) return;
    dirtyRef.current = {};
    setSaveState('saving');
    try {
      const res = await fetch('/api/intake-autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers: dirty }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaveState('saved');
    } catch {
      // Put the failed fields back so the next edit retries them.
      dirtyRef.current = { ...dirty, ...dirtyRef.current };
      setSaveState('error');
    }
  }, [token]);

  const setAnswer = useCallback(
    (id: string, value: string) => {
      setAnswers((prev) => ({ ...prev, [id]: value }));
      dirtyRef.current[id] = value;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Flush pending edits when the tab is backgrounded or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const answeredCount = useMemo(
    () =>
      SNAPSHOT_QUESTIONS.filter((q) => (answers[q.id] ?? '').trim().length > 0)
        .length,
    [answers]
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const q of SNAPSHOT_QUESTIONS) {
      const raw = (answers[q.id] ?? '').trim();
      if (!raw && q.required) {
        next[q.id] = 'This one is required.';
      } else if (q.minLength && raw.length < q.minLength) {
        next[q.id] = `Give this a little more. ${q.minLength - raw.length} more characters of specifics makes your report sharper.`;
      }
    }
    setProblems(next);
    if (Object.keys(next).length > 0) {
      const firstId = SNAPSHOT_QUESTIONS.find((q) => next[q.id])?.id;
      if (firstId) document.getElementById(`q-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  async function submit() {
    setSubmitError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await flush();
      const res = await fetch('/api/intake-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.thin) {
          const next: Record<string, string> = {};
          for (const t of data.thin as { id: string; message: string }[]) {
            next[t.id] = t.message;
          }
          setProblems(next);
        }
        setSubmitError(data.error || 'Something went wrong. Your answers are saved. Try again.');
        return;
      }
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch {
      setSubmitError('Something went wrong. Your answers are saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="text-2xl font-bold">Done. Your Snapshot is being built.</h1>
        <p className="mt-4 leading-relaxed">
          Your answers are in. The report gets a human review before it goes
          out, so expect it in your inbox today. A confirmation email is on its
          way to you now.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">
          {firstName ? `${firstName}, this is where your Snapshot starts` : 'This is where your Snapshot starts'}
        </h1>
        <p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-300">
          About 5 minutes. Everything saves as you type, so you can leave and
          come back with the same link. The more specific your answers, the
          sharper your report.
        </p>
        {needsInfo && (
          <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            We held your report because a few answers were too short to work
            with. The flagged questions below are the ones worth another minute.
          </p>
        )}
      </header>

      <div className="sticky top-0 z-10 -mx-6 mt-6 border-b bg-background px-6 py-2 text-sm text-gray-500">
        {answeredCount} of {SNAPSHOT_QUESTIONS.length} answered
        <span className="float-right">
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && 'Save failed, will retry as you type'}
        </span>
      </div>

      {SNAPSHOT_SECTIONS.map((section) => (
        <section key={section} className="mt-10">
          <h2 className="text-lg font-semibold">{section}</h2>
          <div className="mt-4 flex flex-col gap-6">
            {SNAPSHOT_QUESTIONS.filter((q) => q.section === section).map((q) => (
              <Question
                key={q.id}
                q={q}
                value={answers[q.id] ?? ''}
                problem={problems[q.id]}
                onChange={(v) => setAnswer(q.id, v)}
              />
            ))}
          </div>
        </section>
      ))}

      <div className="mt-12">
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded bg-black px-4 py-3 text-lg font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? 'Submitting…' : 'Build my Snapshot'}
        </button>
        {submitError && (
          <p className="mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            {submitError}
          </p>
        )}
        <p className="mt-4 text-center text-sm text-gray-500">
          Delivered to your checkout email the same day.
        </p>
      </div>
    </main>
  );
}

function Question({
  q,
  value,
  problem,
  onChange,
}: {
  q: SnapshotQuestion;
  value: string;
  problem?: string;
  onChange: (v: string) => void;
}) {
  const selected = useMemo(
    () => new Set(value ? value.split('; ') : []),
    [value]
  );

  return (
    <div id={`q-${q.id}`}>
      <label className="block font-medium">{q.label}</label>
      {q.help && <p className="mt-1 text-sm text-gray-500">{q.help}</p>}
      <div className="mt-2">
        {q.type === 'text' && (
          <input
            type="text"
            value={value}
            placeholder={q.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        )}
        {q.type === 'textarea' && (
          <textarea
            value={value}
            placeholder={q.placeholder}
            rows={4}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        )}
        {q.type === 'select' && (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="">Choose one…</option>
            {q.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        )}
        {q.type === 'multiselect' && (
          <div className="flex flex-col gap-2">
            {q.options?.map((o) => (
              <label key={o} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(o)}
                  onChange={(e) => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(o);
                    else next.delete(o);
                    onChange(Array.from(next).join('; '));
                  }}
                  className="mt-0.5"
                />
                {o}
              </label>
            ))}
          </div>
        )}
        {q.type === 'scale' && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded border text-sm ${
                  value === n
                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-gray-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {problem && <p className="mt-2 text-sm text-red-700">{problem}</p>}
    </div>
  );
}
