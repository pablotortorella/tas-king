# Verificación de HomeSuite

Parte de la [base común](README.md). Los comandos y fixtures propios se documentan
en cada ficha. No confundir política requerida con cobertura ya implementada.

## Diseñar por escenarios

Antes de implementar, enumerar criterio, estado inicial, acción y resultado
observable. Para un recorrido, considerar como corresponda: éxito; entrada
inválida; identidad ausente o ajena; permiso revocado; relaciones de otro grupo;
estado vacío; doble envío; reintento; concurrencia; borrado y fallo parcial.
Cada caso debe proteger un comportamiento, no copiar el algoritmo implementado.

| Riesgo | Evidencia adecuada |
|---|---|
| Regla o cálculo puro | Unitario de invariantes, límites y ejemplos |
| SQL, autorización y atomicidad | Integración con migraciones y base reales de test; casos negativos y rollback |
| Recorrido y contratos UI/API | E2E de comportamiento observable y persistencia |
| Assets, CSP, cookies y redirecciones | HTTP/navegador sobre servidor real, no sólo invocación directa del handler |
| Proveedor OAuth, colaboración y dispositivo | Prueba real dirigida en staging; identificar cuentas por rol sin exponer datos |
| Backup y migración | Restauración aislada y actualización desde esquema anterior con datos |
| Costo innecesario | Presupuesto determinista de llamadas/consultas más resultado funcional |
| Documentación | Enlaces internos, comandos contra scripts existentes y revisión de contradicciones |

Elegir el nivel más bajo que pruebe el riesgo; complementar fronteras reales con
E2E o pruebas manuales cuando sea necesario. No exigir porcentajes arbitrarios de
cobertura ni tests para cambios reversibles que sólo repitan la implementación.

## Regresiones y refactors

Para un bug, demostrar que el caso reproduce el fallo anterior y pasa con el
arreglo cuando sea practicable; registrar límites si no puede reproducirse.
Buscar el mismo defecto en rutas y consumidores equivalentes. Controlar el entorno
para evitar que polling, caché o una recarga oculten un cálculo incorrecto.

Para un refactor, caracterizar resultados y contratos, incluyendo errores y
secuencias `await`; conservar comportamiento salvo cambio explícito. Cambios de
seguridad incluyen intentos de suplantación, bypass y acceso a recursos ajenos.

## Entornos y estabilidad

Datos sintéticos, migraciones reales y almacenamiento de test aislado. No borrar
la base de desarrollo como remedio general. Resetear sólo un estado de test
identificado como descartable, con el comando específico del producto.

Esperar condiciones de la aplicación, no tiempos arbitrarios. El servidor que
reutiliza un test debe corresponder al código bajo prueba. Coordinar puerto y
proceso entre worktrees. Al fallar, guardar diagnóstico suficiente y distinguir
producto, test y entorno antes de modificar expectativas.

Los reintentos son diagnóstico o mitigación temporal: un test que pasa al reintentar
sigue registrándose como intermitente. Asignar seguimiento y no convertir un posible
fallo de datos en éxito. No bajar una expectativa sólo para obtener verde.

## Evidencia de aceptación

Registrar SHA/base, comando, resultado, entorno y alcance. Para pruebas manuales:
recorrido, navegador/dispositivo y hallazgos. Marcar explícitamente lo no probado;
no inferir aceptación de dos personas a partir de un único login.

Antes de integrar código ejecutar suites afectadas; los cambios transversales
verifican consumidores. Antes de publicar ejecutar los checks del despliegue sobre
la integración final y el smoke test del mismo SHA en staging. La CI debe cubrir
cada unidad desplegable; mientras falte, registrar los checks adicionales locales.

Para cambios de UI revisar escritorio y móvil, zoom, foco, contraste y movimiento
reducido. Cuando haya dependencia del motor, comprobar un segundo motor además de
Chromium; registrar navegadores y dispositivos no disponibles como límite.

La revisión humana se concentra en legibilidad, interacción, accesibilidad y
fronteras externas. Automatizar lo determinista; no pedir rondas manuales repetidas
para contar peticiones. Un dispositivo emulado no acredita una prueba física.

Cerrar con criterios satisfechos, evidencia y límites pendientes identificados.
Ver [operación](OPERACION.md) para aprobación, despliegue y smoke posterior.
