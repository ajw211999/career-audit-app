-- Career Clarity Audit — initial schema
-- Run this once in the Supabase SQL editor on a fresh project.

create extension if not exists "uuid-ossp";

create table if not exists audits (
  id uuid primary key default uuid_generate_v4(),

  -- Client identity
  client_name  text not null,
  client_email text not null,

  -- Product
  tier   text not null check (tier in ('79','149')),
  status text not null default 'processing'
    check (status in ('processing','pending_review','approved','sent','error')),

  -- Raw intake payload from Google Form (key/value JSON of every form field)
  intake_json jsonb not null,

  -- Resume: we keep the Drive URL for audit trail AND the file bytes inline
  -- so Claude can read the PDF as a document content block.
  resume_url         text,
  resume_file_base64 text,
  resume_mime_type   text,
  resume_filename    text,

  -- Generated content
  audit_content text,
  error_message text,

  -- Lifecycle timestamps
  created_at   timestamptz not null default now(),
  processed_at timestamptz,
  approved_at  timestamptz,
  sent_at      timestamptz
);

create index if not exists audits_status_idx
  on audits(status);

create index if not exists audits_email_created_idx
  on audits(client_email, created_at desc);

-- RLS: the service role key bypasses RLS, which is what /lib/supabase.ts uses.
-- Enable RLS anyway so no anon client can ever read the table by accident.
alter table audits enable row level security;
