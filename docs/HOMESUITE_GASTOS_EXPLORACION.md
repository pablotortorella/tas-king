# HomeSuite Gastos — brief para exploración y proposal

**Estado:** insumo de producto previo a OpenSpec; no es todavía un proposal

**Última actualización:** 2026-09-17

**Objetivo:** conservar las decisiones y ejemplos ya conversados para que la fase
`explore` pueda concentrarse en los puntos realmente abiertos y el futuro
`proposal` no tenga que reconstruir el contexto.

## 1. Problema que queremos resolver

HomeSuite Gastos debe sustituir el uso cotidiano de Splitwise con una alternativa
propia, robusta y portable para:

- familias y parejas;
- viajes entre amistades o familias amigas;
- hogares con gastos e ingresos compartidos;
- proyectos pequeños cuyos integrantes aportan o reciben dinero;
- cualquier grupo que necesite saber cuánto aportó o recibió cada persona y cuál
  es su posición neta.

El primer producto no es un presupuesto familiar ni un sistema contable completo.
Su trabajo es registrar movimientos compartidos, repartir su efecto y contestar,
por moneda:

> ¿Cuál es el saldo neto de cada participante y qué movimientos lo explican?

## 2. Decisiones de producto ya acordadas

Estas decisiones son punto de partida para `explore`. Solo deberían reabrirse si
aparece evidencia concreta de que impiden resolver un caso real.

1. **El saldo neto es la única verdad financiera del grupo.**
   No habrá un inventario paralelo de obligaciones entre movimientos.
2. **No existe una entidad “préstamo”.**
   Entregar dinero a otra persona es una transferencia. “Préstamo”, “adelanto” o
   “pago parcial” pueden aparecer en la descripción, pero no cambian el cálculo.
3. **Una transferencia no se aplica a una deuda o gasto particular.**
   Modifica el saldo neto del origen y el destino. El sistema no pregunta qué
   obligación está pagando.
4. **Gastos, ingresos y transferencias alimentan el mismo balance.**
   Son tipos de movimiento distintos porque requieren datos y reportes diferentes,
   no porque creen libros de deuda separados.
5. **Los ingresos compartidos forman parte del MVP.**
   No se modelarán como gastos negativos. El caso inicial concreto es el alquiler
   de un inmueble recibido por una persona pero perteneciente a varias.
6. **Las monedas no se suman ni convierten implícitamente.**
   Cada balance permanece separado por moneda hasta que exista una conversión
   explícita, con tasa y fecha conocidas.
7. **La historia debe explicar el saldo.**
   Correcciones y anulaciones conservan auditoría; el balance nunca se edita a
   mano.
8. **La portabilidad es parte de la confianza.**
   El grupo debe poder exportar datos suficientes para reconstruir sus balances
   fuera de HomeSuite.

## 3. Referencia de producto: qué aprendemos de Tricount

Tricount valida un modelo útil para HomeSuite: un grupo colaborativo, participantes
ligeros, una lista común de movimientos y una pantalla de balance. Su documentación
oficial distingue gasto, transferencia e ingreso; admite repartos desiguales,
archivo y restauración, trabajo colaborativo y monedas diferentes.

La referencia es funcional, no visual ni técnica. HomeSuite no pretende clonar la
aplicación ni reproducir su integración bancaria.

### 3.1 Incluir o tomar como principio

- crear un grupo rápidamente y agregar participantes sin exigir que todos tengan
  cuenta desde el comienzo;
- permitir que las personas habilitadas agreguen movimientos y vean cambios
  compartidos;
- presentar gasto, ingreso y transferencia desde una única acción principal;
- optimizar el caso frecuente sin impedir repartos desiguales;
- mantener una cronología legible de movimientos;
- mostrar balances actuales y una forma concreta de quedar a mano;
- funcionar bien en móvil;
- archivar y restaurar grupos;
- tratar redondeos de manera determinista y conservar exactamente el total.

### 3.2 Adaptar y mejorar para HomeSuite

- usar acceso autenticado e invitaciones revocables en lugar de depender de enlaces
  abiertos como frontera principal de seguridad;
