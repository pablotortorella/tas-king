// Regenera los PDF A3 de las láminas vigentes y, con --snapshot <versión-hito>, guarda el snapshot
// (HTML con el CSS incorporado, PDF y PNG) en visual/history/. Uso, desde la raíz del repositorio:
//   node visual/render.mjs
//   node visual/render.mjs --snapshot v0.1.3-libro-importacion-y-rediseno
import { chromium } from "@playwright/test";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const boards = [
  { source: "journey", folder: "journey", prefix: "user-journey" },
  { source: "story-map", folder: "story-map", prefix: "user-story-map" },
];
const flag = process.argv.indexOf("--snapshot");
const snapshot = flag > -1 ? process.argv[flag + 1] : null;
if (flag > -1 && !snapshot) throw new Error("Falta la versión: --snapshot v<producto>-<hito>");

const browser = await chromium.launch();
for (const board of boards) {
  const html = path.join(here, `${board.source}.html`);
  const page = await browser.newPage({ viewport: { width: 1700, height: 1300 } });
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(here, `${board.source}.pdf`), width: "420mm", height: "297mm", printBackground: true, pageRanges: "1" });
  if (snapshot) {
    const directory = path.join(here, "history", board.folder);
    await mkdir(directory, { recursive: true });
    const name = `${board.prefix}-${snapshot}`;
    const css = await readFile(path.join(here, "board.css"), "utf8");
    const source = (await readFile(html, "utf8")).replace('<link rel="stylesheet" href="board.css">', `<style>\n${css}\n  </style>`);
    await writeFile(path.join(directory, `${name}.html`), source);
    await copyFile(path.join(here, `${board.source}.pdf`), path.join(directory, `${name}.pdf`));
    await page.locator(".page").screenshot({ path: path.join(directory, `${name}.png`) });
  }
  await page.close();
}
await browser.close();
