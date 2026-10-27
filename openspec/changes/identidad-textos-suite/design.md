## Context

El marco de identidad deja cinco decisiones abiertas que esta tarea toca. Las cuatro primeras las
resolvió Pablo el 2026-10-27; la quinta sigue abierta.

## Decisions

1. **«Pausa» sale; Remanso ocupa su lugar.** Se registra en el marco (nota al inicio, sin reescribir
   su texto, que es un documento adjunto), en la ficha de Remanso y en el backlog.
2. **Sin «mitades».** Organizar, cuidar y disfrutar son dimensiones de la marca (§2). Remanso se
   describe por lo que es. Se quitan las menciones de fichas, change `remanso-meditacion`, backlog y
   STATUS; el paquete de diseño recibido (`docs/diseno/remanso`) se conserva sin editar.
3. **Textos desde el §9, contrastados con el código.** Portada con el título del §9.1. La
   alternativa prudente («Estamos sumando otras…») se descartó el mismo día por Pablo, que la
   consideró demasiado temporal: el hero dice «organizar lo cotidiano y encontrar momentos de
   calma» y la calma se conecta con Remanso (decisión 6). Remanso sigue «Próximamente» en el
   catálogo de la portada. Fun TasKing: tablero personal y tableros compartidos, que
   existen (README). Cuentas Claras: «cuando se comparten» repartos y saldos; no se promete un modo
   individual, informes ni presupuestos. Compras: sin promesa de colaboración (§9.5).
4. **Pie «Tu hogar, a tu ritmo.»** reemplaza el lema anterior del pie;
   la frase se toma de las pautas de redacción (§5). Se quita también la excepción del glosario
   que permitía el lema anterior, que era una decisión pendiente de Pablo.
5. **Colores de acento por producto: pendiente.** El marco pide revisar la identidad visual actual
   antes de proponer; no se cambia paleta ni emblema en este change.

6. **Conexión de la portada con Remanso, sólo en staging.** El hero suma «Probá Remanso» con el
   mismo mecanismo que las landings (`<!-- staging-app-entry -->` que el worker reemplaza si
   `SITE_ENV=staging`). En producción no hay enlace: la app aún no tiene producción, y apuntar a
   staging desde el dominio público sería un enlace roto o no deseado. Alternativas descartadas:
   mostrar el botón también en producción hacia la landing «en preparación» (un «Probá» que lleva
   a «todavía no» desilusiona) y cambiar el estado de la tarjeta a «Disponible» (no lo está).

7. **La landing de Remanso no menciona cuentas** (Pablo, 2026-10-27). Los niveles de acceso viven en la app
   (`REMANSO_ACCESO`) y pueden cambiar; la landing no los fija. Se quitó la frase del hero y la nota del botón de
   staging.

## Risks

- En producción el hero habla de momentos de calma mientras Remanso figura «Próximamente»: el texto
  describe lo que la suite busca (§9.1) y el catálogo conserva el estado real. Si se prefiere
  más prudencia, la alternativa es un hero sin mención a la calma hasta publicar la app.

- Los textos nuevos de Cuentas Claras y Compras siguen describiendo productos en preparación: se
  conserva el estado «Próximamente» y la nota «todavía está en preparación».
- El título de la portada cambia en el `<title>`, el `h1` y el meta: se actualizan sus pruebas.
