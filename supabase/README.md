# Base de datos

El esquema vive en `migrations/`, con el mismo nombre y orden que tiene el
proyecto de Supabase (`bpvtydaoiscvxpidwmif`). Cada archivo ya fue aplicado.

## Reglas

- **Nunca edites una migración ya aplicada.** Escribe una nueva que corrija.
  Esto ya se rompió una vez: los cambios de `ubicacion_panel_solo_autenticados`,
  `restaurant_coords_solo_del_duenio` y `lugar_vacio_no_apaga_el_radio` se
  metieron dentro de `ubicacion_en_busqueda_y_panel`, que ya estaba aplicada,
  en vez de ir en archivos nuevos. Los tres archivos ya están de vuelta, con el
  SQL exacto que corrió; el que los precede quedó con el contenido final de los
  cuatro, así que reaplicar de cero da el mismo esquema, solo que pasando dos
  veces por lo mismo.
- **El archivo se llama igual que la versión registrada en la base.** El
  prefijo del nombre es el `version` de `supabase_migrations.schema_migrations`,
  no la hora en que se te ocurrió el cambio. `supabase db push` y `db diff`
  comparan por ese número: con una fecha inventada ven una migración local que
  "falta" allá y una remota que no conocen, y dejan de servir. Siete archivos
  llevaban fecha propia y ya están renombrados; los dos últimos fueron
  `perfil_destacados_redes_fotos` (20260903204500 → 20260903204955) y
  `zona_horaria_del_restaurante` (20260903221500 → 20260903224920). La lista
  de referencia es `supabase_migrations.schema_migrations`, no el reloj de
  quien escribe la migración. Los dos que faltaban se renombraron después:
  `favoritos_del_comensal` (20260905120500 → 20260905092700) y
  `busqueda_con_servicios_y_coordenadas` (20260905120000 → 20260905092729),
  que además iban en el orden equivocado entre ellos: la fecha inventada
  ponía la búsqueda antes que los favoritos y en la base fue al revés.
  Volvió a pasar con lo social y lo de WhatsApp, y se corrigió igual:
  `programar_publicaciones` (20260907210000 → 20260907214705),
  `evento_de_pedido_por_whatsapp` (20260908101500 → 20260908022033) y
  `pedidos_por_whatsapp` (20260908101600 → 20260908022555). En esa misma
  ronda faltaban tres archivos de migraciones que sí estaban aplicadas
  —`plan_de_trabajo_pasos`, `programar_publicaciones_permisos` y
  `social_mias_no_es_para_anon`— y se escribieron con el SQL exacto que
  guarda `supabase_migrations.schema_migrations`. Los dos últimos son las
  correcciones que se habían metido dentro de `programar_publicaciones`, que
  ya estaba aplicada: ese archivo queda con el contenido final de los tres,
  igual que el cuarteto de la ubicación, así que reaplicar de cero da el
  mismo esquema pasando dos veces por lo mismo. Volvió a pasar una cuarta
  vez con los cupones y las fotos, y se corrigió igual: `eventos_de_cupon`
  (20260908120000 → 20260908050932), `horarios_cupones_y_sucursales`
  (20260908120100 → 20260908051041), `metricas_de_cupones_y_comunidad`
  (20260908120200 → 20260908051158), `permisos_de_lo_nuevo`
  (20260908120300 → 20260908231429) y `nombres_de_platillo_en_fotos`
  (20260909120000 → 20260909024219). La forma de no repetirlo: aplicar
  primero con `apply_migration`, leer la versión que quedó registrada en
  `supabase_migrations.schema_migrations` y nombrar el archivo con esa. Hoy
  cada archivo del directorio coincide con una versión registrada, y no sobra
  ninguna.
- Toda tabla nueva nace con RLS activo y sus políticas en la misma migración.
  Una tabla sin políticas queda invisible, que es el fallo seguro correcto.
- Después de cambiar el esquema, revisa los advisors de seguridad y
  rendimiento de Supabase antes de dar el trabajo por terminado.

## Decisiones que conviene no reabrir a la ligera

