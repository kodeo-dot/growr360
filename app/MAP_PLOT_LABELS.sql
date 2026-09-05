-- Growr360 · Etiquetas configurables de lotes en el mapa
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table public.app_settings
  add column if not exists plot_label_fields text[] not null
  default array['plot_name']::text[];

-- Normaliza filas antiguas que pudieran haber quedado sin valor.
update public.app_settings
set plot_label_fields = array['plot_name']::text[]
where plot_label_fields is null or cardinality(plot_label_fields) = 0;
