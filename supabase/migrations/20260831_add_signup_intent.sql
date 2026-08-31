-- Que eligio la persona al registrarse. Es una senal de onboarding, no un
-- permiso: quien puede editar un restaurante lo decide owner_id, no esto.
-- Una misma persona puede tener restaurante y ser comensal en los demas.
alter table public.profiles
  add column signup_intent text
  check (signup_intent in ('comensal', 'restaurante'));

comment on column public.profiles.signup_intent is
  'Intencion declarada al registrarse. Solo sirve para decidir a donde llevar a la persona despues del alta. Nunca para autorizar.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, signup_intent)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'signup_intent' in ('comensal', 'restaurante')
        then new.raw_user_meta_data ->> 'signup_intent'
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
