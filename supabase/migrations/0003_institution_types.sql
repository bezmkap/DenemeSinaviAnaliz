-- Okul hem ortaokul hem lise olabilir.

alter table public.institutions
  add column if not exists types public.institution_type[] not null default '{}'::public.institution_type[];

update public.institutions
set types = array[type]::public.institution_type[]
where coalesce(cardinality(types), 0) = 0;
