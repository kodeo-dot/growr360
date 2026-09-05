-- Growr360 · OTs con varios lotes del mismo campo
-- Ejecutar una vez en Supabase SQL Editor antes de publicar esta versión.

begin;

create table if not exists public.work_order_plots (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete restrict,
  plot_id uuid not null references public.plots(id) on delete restrict,
  planned_area numeric null check (planned_area is null or planned_area >= 0),
  created_at timestamptz not null default now(),
  unique (work_order_id, plot_id)
);

create index if not exists work_order_plots_group_idx on public.work_order_plots(group_id);
create index if not exists work_order_plots_order_idx on public.work_order_plots(work_order_id);
create index if not exists work_order_plots_plot_idx on public.work_order_plots(plot_id);

alter table public.work_order_plots enable row level security;

-- Reutiliza la pertenencia activa al grupo. Si tu proyecto usa policies con otros nombres,
-- estas policies son compatibles con la tabla public.group_members usada por Growr360.
drop policy if exists "work_order_plots_select_group_members" on public.work_order_plots;
create policy "work_order_plots_select_group_members" on public.work_order_plots
for select to authenticated
using (exists (
  select 1 from public.group_members gm
  where gm.group_id = work_order_plots.group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
));

drop policy if exists "work_order_plots_insert_group_members" on public.work_order_plots;
create policy "work_order_plots_insert_group_members" on public.work_order_plots
for insert to authenticated
with check (exists (
  select 1 from public.group_members gm
  where gm.group_id = work_order_plots.group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
));

drop policy if exists "work_order_plots_update_group_members" on public.work_order_plots;
create policy "work_order_plots_update_group_members" on public.work_order_plots
for update to authenticated
using (exists (
  select 1 from public.group_members gm
  where gm.group_id = work_order_plots.group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
))
with check (exists (
  select 1 from public.group_members gm
  where gm.group_id = work_order_plots.group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
));

drop policy if exists "work_order_plots_delete_group_members" on public.work_order_plots;
create policy "work_order_plots_delete_group_members" on public.work_order_plots
for delete to authenticated
using (exists (
  select 1 from public.group_members gm
  where gm.group_id = work_order_plots.group_id
    and gm.user_id = auth.uid()
    and gm.status = 'active'
));

-- Migra OTs existentes de un solo lote para que al editarlas no pierdan ubicación/superficie.
insert into public.work_order_plots (group_id, work_order_id, field_id, plot_id, planned_area)
select wo.group_id, wo.id, wo.field_id, wo.plot_id, wo.planned_area
from public.work_orders wo
where wo.plot_id is not null
  and wo.field_id is not null
  and not exists (select 1 from public.work_order_plots wop where wop.work_order_id = wo.id and wop.plot_id = wo.plot_id)
on conflict (work_order_id, plot_id) do nothing;

commit;
