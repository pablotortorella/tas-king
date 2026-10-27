import { expect } from "vitest";

// Un documento de Remanso no puede traer código ni estilo incrustado ni recursos de
// otros orígenes (salvo la foto de Google que el shell ya muestra).
export function expectCleanDocument(html) {
  expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/iu);
  expect(html).not.toMatch(/<style[\s>]/iu);
  expect(html).not.toMatch(/\sstyle\s*=/iu);
  expect(html).not.toMatch(/\son[a-z]+\s*=/iu);
  const urls = [...html.matchAll(/\s(?:src|href|action)="([^"]*)"/gu)].map((match) => match[1]);
  const foreign = urls.filter((url) => !/^\/(?!\/)/u.test(url) && !/^#/u.test(url) && !/^https:\/\/lh[3-6]\.googleusercontent\.com\//u.test(url));
  expect(foreign).toEqual([]);
}