- **Una ficha sin `owner_id` es una ficha sembrada, y solo se reclama por
  `aprobar_reclamo()`.** Las columnas `source` y `source_id` dicen de donde
  salio (hoy solo `denue`) y su indice unico hace idempotente la importacion.
  `ficha_duplicada()` evita sembrar encima de un local que ya esta. Las tres
  funciones son security definer sin EXECUTE para anon/authenticated: las
  llama el script con la llave de servicio, o la accion de reclamo cuando el
  correo demuestra el dominio del sitio. La politica de insert de
  `restaurant_claims` exige que la ficha no tenga dueno.
- **La direccion de una ficha es su nombre pegado, y la reparte la base.**
  `slug` guarda la ruta completa (`jcsmokehouse`, o `jcsmokehouse/centro`
  cuando el nombre ya estaba tomado), no un tramo suelto: lo unico que tiene
  que ser unico es la direccion entera, y de eso ya se encarga el indice unico
  de la columna. El CHECK `restaurants_slug_formato` obliga la forma y ademas
  impide que un restaurante se quede con `/panel` o `/entrar`; la misma lista
  de rutas reservadas vive en `lib/slug.js` y las dos tienen que decir lo
  mismo; cada ruta fija nueva tiene que entrar en las dos, y `novedades` y
  `avisos` —el feed del comensal y su bandeja— se agregaron con las historias.
  `comida` entro con las paginas por cocina y por zona (`/comida/tacos`,
  `/comida/tacos/coyoacan`), y en esa misma migracion se pusieron al dia
  `novedades` y `avisos`, que llevaban prohibidos solo en el codigo: la copia
  que manda es esta, porque es la que la base puede hacer cumplir.
  El slug lo elige `slug_disponible`, que es `security definer` a
  proposito: para saber si "tacoselgordo" esta libre hay que ver todas las
  fichas y la RLS solo deja ver las publicadas.
- **El slug no cambia cuando el restaurante cambia de nombre.** Es la
  direccion que la gente dicta por telefono y pega en Instagram, y el dueno no
  puede avisarle a todos porque le corrigio una falta de ortografia al letrero.
  Lo impreso ya no depende de el —para eso esta `qr_code`—, pero lo compartido
  si. `legacy_slug` guarda el slug anterior a la estandarizacion para que
  `/r/<slug viejo>` siga redirigiendo a la ficha en vez de dar un 404.
- **Un restaurante tiene un solo QR, y es para siempre.** `qr_code` es un
  código corto y sin significado que la base reparte al dar de alta la ficha;
  la ruta impresa es `/q/<codigo>` y de ahí redirige a la ficha. No apunta al
  slug a propósito: el slug es texto derivado del nombre y de la colonia, y lo
  que está pegado en una mesa no puede depender de una decisión de producto.
  Un trigger (`qr_code_permanente`) lo pone al insertar y revienta si alguien
  intenta cambiarlo, que es justo la garantía que hace que el vinil se imprima
  una sola vez. El alfabeto no tiene o/0 ni i/l/1, para que el código se pueda
  dictar. La traducción de código a dirección va por `restaurante_por_qr`, que
  es `security definer` porque quien escanea no tiene sesión y el dueño tiene
  que poder probar el suyo antes de publicar. Antes había un QR por carta: se
  quitó porque cada carta nueva obligaba a reimprimir, y quien se sienta en la
  mesa quiere el restaurante, no una carta en particular.
- **Los eventos del panel son anónimos y se cuentan una vez por hora.**
  `restaurant_events` no guarda IP ni cuenta: `visitor` es un id aleatorio de
  una cookie httpOnly, y el índice `restaurant_events_sin_repetir` hace que
  recargar la ficha cinco veces sea una sola visita. La ciudad la pone el borde
  de Vercel y se queda en ciudad, estado y país. Escribir solo se puede sobre
  fichas publicadas; leer, solo el dueño, y el tablero entra por
  `restaurant_metrics`, que calcula el periodo en la zona horaria del local
  porque "hoy" no significa lo mismo en Tijuana que en Cancún.
