## Context

Producción separa `homesuite.info` (sitio público) de la futura
`app.homesuite.info` (sesión). Staging ya tiene el origen autenticado
`staging.homesuite.info` con callback y D1 propios. La home pública no debe
recibir cookies, secretos ni datos de perfil.

## Decisions

1. **Dos Workers y dos hostnames estables.** `homesuite-site-staging` sirve
   `site-staging.homesuite.info` con los mismos assets públicos. Mantener ambos
   Workers separados reproduce la frontera prevista para producción y evita
   cambiar el callback OAuth ya verificado.
2. **Enlaces sólo del entorno correspondiente.** El sitio reconoce staging por
   la variable pública `SITE_ENV`; allí añade una acción a la landing de Cuentas
   Claras y cambia el destino de TasKing a su staging. El sitio de producción no
   recibe esa variable. Las respuestas públicas de staging indican `noindex`.
3. **Raíz de suite, ruta de producto.** `/` presenta herramientas a personas con
   o sin sesión. `/cuentas-claras` contiene el aviso después de elegir el
   producto y conserva `returnTo` al iniciar Google desde esa ruta.
4. **Un perfil global con dos accesos.** El avatar/nombre enlaza directamente a
   `/perfil`; el menú general también lo ofrece. La página usa el contrato
   propio `GET/PATCH /api/me/profile`, CSRF y revisión; no crea otra copia del
   perfil. El apodo por espacio permanece fuera de esta pantalla.
5. **Recuperar el emoji oculto sin exponerlo a integrantes.** La lectura propia
   añade `avatar.savedEmoji`; la presentación ajena sigue entregando únicamente
   el emoji visible. La imagen Google usa inicial si falta o no carga.

## Risks and checks

- El nuevo dominio público debe provisionarse con HTTPS y comprobarse antes de
  anunciarlo. El Worker de sitio no debe adquirir D1 ni secretos.
- Un cambio de perfil desde otra pestaña debe producir conflicto 409 visible, no
  pisar la edición. Una sesión ausente no debe ver `/perfil`.
- El staging de TasKing sigue en otro Worker y con otra sesión. Su enlace no
  acredita integración de identidad; esa migración conserva seguimiento propio.
