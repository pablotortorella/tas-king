# Operación de HomeSuite

Parte de la [base común](README.md). Los comandos y recursos concretos están en
las fichas y runbooks de producto. No ejecutar operaciones remotas al actualizar
esta documentación.

## Entornos y secretos

Local, test, staging y producción tienen datos y recursos separados. Staging usa
identidad OAuth y secretos propios de su entorno. No copiar datos privados de
producción para probar; preferir fixtures sintéticos. Antes de actuar confirmar
Worker, configuración, bindings, base y entorno explícitos.

Cargar secretos por el mecanismo seguro del entorno o un gestor autorizado. Nunca
pedir pegarlos en la conversación, versionarlos o imprimirlos en diagnósticos.
Revisar diff y archivos preparados; una comprobación por nombre no es un escáner
de secretos. Si se expone uno, revocarlo/rotarlo y tratar el incidente, además de
retirarlo del código. No asumir que borrarlo del último commit elimina la exposición.

## Publicación reproducible

1. Identificar unidad desplegable, rama, SHA y checks requeridos. Trabajar con árbol
   limpio para publicar; comprobar que incluye los archivos revisados.
2. Validar el cambio en staging cuando lo requiera su riesgo. Staging compartido
   tiene un solo SHA activo: coordinar su uso y comprobar la versión servida antes
   de solicitar una prueba. El siguiente deploy invalida esa referencia.
3. Integrar por revisión y validar el SHA final de `main`. Si cambia el código,
   configuración o migraciones validadas, repetir comprobaciones afectadas.
4. Desplegar la integración final a staging y registrar SHA/versión, pruebas y
   límites. No reutilizar una aprobación de otro artefacto.
5. Publicar en producción sólo con aprobación explícita de Pablo aplicable a esa
   publicación; no inferirla de “probar staging”. Preparar primero un resultado
   revisable. Una autorización previa explícita conserva su alcance.
6. Registrar versión y unidad publicadas, entorno, migraciones y resultado del
   smoke posterior. Comprobar el recorrido afectado, errores y configuración servida.

Sitio público y app se publican independientemente. Un cambio sólo documental no
requiere despliegue. Los scripts deben hacer cumplir lo automatizable; los controles
manuales y brechas se declaran en la [matriz](README.md#cumplimiento-conocido-al-adoptar-la-base).

## Migraciones y recuperación

Para cambios aditivos compatibles: verificar → respaldar cuando haya datos que
preservar → migrar → desplegar → smoke. Si falla migración, cortar antes del Worker.
Ensayar actualización desde el esquema anterior con datos; probar sólo una base
vacía no demuestra compatibilidad.

Para cambios incompatibles, planificar expansión, transición y retiro en releases
separados. No recomendar invertir ciegamente el orden. Definir qué código puede
convivir con cada esquema y el punto seguro de rollback.

Antes de operar con datos irreemplazables, cada unidad debe tener responsable,
frecuencia y retención de backups, objetivos de pérdida tolerable (RPO) y tiempo
de recuperación (RTO), acceso seguro y restauración ensayada. Verificar en un
entorno aislado datos, relaciones, índices, triggers y archivos; registrar fecha,
resultado y diferencias. Un archivo generado no certifica recuperación.

Ante incidente: limitar daño, identificar versión y evidencia, preservar respaldo,
preparar revert/hotfix revisable y verificarlo. Revertir código no revierte datos;
no borrar columnas o triggers aditivos automáticamente. Restaurar datos es una
operación distinta, con destino confirmado y autorización para su impacto.

No usar `rm -rf .wrangler` ni resetear bases como limpieza de caché. Diagnosticar
el proceso, configuración y almacenamiento afectados antes de cambiar estado.
El reset específico de una base descartable no habilita borrar otras.

## Registro de operación

STATUS conserva hechos fechados y estado de integración/publicación. Las novedades
públicas describen cambios relevantes para usuarios y mantienen versión consistente
con manifiestos y UI cuando corresponda. El handoff enlaza fuentes y pendientes,
sin redefinir reglas ni prometer pruebas no realizadas.

Cada incidente produce causa o hipótesis identificada, alcance, corrección,
regresión o control, evidencia y seguimiento. Actualizar el [registro de aprendizajes](APRENDIZAJES.md)
si el criterio se aplica a más de un producto.
