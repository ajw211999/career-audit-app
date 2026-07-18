-- Career Clarity Snapshot — $39 automated tier.
-- Extends the audits table rather than adding a second table so the existing
-- review dashboard picks up snapshot rows with no query changes.

-- New tier + lifecycle states.
-- draft:      paid, intake link issued, form not yet submitted (snapshot only)
-- submitted:  intake complete, waiting for generation to start (snapshot only)
-- needs_info: answers too thin to generate a report worth $39 (snapshot only)
alter table audits drop constraint if exists audits_tier_check;
alter table audits add constraint audits_tier_check
  check (tier in ('197','497','snapshot'));

alter table audits drop constraint if exists audits_status_check;
alter table audits add constraint audits_status_check
  check (status in (
    'draft','submitted','needs_info',
    'processing','pending_review','approved','sent','error'
  ));

-- Webhook rows are created before the buyer has answered anything.
alter table audits alter column intake_json set default '{}'::jsonb;

-- Magic link token: bearer credential for the intake form. uuid v4 = 122 bits
-- of crypto randomness from pgcrypto-backed uuid-ossp; looked up only via the
-- unique index below.
alter table audits add column if not exists intake_token uuid
  unique default uuid_generate_v4();

-- Kajabi retries webhook deliveries for hours and does not sign payloads.
-- The transaction id unique constraint is the idempotency key: a retried or
-- duplicated delivery upserts into the same row instead of minting a second
-- magic link.
alter table audits add column if not exists kajabi_transaction_id text unique;

-- Cost guard: generation attempts per row (sweeper + retry + webhook races
-- are CAS-guarded, but the cap bounds worst-case Claude spend regardless).
alter table audits add column if not exists generation_count int not null default 0;

-- Crisis-flagged rows are excluded from auto-send permanently — a human
-- reads them even after the hands-free flip.
alter table audits add column if not exists crisis_flag boolean not null default false;

alter table audits add column if not exists paid_at timestamptz;
alter table audits add column if not exists submitted_at timestamptz;

-- Paid-but-never-submitted reminder tracking (max 3, spaced >=48h, sent by
-- the sweep cron). Untouched intakes become 60-day chargebacks otherwise.
alter table audits add column if not exists reminder_count int not null default 0;
alter table audits add column if not exists last_reminder_at timestamptz;

create index if not exists audits_intake_token_idx on audits(intake_token);

-- Sweeper query: stuck rows by status + age.
create index if not exists audits_status_created_idx on audits(status, created_at);
