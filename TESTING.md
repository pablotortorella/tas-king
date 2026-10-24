# Verificación de productos

La política vigente de escenarios, niveles de prueba, regresiones, aceptación y
tratamiento de fallos intermitentes es [Verificación de HomeSuite](docs/homesuite/VERIFICACION.md).

- [TasKing](docs/productos/TASKING.md): comandos, fixtures, puerto, presupuestos y recorridos particulares.
- [Plataforma](docs/productos/PLATAFORMA.md): suites específicas y aceptación con identidades reales.
- [Cuentas Claras](docs/productos/CUENTAS-CLARAS.md): invariantes financieras y fuentes de escenarios.

`npm run test:all` ejecuta Vitest y Playwright de TasKing. La CI versionada hace lo
mismo; todavía no incorpora los comandos específicos de HomeSuite App. Consultar
la [matriz de cumplimiento](docs/homesuite/README.md#cumplimiento-conocido-al-adoptar-la-base)
antes de afirmar cobertura de toda la suite.
