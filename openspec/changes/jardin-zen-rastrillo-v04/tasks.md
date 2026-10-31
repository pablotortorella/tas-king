# Tareas · Jardín Zen beta v0.4

- [ ] Esperar a que termine el orden de ramas y worktrees viejos (condición acordada el 2026-10-31).
- [ ] Partir de `main` vigente y aplicar el prototipo v0.4 sobre `apps/app/public/jardin-zen/`, sin reemplazar a ciegas: el motor de `main` ya tiene el encuadre de cámara por relación de aspecto (`fitDist`).
- [ ] Mango invertido en WebGL 2 y en Canvas 2.5D.
- [ ] Giro suave con límite por fotograma y umbral de desplazamiento mínimo; sin cambiar la geometría de los surcos.
- [ ] Control «Rastrillo visible / oculto» con `aria-pressed` y persistencia tolerante en `localStorage`.
- [ ] Pruebas: ampliar `apps/app/e2e/jardin-zen.spec.js` (alternar el control, persistencia, almacenamiento no disponible, sin desborde a 360 y 390 px) y mantener en verde unitarias, E2E de app y sitio, y el glosario.
- [ ] Verificar WebGL 2 en un navegador con aceleración y el giro en un celular real; ajustar constante y umbral si hace falta.
- [ ] Abrir PR, esperar el CI y recién entonces coordinar staging; registrar SHA y versiones en STATUS.
