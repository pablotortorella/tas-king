## 1. Contenido

**Punto de partida para continuar con Claude:** leer [tips.md](tips.md), que reúne el catálogo para curar, los criterios conversados, las variantes y las decisiones pendientes. La voz fue aceptada, pero la colección completa y su orden todavía requieren curación con Pablo; este registro no da por completadas las tareas siguientes.

- [x] 1.1 **Curar el catálogo con Pablo, tip por tip** (es él quien decide; los IDs se mantienen estables al editar). Marcar cada candidato como Aprobado o Descartado en `tips.md` y elegir entre originales y hermanas singulares, hasta cerrar la colección — **cerrado 2026-09-11**: 74 aprobados, 1 descartado (P5); las hermanas y los originales conviven
- [x] 1.2 Recortar los 4 tips que superan el techo editorial de ~110 caracteres — P5 (112), K7 (117), G5 (120), G3 (125) — y verificar que ningún texto aprobado excede ese largo — **resuelto 2026-09-11**: P5 descartado; K7 (99), G5 (98) y G3 (101) reescritos; verificado que ningún texto vivo del catálogo supera los 110
- [x] 1.3 Repartir los candidatos N1–N10 entre los tres tramos según su tema (hoy están agrupados aparte y mezclan temas de los tres) y verificar que cada tip quedó en el tramo que le corresponde — **resuelto 2026-09-11**: N1/N4/N5/N6/N9/N10 al segundo tramo y N2/N3/N7/N8 al tercero; ninguno al primero
- [x] 1.4 Agregar las hermanas singulares que falten para los tips en plural donde aplique, sin reemplazar el original, y verificar que ambas versiones conviven con IDs propios — **resuelto 2026-09-11**: nueve hermanas nuevas aprobadas (K6, K8, K11, K12, O6, M5, M7, M9, M10) más la alineación de K7-V1; originales intactos y cada hermana con ID propio
- [x] 1.5 Resolver los solapamientos ya detectados (K4/M1, K11/M6, O4/G4, T5/N7, T6/N4): conservarlos separados en la secuencia o reducirlos, y verificar que la decisión quedó registrada en `tips.md` — **resuelto 2026-09-11**: se conservan los cinco pares completos, separados en la secuencia; K4 queda como está y en el tramo 1
- [x] 1.6 Ajustar K5, que presenta «Quietas» como si estuviera directo en «¿Cómo vamos?» cuando está dentro de la sección «¡Pilas con esto! 🔥», y verificar la ruta contra la UI real — **resuelto 2026-09-11**: ruta completa en el texto, verificada contra `public/index.html:915-919`
- [x] 1.7 Definir la secuencia final de los tres tramos y dejarla como un único array ordenado `DAILY_TIPS` en `public/tips.js` (archivo propio por modularidad, decisión de Pablo del 2026-09-11; se carga desde `public/index.html`), verificando que el orden del archivo es el orden pedagógico del spec — **resuelto 2026-09-11**: 74 tips en orden (26 + 22 + 26), cada hermana a 8-13 días de su original

## 2. Selección del tip del día

**Decidido el 2026-09-11**: el avance vive en la cuenta de la persona (dos columnas en `users`), no en `localStorage`. Ver `design.md`.

- [x] 2.1 Escribir la migración `0014_tip_diario.sql` que agrega a `users` las columnas `tip_index` (INTEGER) y `tip_date` (TEXT), ambas nullable y sin backfill, y verificar que aplica en limpio con `npm run db:reset:local` — **hecho**: `migrations/0014_tip_diario.sql`, aplicada en limpio en local
- [x] 2.2 Implementar la regla de avance como función pura en el backend (si la fecha guardada no es hoy: incrementar el contador y grabar hoy; si es hoy: devolver el contador tal cual) y verificar con tests unitarios en `test/tip-diario.test.js` los casos: primera vez sin avance guardado, misma jornada, día siguiente, varios días de ausencia, y contador que supera el largo del catálogo — **hecho**: `avanzarTip()` en `src/routes/users.js`, 9 tests unitarios en `test/tip-diario.test.js`
- [x] 2.3 Conectar la regla a `GET /api/me`: sumar `tip_index` y `tip_date` al `SELECT` que ya se hace sobre `users` (`src/routes/users.js:15`), devolver el índice del día en la respuesta y grabar el avance cuando corresponda, verificando que no se agrega ninguna query nueva a la carga del tablero — **hecho**: las dos columnas viajan en el `SELECT` que ya existía, sin queries nuevas; 5 tests de integración sobre `/api/me`
- [x] 2.4 Resolver el tip en el frontend con `DAILY_TIPS[indice % DAILY_TIPS.length]`, de modo que el ciclado viva junto al catálogo y el backend nunca necesite saber cuántos tips hay, y verificar que dos personas con distinto avance ven tips distintos — **hecho**: `tipDelDia()` en `public/index.html`
- [x] 2.5 Verificar que si la respuesta de `/api/me` no trae avance (error de red, columna vacía) igual se muestra el primer tip, sin errores en consola ni bloqueo del tablero — **hecho**: `tipDelDia()` cae al primer tip si no hay catálogo o avance, y el `UPDATE` va en `try/catch` para no bloquear la carga

