-- Kitapçık türü ve öğrenci alan bilgisi eklenir
-- Kitapçık: A, B, C, D vb.
-- Alan: sözel, sayısal, eşit ağırlık (EA)

-- Alan tipi enum
create type public.exam_area as enum ('sayisal', 'sozel', 'esit_agirlik');

-- exam_results tablosuna kitapçık ve alan sütunları eklenir
alter table public.exam_results
  add column booklet text,
  add column exam_area public.exam_area;

-- AYT için skor sütunları (sayısal, eşit ağırlık, sözel)
alter table public.exam_results
  add column score_say numeric,
  add column score_ea numeric,
  add column score_soz numeric;

-- İndeksler
create index exam_results_booklet_idx on public.exam_results (booklet) where booklet is not null;
create index exam_results_exam_area_idx on public.exam_results (exam_area) where exam_area is not null;
