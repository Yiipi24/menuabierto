-- Un platillo dice más que su nombre y su precio: quien no come carne, quien
-- no puede con el gluten y quien pregunta si pica están decidiendo con datos
-- que hoy no caben en la carta. Las etiquetas son eso, y son del platillo, no
-- del restaurante: la misma cocina tiene el taco de suadero y la ensalada
-- vegana.
--
-- Va en tabla y no en un CHECK, por lo mismo que los servicios del local: la
-- lista va a crecer —cada dueño pide la suya— y una migración por etiqueta
-- sería una migración por semana. Agregar una es un INSERT: aparece en el
-- panel y en la carta sin desplegar nada, aunque su dibujo llegue después.
create table public.dish_labels (
  slug text primary key,
  name text not null,
  hint text not null,
  icon text not null,
  -- Tres familias, porque no se leen igual. 'dieta' y 'caracteristica' son
  -- promesas del platillo y salen como distintivos junto a su nombre;
  -- 'alergeno' es una advertencia y sale como el renglón "Contiene…", que es
  -- como lo escriben las cartas que ya lo hacen.
  kind text not null check (kind in ('dieta', 'caracteristica', 'alergeno')),
  position smallint not null default 100
);

comment on table public.dish_labels is
  'Catálogo de etiquetas de platillo. Se lee público; se edita desde la consola.';
comment on column public.dish_labels.kind is
  'dieta | caracteristica = distintivo del platillo. alergeno = advertencia de lo que contiene.';
comment on column public.dish_labels.icon is
  'Nombre del dibujo en app/etiquetas-iconos.js. Si no existe, la app pinta uno genérico.';
comment on column public.dish_labels.position is
  'Orden en el panel y en la carta. Primero lo que más cambia la decisión de pedir.';

-- La semilla. `do nothing` y no `do update`: en un entorno donde alguien haya
-- ajustado un texto, reaplicar esto no se lo pisa.
insert into public.dish_labels (slug, name, hint, icon, kind, position) values
  -- Dieta: lo que el platillo no lleva, o el rito con el que se preparó.
  ('vegetariano',    'Vegetariano',       'Sin carne ni pescado',                          'hoja',        'dieta', 10),
  ('vegano',         'Vegano',            'Sin nada de origen animal',                     'brote',       'dieta', 20),
  ('sin-gluten',     'Sin gluten',        'Sin trigo, cebada ni centeno',                  'sin-gluten',  'dieta', 30),
  ('sin-lactosa',    'Sin lactosa',       'Sin leche ni derivados',                        'sin-lactosa', 'dieta', 40),
  ('sin-azucar',     'Sin azúcar',        'Sin azúcar añadida',                            'sin-azucar',  'dieta', 50),
  ('keto',           'Keto',              'Bajo en carbohidratos',                         'keto',        'dieta', 60),
  ('halal',          'Halal',             'Preparado según el rito islámico',              'halal',       'dieta', 70),
  ('kosher',         'Kosher',            'Preparado según el rito judío',                 'kosher',      'dieta', 80),
  -- Cómo es: lo que se pregunta antes de pedirlo.
  ('picante',        'Picante',           'Pica',                                          'chile',       'caracteristica', 110),
  ('muy-picante',    'Muy picante',       'Pica mucho',                                    'chile-doble', 'caracteristica', 120),
  ('crudo',          'Crudo',             'Se sirve crudo o poco cocido',                  'crudo',       'caracteristica', 130),
  ('para-compartir', 'Para compartir',    'Alcanza para dos o más',                        'compartir',   'caracteristica', 140),
  ('especialidad',   'Especialidad',      'La especialidad de la casa',                    'estrella',    'caracteristica', 150),
  ('mas-pedido',     'Lo más pedido',     'Lo que más piden en el lugar',                  'mas-pedido',  'caracteristica', 160),
  ('nuevo',          'Nuevo',             'Recién agregado a la carta',                    'nuevo',       'caracteristica', 170),
  -- Alérgenos. Son los catorce que la Unión Europea obliga a declarar, menos
  -- el altramuz, que aquí no se come y no tiene nombre que alguien reconozca.
  -- Se declaran de más, no de menos: quien es alérgico lee esta línea para
  -- decidir si pregunta o si se levanta.
  ('gluten',         'Gluten',            'Trigo, cebada, centeno o avena',                'trigo',       'alergeno', 210),
  ('lacteos',        'Lácteos',           'Leche, queso, crema o mantequilla',             'leche',       'alergeno', 220),
  ('huevo',          'Huevo',             'Huevo o preparados con huevo',                  'huevo',       'alergeno', 230),
  ('pescado',        'Pescado',           'Pescado o caldo de pescado',                    'pescado',     'alergeno', 240),
  ('crustaceos',     'Crustáceos',        'Camarón, langosta, jaiba',                      'camaron',     'alergeno', 250),
  ('moluscos',       'Moluscos',          'Pulpo, calamar, almeja, ostión',                'concha',      'alergeno', 260),
  ('frutos-secos',   'Frutos secos',      'Nuez, almendra, pistache, avellana',            'nuez',        'alergeno', 270),
  ('cacahuate',      'Cacahuate',         'Cacahuate o crema de cacahuate',                'cacahuate',   'alergeno', 280),
  ('soya',           'Soya',              'Soya, salsa de soya o tofu',                    'soya',        'alergeno', 290),
  ('ajonjoli',       'Ajonjolí',          'Ajonjolí o sésamo',                             'ajonjoli',    'alergeno', 300),
  ('mostaza',        'Mostaza',           'Mostaza o semillas de mostaza',                 'mostaza',     'alergeno', 310),
  ('apio',           'Apio',              'Apio o su raíz',                                'apio',        'alergeno', 320),
  ('sulfitos',       'Sulfitos',          'Conservador del vino y de algunos embutidos',   'sulfitos',    'alergeno', 330)
on conflict (slug) do nothing;

-- Igual que `amenities` y `cuisines`: lo lee cualquiera, no lo escribe nadie
-- desde la aplicación.
alter table public.dish_labels enable row level security;

create policy dish_labels_select_all on public.dish_labels
  for select to anon, authenticated using (true);

-- Las etiquetas del platillo. Arreglo de texto y no una tabla de cruce: son
-- una lista corta que siempre se lee junto con el platillo, y una tabla más
-- habría metido un join en la consulta que arma cada carta.
alter table public.menu_items
  add column labels text[] not null default '{}'::text[];

comment on column public.menu_items.labels is
  'Claves de public.dish_labels. Vacío = el platillo no declara ninguna.';

-- La lista no la puede validar un CHECK: una restricción no puede consultar
-- otra tabla. Lo hace un trigger, que además nombra la etiqueta desconocida en
-- el error en vez de dejar un 23514 seco.
create function public.validar_dish_labels()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desconocida text;
begin
  select s into desconocida
  from unnest(new.labels) as s
  where not exists (select 1 from public.dish_labels d where d.slug = s)
  limit 1;

  if desconocida is not null then
    raise exception 'Etiqueta de platillo desconocida: %', desconocida
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_dish_labels() from public, anon, authenticated;

create trigger menu_items_validar_labels
  before insert or update of labels on public.menu_items
  for each row execute function public.validar_dish_labels();
