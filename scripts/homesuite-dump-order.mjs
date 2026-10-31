// Reordena un dump de `wrangler d1 export` para poder importarlo: primero todos los CREATE TABLE,
// después el resto (datos, índices, triggers) en su orden original.
//
// El export escribe cada tabla con sus datos en orden de creación. Si una tabla antigua recibió después una
// columna con REFERENCES a una tabla más nueva (ALTER TABLE ... ADD COLUMN), sus INSERT quedan antes de que
// exista la tabla referida y SQLite responde «no such table: main.<tabla>».
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function reorderDump(sql) {
  const header = [];
  const tables = [];
  const rest = [];
  let open = null;
  for (const line of sql.split("\n")) {
    if (open) {
      open.push(line);
      if (line.trimEnd().endsWith(";")) { tables.push(...open); open = null; }
    } else if (/^CREATE TABLE\b/iu.test(line)) {
      if (line.trimEnd().endsWith(";")) tables.push(line); else open = [line];
    } else if (/^PRAGMA\b/iu.test(line)) {
      header.push(line);
    } else {
      rest.push(line);
    }
  }
  if (open) throw new Error("El dump termina dentro de un CREATE TABLE sin cerrar.");
  return [...header, ...tables, ...rest].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Uso: node scripts/homesuite-dump-order.mjs <entrada.sql> <salida.sql>");
    process.exit(1);
  }
  writeFileSync(output, reorderDump(readFileSync(input, "utf8")));
}
