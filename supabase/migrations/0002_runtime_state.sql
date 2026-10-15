-- Vercel gibi sunucusuz ortamda yüklemelerin ve önizlemelerin kaybolmaması için.
-- Bu dosyayı Supabase SQL editor'de bir kez çalıştırın.

create table if not exists public.app_runtime_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_import_previews (
  id text primary key,
  actor_id text not null,
  file_name text not null,
  file_hash text not null,
  exam_type text not null,
  created_at timestamptz not null default now(),
  buffer_base64 text not null
);

alter table public.app_runtime_state enable row level security;
alter table public.app_import_previews enable row level security;

grant all privileges on table public.app_runtime_state to service_role;
grant all privileges on table public.app_import_previews to service_role;

notify pgrst, 'reload schema';
