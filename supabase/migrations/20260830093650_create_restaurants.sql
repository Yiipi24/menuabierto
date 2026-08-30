create type public.listing_status as enum ('borrador', 'publicado', 'oculto');
create type public.plan_tier as enum ('basico', 'premium');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (length(btrim(name)) > 0),
  summary text,
  description text,
  price_level smallint check (price_level between 1 and 4),

  phone text,
  website text,

  street text,
  neighborhood text,
  city text not null,
  state text,
  postal_code text,
  country char(2) not null default 'MX',
  -- geography y no geometry: las distancias salen en metros reales sin
  -- proyectar nada, que es justo lo que pide "restaurantes cerca de mi".
  location geography (point, 4326),

  status public.listing_status not null default 'borrador',

  -- created_by es quien cargo la ficha (puede ser el equipo de Menu Abierto).
  -- owner_id es el dueno que la reclamo y la controla. Son distintos a
  -- proposito: una ficha cargada por nosotros no debe parecer publicada por
  -- el restaurante hasta que alguien la reclame.
  created_by uuid references public.profiles (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,

  plan public.plan_tier not null default 'basico',
  premium_until timestamptz,

  rating_avg numeric(2, 1),
  rating_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint restaurants_claim_coherente
    check ((owner_id is null) = (claimed_at is null)),
  -- Un plan premium sin fecha de vencimiento seria premium para siempre por
  -- accidente. Si el plan es premium, la fecha es obligatoria.
  constraint restaurants_premium_con_vigencia
    check (plan = 'basico' or premium_until is not null)
);

comment on column public.restaurants.owner_id is
  'Dueno que reclamo la ficha. Nulo = ficha no reclamada, cargada por el equipo.';
comment on column public.restaurants.location is
  'Punto WGS84. Usar ST_DWithin sobre el indice GiST para buscar por cercania.';

create index restaurants_location_idx on public.restaurants using gist (location);
create index restaurants_city_idx on public.restaurants (city) where status = 'publicado';
create index restaurants_owner_idx on public.restaurants (owner_id);
create index restaurants_name_trgm_idx on public.restaurants using gin (name gin_trgm_ops);

create trigger restaurants_touch
  before update on public.restaurants
  for each row execute function public.touch_updated_at();

create table public.restaurant_cuisines (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  cuisine_id smallint not null references public.cuisines (id) on delete cascade,
  primary key (restaurant_id, cuisine_id)
);

create index restaurant_cuisines_cuisine_idx
  on public.restaurant_cuisines (cuisine_id);

-- Horarios: una fila por tramo, de modo que un local que cierra a mediodia
-- se representa con dos filas del mismo dia en vez de un caso especial.
create table public.restaurant_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null
);

comment on column public.restaurant_hours.closes is
  'Si closes <= opens el tramo cruza la medianoche (ej. 20:00 a 02:00).';
comment on column public.restaurant_hours.weekday is
  '0 = domingo, 6 = sabado.';

create index restaurant_hours_restaurant_idx
  on public.restaurant_hours (restaurant_id, weekday);
