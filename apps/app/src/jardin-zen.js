// Jardín Zen · beta v0.2. Página generada por el Worker; recursos JS/CSS del mismo origen.
// No requiere sesión, D1 ni APIs: la experiencia y el audio son locales al navegador.
export function renderJardinZen() {
  return `<noscript><p class="notice">Jardín Zen necesita JavaScript para dibujar y mover las piedras.</p></noscript>
<section class="zen-app" id="jardin-zen">
  <div class="zen-head">
    <div><div class="zen-brand"><i></i>HomeSuite <span class="zen-trail">/ disfrutar</span></div><h1>Un momento de calma</h1><p class="subtitle">Tu pequeño jardín para crear, soltar y volver a empezar.</p></div>
    <button class="pill" id="sound" aria-pressed="false" title="Activar o silenciar un paisaje sonoro original">♪ &nbsp; Sonido apagado</button>
  </div>
  <div class="scene" id="scene-box" aria-label="Jardín zen tridimensional interactivo">
    <canvas id="scene" aria-label="Jardín de arena, piedras y madera"></canvas>
    <div class="scene-info" id="hint"><span class="dot"></span><span>Arrastrá sobre la arena para dibujar surcos</span></div>
    <div class="scene-error" id="error">No pudimos mostrar el jardín. Probá actualizar tu navegador.</div>
  </div>
  <div class="toolbar" aria-label="Herramientas del jardín">
    <div class="tools"><div class="group" role="group" aria-label="Herramienta activa">
      <button class="tool" data-tool="rake" aria-pressed="true">⋰ &nbsp; Rastrillar</button>
      <button class="tool" data-tool="stone" aria-pressed="false">◈ &nbsp; Piedras</button>
      <button class="tool" data-tool="orbit" aria-pressed="false">◉ &nbsp; Explorar</button>
    </div></div>
    <div class="actions">
      <button class="action" id="rake-size" title="Alternar entre rastrillo fino y normal" aria-label="Ancho del rastrillo: fino. Pulsar para cambiar a normal">Trazo fino</button>
      <button class="action" id="waves" title="Crear un patrón de ondas">Ondas</button>
      <button class="action" id="clear" title="Alisar completamente la arena">Alisar</button>
      <button class="action" id="undo" title="Deshacer el último trazo">↶ Deshacer</button>
    </div>
  </div>
  <div class="zen-foot"><span>Versión beta · sin cuenta ni datos enviados</span><span>3D liviano · sin bibliotecas externas</span></div>
</section>`;
}

export function registerJardinZenRoutes(app, { page }) {
  app.get("/jardin-zen", (c) => c.html(page("Jardín Zen", renderJardinZen(), {
    wide: true,
    bodyClass: "jardin-zen",
    styles: ["/jardin-zen/jardin-zen.css"],
    scripts: ["/jardin-zen/jardin-zen.js"],
  })));
}