- distinguir claramente participantes con cuenta de participantes nominales;
- conservar revisiones y anulaciones en vez de depender de borrados silenciosos;
- hacer que el ingreso tenga reparto explícito de beneficiarios, simétrico al
  reparto de un gasto;
- mantener balances independientes por moneda, sin conversión automática opaca;
- ofrecer exportación CSV y JSON desde el producto;
- asegurar escrituras idempotentes para no duplicar dinero al reintentar;
- mostrar una previsualización del efecto sobre el saldo antes de confirmar cuando
  ayude a evitar errores;
- conservar un modelo de saldo neto sencillo: las etiquetas narrativas no crean
  obligaciones financieras adicionales.

### 3.3 Dejar fuera del producto inicial

- tarjetas, cuentas bancarias, KYC o ejecución real de pagos;
- importación automática de movimientos bancarios;
- productos financieros de terceros;
- eSIM, álbumes de viaje u otras extensiones no relacionadas con el balance;
- conversión automática según cotizaciones de mercado;
- estadísticas de gasto avanzadas, presupuestos y proyecciones;
- OCR, reconocimiento de recibos y automatizaciones inteligentes;
- intereses, vencimientos o calendarios de amortización de préstamos;
- una contabilidad patrimonial o fiscal.

## 4. Modelo mental acordado

### 4.1 Movimiento

Todo hecho financiero que afecta al grupo es un movimiento vigente o anulado. Hay
tres tipos visibles:

| Tipo | Pregunta que responde | Efecto económico |
|---|---|---|
| Gasto | ¿Quién pagó y a quién le correspondía el consumo? | Compara aportes con partes asignadas |
| Ingreso | ¿Quién recibió y a quién le correspondía el dinero? | Compara partes asignadas con importes recibidos |
| Transferencia | ¿Quién le entregó dinero a quién? | Aumenta la posición del origen y reduce la del destino |

Un importe positivo en el balance significa que el grupo debe reconocer dinero a
esa persona. Un importe negativo significa que esa persona debe aportar dinero para
quedar a mano.

### 4.2 Fórmulas conceptuales

Para cada participante y moneda:

```text
efecto de gasto        = importe pagado - parte del gasto asignada
efecto de ingreso      = parte del ingreso asignada - importe recibido
efecto de transferencia para origen  = +importe
efecto de transferencia para destino = -importe

saldo neto = suma de los efectos de todos los movimientos vigentes
```

Para cada movimiento y para el libro completo en cada moneda:

```text
suma de efectos de todos los participantes = 0
```

Esta igualdad es una invariante, no una aproximación.

### 4.3 Lo que el modelo deliberadamente no conserva

El sistema no afirma que una persona le deba a otra por un gasto determinado. Solo
conserva movimientos y posiciones netas. Una sugerencia como “Laura puede pagarle
$200 a Pablo” es una forma de cancelar balances, no una obligación persistida.

Tampoco distingue matemáticamente entre:

- dinero prestado;
- un adelanto para una compra;
- un reintegro;
- un pago parcial del saldo.

Todos son transferencias. La descripción permite contar el contexto si el grupo lo
necesita.

## 5. Casos reales que el MVP debe resolver

### 5.1 Alquiler compartido recibido por una persona

Entra un alquiler de $1.000. Ana recibe el depósito y el ingreso corresponde 50 %
a Ana y 50 % a Pablo.

```text
Ana:  parte asignada 500 - recibido 1.000 = -500
Pablo: parte asignada 500 - recibido 0     = +500
```

Resultado: el balance neto indica que Ana debe aportar $500 a Pablo para quedar a
mano. No se registra un gasto de -$1.000.

El ingreso debería admitir:

- descripción y fecha;
- importe y moneda;
- uno o varios receptores, con sus importes;
- beneficiarios y reparto igual, exacto, porcentual o por partes;
- fuente externa opcional, por ejemplo “inquilino”;
- nota opcional, por ejemplo “alquiler septiembre 2026”.

### 5.2 Dinero entregado como préstamo

Pablo entrega $300 a Laura.

```text
transferencia: Pablo -> Laura, $300
Pablo: +300
Laura: -300
```

Resultado: Laura queda $300 por debajo y Pablo $300 por encima. La palabra
“préstamo” puede ser la descripción, pero no crea una entidad con capital pendiente.

