## 1. Contenido

- [ ] 1.1 Escribir el primer tramo de tips (principio Lean/Kanban + afordancia de la app), uno o dos por cada una de las seis prácticas centrales de Kanban — visualizar el trabajo, limitar el WIP, gestionar el flujo, hacer explícitas las políticas, implementar circuitos de retroalimentación, mejorar colaborativamente — y verificar con Pablo que la voz coincide con la del toast existente (`🎯 Dejar de empezar y empezar a terminar`), no con la de un manual
- [ ] 1.2 Escribir el segundo tramo de tips de método puro (sin referencias a funcionalidades) y verificar que ningún tip del tramo menciona botones, íconos ni pantallas de la app
- [ ] 1.3 Dejar ambos tramos como un único array ordenado `DAILY_TIPS` en `public/index.html` y verificar que el orden en el archivo es el orden pedagógico definido en el spec

## 2. Selección del tip del día

- [ ] 2.1 Implementar la lectura/escritura del puntero y de la fecha en `localStorage` (claves `tasking-tip-index` y `tasking-tip-date`), envueltas en `try/catch` como `wipPulseEnabled()`, y verificar que con el almacenamiento bloqueado igual se muestra un tip sin errores en consola
- [ ] 2.2 Implementar la regla de avance (si la fecha guardada no es hoy: avanzar el índice con vuelta al inicio al llegar al final, y grabar hoy; si es hoy: usar el índice tal cual) y verificar con tests unitarios en `test/tip-diario.test.js` los casos: primera vez, misma jornada, día siguiente, varios días de ausencia, y fin de lista

## 3. Presencia en pantalla

- [ ] 3.1 Agregar la línea de tip bajo el header, sin control de descarte, y verificar en tema claro y oscuro que no tapa ni desplaza el contenido del tablero
- [ ] 3.2 Verificar en viewport mobile que la línea trunca correctamente y no rompe el layout del tablero

## 4. Realce diario

- [ ] 4.1 Agregar el keyframe del realce dentro del guard `@media (prefers-reduced-motion: no-preference)`, siguiendo el patrón de `wip-pulse`, y verificar que con movimiento reducido activado el tip se ve completo y sin animación
- [ ] 4.2 Disparar el realce en la primera interacción del día con el tablero, con tope diario vía `tasking-tip-blink-date` (mismo patrón que `maybeShowWipToast()`), y verificar manualmente que titila una sola vez por jornada aunque se sigan creando y moviendo tarjetas

## 5. Tests E2E

- [ ] 5.1 Escribir `e2e/tip-diario.spec.js` cubriendo: el tip aparece al abrir el tablero; el mismo tip persiste tras recargar el mismo día; el realce ocurre una sola vez por día — y verificar que corre en verde con `npm run test:e2e`

## 6. Cierre

- [ ] 6.1 Correr `npm run test:all` y verificar que pasa 100% (unit + E2E) antes de cualquier deploy
- [ ] 6.2 Documentar según el flujo obligatorio de CLAUDE.md al deployar a producción: sesión en `docs/STATUS.md`, entrada en `public/releases.html` y bump de versión en `package.json` y en el footer de `public/index.html`
