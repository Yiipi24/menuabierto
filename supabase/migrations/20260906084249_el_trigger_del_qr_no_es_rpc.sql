-- Igual que pasó con el trigger de insignias: `qr_code_permanente` nació con
-- el EXECUTE que Postgres le da a `public`, así que PostgREST la publica como
-- /rest/v1/rpc/qr_code_permanente y el advisor la marca como función
-- `security definer` que cualquiera puede llamar. Llamarla suelta no haría
-- nada —una función de trigger sin TG_OP revienta—, pero una función que no
-- es de nadie no tiene por qué estar en la API.
--
-- El trigger sigue disparando: el permiso de EXECUTE se comprueba al crear el
-- trigger, no cada vez que la fila cambia.
revoke all on function public.qr_code_permanente() from public, anon, authenticated;
