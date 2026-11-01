-- Align cloud identifiers with the existing React app, which uses string IDs.
-- Safe to run after 202611010001_initial_schema.sql.

alter table public.pilgrim_records
  drop constraint if exists pilgrim_group_owner_fk;

alter table public.agency_groups
  alter column id drop default,
  alter column id type text using id::text,
  alter column id set default gen_random_uuid()::text;

alter table public.pilgrim_records
  alter column id drop default,
  alter column id type text using id::text,
  alter column id set default gen_random_uuid()::text,
  alter column group_id type text using group_id::text;

alter table public.operation_audit
  alter column entity_id type text using entity_id::text;

alter table public.pilgrim_records
  add constraint pilgrim_group_owner_fk
  foreign key (user_id, group_id)
  references public.agency_groups(user_id, id)
  on delete set null (group_id);

-- Keep app-provided string identifiers unique within each user.
create unique index if not exists agency_groups_user_id_id_uidx
  on public.agency_groups(user_id, id);
