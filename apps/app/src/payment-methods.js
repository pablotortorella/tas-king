// Formas de pago de un movimiento: una lista fija y corta, no una lista por grupo. «Sin indicar» es no tener ninguna.
// Cambiarla exige una migración (la columna lleva un CHECK con estos identificadores) y actualizar el glosario.
export const PAYMENT_METHODS = Object.freeze([
  { id: "cash", name: "Efectivo" },
  { id: "debit", name: "Débito" },
  { id: "credit", name: "Crédito" },
  { id: "transfer", name: "Transferencia" },
  { id: "wallet", name: "Billetera virtual" },
]);

export const paymentMethodName = id => PAYMENT_METHODS.find(method => method.id === id)?.name ?? null;

// De lo que llega en la solicitud al identificador guardado: vacío es «sin indicar» y un identificador desconocido es null
// con `valid: false`, para que quien guarda lo rechace en lugar de descartarlo en silencio.
export function parsePaymentMethod(value) {
  if (value === undefined || value === null || value === "") return { valid: true, id: null };
  const known = PAYMENT_METHODS.some(method => method.id === value);
  return { valid: known, id: known ? value : null };
}
