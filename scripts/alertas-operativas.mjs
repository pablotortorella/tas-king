#!/usr/bin/env node
// Avisos mínimos de operación de HomeSuite (change alertas-minimas-homesuite). Lo ejecutan los workflows de vigilancia de
// .github/workflows/ con `GITHUB_TOKEN` y la CLI `gh`; no usa ningún otro secreto. El aviso es un issue de GitHub deduplicado
// por título. El repositorio es PÚBLICO: ningún texto de este archivo incluye registros, emails ni nombres de grupos.
//
// Uso: node scripts/alertas-operativas.mjs <respaldo-fallido|salud|antiguedad|revision-semanal>
// Entorno: GH_TOKEN, GH_REPO (o GITHUB_REPOSITORY), GITHUB_SERVER_URL, GITHUB_RUN_ID y, solo para ensayar, SIMULATE.
// La lógica pura y la CLI inyectable (gh, sonda, reloj) las prueba apps/app/test/alertas-operativas.test.js.
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const ETIQUETA = "alerta-operativa";
export const OPERADOR = "pablotortorella";
export const HEALTHZ_URL = "https://app.homesuite.info/healthz";
export const CUERPO_ESPERADO = { status: "ok", service: "homesuite-app" };
export const WORKFLOW_RESPALDO = "homesuite-production-backup.yml";
export const TRABAJO_RESPALDO = "backup";
export const UMBRAL_HORAS = 26;
export const INTENTOS = 3;
export const ESPERA_ENTRE_INTENTOS_MS = 15_000;
// Con la caída sostenida el chequeo corre cada 30 minutos: sin este límite el issue recibiría 48 comentarios por día.
export const MINUTOS_ENTRE_COMENTARIOS_SALUD = 120;
export const PREFIJO_SIMULACRO = "[Simulacro] ";
export const PREFIJO_REVISION = "Revisión semanal de operación";

export const TITULOS = {
  respaldo: "Alerta: el respaldo diario de producción falló",
  salud: "Alerta: /healthz de producción no responde",
  antiguedad: "Alerta: no hay un respaldo de producción reciente",
};

const DOCUMENTO = "docs/HOMESUITE_VIGILANCIA.md";

/** Lista de comprobación de la cita semanal. La fuente humana es docs/HOMESUITE_VIGILANCIA.md; una prueba exige que coincidan. */
export const COMPROBACIONES_SEMANALES = [
  "Workers Logs: contá los eventos `slow_book_open` (señal de producto: cuándo pasar a SQL) y revisá `unhandled_error`, `rate_limited` y `csrf_rejected`.",
  "Panel de Workers: errores y respuestas 5xx de la semana.",
  "`maintenance_completed` aparece todos los días (no hay alerta por su ausencia).",
  "Los últimos 7 respaldos están en verde; mirá el tamaño del respaldo y de la base D1.",
  "Correos de incidentes y mantenimientos de Cloudflare de la semana.",
  "Los workflows de vigilancia siguen activos (ninguno figura como desactivado por inactividad).",
  "Issues `alerta-operativa` abiertos: atendelos o cerralos.",
];

// ---------------------------------------------------------------- gh

/** Ejecuta `gh` con argumentos (nunca por un shell) y devuelve la salida estándar. */
export function ejecutarGh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

const json = (texto) => JSON.parse(texto || "null");

export function tituloDe(base, simulacro) {
  return simulacro ? `${PREFIJO_SIMULACRO}${base}` : base;
}

function garantizarEtiqueta(gh) {
  try {
    const existentes = json(gh(["label", "list", "--limit", "200", "--json", "name"])) ?? [];
    if (existentes.some((etiqueta) => etiqueta.name === ETIQUETA)) return true;
    gh(["label", "create", ETIQUETA, "--color", "B60205", "--description", "Aviso automático de operación de HomeSuite"]);
    return true;
  } catch {
    return false;
  }
}

function issuesAbiertos(gh) {
  return json(gh(["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,url,createdAt"])) ?? [];
}

function minutosDesdeUltimaActividad(gh, numero, ahora) {
  const issue = json(gh(["issue", "view", String(numero), "--json", "createdAt,comments"]));
  const fechas = [issue.createdAt, ...(issue.comments ?? []).map((comentario) => comentario.createdAt)].map((fecha) => Date.parse(fecha));
  return (ahora.getTime() - Math.max(...fechas)) / 60_000;
}

function crearIssue(gh, { titulo, cuerpo, conEtiqueta }) {
  try {
    gh(["issue", "create", "--title", titulo, "--body", cuerpo, ...(conEtiqueta ? ["--label", ETIQUETA] : []), "--assignee", OPERADOR]);
  } catch (error) {
    // Una etiqueta o una asignación rechazadas no pueden impedir el aviso: se reintenta sin ellas y queda dicho en el registro.
    console.warn(`No se pudo crear el issue con etiqueta y asignación (${String(error.message).split("\n")[0]}); se reintenta sin ellas.`);
    gh(["issue", "create", "--title", titulo, "--body", cuerpo]);
  }
}

