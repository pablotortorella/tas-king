import { appCss } from "../styles.js";
import { LEDGER_CLIENT_JS } from "../client.js";
import { SPLIT_MODULE_SOURCE } from "../split.js";
import { CLASSIFY_JS } from "../classify-client.js";
import { IMPORT_PROGRESS_JS } from "../import-client.js";
import { TEXT_MODULE_SOURCE } from "../text.js";

// Hoja de estilos y módulos del navegador. La CSP solo admite scripts del mismo origen, así que viven como texto servido.

export function registerAssetRoutes(app) {
  app.get("/app.css", (c) => c.body(appCss(), 200, { "Content-Type": "text/css; charset=utf-8" }));

  app.get("/ledger-ui.js", (c) => c.body(LEDGER_CLIENT_JS, 200, { "Content-Type": "text/javascript; charset=utf-8" }));
  app.get("/split.js", (c) => c.body(SPLIT_MODULE_SOURCE, 200, { "Content-Type": "text/javascript; charset=utf-8" }));
  app.get("/classify.js", (c) => c.body(CLASSIFY_JS, 200, { "Content-Type": "text/javascript; charset=utf-8" }));
  app.get("/import-progress.js", (c) => c.body(IMPORT_PROGRESS_JS, 200, { "Content-Type": "text/javascript; charset=utf-8" }));
  app.get("/text.js", (c) => c.body(TEXT_MODULE_SOURCE, 200, { "Content-Type": "text/javascript; charset=utf-8" }));
}
