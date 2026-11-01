-- NUSUK-HAMZA cloud schema
-- Run in Supabase SQL Editor. All tenant-owned rows are isolated by RLS.

create extension if not exists pgcrypto;

create table if not exists public.agency_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.pilgrim_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid,
  status text not null default 'IDLE'
    check (status in ('IDLE','EXTRACTING','READY_TO_START','COMPLETED','FAILED')),
  account_created boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  operation_logs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilgrim_group_owner_fk
    foreign key (user_id, group_id)
    references public.agency_groups(user_id, id)
    on delete set null (group_id)
);

create index if not exists pilgrim_records_user_updated_idx
  on public.pilgrim_records(user_id, updated_at desc);
create index if not exists pilgrim_records_group_idx
  on public.pilgrim_records(user_id, group_id);

create table if not exists public.operation_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists operation_audit_user_created_idx
  on public.operation_audit(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agency_groups_set_updated_at on public.agency_groups;
create trigger agency_groups_set_updated_at before update on public.agency_groups
for each row execute function public.set_updated_at();

drop trigger if exists pilgrim_records_set_updated_at on public.pilgrim_records;
create trigger pilgrim_records_set_updated_at before update on public.pilgrim_records
for each row execute function public.set_updated_at();

alter table public.agency_groups enable row level security;
alter table public.pilgrim_records enable row level security;
alter table public.operation_audit enable row level security;

drop policy if exists "Users manage their own groups" on public.agency_groups;
create policy "Users manage their own groups"
on public.agency_groups for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own pilgrim records" on public.pilgrim_records;
create policy "Users manage their own pilgrim records"
on public.pilgrim_records for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    group_id is null or exists (
      select 1 from public.agency_groups g
      where g.id = group_id and g.user_id = (select auth.uid())
    )
  )
);

drop policy if exists "Users read their own audit" on public.operation_audit;
create policy "Users read their own audit"
on public.operation_audit for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users append their own audit" on public.operation_audit;
create policy "Users append their own audit"
on public.operation_audit for insert to authenticated
with check (user_id = (select auth.uid()));

-- No client-side UPDATE/DELETE policy for audit rows: history is append-only.
