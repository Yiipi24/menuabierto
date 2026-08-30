create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('comensal', 'restaurante')),
  created_at timestamptz not null default now()
);

-- El correo se guarda ya normalizado en minusculas desde la ruta de la API.
create unique index if not exists waitlist_email_key on public.waitlist (email);

comment on table public.waitlist is
  'Correos capturados en la landing antes del lanzamiento. role distingue comensales de duenos de restaurante.';

alter table public.waitlist enable row level security;

-- La landing solo necesita insertar. No hay politica de select, update ni
-- delete: la llave publicable no puede leer la lista aunque se filtre.
drop policy if exists waitlist_insert_anon on public.waitlist;
create policy waitlist_insert_anon
  on public.waitlist
  for insert
  to anon
  with check (true);
