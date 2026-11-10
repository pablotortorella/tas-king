// ---------- Routes: Users ----------

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

// Fecha del día según el navegador de la persona. El día tiene que cambiar a SU
// medianoche, no a la del servidor: con la fecha en UTC, alguien en Argentina
// vería cambiar el tip a las 21:00. Si no llega o viene mal formada, caemos a UTC.
export function hoyDelCliente(valor) {
  return FECHA_RE.test(String(valor || "")) ? String(valor) : new Date().toISOString().slice(0, 10);
}

// Regla de avance del tip diario. Pura, para poder testearla sin base ni red.
// `tipIndex` es un contador monótono de tips vistos, no una posición: el frontend
// resuelve DAILY_TIPS[index % DAILY_TIPS.length], así que el ciclado vive junto
// al catálogo y acá nunca hace falta saber cuántos tips hay.
export function avanzarTip({ tipIndex, tipDate, hoy }) {
  const visto = Number.isInteger(tipIndex) && tipIndex >= 0 ? tipIndex : null;
  // Primera vez: empieza por el primero, sin saltear nada.
  if (visto === null) return { index: 0, date: hoy, guardar: true };
  // Misma jornada: el tip no se mueve, aunque recargue mil veces.
  if (tipDate === hoy) return { index: visto, date: hoy, guardar: false };
  // Otro día: avanza UNO solo, hayan pasado uno o treinta días sin entrar.
  return { index: visto + 1, date: hoy, guardar: true };
}

