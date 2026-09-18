// ¿Este error es una base bloqueada de forma transitoria?
//
// Vive aparte de reset-db.js a propósito: ahí adentro hay un execSync, y un
// módulo que importa child_process no se puede cargar en el runner de tests
// (workerd). Separada, la decisión queda probada.
//
// Lo que importa no es que reintente, sino que reintente SOLO ante esto: tapar
// un seed roto con reintentos sería peor que la falla original.
export function esBaseBloqueada(e) {
  if (!e) return false;
  const salida = `${e.stdout ?? ""}${e.stderr ?? ""}${e.message ?? ""}`;
  return /SQLITE_BUSY|database is locked/i.test(salida);
}