### 5.3 La misma transferencia como pago parcial

Si Laura tenía saldo -$300 y entrega $100 a Pablo:

```text
transferencia: Laura -> Pablo, $100
nuevo saldo de Laura: -200
nuevo saldo de Pablo: +200
```

La interfaz no necesita preguntar si fue pago parcial. La dirección del dinero y
el importe determinan el resultado.

### 5.4 Préstamo que compensa un saldo previo

Pablo debía $100 a Laura y luego Pablo le entrega $50 a Laura por cualquier motivo.
El nuevo saldo neto es que Pablo debe $50. No se muestran dos obligaciones brutas
en sentidos contrarios.

Si la descripción dice “préstamo”, se conserva como información narrativa, pero el
producto continúa mostrando un solo saldo.

### 5.5 Adelanto antes de una compra compartida

Pablo entrega $50 a Laura. Después Laura paga $100 de supermercado para ambos,
repartido 50/50.

```text
transferencia Pablo -> Laura: Pablo +50, Laura -50
gasto pagado por Laura:       Pablo -50, Laura +50
resultado neto:               Pablo 0,   Laura 0
```

No hace falta vincular el adelanto con el gasto para obtener el resultado correcto.

### 5.6 Ingreso que compensa un saldo anterior

Pablo debía $200 a Ana. Luego Ana recibe un alquiler compartido que genera una
posición de +$500 para Pablo y -$500 para Ana. El resultado final es:

```text
Ana:   -300
Pablo: +300
```

HomeSuite muestra el saldo de $300 y permite llegar a los movimientos que lo
explican; no crea una “deuda del alquiler” separada.

## 6. Experiencia inicial sugerida

### 6.1 Crear grupo

1. Nombre y propósito opcional.
2. Moneda predeterminada.
3. Participantes iniciales.
4. Estado vacío con una acción principal: “Agregar movimiento”.

### 6.2 Agregar movimiento

La primera elección es:

- **Gasto:** alguien pagó algo que correspondía a una o más personas.
- **Ingreso:** alguien recibió dinero que correspondía a una o más personas.
- **Transferencia:** una persona le entregó dinero a otra.

No se ofrecen “préstamo” ni “pago parcial” como tipos financieros.

### 6.3 Caso frecuente primero

El gasto predeterminado debería asumir:

- la persona actual pagó;
- participan todas las personas activas;
- reparto igual;
- fecha de hoy;
- moneda predeterminada.

El ingreso puede usar un patrón equivalente: la persona actual recibió y el dinero
corresponde por igual a todas las personas activas. Cada supuesto debe ser visible
y modificable antes de guardar.

### 6.4 Previsualización

Antes de confirmar movimientos menos evidentes, la interfaz puede decir:

> Después de este movimiento, Laura tendrá saldo -$200 y Pablo +$200.

La previsualización expresa el resultado neto. No dice qué deuda específica se
pagó ni crea asociaciones ocultas.

### 6.5 Pantalla de balance

Debe priorizar:

- saldo de cada participante por moneda;
- una sugerencia comprensible de transferencias para quedar a mano;
- acceso a los movimientos que explican el cálculo;
- acción directa para registrar una transferencia sugerida.

La sugerencia se recalcula desde los saldos y no se persiste como deuda.

### 6.6 Cronología

Cada fila debe distinguir visualmente gasto, ingreso y transferencia, e indicar lo
necesario para comprender su efecto sin abrir el detalle. Ediciones y anulaciones
deben quedar visibles o accesibles desde la actividad.

## 7. Alcance recomendado para el primer reemplazo usable

### Imprescindible

- grupos y participantes con o sin cuenta;
- invitaciones seguras;
- gastos, ingresos y transferencias;
- uno o varios pagadores o receptores cuando corresponda;
- reparto igual, exacto, porcentual y por partes;
- balance neto por participante y moneda;
- sugerencias derivadas para quedar a mano;
- edición, anulación e historial auditable;
- experiencia móvil;
- archivo y restauración;
- exportación CSV y JSON;
- idempotencia y backups restaurables.

### Puede esperar

