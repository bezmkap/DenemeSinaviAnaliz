-- DenemeSinaviAnaliz — çekirdek şema, RLS ve yetki fonksiyonları
-- Öğrenci numarası ve kurum kodu text tutulur (baştaki sıfırlar korunur).
-- T.C. kimlik numarası istenmez ve saklanmaz.

create extension if not exists "pgcrypto";

create type public.exam_type as enum ('LGS', 'TYT', 'AYT');
create type public.institution_type as enum ('ortaokul', 'lise');
create type public.user_role as enum ('system_admin', 'school_user');
create type public.upload_status as enum ('previewed', 'committed', 'rolled_back', 'rejected');

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text not null,
  district text not null,
  type public.institution_type not null,
  exam_type_permissions public.exam_type[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null,
  role public.user_role not null default 'school_user',
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  unique (user_id, institution_id)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false
);

create table public.analysis_modules (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order int not null
);

create table public.institution_module_permissions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  module_slug text not null references public.analysis_modules (slug),
  exam_type public.exam_type not null,
  enabled boolean not null default false,
  unique (institution_id, module_slug, exam_type)
);

create table public.permission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  actor_email text not null,
  institution_id uuid references public.institutions (id),
  institution_name text,
  module_slug text,
  exam_type public.exam_type,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

create table public.exam_sittings (
  id uuid primary key default gen_random_uuid(),
  exam_type public.exam_type not null,
  name text not null,
  exam_date date not null,
  academic_year_id uuid not null references public.academic_years (id),
  publisher text not null,
  exam_code text not null unique,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id),
  source_student_no text not null,
  full_name text not null,
  grade text not null,
  section text not null,
  unique (institution_id, academic_year_id, source_student_no)
);

create table public.uploads (
  id uuid primary key default gen_random_uuid(),
  exam_sitting_id uuid references public.exam_sittings (id),
  uploaded_by uuid references public.profiles (id),
  file_name text not null,
  file_hash text not null,
  status public.upload_status not null default 'previewed',
  exam_type public.exam_type not null,
  row_count int not null default 0,
  valid_count int not null default 0,
  error_count int not null default 0,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  rolled_back_at timestamptz
);

create unique index uploads_committed_hash_idx
  on public.uploads (file_hash)
  where status = 'committed';

create table public.upload_errors (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.uploads (id) on delete cascade,
  row_number int not null,
  message text not null
);

create table public.exam_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  exam_sitting_id uuid not null references public.exam_sittings (id) on delete cascade,
  institution_id uuid not null references public.institutions (id) on delete cascade,
  upload_id uuid not null references public.uploads (id),
  total_correct numeric not null,
  total_wrong numeric not null,
  total_blank numeric not null,
  source_net numeric,
  calculated_net numeric not null,
  score numeric,
  rank_general int,
  rank_city int,
  rank_district int,
  rank_school int,
  rank_class int,
  count_general int,
  count_city int,
  count_district int,
  count_school int,
  count_class int,
  unique (student_id, exam_sitting_id)
);

create table public.subject_results (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.exam_results (id) on delete cascade,
  subject_code text not null,
  correct numeric not null,
  wrong numeric not null,
  blank numeric not null,
  source_net numeric,
  calculated_net numeric not null
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text not null,
  action text not null,
  institution_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

insert into public.analysis_modules (slug, name, description, sort_order) values
  ('okul-ozeti', 'Okul Özeti', 'Son sınav ve okul özeti', 1),
  ('sinav-analizi', 'Sınav Analizi', 'Seçilen deneme kırılımı', 2),
  ('ogrenci-sonuclari', 'Öğrenci Sonuçları ve Gelişimi', 'Öğrenci bazlı sonuçlar', 3),
  ('sinif-karsilastirma', 'Sınıf Karşılaştırması', 'Sınıf karşılaştırması', 4),
  ('sube-karsilastirma', 'Şube Karşılaştırması', 'Şube karşılaştırması', 5),
  ('ders-analizi', 'Ders Analizi', 'Ders ortalamaları', 6),
  ('dybn-analizi', 'Doğru, Yanlış, Boş ve Net Analizi', 'D/Y/B/N', 7),
  ('puan-dagilim', 'Puan ve Sıralama Dağılımı', 'Puan dağılımı', 8),
  ('sinavlar-arasi-gelisim', 'Sınavlar Arası Gelişim', 'Yıl içi gelişim', 9),
  ('ogrenci-performans', 'Öğrenci Performans Değişimi', 'Öğrenci değişimi', 10),
  ('basari-sirasi', 'Okul İçi Başarı Sırası', 'Okul sırası', 11),
  ('risk-analizi', 'Risk Analizi ve Erken Uyarı', 'Tahminsel analitik ile risk tespiti', 12),
  ('gelisim-trendi', 'Gelişim Trendleri ve Tahminler', 'Zamana dayalı gelişim analizi', 13),
  ('akran-karsilastirma', 'Akran Grubu Karşılaştırması', 'Akran grubu analizi', 14),
  ('sinif-detay-analizi', 'Detaylı Sınıf/Şube Analizi', 'Derinlemesine sınıf analizi', 15),
  ('ogrenci-profili', 'Bireysel Öğrenci Profili', 'Öğrenci dashboard ve gelişim takibi', 16),
  ('mudahale-onerileri', 'Müdahale Önerileri', 'Veriye dayalı destek planları', 17);

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'system_admin'
  );
