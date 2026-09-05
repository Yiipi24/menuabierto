-- El advisor marcó `refresh_profile_reviews_count` como una función security
-- definer que anon y authenticated pueden llamar por /rest/v1/rpc. Llamarla
-- así falla —una función de trigger no corre fuera de su trigger—, pero el
-- permiso no debería existir de todos modos: nadie fuera de la base tiene por
-- qué invocarla, y dejarlo abierto obliga a volver a razonarlo cada vez que
-- alguien audita la lista.
revoke execute on function public.refresh_profile_reviews_count() from public, anon, authenticated;