## 3. Presencia en pantalla

- [x] 3.0 Resolver primero la pregunta abierta de `design.md`: si la franja muestra una categoría visible. Cambia el markup y el techo editorial, así que se decide con Pablo antes de escribir la UI — **resuelto 2026-09-11: sin categoría en v1**, la franja muestra solo el texto y el techo queda en ~110 caracteres
- [x] 3.1 Agregar la franja de tip como elemento propio justo encima del `.app-footer`, sin control de descarte, y verificar en tema claro y oscuro que no tapa el tablero ni se confunde con el pie de página — **hecho**: `.tip-daily` con `#tipDaily`/`#tipText` encima del `.app-footer`, verificado en claro y oscuro
- [x] 3.2 Verificar en viewport de 360px que el tip se lee completo en dos líneas, sin truncar, y que el layout del tablero no se rompe — **hecho**: test E2E que mide desborde y cantidad de líneas a 360px
- [x] 3.3 Ocultar los atajos de teclado (`F · U · N · F1`) del footer en pantallas angostas, donde no sirven, y verificar que el alto total del pie no crece respecto de hoy — **hecho**: `.app-footer .shortcuts` oculto en `max-width: 560px`, con su separador

## 4. Realce diario

- [x] 4.1 Agregar el keyframe del realce dentro del guard `@media (prefers-reduced-motion: no-preference)`, siguiendo el patrón de `wip-pulse`, y verificar que con movimiento reducido activado el tip se ve completo y sin animación — **hecho**: `@keyframes tip-blink` dentro del guard, con test E2E de movimiento reducido
- [x] 4.2 Disparar el realce en la primera interacción del día con el tablero, con tope diario vía `tasking-tip-blink-date` (mismo patrón que `maybeShowWipToast()`), y verificar manualmente que titila una sola vez por jornada aunque se sigan creando y moviendo tarjetas — **hecho**: se arma una sola vez por carga y titila en el primer gesto del día

## 5. Tests E2E

- [x] 5.1 Escribir `e2e/tip-diario.spec.js` cubriendo: el tip aparece al abrir el tablero; el mismo tip persiste tras recargar el mismo día (ahora con el avance leído de la cuenta, no del navegador); el realce ocurre una sola vez por día — y verificar que corre en verde con `npm run test:e2e` — **hecho**: 6 tests E2E en verde

## 6. Cierre

- [x] 6.1 Correr `npm run test:all` y verificar que pasa 100% (unit + E2E) antes de cualquier deploy — **hecho 2026-09-11**: 139 unitarios y 62 E2E en verde
- [x] 6.2 Abrir el PR de la rama `feature/tip-diario` (obligatorio por incluir migración de esquema) y esperar el OK de Pablo antes de mergear y deployar — **hecho**: PR #35, mergeado a `main` el 2026-09-11 con la aprobación de Pablo
- [x] 6.3 Documentar según el flujo obligatorio de CLAUDE.md al deployar a producción: sesión en `docs/STATUS.md`, entrada en `public/releases.html` y bump de versión en `package.json` y en el footer de `public/index.html` — **hecho**: sesión en `docs/STATUS.md`, release 17 en `public/releases.html`, versión v2.2.0 en `package.json` y en el pie de `index.html`