- **Un evento puede tener carta.** `menu_id` la guarda cuando pasó en la
  página de una sola (`/<slug>/menu/<id>`). Ya no hay un QR por carta, así que
  `qr_scan` cae siempre en la ficha y el desglose por carta es de vistas. Es
  nulo en todo lo demás —la ficha, el teléfono, la página con todas las
  cartas— porque ahí no hay un menú en particular y forzarle uno sería
  inventar el dato. El índice que evita los duplicados lo incluye con un
  `coalesce`: en un índice único Postgres considera distintos a dos NULL, y sin
  el `coalesce` los eventos sin carta —casi todos— dejarían de deduplicarse.
  Que la carta sea de esa ficha y esté visible lo comprueba la política de
  `INSERT` con `menu_es_de_la_ficha`, no solo la ruta que recibe los eventos.

- **Una historia o publicación es una fila, aunque salga en cuatro fichas.**
  `social_posts` guarda el contenido y `social_post_restaurants` dice dónde
  sale. Un dueño con cuatro sucursales publica la misma promoción en las
  cuatro, y duplicar la fila habría duplicado también sus likes, sus
  comentarios y su conteo de vistas: la misma foto acabaría con cuatro cifras
  distintas debajo. La regla de "solo publicas en lo tuyo" vive en la política
  de `social_post_restaurants`, que exige ser el autor del contenido *y* el
  dueño de la ficha; una fila suelta en `social_posts` sin restaurantes no la
  ve nadie, así que no es una fuga sino basura.
- **La caducidad de una historia es un dato, no un cálculo.** `expires_at` se
  llena al insertar, en la base y no en el navegador: veinticuatro horas
  contadas desde el reloj de quien publica durarían lo que ese reloj diga. Las
  lecturas filtran por esa columna, así que la historia deja de verse en el
  instante exacto aunque su fila siga ahí; `limpiar_historias` solo recoge lo
  caducado hace más de una semana y la llama la carga de la ficha, de vez en
  cuando, en vez de un cron.
- **Los conteos de likes, comentarios y vistas son columnas, no `count(*)`.**
  Una ficha con diez publicaciones haría treinta consultas agregadas para
  dibujarse. Los mantienen triggers y el cliente no los puede escribir: un
  BEFORE UPDATE los congela. Eso mismo congelaba al trigger que sí debe
  moverlos, así que `contar_social` enciende una marca local a la transacción
  (`menuabierto.contando`) que el guardia respeta. `contar_social` no está
  concedida a nadie desde la API: publicada, servía para poner mil Me gusta
  sin dejar una fila en `social_likes`.
- **La campana va en la fila de seguidor y no en su propia tabla.**
  `restaurant_followers.notify_stories` es del mismo grano —una persona y un
  restaurante— y separarlo habría sido una tabla 1:1 que unir en cada lectura
  para leer un booleano. Dejar de seguir se lleva la preferencia por delante,
  que es lo que se espera.
- **A quién sigues es privado; cuántos te siguen es público.** La tabla solo
  se lee a sí misma, igual que los favoritos, y el número que enseña la ficha
  es `restaurants.followers_count`, una columna que lleva un trigger. Abrir la
  lista de seguidores para poder contarlos habría sido enseñar nombres para
  pintar una cifra.
- **Los avisos los reparte un trigger y nadie más.** `notifications` no tiene
  política de INSERT a propósito: el reparto va sobre
  `social_post_restaurants` —hasta que el contenido no tiene ficha no hay nada
  que avisar— y corre como `security definer`. Que el cliente no pueda
  escribir ahí es lo que garantiza que un aviso siempre corresponde a algo que
  pasó. El índice único `notifications_sin_repetir` es el antiduplicado: una
  historia publicada a la vez en tres sucursales que sigues son tres avisos
  —son tres restaurantes— pero nunca dos por la misma.
