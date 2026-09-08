-- El plan de trabajo del producto, guardado en la base para que cualquier
-- sesión nueva pueda leer qué toca hacer sin volver a analizar el repo.
--
-- Vive en su propio esquema y no en `public` a propósito: `public` es lo que
-- PostgREST expone con la llave anónima, y el plan interno no tiene por qué
-- viajar al navegador de nadie. Solo se lee con la llave de servicio.
create schema if not exists plan;

create table if not exists plan.pasos (
  id            text primary key,
  fase          int  not null,
  orden         int  not null,
  titulo        text not null,
  porque        text not null,
  objetivo      text not null,
  alcance       text not null,
  entregables   text not null,
  aceptacion    text not null,
  fuera         text not null default '',
  dependencias  text[] not null default '{}',
  esfuerzo      text not null default 'medio',
  estado        text not null default 'pendiente'
                check (estado in ('pendiente','en curso','hecho','descartado')),
  notas         text not null default '',
  rama          text not null default 'claude/competitive-analysis-improvements-u1z34a',
  actualizado   timestamptz not null default now()
);

create unique index if not exists pasos_orden_unico on plan.pasos (orden);

alter table plan.pasos enable row level security;

create or replace function plan.marcar_actualizado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.actualizado = now();
  return new;
end;
$$;

drop trigger if exists pasos_actualizado on plan.pasos;
create trigger pasos_actualizado
  before update on plan.pasos
  for each row execute function plan.marcar_actualizado();
