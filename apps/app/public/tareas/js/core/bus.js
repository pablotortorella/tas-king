// Bus de eventos mínimo.
//
// Existe para una sola cosa: cortar las dependencias circulares entre módulos de
// feature. Las flechas del diseño van hacia abajo — feature -> núcleo — y nunca
// de feature a feature. Cuando un módulo necesita avisarle algo a otro (se guardó
// una tarjeta, hay que re-renderizar el tablero) emite acá en vez de importarlo.
//
// Regla de diseño que se deriva: si un módulo de feature necesita importar a
// otro, o la frontera está mal trazada o el destinatario real es el bus.
//
// Los módulos ES toleran ciclos cuando las referencias se usan en tiempo de
// llamada, que es el caso de casi todo este frontend. Pero apoyarse en esa
// sutileza del cargador deja dependencias invisibles; acá quedan explícitas.

const oyentes = new Map();

/**
 * Suscribe `fn` a `evento`. Devuelve una función para desuscribir.
 */
export function on(evento, fn) {
  if (!oyentes.has(evento)) oyentes.set(evento, new Set());
  oyentes.get(evento).add(fn);
  return () => off(evento, fn);
}

export function off(evento, fn) {
  const fns = oyentes.get(evento);
  if (!fns) return;
  fns.delete(fn);
  if (fns.size === 0) oyentes.delete(evento);
}

/**
 * Notifica a los suscriptos de `evento`.
 *
 * Itera sobre una copia: un oyente que se desuscribe a sí mismo durante la
 * notificación no debe alterar el recorrido en curso. Un oyente que falla no
 * impide que corran los demás — si no, el primer bug de render dejaría media
 * interfaz sin actualizar y el síntoma no se parecería en nada a la causa.
 */
export function emit(evento, payload) {
  const fns = oyentes.get(evento);
  if (!fns) return;
  for (const fn of [...fns]) {
    try {
      fn(payload);
    } catch (e) {
      console.error(`[bus] oyente de "${evento}" falló:`, e);
    }
  }
}

/** Solo para tests: deja el bus sin suscripciones. */
export function reset() {
  oyentes.clear();
}
