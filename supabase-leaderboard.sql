-- DAD vs THE MACHINES: shared neighborhood leaderboard
-- Run once in the Supabase SQL editor (your project > SQL Editor > New query):
-- https://supabase.com/dashboard
--
-- Design: anonymous read + insert only (no sign-in), rows are immutable
-- (no update/delete policies), and check constraints cap garbage input.

create table if not exists public.dvm_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 16),
  score integer not null check (score >= 0 and score <= 50000000),
  wave integer not null check (wave between 0 and 999),
  champ text not null check (char_length(champ) <= 24),
  diff text not null check (char_length(diff) <= 24),
  coop integer not null default 1 check (coop between 1 and 4),
  created_at timestamptz not null default now()
);

create index if not exists dvm_scores_score_idx on public.dvm_scores (score desc);

alter table public.dvm_scores enable row level security;

drop policy if exists "dvm anyone can read" on public.dvm_scores;
create policy "dvm anyone can read"
  on public.dvm_scores for select using (true);

drop policy if exists "dvm anyone can submit" on public.dvm_scores;
create policy "dvm anyone can submit"
  on public.dvm_scores for insert with check (true);
