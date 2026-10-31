# Propuesta: Jardín Zen beta v0.4 — orientación, giro y visibilidad del rastrillo

## Por qué

La beta v0.2 ya está en staging y se probó en escritorio. En esa prueba salieron tres ajustes sobre el rastrillo:
el mango apunta para el lado que no se espera, el rastrillo gira de golpe cuando cambia el rumbo del gesto y a veces
estorba para ver los surcos. Un prototipo de la v0.4 (fuera del repositorio) ya los resuelve; falta incorporarlo.

## Qué incluye

1. **Mango invertido.** La parte larga del rastrillo se gira 180° alrededor del cabezal. Los cinco dientes y el punto de
   contacto con la arena no cambian. Vale para WebGL 2 y para la alternativa Canvas 2.5D.
2. **Giro suave.** El rumbo objetivo sale del desplazamiento del cursor o del dedo; el ángulo mostrado se acerca de a poco
   por el arco más corto (unos 185 ms de constante de tiempo, con tope por fotograma). Un desplazamiento mínimo no cambia
   el rumbo. Es solo la pieza visual: la geometría de los surcos no cambia.
3. **Mostrar u ocultar el rastrillo.** Control «Rastrillo visible / Rastrillo oculto», visible al inicio. Ocultar afecta solo
   el modelo gráfico y el cursor especial. La preferencia se recuerda en `localStorage`
   (`homesuite:jardin-zen:rake-visible`) y nunca se envía al servidor.

## Fuera de alcance

Cambiar la sensibilidad del giro antes de probarlo en un teléfono, desplazar la herramienta para que la mano no tape el
cabezal, optimizar el redibujado de Canvas 2.5D en teléfonos de gama baja, tocar Remanso, Cuentas Claras, Fun TasKing, la
landing pública o las migraciones, y publicar en producción.

## Estado

**Propuesto, sin implementar y sin aplicar al repositorio.** Se incorpora cuando termine el orden de ramas y worktrees
viejos (acordado el 2026-10-31). El documento original con los ajustes acordados y su evidencia está en
`docs/diseno/jardin-zen/propuestas/HomeSuite-Jardin-Zen-v0.4-Cambios.md`.

**Lo que no se verificó aún:** WebGL 2 en un navegador con aceleración, la sensación del giro en un teléfono físico,
la suite completa del monorepo y el CI. Ver `design.md`.
