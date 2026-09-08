-- `social_mias` devuelve las publicaciones de quien está firmado, incluidas
-- las que todavía no salen. Sin sesión no devuelve nada, así que concederla a
-- `anon` no filtraba: solo dejaba abierta una función que nadie sin sesión
-- puede usar para algo. Se cierra por lo mismo que las demás.
revoke execute on function public.social_mias(integer, timestamptz) from public, anon;
