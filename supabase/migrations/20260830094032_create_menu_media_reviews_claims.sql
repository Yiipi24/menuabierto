create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index menu_sections_restaurant_idx
  on public.menu_sections (restaurant_id, position);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  section_id uuid references public.menu_sections (id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  description text,
  -- Centavos en entero: los precios en float terminan mostrando 89.99000001.
  price_cents integer check (price_cents >= 0),
  currency char(3) not null default 'MXN',
  photo_path text,
  is_available boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.menu_items.price_cents is
  'Precio en centavos. 8900 = $89.00 MXN. Nulo = precio no publicado.';
comment on column public.menu_items.is_available is
  'false = agotado hoy. La ficha lo muestra tachado en vez de esconderlo.';

create index menu_items_restaurant_idx
  on public.menu_items (restaurant_id, position);

create trigger menu_items_touch
  before update on public.menu_items
  for each row execute function public.touch_updated_at();

create type public.media_kind as enum ('foto', 'video');

create table public.restaurant_media (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind public.media_kind not null default 'foto',
  -- Ruta dentro de Supabase Storage, no una URL completa: asi cambiar de
  -- dominio o de CDN no obliga a reescribir cada fila.
  storage_path text not null,
  alt text,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index restaurant_media_restaurant_idx
  on public.restaurant_media (restaurant_id, position);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una resena por persona y restaurante; editarla es actualizar la suya.
  unique (restaurant_id, author_id)
);

create index reviews_restaurant_idx on public.reviews (restaurant_id);

create trigger reviews_touch
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- El promedio se guarda en restaurants para que ordenar por calificacion no
-- obligue a recorrer todas las resenas en cada busqueda.
create function public.refresh_restaurant_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.restaurant_id, old.restaurant_id);
begin
  update public.restaurants r
  set rating_avg = sub.avg_rating,
      rating_count = sub.total
  from (
    select round(avg(rating)::numeric, 1) as avg_rating, count(*) as total
    from public.reviews
    where restaurant_id = target
  ) sub
  where r.id = target;
  return null;
end;
$$;

create trigger reviews_refresh_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_restaurant_rating();

-- Reclamos: el camino por el que un dueno toma control de una ficha que
-- cargamos nosotros. Queda historial de quien pidio que y quien resolvio.
create type public.claim_status as enum ('pendiente', 'aprobada', 'rechazada');

create table public.restaurant_claims (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  status public.claim_status not null default 'pendiente',
  evidence text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

-- Una sola solicitud pendiente por persona y restaurante.
create unique index restaurant_claims_pendiente_idx
  on public.restaurant_claims (restaurant_id, claimant_id)
  where status = 'pendiente';