- **Lo social se lee por función.** `historias_restaurante`,
  `publicaciones_restaurante`, `comentarios_publicacion`, `feed_seguidos`,
  `social_mias` y `mis_avisos`. Por lo mismo que `resenas_restaurante`: el
  nombre de quien comenta vive en `profiles`, que es privado, y el feed cruza
  cinco tablas. Paginan por fecha (`antes`) y no por número de página, porque
  publicar mientras alguien baja movería todas las páginas un lugar.
- **El bucket `social` va por autor y no por restaurante.** La ruta es
  `<author_id>/<archivo>` porque el mismo archivo puede salir en cuatro
  sucursales: la carpeta dice quién lo subió, que es lo único que no cambia.
  Es un bucket aparte del de fotos porque acepta video, y el de fotos tiene un
  tope de 5 MB que un video de quince segundos se salta.
- **El archivo de una publicación no se puede cambiar al editar.** Solo el
  texto. Cambiar la foto de algo que ya tiene likes y comentarios convertiría
  esos likes en likes de otra cosa; quien se equivocó la borra y sube la
  buena.
- **`location` es `geography(point, 4326)`**, no dos columnas de latitud y
  longitud. Con el índice GiST, `ST_DWithin` resuelve "cerca de mí" contra un
  directorio grande; filtrar en JavaScript no escala más allá de un pueblo.
- **Una ficha sin coordenadas no la esconde el radio.** `location` se quedó
  nula en todas las fichas hasta que el panel aprendió a pedirla, y mientras
  tanto exigir `location is not null` dejaba "Cerca de mí" en cero resultados.
  Sale igual en la búsqueda, pero al final, porque su distancia es nula.
  Cuando la mayoría tenga punto conviene volver a apretar esto.
- **El lugar escrito manda sobre el radio.** Buscar "Escobedo" con la ubicación
  puesta tiene que traer Escobedo, no la intersección vacía de las dos cosas.
- **El punto se calcula desde la dirección, con Nominatim (OpenStreetMap).**
  Pedirle coordenadas al dueño de un restaurante era pedirle que copiara
  números de un mapa para poder aparecer en "Cerca de mí". Los campos de
  latitud y longitud siguen ahí, plegados, y ganan si los llena: un
  geocodificador se equivoca en colonias nuevas. No se usa el de Google porque
  sus términos restringen guardar las coordenadas de forma permanente, y aquí
  el punto vive en la base; los datos de OSM son ODbL y sí se pueden almacenar
  dando atribución. Se consulta solo cuando la dirección cambió o no hay punto,
  y va al final del guardado: un servicio ajeno lento no puede dejar la ficha
  sin categorías ni horarios. `NOMINATIM_URL` apunta a otra instancia si el
  volumen crece, que es lo que su política pide.
- **El panel escribe el punto por `set_restaurant_location`**, no con un
  `update` normal: mandar EWKT en texto y confiar en el cast es más frágil que
  una función que recibe dos números y los valida. Se lee con
  `restaurant_coords`, porque PostgREST devuelve `geography` en hexadecimal.
  Las dos son `security invoker` y solo para `authenticated`.
- **`owner_id` y `created_by` son distintos.** `created_by` es quien cargó la
  ficha; `owner_id` es el dueño que la reclamó. Una ficha que cargamos
  nosotros tiene `owner_id` nulo y debe mostrarse como *no reclamada*, nunca
  como si el restaurante la hubiera publicado.
- **Los precios son enteros en centavos.** En punto flotante terminan
  mostrando 89.99000001.
- **Un restaurante tiene varios menús, no uno.** La carta, la de bebidas, la
  del día. Las secciones y los platillos cuelgan de `menus`, no del
  restaurante: antes todo caía en una sola lista y no había forma de separar
  la carta de temporada de la de siempre. `menu_sections` y `menu_items`
  conservan `restaurant_id` porque de ahí sale su RLS, y la llave hacia el
  menú es compuesta (`menu_id, restaurant_id`) para que una sección no pueda
  colgar del menú de otro restaurante.
