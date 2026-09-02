-- El plan intermedio. Va en su propia migracion porque Postgres no deja usar
-- un valor de enum recien agregado en la misma transaccion que lo agrega, y
-- la migracion siguiente si lo nombra para repartir los menus por plan.
alter type public.plan_tier add value if not exists 'plus' before 'premium';
