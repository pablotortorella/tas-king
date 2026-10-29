-- Forma de pago del movimiento: lista fija y corta, opcional. NULL = sin indicar (movimientos anteriores y transferencias).
-- Columna nula y compatible con el código anterior, que no la escribe ni la lee.
ALTER TABLE ledger_entries ADD COLUMN payment_method TEXT CHECK(payment_method IS NULL OR payment_method IN ('cash', 'debit', 'credit', 'transfer', 'wallet'));
