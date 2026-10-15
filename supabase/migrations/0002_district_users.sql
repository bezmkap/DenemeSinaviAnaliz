-- İlçe kullanıcı rolü ve kapsam alanları
alter type public.user_role add value if not exists 'district_admin';

alter table public.profiles
  add column if not exists city text,
  add column if not exists district text;
