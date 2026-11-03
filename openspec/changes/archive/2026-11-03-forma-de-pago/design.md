## Context

El movimiento ya lleva categoría (lista propia por grupo, con administración). La forma de pago tiene otra naturaleza:
pocas opciones estables y sin necesidad de que cada grupo las defina.

## Decisions

1. **Lista fija en código y en la base** (`src/payment-methods.js` y un CHECK en la columna). Agregar una forma es una
   migración y un cambio de glosario, no una pantalla. Decidido con Pablo el 2026-10-29; la alternativa de una lista
   por grupo quedó fuera por ser un módulo entero (alta, archivo, unión) para un dato de cinco valores.
2. **Cinco formas y «sin indicar».** Efectivo, Débito, Crédito, Transferencia y Billetera virtual. «Billetera virtual»
   cubre Mercado Pago y similares sin atar la interfaz a una marca.
3. **Columna nula en `ledger_entries`**, no una tabla: es un atributo del movimiento y viaja en la instantánea de cada
   revisión (`paymentMethod`), así queda en el historial auditable.
4. **Ausente significa «no tocar».** Igual que la categoría: una solicitud sin el campo conserva la forma de pago; un
   campo vacío la quita. Así las llamadas internas y los formularios abiertos antes de la migración no la borran.
5. **Un valor fuera de la lista se rechaza** («Elegí una forma de pago de la lista.») en lugar de descartarse en silencio.
6. **Las transferencias no la llevan.** La solicitud puede traerla (formulario viejo) y se ignora.
7. **Selector nativo.** Son seis opciones: el diálogo del teléfono las muestra sin desplazarse, a diferencia de las
   categorías (ver `buscar-categoria` en el backlog).
8. **Glosario:** «forma de pago» / `paymentMethod` / `payment_method`.
