-- Ejecutar una sola vez en Supabase SQL Editor antes de desplegar este cambio.
alter table public.work_orders
  add column if not exists allow_member_edits boolean not null default false;

-- IMPORTANTE: si tus policies RLS de work_orders solo permiten UPDATE al creador/admin,
-- deben ampliarse para aceptar allow_member_edits = true para miembros autorizados del grupo.
-- No se reemplazan policies automáticamente aquí porque dependen de las funciones/roles RLS
-- que ya tenga tu proyecto.
