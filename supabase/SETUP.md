# Supabase setup for NUSUK-HAMZA

## 1. Create the database schema
1. Open the Supabase project dashboard.
2. Open **SQL Editor** and create a new query.
3. Copy and run `supabase/migrations/202611010001_initial_schema.sql`.
4. Then copy and run `supabase/migrations/202611010002_app_string_ids.sql`.
5. Confirm both queries complete successfully.

The migration creates:
- `agency_groups`: groups owned by an authenticated user.
- `pilgrim_records`: pilgrim/task records, including task status and operation log snapshots.
- `operation_audit`: append-only audit events.
- Row Level Security policies that scope access to `auth.uid()`.

## 2. Frontend environment variables
Set these in the deployment platform (and locally in an untracked `.env.local` file):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

The publishable key is intended for browser use when RLS is correctly enabled. Never put a Supabase secret key or service_role key in a Vite variable or browser bundle.

## 3. Authentication cutover
The current app authentication implementation is browser-local. Do not treat its local users, password hashes, reset tokens, or demo shortcuts as cloud authentication. The application auth flow must be migrated to Supabase Auth before enabling cloud data access. Configure Supabase Auth email sign-up/sign-in and password recovery in the dashboard first.

## 4. Data safety
Do not persist mailbox app passwords, Supabase secrets, or one-time verification codes in audit details. Keep mailbox credentials on the server in a secrets store if that feature is retained. Audit events should describe actions and record identifiers, not copy sensitive payloads.

## 5. Current implementation status
This migration and setup guide are committed on the isolated `feature/supabase-cloud-sync` branch. The app's runtime authentication and synchronization have not yet been switched over; the original `main` branch remains unchanged.


## 6. Current cloud service foundation
The branch now includes a browser Supabase client (`services/supabaseClient.ts`) and tenant-scoped group/task persistence helpers (`services/cloudDataService.ts`). These are foundations only: the existing login screen and App state are not yet switched to Supabase Auth/cloud sync. Do not deploy this branch as a completed cloud-connected release until that integration and a production build are tested.