- adjuntos y fotografías de comprobantes;
- categorías y estadísticas avanzadas;
- movimientos recurrentes;
- recordatorios y notificaciones;
- importación desde Splitwise o Tricount;
- OCR;
- operación offline completa;
- conversión de monedas;
- conexión bancaria;
- fondos o cuentas comunes;
- presupuestos, flujo de caja y patrimonio.

## 8. Decisiones que el proposal no debe introducir por accidente

- No crear tablas `loans`, `debts`, `obligations` o `repayments`.
- No guardar un “saldo actual” editable como fuente de verdad.
- No vincular obligatoriamente una transferencia con otro movimiento.
- No representar ingresos como gastos negativos.
- No netear monedas distintas.
- No borrar movimientos con historia financiera desde el flujo normal.
- No exigir cuenta a toda persona incluida en un reparto.
- No integrar servicios bancarios para resolver el MVP.

Los nombres físicos del esquema se decidirán durante diseño técnico, pero deben
preservar estas restricciones conceptuales.

## 9. Preguntas todavía abiertas para `explore`

### Producto y vocabulario

- ¿El producto se presenta como “Gastos”, “Cuentas compartidas” u otro nombre?
- ¿La interfaz llama “saldo”, “balance” o adapta el término según el país?
- ¿La fuente de un ingreso merece un campo propio o alcanza inicialmente con la
  descripción?

### Participantes y acceso

- ¿Quién puede editar o anular movimientos creados por otra persona?
- ¿Cómo se reclama o vincula un participante nominal al aceptar una invitación?
- ¿Cuál es el límite razonable de participantes por grupo?

### Repartos

- ¿La primera versión necesita varios receptores en un ingreso o basta uno aunque
  el modelo quede preparado para más?
- ¿Cómo se asigna y explica el residuo de redondeo?
- ¿Se recuerdan repartos frecuentes por grupo?

### Balance y cierre

- ¿Qué algoritmo determinista produce las transferencias sugeridas?
- ¿Se muestra el signo contable o frases como “te deben / debés”?
- ¿Qué significa “cerrar” o archivar un grupo con saldos no nulos?

### Historia y exportación

- ¿Cuánto detalle de revisiones aparece en la interfaz normal?
- ¿Qué archivos y columnas forman la exportación CSV?
- ¿Cómo se representa una anulación en exportaciones y restauraciones?

### Monedas

- ¿Un grupo multimoneda muestra una pestaña por moneda o varias tarjetas de saldo?
- ¿Cuándo, si alguna vez, se permite registrar una transferencia de cambio entre
  dos monedas?

## 10. Semillas para el futuro proposal

El proposal probablemente deba separar al menos estas capacidades:

1. espacios, miembros, participantes e invitaciones;
2. libro y ciclo de vida del grupo;
3. registro y revisión de gastos;
4. registro y revisión de ingresos;
5. transferencias genéricas entre participantes;
6. motor de repartos y redondeo;
7. cálculo y presentación de saldos netos por moneda;
8. sugerencias de transferencias para quedar a mano;
9. actividad y auditoría;
10. exportación, archivo y recuperación;
11. idempotencia, concurrencia y sincronización.

Esto es una guía de corte, no una obligación de producir once specs. `explore`
deberá decidir el cambio mínimo coherente y el orden de entrega.

## 11. Fuentes de referencia de Tricount

Consultadas el 2026-09-17:

- [Preguntas frecuentes oficiales](https://help.tricount.com/articles/tricount-faqs)
  — tipos de movimiento, colaboración, repartos, precisión y balance.
- [Gestión de grupos y movimientos](https://help.tricount.com/articles/how-can-i-manage-my-tricounts-and-expenses)
  — participantes, reparto desigual, archivo, transferencias, ingresos y monedas.
- [Agregar pagos de bunq como gastos](https://help.tricount.com/articles/add-bunq-payments-as-expenses)
  — integración bancaria y comprobantes, tomados como referencia de lo que no hace
  falta para el MVP propio.

## Documentos relacionados

- [Especificación funcional del MVP](HOMESUITE_GASTOS_MVP.md)
- [Visión de HomeSuite](HOMESUITE_VISION.md)
- [Infraestructura de HomeSuite](HOMESUITE_INFRASTRUCTURE.md)
- [ADR-018: HomeSuite como suite modular](ADRs/ADR-018-homesuite-suite-modular.md)
