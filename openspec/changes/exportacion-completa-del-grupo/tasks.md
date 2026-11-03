## 1. Contrato del formato

- [ ] 1.1 Escribir `docs/HOMESUITE_CUENTAS_CLARAS_EXPORTACION.md` con cada sección del JSON versión 4, los tipos, la unidad menor de los importes, el cálculo de saldos, el contenido por rol y la regla de versionado; verificar que los enlaces resuelven y corregir el «2» de `ANALISIS-APLICACION.md`
- [ ] 1.2 Escribir la prueba de esquema que lee el documento y compara con una exportación de ejemplo (secciones y campos); verificar que falla al agregar un campo sin documentarlo

## 2. Contenido del JSON

- [ ] 2.1 Extender `exportLedger` con `group`, `members`, `personMerges`, `recategorizations`, `balances`, `ledgerRevision` y `exportedBy`, y subir `schemaVersion` a 4; verificar con una prueba de integración D1 que cada sección aparece y que lo oculto (lotes sin publicar) sigue excluido
- [ ] 2.2 Agregar `invitations` (sin email) y `auditEvents` solo para la persona titular, filtrando por rol dentro de la misma función; verificar con pruebas de integración que un integrante no los recibe y que ningún archivo contiene un email de prueba
- [ ] 2.3 Leer la revisión del libro antes de armar el archivo y devolverla en `ledgerRevision`; verificar con una prueba que una escritura concurrente produce una revisión anterior (falla segura)

## 3. Fidelidad

- [ ] 3.1 Escribir la prueba de fidelidad (100,00 entre 3, unión de personas, anulación, dos monedas, lote importado) que recalcula los saldos desde el JSON con las funciones de dominio y compara con la aplicación y con `balances`; verificar que falla si se altera un importe del archivo

## 4. CSV, auditoría y límites

- [ ] 4.1 Agregar `participante` y `cargado_por` al CSV conservando la protección contra fórmulas; verificar con pruebas unitarias (nombres, comillas, `=`/`+`/`-`/`@`)
- [ ] 4.2 Registrar `ledger_exported` en `platform_audit_events` (formato y revisión) sin subir `expense_ledgers.revision`; verificar con una prueba de integración que la revisión no cambia y que una vista previa de importación abierta sigue válida
- [ ] 4.3 Aplicar el limitador a las rutas de exportación y verificar el 429 con el mensaje habitual; verificar que 404 (persona ajena) y el pedido de iniciar sesión (sin sesión) no cambian

## 5. Pantalla y móvil

- [ ] 5.1 Crear `GET /groups/:groupId/ledger/export` con las dos descargas y la explicación, reemplazar los enlaces sueltos del grupo y enlazarla desde Administrar grupo; verificar con integración de vistas y con el nombre de archivo `cuentas-claras-<slug>-<fecha>`
- [ ] 5.2 Verificar con E2E en 390 px y escritorio (claro y oscuro): controles de al menos 44 px, sin desborde horizontal, descarga iniciada; probar a mano la descarga en un teléfono real y registrar modelo y navegador

## 6. Textos legales (texto legal que revisa Pablo)

- [ ] 6.1 Redactar para `apps/site/public/terminos.html` el reemplazo de «La exportación completa y eliminación autónoma de grupos aún no se ofrecen desde la interfaz» (la exportación sí existe; la eliminación se describe aparte cuando exista) y actualizar «Última actualización». **Texto legal que revisa Pablo**: no publicar sin su lectura
- [ ] 6.2 Redactar para `apps/site/public/privacidad.html` qué incluye la exportación (sin emails de otras personas), que la puede pedir cualquier integrante, que no sustituye las copias de seguridad y que estas se eliminan a los noventa días; ajustar la frase «La eliminación autónoma de un grupo o cuenta todavía no está disponible» solo en lo que corresponda a este cambio. **Texto legal que revisa Pablo**
- [ ] 6.3 Agregar una prueba del sitio que falle si `terminos.html` conserva la frase «aún no se ofrecen» sobre la exportación; verificar con `npm run test:homesuite-site`

## 7. Documentación y cierre

- [ ] 7.1 Actualizar `docs/HOMESUITE_DATA_LIFECYCLE.md` (punto 1 cumplido, con evidencia), `docs/productos/CUENTAS-CLARAS.md`, el glosario si aparece un concepto nuevo, STATUS y backlog; verificar con la prueba del glosario
- [ ] 7.2 Medir tamaño y tiempo de la exportación del caso real (~2.500 filas) contra staging y registrar el resultado y el límite resultante en el documento de formato
- [ ] 7.3 Validar con `openspec validate exportacion-completa-del-grupo --strict`, correr `test:homesuite-app`, `test:homesuite-app:integration` y el E2E afectado, y abrir el PR sin mergear