/**
 * Abre un issue o, si ya hay uno abierto con el mismo título, comenta en él (sin duplicar).
 * @returns {{ accion: "creado" | "comentado" | "omitido", numero?: number }}
 */
export function avisar({ gh, titulo, cuerpo, comentario = cuerpo, minutosEntreComentarios = 0, ahora = new Date() }) {
  const abierto = issuesAbiertos(gh).find((issue) => issue.title === titulo);
  if (abierto) {
    if (minutosEntreComentarios > 0 && minutosDesdeUltimaActividad(gh, abierto.number, ahora) < minutosEntreComentarios) {
      return { accion: "omitido", numero: abierto.number };
    }
    gh(["issue", "comment", String(abierto.number), "--body", comentario]);
    return { accion: "comentado", numero: abierto.number };
  }
  crearIssue(gh, { titulo, cuerpo, conEtiqueta: garantizarEtiqueta(gh) });
  return { accion: "creado" };
}

/** Comenta y cierra el issue abierto con ese título, si existe. */
export function cerrarSiAbierto({ gh, titulo, comentario }) {
  const abierto = issuesAbiertos(gh).find((issue) => issue.title === titulo);
  if (!abierto) return { accion: "nada" };
  gh(["issue", "comment", String(abierto.number), "--body", comentario]);
  gh(["issue", "close", String(abierto.number), "--reason", "completed"]);
  return { accion: "cerrado", numero: abierto.number };
}

// ---------------------------------------------------------------- textos (públicos: sin registros, emails ni grupos)

export const fechaUtc = (fecha) => fecha.toISOString().slice(0, 16).replace("T", " ") + " UTC";

function ayuda(repo, ancla) {
  return `https://github.com/${repo}/blob/main/${DOCUMENTO}#${ancla}`;
}

export function cuerpoRespaldoFallido({ urlCorrida, repo, ahora, simulacro }) {
  return [
    `Corrida: ${urlCorrida}`,
    `Fecha: ${fechaUtc(ahora)}`,
    "",
    "Qué hacer: abrí la corrida, mirá en qué paso falló y seguí la guía.",
    `Guía: ${ayuda(repo, "respaldo-fallido")}`,
    "",
    ...(simulacro ? ["Esto es un simulacro: el respaldo no falló de verdad.", ""] : []),
    "Este aviso no incluye registros de la corrida porque el repositorio es público.",
  ].join("\n");
}

export function cuerpoSaludCaida({ urlCorrida, repo, ahora, intentos, simulacro }) {
  return [
    `Corrida: ${urlCorrida}`,
    `Fecha: ${fechaUtc(ahora)}`,
    `Intentos: ${intentos.map((intento) => `${intento.numero}) ${descripcionIntento(intento)}`).join("; ")}`,
    "",
    "Qué hacer: abrí https://app.homesuite.info/healthz desde el teléfono y seguí la guía.",
    `Guía: ${ayuda(repo, "healthz-no-responde")}`,
    "",
    ...(simulacro ? ["Esto es un simulacro: la aplicación no se cayó.", ""] : []),
    "Este issue se cierra solo cuando la aplicación vuelve a responder.",
  ].join("\n");
}

export function cuerpoAntiguedad({ urlCorrida, repo, ahora, ultimo, simulacro, umbralHoras = UMBRAL_HORAS }) {
  return [
    `Control: ${urlCorrida}`,
    `Fecha: ${fechaUtc(ahora)}`,
    ultimo
      ? `Último respaldo exitoso: ${fechaUtc(new Date(ultimo.createdAt))} (hace ${Math.floor(ultimo.horas)} h; el umbral es ${umbralHoras} h).`
      : `No hay ninguna corrida exitosa reciente del respaldo (el umbral es ${umbralHoras} h).`,
    "",
    "Qué hacer: revisá si el workflow del respaldo está activo y si la variable HOMESUITE_PROD_BACKUPS_ENABLED vale true; después seguí la guía.",
    `Guía: ${ayuda(repo, "respaldo-desactualizado")}`,
    "",
    ...(simulacro ? ["Esto es un simulacro: el respaldo no está atrasado.", ""] : []),
    "Cerrá este issue a mano cuando haya un respaldo reciente.",
  ].join("\n");
}

/** Semana ISO 8601, p. ej. «2026-S45». */
export function semanaIso(fecha) {
  const dia = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const diaSemana = dia.getUTCDay() || 7;
  dia.setUTCDate(dia.getUTCDate() + 4 - diaSemana);
  const inicioDeAnio = Date.UTC(dia.getUTCFullYear(), 0, 1);
  const semana = Math.ceil(((dia.getTime() - inicioDeAnio) / 86_400_000 + 1) / 7);
  return `${dia.getUTCFullYear()}-S${String(semana).padStart(2, "0")}`;
}

