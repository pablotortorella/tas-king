import { inflateSync } from "node:zlib";

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Lee lo mínimo de un PNG sin dependencias: firma, IHDR y (si hace falta) los píxeles, para comprobar tamaño y opacidad.
export function leerPng(bytes) {
  const buffer = Buffer.from(bytes);
  if (!buffer.subarray(0, 8).equals(FIRMA)) throw new Error("No es un PNG (firma inválida).");
  let desplazamiento = 8;
  let cabecera = null;
  const datos = [];
  while (desplazamiento < buffer.length) {
    const largo = buffer.readUInt32BE(desplazamiento);
    const tipo = buffer.toString("ascii", desplazamiento + 4, desplazamiento + 8);
    const cuerpo = buffer.subarray(desplazamiento + 8, desplazamiento + 8 + largo);
    if (tipo === "IHDR") cabecera = { ancho: cuerpo.readUInt32BE(0), alto: cuerpo.readUInt32BE(4), profundidad: cuerpo[8], tipoColor: cuerpo[9], entrelazado: cuerpo[12] };
    if (tipo === "IDAT") datos.push(cuerpo);
    desplazamiento += 12 + largo;
  }
  if (!cabecera) throw new Error("PNG sin IHDR.");
  return { ...cabecera, idat: Buffer.concat(datos) };
}

// Devuelve los valores de alfa de cada píxel (255 si el PNG no tiene canal alfa). Solo admite 8 bits, sin entrelazado (lo que genera Chromium).
export function alfas(png) {
  if (png.profundidad !== 8 || png.entrelazado !== 0) throw new Error("PNG no admitido por el lector de prueba.");
  const canales = { 0: 1, 2: 3, 4: 2, 6: 4 }[png.tipoColor];
  if (!canales) throw new Error("Tipo de color no admitido.");
  if (png.tipoColor !== 4 && png.tipoColor !== 6) return new Uint8Array(png.ancho * png.alto).fill(255);
  const fila = png.ancho * canales;
  const crudo = inflateSync(png.idat);
  const previa = Buffer.alloc(fila);
  const actual = Buffer.alloc(fila);
  const resultado = new Uint8Array(png.ancho * png.alto);
  for (let y = 0; y < png.alto; y += 1) {
    const filtro = crudo[y * (fila + 1)];
    const origen = crudo.subarray(y * (fila + 1) + 1, (y + 1) * (fila + 1));
    for (let x = 0; x < fila; x += 1) {
      const izquierda = x >= canales ? actual[x - canales] : 0;
      const arriba = previa[x];
      const arribaIzquierda = x >= canales ? previa[x - canales] : 0;
      let predicho = 0;
      if (filtro === 1) predicho = izquierda;
      else if (filtro === 2) predicho = arriba;
      else if (filtro === 3) predicho = (izquierda + arriba) >> 1;
      else if (filtro === 4) {
        const p = izquierda + arriba - arribaIzquierda;
        const pa = Math.abs(p - izquierda);
        const pb = Math.abs(p - arriba);
        const pc = Math.abs(p - arribaIzquierda);
        predicho = pa <= pb && pa <= pc ? izquierda : pb <= pc ? arriba : arribaIzquierda;
      }
      actual[x] = (origen[x] + predicho) & 255;
    }
    for (let x = 0; x < png.ancho; x += 1) resultado[y * png.ancho + x] = actual[x * canales + canales - 1];
    actual.copy(previa);
  }
  return resultado;
}