- **Cuántos menús caben lo decide `menus_incluidos`, y lo impone un trigger.**
  5 en básico, 10 en plus, 30 en premium. Está en la base y no solo en el
  panel porque el límite tiene que sostenerse aunque alguien escriba contra
  PostgREST directamente. `lib/planes.js` repite los números para poder avisar
  antes de tiempo; si cambian, se cambian en los dos lados. Un plan de paga
  vencido cuenta como básico: si no, dejar de pagar conservaría los treinta
  menús para siempre.
- **Borrar una sección no borra sus platillos.** `section_id` queda en nulo y
  los platillos se muestran al final, sin agrupar. Por eso la coherencia entre
  platillo y sección la comprueba un trigger y no una llave compuesta: al
  borrar, esa llave pondría en nulo también `menu_id`, que es obligatorio.
- **La descripción del menú se escribe o se arma sola.** `description` es la
  línea que la ficha enseña bajo el nombre de cada carta. Nula no significa
  vacía: significa "ármala con lo que la carta ya tiene" —sus secciones, o sus
  primeros platillos cuando solo tiene una—, y por eso el panel la guarda como
  nula cuando el dueño borra el campo en vez de como cadena vacía. Una casilla
  más que se queda sin llenar no puede dejar la ficha sin la línea. El tope de
  140 vive en los tres lados: el `maxLength` del formulario, la acción que
  guarda y el CHECK de la columna.
- **Un menú puede ser un archivo.** `kind = 'archivo'` con el PDF o la foto en
  el bucket `menus`, para quien ya tiene su carta hecha y no quiere
  capturarla. Bucket aparte del de fotos porque este acepta PDF y aquel no.
  Lo capturado sale en las búsquedas por platillo; lo subido no, y el panel lo
  dice al elegir.
- **Las etiquetas del platillo son un catálogo en tabla, no un CHECK.**
  `dish_labels` guarda la lista —vegetariano, sin gluten, picante, los
  alérgenos— y `menu_items.labels` las claves que cada platillo declara. Es el
  mismo trato que `amenities`: la lista va a crecer cada vez que un dueño pida
  la suya, y una migración por etiqueta sería una migración por semana. Agregar
  una es un INSERT y aparece en el panel y en la carta sin desplegar; su dibujo
  puede llegar después, porque `app/etiquetas-iconos.js` pinta uno genérico
  mientras tanto. La validación la hace un trigger (`menu_items_validar_labels`)
  y no una restricción, porque un CHECK no puede consultar otra tabla; además
  nombra la etiqueta desconocida en el error.
- **Un alérgeno no es un distintivo, y por eso `kind` existe.** `dieta` y
  `caracteristica` son promesas del platillo y salen como marcas junto a su
  nombre; `alergeno` es una advertencia y sale escrita, en el renglón
  "Contiene: gluten, lácteos". Cinco dibujos seguidos habría que descifrarlos, y
  quien es alérgico lee esa línea para decidir si pregunta o si se levanta. Los
  trece alérgenos sembrados son los catorce que obliga a declarar la Unión
  Europea menos el altramuz, que aquí no se come.
- **En el JSON-LD solo entran las dietas que schema.org sabe nombrar.**
  `RestrictedDiet` es un vocabulario cerrado: vegetariano, vegano, sin gluten,
  sin lactosa, halal y kosher tienen término y se declaran; keto y sin azúcar no
  lo tienen y se quedan solo en la carta. Los alérgenos tampoco entran:
  `MenuItem` no tiene dónde declararlos y meterlos en la descripción sería
  inventarle texto al dueño.
- **La búsqueda solo mira menús visibles.** Encontrar un restaurante por un
  platillo de una carta que su dueño tiene guardada manda a la ficha a buscar
  algo que no está.
- **Las políticas usan `(select auth.uid())`**, no `auth.uid()` suelto: así
  Postgres lo evalúa una vez por consulta en lugar de una vez por fila.
- **Nada de `upsert` ni `ON CONFLICT` bajo RLS** si no quieres una política de
  `SELECT`: Postgres necesita leer la fila en conflicto para resolverlos.

## Avisos aceptados a propósito

- `plan.pasos` con RLS y sin políticas: es el plan de trabajo interno y vive
  fuera de `public` justamente para que PostgREST no lo exponga. Sin políticas
  no lo lee nadie desde la API, que es lo que se quiere; se consulta con la
  llave de servicio.
