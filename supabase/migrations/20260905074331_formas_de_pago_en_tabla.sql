-- Las formas de pago se quedaron como lista en el código cuando los servicios
-- se mudaron a una tabla. Es la misma clase de catálogo y va a crecer por las
-- mismas razones —vales de despensa, CoDi, transferencia por app— así que
-- recibe el mismo trato: tabla, lectura pública, y agregar una es un INSERT.
--
-- Igual que con `amenities`, los dibujos se quedan en el código: la tabla
-- guarda cuál le toca a cada forma y la app pinta uno genérico mientras ese
-- dibujo no exista.
create table public.payment_methods (
  slug text primary key,
  name text not null,
  hint text not null,
  icon text not null,
  position smallint not null default 100
);

comment on table public.payment_methods is
  'Catálogo de formas de pago. Se lee público; se edita desde la consola.';
comment on column public.payment_methods.icon is
  'Nombre del dibujo en app/pagos-iconos.js. Si no existe, la app pinta uno genérico.';
comment on column public.payment_methods.position is
  'Orden en el panel y en la ficha.';

insert into public.payment_methods (slug, name, hint, icon, position) values
  ('efectivo', 'Efectivo', 'Pago en caja o en la mesa', 'efectivo', 10),
  ('tarjeta-credito', 'Tarjeta de crédito', 'Visa, Mastercard, American Express', 'tarjeta-credito', 20),
  ('tarjeta-debito', 'Tarjeta de débito', 'Con terminal en el local', 'tarjeta-debito', 30),
  ('transferencia', 'Transferencia', 'SPEI o depósito a cuenta', 'transferencia', 40),
  ('sin-contacto', 'Pago sin contacto', 'Apple Pay, Google Pay o tarjeta NFC', 'sin-contacto', 50);

alter table public.payment_methods enable row level security;

create policy payment_methods_select_all on public.payment_methods
  for select to anon, authenticated using (true);

-- El check no puede consultar otra tabla, así que valida un trigger, que de
-- paso nombra a la clave desconocida en vez de dejar un 23514 seco.
alter table public.restaurants
  drop constraint restaurants_payment_methods_validos;

create function public.validar_payment_methods()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desconocido text;
begin
  select s into desconocido
  from unnest(new.payment_methods) as s
  where not exists (select 1 from public.payment_methods p where p.slug = s)
  limit 1;

  if desconocido is not null then
    raise exception 'Forma de pago desconocida: %', desconocido
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_payment_methods() from public, anon, authenticated;

create trigger restaurants_validar_payment_methods
  before insert or update of payment_methods on public.restaurants
  for each row execute function public.validar_payment_methods();
