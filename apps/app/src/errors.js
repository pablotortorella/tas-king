// Error de dominio del libro: lleva el estado HTTP con el que la ruta debe responder.
export class LedgerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
