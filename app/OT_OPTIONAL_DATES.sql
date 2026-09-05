-- Permite crear órdenes de trabajo sin fecha prevista.
-- Ejecutar una sola vez en Supabase > SQL Editor.
alter table public.work_orders
  alter column scheduled_date drop not null;