$$;

create or replace function public.user_institution_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select institution_id
  from public.memberships
  where user_id = auth.uid();
$$;

create or replace function public.has_module_access(
  inst uuid,
  slug text,
  exam public.exam_type default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_system_admin()
    or exists (
      select 1
      from public.institution_module_permissions p
      where p.institution_id = inst
        and p.module_slug = slug
        and p.enabled = true
        and (exam is null or p.exam_type = exam)
        and p.institution_id in (select public.user_institution_ids())
    );
$$;

create or replace function public.assert_module_access(
  inst uuid,
  slug text,
  exam public.exam_type default null
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_module_access(inst, slug, exam) then
    raise exception 'Bu analiz modülü kurumunuz için kapalı.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.school_summary(inst uuid, slug text default 'okul-ozeti')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if inst is null or inst not in (select public.user_institution_ids()) and not public.is_system_admin() then
    raise exception 'Bu kuruma ait verilere erişemezsiniz.' using errcode = '42501';
  end if;
  perform public.assert_module_access(inst, slug, null);
  select jsonb_build_object(
    'institution_id', inst,
    'result_count', count(*)
  )
  into payload
  from public.exam_results
  where institution_id = inst;
  return payload;
end;
$$;

-- Yeni kurum: yalnızca okul-ozeti açık
create or replace function public.trg_default_module_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exam public.exam_type;
  rec record;
begin
  foreach exam in array new.exam_type_permissions loop
    for rec in select slug from public.analysis_modules loop
      insert into public.institution_module_permissions (institution_id, module_slug, exam_type, enabled)
      values (new.id, rec.slug, exam, rec.slug = 'okul-ozeti')
      on conflict do nothing;
    end loop;
  end loop;
  return new;
end;
$$;

create trigger institutions_default_permissions
after insert on public.institutions
for each row execute procedure public.trg_default_module_permissions();

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.academic_years enable row level security;
alter table public.analysis_modules enable row level security;
alter table public.institution_module_permissions enable row level security;
alter table public.permission_audit_logs enable row level security;
alter table public.exam_sittings enable row level security;
alter table public.students enable row level security;
alter table public.uploads enable row level security;
alter table public.upload_errors enable row level security;
alter table public.exam_results enable row level security;
alter table public.subject_results enable row level security;
alter table public.audit_logs enable row level security;

create policy institutions_select on public.institutions
  for select using (public.is_system_admin() or id in (select public.user_institution_ids()));
create policy institutions_admin_write on public.institutions
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy profiles_self on public.profiles
  for select using (id = auth.uid() or public.is_system_admin());
create policy profiles_admin_write on public.profiles
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy memberships_select on public.memberships
  for select using (user_id = auth.uid() or public.is_system_admin());
create policy memberships_admin_write on public.memberships
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy years_read on public.academic_years for select using (auth.role() = 'authenticated');
create policy years_admin on public.academic_years for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy modules_read on public.analysis_modules for select using (true);

create policy perm_select on public.institution_module_permissions
  for select using (
    public.is_system_admin()
    or institution_id in (select public.user_institution_ids())
  );
create policy perm_admin on public.institution_module_permissions
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy audit_admin on public.permission_audit_logs
  for select using (public.is_system_admin());
create policy audit_admin_write on public.permission_audit_logs
  for insert with check (public.is_system_admin());

create policy sittings_read on public.exam_sittings
  for select using (auth.role() = 'authenticated');
create policy sittings_admin on public.exam_sittings
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy students_select on public.students
  for select using (
    public.is_system_admin() or institution_id in (select public.user_institution_ids())
  );
create policy students_write_admin on public.students
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy results_select on public.exam_results
  for select using (
    public.is_system_admin() or institution_id in (select public.user_institution_ids())
  );
create policy results_no_client_write on public.exam_results
  for insert with check (false);
create policy results_admin_write on public.exam_results
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy subject_results_select on public.subject_results
  for select using (
    exists (
      select 1 from public.exam_results r
      where r.id = result_id
        and (public.is_system_admin() or r.institution_id in (select public.user_institution_ids()))
    )
  );

create policy uploads_select on public.uploads
  for select using (public.is_system_admin() or uploaded_by = auth.uid());
create policy uploads_admin on public.uploads
  for all using (public.is_system_admin()) with check (public.is_system_admin());

create policy upload_errors_select on public.upload_errors
  for select using (
    exists (
      select 1 from public.uploads u
      where u.id = upload_id and (public.is_system_admin() or u.uploaded_by = auth.uid())
    )
  );

create policy audit_logs_admin on public.audit_logs
  for select using (public.is_system_admin());

revoke insert, update, delete on public.exam_results from anon, authenticated;
revoke insert, update, delete on public.subject_results from anon, authenticated;
grant execute on function public.school_summary(uuid, text) to authenticated;
grant execute on function public.has_module_access(uuid, text, public.exam_type) to authenticated;