export function tituloRevision(fecha) {
  return `${PREFIJO_REVISION} ${semanaIso(fecha)}`;
}

export function cuerpoRevision({ repo, ahora, anteriores }) {
  return [
    `Guía y consultas exactas: https://github.com/${repo}/blob/main/${DOCUMENTO}#revisión-semanal`,
    `Fecha: ${fechaUtc(ahora)}`,
    "",
    ...COMPROBACIONES_SEMANALES.map((linea) => `- [ ] ${linea}`),
    "",
    ...(anteriores.length ? ["Sigue abierta una revisión anterior:", ...anteriores.map((issue) => `- #${issue.number}`), ""] : []),
    "Es una cita, no una alerta. Cerrá este issue cuando termines.",
  ].join("\n");
}

// ---------------------------------------------------------------- salud

function descripcionIntento(intento) {
  if (intento.motivo === "sin-respuesta") return "sin respuesta a tiempo";
  if (intento.motivo === "cuerpo") return `HTTP ${intento.codigo} con un cuerpo inesperado`;
  return `HTTP ${intento.codigo}`;
}

/** Evalúa una respuesta de /healthz: 200 y cuerpo JSON con los campos esperados. */
export function evaluarRespuestaSalud({ codigo, cuerpo }) {
  if (!codigo) return { ok: false, codigo: 0, motivo: "sin-respuesta" };
  if (codigo !== 200) return { ok: false, codigo, motivo: "codigo" };
  try {
    const dato = JSON.parse(cuerpo);
    const coincide = Object.entries(CUERPO_ESPERADO).every(([clave, valor]) => dato?.[clave] === valor);
    return coincide ? { ok: true, codigo } : { ok: false, codigo, motivo: "cuerpo" };
  } catch {
    return { ok: false, codigo, motivo: "cuerpo" };
  }
}

/** Consulta con curl (`--max-time 10`); un error de red o de tiempo cuenta como «sin respuesta». */
export function sondaCurl(url = HEALTHZ_URL) {
  try {
    const salida = execFileSync("curl", ["--silent", "--show-error", "--max-time", "10", "--write-out", "\n%{http_code}", url], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const corte = salida.lastIndexOf("\n");
    return { codigo: Number(salida.slice(corte + 1)) || 0, cuerpo: salida.slice(0, corte) };
  } catch {
    return { codigo: 0, cuerpo: "" };
  }
}

const RESPUESTA_BUENA = { codigo: 200, cuerpo: JSON.stringify(CUERPO_ESPERADO) };

/** Sonda de ensayo: caida (todo falla), tropiezo (falla el primer intento) o recuperacion (todo bien). */
export function sondaSimulada(modo) {
  let llamadas = 0;
  return () => {
    llamadas += 1;
    if (modo === "caida") return { codigo: 503, cuerpo: "" };
    if (modo === "tropiezo" && llamadas === 1) return { codigo: 0, cuerpo: "" };
    return RESPUESTA_BUENA;
  };
}

/** Hasta `intentos` consultas separadas por `esperaMs`; para en la primera que responde bien. */
export async function revisarSalud({ sonda, dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms)), intentos = INTENTOS, esperaMs = ESPERA_ENTRE_INTENTOS_MS }) {
  const resultados = [];
  for (let numero = 1; numero <= intentos; numero += 1) {
    const evaluacion = evaluarRespuestaSalud(await sonda());
    resultados.push({ numero, ...evaluacion });
    if (evaluacion.ok) return { sano: true, intentos: resultados };
    if (numero < intentos) await dormir(esperaMs);
  }
  return { sano: false, intentos: resultados };
}

// ---------------------------------------------------------------- antigüedad del respaldo

/**
 * Última corrida del respaldo cuyo trabajo `backup` terminó en éxito. Una corrida con el trabajo omitido (variable de
 * habilitación distinta de `true`) puede figurar como exitosa para la API, por eso se mira el trabajo y no la corrida.
 */
export function ultimoRespaldoExitoso({ gh, ahora }) {
  const corridas = json(gh(["run", "list", "--workflow", WORKFLOW_RESPALDO, "--status", "success", "--limit", "10", "--json", "databaseId,createdAt,url"])) ?? [];
  for (const corrida of corridas) {
    const trabajos = json(gh(["run", "view", String(corrida.databaseId), "--json", "jobs"]))?.jobs ?? [];
    if (trabajos.some((trabajo) => trabajo.name === TRABAJO_RESPALDO && trabajo.conclusion === "success")) {
      return { ...corrida, horas: (ahora.getTime() - Date.parse(corrida.createdAt)) / 3_600_000 };
    }
  }
  return null;
}

