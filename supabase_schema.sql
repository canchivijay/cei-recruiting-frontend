-- ============================================================
-- CEI Recruiting — Supabase Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── RECRUITERS ────────────────────────────────────────────────
-- Extends Supabase Auth users with recruiter-specific profile data
create table public.recruiters (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  initials    text not null,
  role        text not null default 'Recruiter',
  color       text not null default '#1d4ed8',
  created_at  timestamptz default now()
);

alter table public.recruiters enable row level security;

create policy "Recruiters can read all profiles"
  on public.recruiters for select using (true);

create policy "Recruiter can insert own profile"
  on public.recruiters for insert with check (auth.uid() = id);

create policy "Recruiter can update own profile"
  on public.recruiters for update using (auth.uid() = id);

-- ── JOBS ──────────────────────────────────────────────────────
create table public.jobs (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  dept              text not null,
  location          text not null,
  skills            text[] default '{}',
  secondary_skills  text[] default '{}',
  responsibilities  text default '',
  urgent            boolean default false,
  status            text default 'Active',
  created_by        uuid references public.recruiters(id) on delete set null,
  created_at        timestamptz default now()
);

alter table public.jobs enable row level security;

create policy "All recruiters can read jobs"
  on public.jobs for select using (true);

create policy "Authenticated recruiters can insert jobs"
  on public.jobs for insert with check (auth.role() = 'authenticated');

create policy "Creator can update their job"
  on public.jobs for update using (auth.uid() = created_by);

create policy "Creator can delete their job"
  on public.jobs for delete using (auth.uid() = created_by);

-- ── CANDIDATES ────────────────────────────────────────────────
create table public.candidates (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  avatar            text,
  role              text,
  exp               text,
  score             integer default 50,
  skills            text[] default '{}',
  email             text,
  phone             text,
  location          text,
  education         text,
  summary           text,
  fit_reason        text,
  red_flags         text[] default '{}',
  strengths         text[] default '{}',
  feedback          text,
  job_id            uuid references public.jobs(id) on delete cascade,
  recruiter_id      uuid references public.recruiters(id) on delete set null,
  source            text default 'manual',
  stage             text default 'Applied',
  interview_status  text default 'pending',
  uploaded_at       timestamptz default now()
);

alter table public.candidates enable row level security;

create policy "All recruiters can read candidates"
  on public.candidates for select using (true);

create policy "Authenticated recruiters can insert candidates"
  on public.candidates for insert with check (auth.role() = 'authenticated');

create policy "Authenticated recruiters can update candidates"
  on public.candidates for update using (auth.role() = 'authenticated');

create policy "Recruiter can delete their candidate"
  on public.candidates for delete using (auth.uid() = recruiter_id);

-- ── INTERVIEWS ────────────────────────────────────────────────
create table public.interviews (
  id              uuid primary key default uuid_generate_v4(),
  candidate_id    uuid references public.candidates(id) on delete cascade,
  candidate_name  text not null,
  role            text,
  recruiter_id    uuid references public.recruiters(id) on delete set null,
  job_id          uuid references public.jobs(id) on delete cascade,
  date            text,
  time            text,
  type            text default 'Technical',
  level           text default 'l1',
  level_label     text default 'Level 1',
  status          text default 'scheduled',
  created_at      timestamptz default now()
);

alter table public.interviews enable row level security;

create policy "All recruiters can read interviews"
  on public.interviews for select using (true);

create policy "Authenticated recruiters can insert interviews"
  on public.interviews for insert with check (auth.role() = 'authenticated');

create policy "Recruiter can update their interview"
  on public.interviews for update using (auth.uid() = recruiter_id);

create policy "Recruiter can delete their interview"
  on public.interviews for delete using (auth.uid() = recruiter_id);

-- ── USEFUL VIEWS ──────────────────────────────────────────────
create or replace view public.candidate_pipeline as
  select
    c.*,
    j.title  as job_title,
    j.dept   as job_dept,
    r.name   as recruiter_name,
    r.color  as recruiter_color
  from public.candidates c
  left join public.jobs j on j.id = c.job_id
  left join public.recruiters r on r.id = c.recruiter_id;
