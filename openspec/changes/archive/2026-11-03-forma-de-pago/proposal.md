## Why

Flori, la primera persona de confianza que usa Cuentas Claras en producción, pidió el 2026-10-29 poder anotar con qué
pagó cada movimiento («tarjeta, Mercado Pago, transferencia, efectivo… tal vez solo crédito, débito, cash»), sin
«las mil formas de pago». Pablo decidió el mismo día una lista fija y corta, opcional.

## What Changes

- Cada gasto o ingreso puede llevar una **forma de pago**: Efectivo, Débito, Crédito, Transferencia o Billetera virtual
  (Mercado Pago y similares). «Sin indicar» es no tener ninguna y es lo que tienen los movimientos anteriores.
- El formulario de agregar y corregir ofrece un selector «Forma de pago (opcional)» después de la categoría.
- El detalle del movimiento la muestra como una etiqueta junto a la categoría; el historial indica «forma de pago»
  cuando cambia; el CSV suma la columna `forma_pago` al final y el JSON incluye `paymentMethod`.
- Migración `0012_payment_method.sql`: columna nula `payment_method` con un CHECK sobre los cinco identificadores.
  Es compatible hacia atrás: el código anterior no la lee ni la escribe.

## Out of scope

- Filtro o búsqueda por forma de pago, etiqueta en la lista de movimientos e informes. Se evalúan cuando alguien los pida.
- Formas de pago propias de cada grupo (con alta, archivo y unión, como las categorías).
- Cambiar la forma de pago en bloque.
- Importación de Splitwise: no trae el dato; los importados quedan «sin indicar».
- Transferencias entre personas: no llevan forma de pago (como no llevan categoría).

## Capabilities

### New Capabilities

- `forma-de-pago-del-movimiento`: dato opcional del movimiento, su lista, su historial y su exportación.
