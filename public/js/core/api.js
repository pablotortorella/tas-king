// Cliente HTTP de la app.
//
// Un único punto por donde pasan todas las llamadas al backend. Concentra dos
// cosas que no conviene repetir en cada módulo: cómo se arma el cuerpo JSON y
// qué significa cada forma de error.
//
// No lee ni escribe estado compartido, así que vive en el núcleo. Sí usa fetch y
// window, o sea que depende del navegador: eso lo hace probable con stubs, no con
// llamadas reales.

/**
 * @throws {Error} con `.status` y el mensaje del backend cuando lo hay.
 * @returns {Promise<any|null>} null en 204; el JSON en el resto.
 */
export async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    let code;
    try { const j = await res.json(); if (j && j.error) msg = j.error; if (j && j.code) code = j.code; } catch (e) {}
    if (code === "access_revoked") {
      // Puede llegar desde cualquier llamada (el poll de fondo incluido), no solo la
      // carga inicial — se navega ya mismo y no se resuelve esta promesa, para que
      // ningún catch de arriba llegue a mostrar un alert() con el error a mitad de la
      // redirección.
      window.location.href = "/revoked";
      return new Promise(() => {});
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
