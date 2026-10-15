-- Anonim örnek veri. Gerçek öğrenci adı, TCKN veya okul yüklemesi içermez.
-- Supabase Auth kullanıcıları dashboard üzerinden oluşturulduktan sonra
-- profiles.id değerlerini auth.users id ile eşleştirin.

insert into public.academic_years (id, label, starts_on, ends_on, is_active)
values ('11111111-1111-1111-1111-111111111111', '2025-2026', '2025-09-08', '2026-06-19', true)
on conflict do nothing;

insert into public.institutions (id, code, name, city, district, type, types, exam_type_permissions)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '000101', 'Atatürk Ortaokulu', 'Ankara', 'Çankaya', 'ortaokul', array['ortaokul']::public.institution_type[], array['LGS']::public.exam_type[]),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '000202', 'Cumhuriyet Anadolu Lisesi', 'İzmir', 'Konak', 'lise', array['lise']::public.institution_type[], array['TYT']::public.exam_type[]),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', '000303', 'Mehmet Akif Ortaokulu', 'Bursa', 'Osmangazi', 'ortaokul', array['ortaokul']::public.institution_type[], array['LGS']::public.exam_type[])
on conflict do nothing;
