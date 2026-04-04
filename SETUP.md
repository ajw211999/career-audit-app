# Career Clarity Audit — Deploy Checklist

End-to-end setup from zero → live on Vercel. Work top to bottom; each step has a
checkpoint so you know it worked before moving on.

---

## 0. Prereqs (one-time)

- [ ] A **Supabase** account (free tier is fine)
- [ ] An **Anthropic** API key with access to `claude-sonnet-4-5`
- [ ] A **Resend** account with `nxtgenheights.com` domain verified
- [ ] A **Vercel** account connected to this repo
- [ ] Your existing **Google Form** for intake (already live)

---

## 1. Supabase — create the `audits` table

1. Go to <https://supabase.com> → New Project → pick any region
2. Once the project is ready, open **SQL Editor** → New query
3. Paste the entire contents of `supabase/migrations/001_init.sql` → Run
4. Verify: Table Editor → you should see an `audits` table with 17 columns

Grab these values from **Project Settings → API**:
- `Project URL` → will become `NEXT_PUBLIC_SUPABASE_URL`
- `service_role` secret key → will become `SUPABASE_SERVICE_ROLE_KEY`
  (do **not** use the `anon` key — the app needs service role to bypass RLS)

**Checkpoint:** You can open the table editor and see an empty `audits` table.

---

## 2. Generate a webhook secret

Pick any strong random string — this is the shared secret between Google Apps
Script and this app. Example:

```
openssl rand -hex 32
```

Save it somewhere. It will become `WEBHOOK_SECRET` in both .env.local AND in
the Apps Script file.

---

## 3. Deploy to Vercel

1. Push this repo to GitHub
2. Vercel → New Project → import the repo
3. Before clicking Deploy, add these **environment variables**:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `RESEND_API_KEY` | your Resend key |
| `RESEND_FROM_EMAIL` | `antoine@nxtgenheights.com` |
| `RESEND_FROM_NAME` | `Antoine Wade \| NxtGen Heights` |
| `DASHBOARD_PASSWORD` | pick a strong password for dashboard login |
| `WEBHOOK_SECRET` | from step 2 |
| `NEXT_PUBLIC_APP_URL` | **leave blank for now** — fill in after first deploy |

4. Click Deploy. First build will take ~2 min.
5. After deploy, copy your production URL (e.g. `https://career-audit-app.vercel.app`)
6. Go back to **Project Settings → Environment Variables**, set
   `NEXT_PUBLIC_APP_URL` to that URL, and **Redeploy**
   (the fire-and-forget generate call needs this set correctly).

**Checkpoint:** Open `https://your-app.vercel.app/dashboard` in a browser. You
should get a Basic Auth prompt. Log in with `DASHBOARD_PASSWORD` (any username
works). You should land on an empty audit list.

---

## 4. Wire up Google Apps Script

1. Open your Google Form → responses tab → the linked Google Sheet
2. In the sheet: **Extensions → Apps Script**
3. Delete the starter code and paste the entire contents of
   `scripts/google-apps-script.js`
4. At the top of the script, replace:
   - `WEBHOOK_URL` → `https://your-app.vercel.app/api/intake`
   - `WEBHOOK_SECRET` → the same value as step 2
5. **Save** (cmd+s)
6. **Triggers** (clock icon on the left) → Add Trigger
   - Choose which function to run: `onFormSubmit`
   - Choose which deployment should run: `Head`
   - Select event source: `From spreadsheet`
   - Select event type: `On form submit`
   - Save. It will prompt for authorization — grant Drive + external URL access.

**Checkpoint:** Submit a test response to your Google Form using a real PDF
resume. Within ~30 seconds:
- The sheet should show `Webhook sent ✓` in the last column
- The dashboard should show a new row, going from `processing` →
  `pending_review` within ~60 seconds
- Click into the audit — the generated content should reference details from
  the PDF resume (company names, titles, dates), not just the form fields

---

## 5. End-to-end smoke test

Run one full paid flow before announcing on the show:

1. Create a **$0 Kajabi offer** for testing (or use a 100% discount code on the
   real offer)
2. Purchase it as a test customer
3. Fill out the Google Form including a real resume PDF
4. Wait for the dashboard to show `pending_review`
5. Review the generated audit, edit anything that reads weak, click
   **Approve + Send**
6. Confirm the test customer receives the PDF email from Resend
7. Confirm the dashboard row is now `sent` with a `sent_at` timestamp

If all 7 pass: you're live. Announce on the next Daily Climb.

---

## 6. Known limits / watch for

- **Resume size.** The resume PDF is base64-encoded and sent in one webhook
  payload. Vercel serverless functions cap request body at 4.5 MB on Hobby and
  50 MB on Pro. Typical resume PDFs are <1 MB, but warn customers against
  uploading 10-page portfolios.
- **Model ID.** `lib/claude.ts` uses `claude-sonnet-4-5`. If Anthropic
  deprecates it, update that single line.
- **Tier is self-reported.** The form field "Which did you purchase?" is the
  only tier signal. A customer who paid $79 could technically pick $149 on the
  form. Low risk at current volume; when it matters, add a Kajabi purchase
  webhook that writes authoritative tier to a `purchases` table and have
  `/api/intake` join on email.
- **Human-in-the-loop.** Every audit currently requires you to click
  Approve + Send. Keep it this way until you've reviewed ~25 drafts with
  minor edits on 90% of them — only then consider auto-send.
- **Retry.** If a generation errors, open the audit → click "Retry Generation".
  That re-runs Claude against the same intake/resume without re-charging
  anything else.

---

## 7. Regression test before trusting automation

Before trusting the automated output, take your last 3–4 manually delivered
audits and re-run them:

1. In Supabase SQL editor, insert a row with the same `intake_json` and
   `resume_file_base64` as one of those past clients
2. Set `status = 'processing'`, call `/api/generate` with the WEBHOOK_SECRET
3. Compare the generated output against what you shipped manually

If the auto-generated version is visibly weaker, the gap is in
`lib/prompt.ts` → tighten `SYSTEM_PROMPT` before launching.
