## 1. Contenido

**Punto de partida para continuar con Claude:** leer [tips.md](tips.md), que reúne el catálogo para curar, los criterios conversados, las variantes y las decisiones pendientes. La voz fue aceptada, pero la colección completa y su orden todavía requieren curación con Pablo; este registro no da por completadas las tareas siguientes.

- [ ] 1.1 **Curar el catálogo con Pablo, tip por tip** (es él quien decide; los IDs se mantienen estables al editar). Marcar cada candidato como Aprobado o Descartado en `tips.md` y elegir entre originales y hermanas singulares, hasta cerrar la colección
- [x] 1.2 Recortar los 4 tips que superan el techo editorial de ~110 caracteres — P5 (112), K7 (117), G5 (120), G3 (125) — y verificar que ningún texto aprobado excede ese largo — **resuelto 2026-09-11**: P5 descartado; K7 (99), G5 (98) y G3 (101) reescritos; verificado que ningún texto vivo del catálogo supera los 110
- [ ] 1.3 Repartir los candidatos N1–N10 entre los tres tramos según su tema (hoy están agrupados aparte y mezclan temas de los tres) y verificar que cada tip quedó en el tramo que le corresponde
- [ ] 1.4 Agregar las hermanas singulares que falten para los tips en plural donde aplique, sin reemplazar el original, y verificar que ambas versiones conviven con IDs propios
- [x] 1.5 Resolver los solapamientos ya detectados (K4/M1, K11/M6, O4/G4, T5/N7, T6/N4): conservarlos separados en la secuencia o reducirlos, y verificar que la decisión quedó registrada en `tips.md` — **resuelto 2026-09-11**: se conservan los cinco pares completos, separados en la secuencia; K4 queda como está y en el tramo 1
- [ ] 1.6 Ajustar K5, que presenta «Quietas» como si estuviera directo en «¿Cómo vamos?» cuando está dentro de la sección «¡Pilas con esto! 🔥», y verificar la ruta contra la UI real
- [ ] 1.7 Definir la secuencia final de los tres tramos y dejarla como un único array ordenado `DAILY_TIPS` en `public/index.html`, verificando que el orden del archivo es el orden pedagógico del spec

## 2. Selección del tip del día

- [ ] 2.1 Implementar la lectura/escritura del puntero y de la fecha en `localStorage` (claves `tasking-tip-index` y `tasking-tip-date`), envueltas en `try/catch` como `wipPulseEnabled()`, y verificar que con el almacenamiento bloqueado igual se muestra un tip sin errores en consola
- [ ] 2.2 Implementar la regla de avance (si la fecha guardada no es hoy: avanzar el índice con vuelta al inicio al llegar al final, y grabar hoy; si es hoy: usar el índice tal cual) y verificar con tests unitarios en `test/tip-diario.test.js` los casos: primera vez, misma jornada, día siguiente, varios días de ausencia, y fin de lista

## 3. Presencia en pantalla

- [x] 3.0 Resolver primero la pregunta abierta de `design.md`: si la franja muestra una categoría visible. Cambia el markup y el techo editorial, así que se decide con Pablo antes de escribir la UI — **resuelto 2026-09-11: sin categoría en v1**, la franja muestra solo el texto y el techo queda en ~110 caracteres
- [ ] 3.1 Agregar la franja de tip como elemento propio justo encima del `.app-footer`, sin control de descarte, y verificar en tema claro y oscuro que no tapa el tablero ni se confunde con el pie de página
- [ ] 3.2 Verificar en viewport de 360px que el tip se lee completo en dos líneas, sin truncar, y que el layout del tablero no se rompe
- [ ] 3.3 Ocultar los atajos de teclado (`F · U · N · F1`) del footer en pantallas angostas, donde no sirven, y verificar que el alto total del pie no crece respecto de hoy

## 4. Realce diario

- [ ] 4.1 Agregar el keyframe del realce dentro del guard `@media (prefers-reduced-motion: no-preference)`, siguiendo el patrón de `wip-pulse`, y verificar que con movimiento reducido activado el tip se ve completo y sin animación
- [ ] 4.2 Disparar el realce en la primera interacción del día con el tablero, con tope diario vía `tasking-tip-blink-date` (mismo patrón que `maybeShowWipToast()`), y verificar manualmente que titila una sola vez por jornada aunque se sigan creando y moviendo tarjetas

## 5. Tests E2E

- [ ] 5.1 Escribir `e2e/tip-diario.spec.js` cubriendo: el tip aparece al abrir el tablero; el mismo tip persiste tras recargar el mismo día; el realce ocurre una sola vez por día — y verificar que corre en verde con `npm run test:e2e`

## 6. Cierre

- [ ] 6.1 Correr `npm run test:all` y verificar que pasa 100% (unit + E2E) antes de cualquier deploy
- [ ] 6.2 Documentar según el flujo obligatorio de CLAUDE.md al deployar a producción: sesión en `docs/STATUS.md`, entrada en `public/releases.html` y bump de versión en `package.json` y en el footer de `public/index.html`