export const estaDesactualizado = (ultimo, umbralHoras = UMBRAL_HORAS) => !ultimo || ultimo.horas > umbralHoras;

// ---------------------------------------------------------------- CLI

function contexto(entorno, ahora) {
  const repo = entorno.GH_REPO || entorno.GITHUB_REPOSITORY || "pablotortorella/tas-king";
  const servidor = entorno.GITHUB_SERVER_URL || "https://github.com";
  const urlCorrida = entorno.GITHUB_RUN_ID ? `${servidor}/${repo}/actions/runs/${entorno.GITHUB_RUN_ID}` : `${servidor}/${repo}/actions`;
  const simulacion = (entorno.SIMULATE || "").trim();
  return { repo, urlCorrida, ahora, simulacion: simulacion && simulacion !== "none" && simulacion !== "false" ? simulacion : "" };
}

/** Ejecuta un subcomando. Devuelve un resumen para el registro; lanza solo si no pudo avisar. */
export async function ejecutar(comando, { entorno = process.env, gh = ejecutarGh, sonda, dormir, ahora = new Date() } = {}) {
  const { repo, urlCorrida, simulacion } = contexto(entorno, ahora);
  const simulacro = Boolean(simulacion);
  const datos = { gh, ahora };

  if (comando === "respaldo-fallido") {
    const cuerpo = cuerpoRespaldoFallido({ urlCorrida, repo, ahora, simulacro });
    const comentario = `Otra falla del respaldo.\n\n${cuerpo}`;
    return { comando, ...avisar({ ...datos, titulo: tituloDe(TITULOS.respaldo, simulacro), cuerpo, comentario }) };
  }

  if (comando === "salud") {
    const titulo = tituloDe(TITULOS.salud, simulacro);
    const sondeo = simulacro ? sondaSimulada(simulacion) : (sonda ?? sondaCurl);
    const resultado = await revisarSalud({ sonda: sondeo, dormir: simulacro && !dormir ? async () => {} : dormir });
    if (resultado.sano) {
      const intento = resultado.intentos.length;
      const cierre = cerrarSiAbierto({ gh, titulo, comentario: `Recuperado: /healthz respondió 200 con el cuerpo esperado (intento ${intento}).\nCorrida: ${urlCorrida}\nFecha: ${fechaUtc(ahora)}` });
      return { comando, sano: true, intentos: resultado.intentos.length, ...cierre };
    }
    const cuerpo = cuerpoSaludCaida({ urlCorrida, repo, ahora, intentos: resultado.intentos, simulacro });
    const aviso = avisar({ ...datos, titulo, cuerpo, comentario: `Sigue sin responder.\n\n${cuerpo}`, minutosEntreComentarios: MINUTOS_ENTRE_COMENTARIOS_SALUD });
    return { comando, sano: false, intentos: resultado.intentos.length, ...aviso };
  }

  if (comando === "antiguedad") {
    const ultimo = simulacion === "al-dia" ? { createdAt: new Date(ahora.getTime() - 14 * 3_600_000).toISOString(), horas: 14 }
      : simulacion === "desactualizado" ? { createdAt: new Date(ahora.getTime() - 30 * 3_600_000).toISOString(), horas: 30 }
      : ultimoRespaldoExitoso({ gh, ahora });
    if (!estaDesactualizado(ultimo)) return { comando, accion: "nada", horas: ultimo.horas };
    const cuerpo = cuerpoAntiguedad({ urlCorrida, repo, ahora, ultimo, simulacro });
    return { comando, ...avisar({ ...datos, titulo: tituloDe(TITULOS.antiguedad, simulacro), cuerpo, comentario: `Sigue sin haber un respaldo reciente.\n\n${cuerpo}` }) };
  }

  if (comando === "revision-semanal") {
    const titulo = tituloRevision(ahora);
    const abiertos = issuesAbiertos(gh).filter((issue) => issue.title.startsWith(PREFIJO_REVISION));
    if (abiertos.some((issue) => issue.title === titulo)) return { comando, accion: "omitido" };
    const cuerpo = cuerpoRevision({ repo, ahora, anteriores: abiertos });
    crearIssue(gh, { titulo, cuerpo, conEtiqueta: false });
    return { comando, accion: "creado" };
  }

  throw new Error(`Comando desconocido: ${comando || "(ninguno)"}. Usar respaldo-fallido, salud, antiguedad o revision-semanal.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  ejecutar(process.argv[2]).then(
    (resumen) => {
      console.log(JSON.stringify(resumen));
      if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\`${JSON.stringify(resumen)}\`\n`);
    },
    (error) => {
      console.error(`No se pudo avisar: ${error.message}`);
      process.exitCode = 1;
    },
  );
}
