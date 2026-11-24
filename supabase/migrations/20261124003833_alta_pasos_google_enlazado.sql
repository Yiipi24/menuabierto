-- Un paso más del embudo del dueño (#100): que puso el enlace de su carta en
-- su Perfil de Negocio de Google. Lo marca el dueño desde la pantalla del QR;
-- Google no avisa. El catálogo tiene que ser el mismo que PASOS_DEL_EMBUDO en
-- lib/alta.js.
alter table public.alta_pasos drop constraint alta_pasos_paso_check;
alter table public.alta_pasos add constraint alta_pasos_paso_check
  check (paso in ('alta_creada', 'menu_creado', 'qr_descargado', 'ficha_publicada', 'google_enlazado'));