- `spatial_ref_sys` sin RLS: es una tabla de sistema de PostGIS con el
  catálogo de sistemas de coordenadas. No contiene datos nuestros y no somos
  sus dueños.
- PostGIS, `unaccent` y `pg_trgm` instalados en el esquema `public`: moverlos
  rompería las referencias existentes a cambio de nada.
- `cuisines_created_by_fkey` sin índice: la columna se escribe al proponer una
  categoría y no se consulta por ella; el catálogo son decenas de filas.
- `restaurante_por_qr` ejecutable por `anon` como `security definer`: quien
  escanea el vinil no tiene sesión y el código puede ser de una ficha en
  borrador —el dueño prueba el suyo antes de publicar—, así que la traducción
  de código a dirección no puede pasar por la RLS. Responde con la dirección y
  el estado de una ficha a quien ya tiene su código de siete caracteres en la
  mano; que esa ficha se pueda ver o no lo sigue decidiendo la RLS de después.
- `menu_es_de_la_ficha` ejecutable por `anon` como `security definer`: dentro
  de una política, la función tiene que poder correrla quien escribe el evento,
  que es cualquiera que abra una carta. Responde sí o no a "este menú visible
  es de esta ficha", que es justo lo que ya se ve en la página. Es el mismo
  caso —y el mismo aviso— que `restaurant_is_public`.
- `social_post_visible` y `social_post_mine` ejecutables por `anon` como
  `security definer`: el mismo caso otra vez. Las llaman las políticas de
  likes, comentarios y vistas, así que tiene que poder correrlas quien
  escribe, que es cualquiera que comente. Responden sí o no a "esta
  publicación se puede ver" y "es mía", que es lo que la página ya enseña.
- `limpiar_historias` ejecutable por `authenticated`: borra historias caducadas
  hace más de una semana, contenido que nadie puede ver desde entonces. Va
  concedida para que la dispare la carga de una ficha —de vez en cuando, no
  siempre— en lugar de depender de un cron. A `anon` no: borrar filas, aunque
  sean invisibles, no es algo que deba poder disparar quien solo abrió una
  página.

# Correos de autenticación

Las plantillas de `templates/` reemplazan las de fábrica de Supabase, que
llegan en inglés y sin logo. `config.toml` las conecta con su asunto para el
entorno local; en el proyecto hospedado hay que pegarlas en
**Authentication → Emails → Templates** (una pestaña por plantilla, con su
asunto) porque el panel guarda el HTML en su propia base, no en el repo.

- El logo se enlaza como PNG absoluto (`https://menuabierto.com/logo-email.png`,
  generado desde `public/logo.svg`). Gmail y Outlook no dibujan SVG ni rutas
  relativas dentro de un correo.
- Todo el estilo va en atributos `style` en línea y sobre tablas: los clientes
  de correo ignoran las hojas de estilo y muchos ignoran flex y grid.
- Se mantiene `{{ .ConfirmationURL }}` también en texto plano abajo, para
  quien tenga los botones bloqueados.

El workflow `plantillas-correo.yml` las aplica solo: cada push a `main` que
toque `templates/` o `config.toml` llama a la Management API con el secret
`SUPABASE_ACCESS_TOKEN` del repo.

Ese secret tiene que ser un **legacy token** de Supabase. Los tokens con
alcance por proyecto no sirven aquí: su capability *Auth Config: read-write*
cubre el `GET` de la config y los endpoints de SSO y third-party-auth, pero no
el `PATCH /v1/projects/{ref}/config/auth`, que es el que escribe las
plantillas. Se intentó y responde 403. Como el legacy token da acceso a toda
la cuenta, conviene renovarlo con vencimiento corto en lugar de dejarlo
abierto un año. El repo es la fuente de verdad;
si alguien edita una plantilla en el panel, el siguiente push la pisa. Para
revisar sin enviar nada: `python3 scripts/aplicar-plantillas-correo.py
--dry-run`.
