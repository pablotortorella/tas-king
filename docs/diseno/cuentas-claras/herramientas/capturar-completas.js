// Capturas de largo completo de las pantallas del celular con scroll interno (ver capturar.js para preparar el entorno).
// Uso: node capturar-completas.js <carpeta-de-salida>; guardar el resultado en capturas/<tema>/completas/.
const { chromium } = require('playwright'); const fs=require('fs');
const OUT=process.argv[2];
const GEORGIA=`@font-face{font-family:Georgia;src:url(http://127.0.0.1:8899/fonts/gelasio-latin-400-normal.woff2);font-weight:400}@font-face{font-family:Georgia;src:url(http://127.0.0.1:8899/fonts/gelasio-latin-700-normal.woff2);font-weight:700}`;
const list=[['NuevoGrupo','01-nuevo-grupo'],['Main','04-saldos'],['Movimientos','05-movimientos-y-busqueda'],['Detalle','07-detalle-y-revisiones'],['SaldoDe','08-por-que-te-deben'],['Personas','10-personas-y-acceso']];
(async()=>{const b=await chromium.launch();
 for(const [scheme,dir] of [['light','claro'],['dark','oscuro']]){
  fs.mkdirSync(`${OUT}/${dir}`,{recursive:true});
  const ctx=await b.newContext({colorScheme:scheme,deviceScaleFactor:2});
  await ctx.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  await ctx.addInitScript(`document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(GEORGIA)};document.head.appendChild(s)})`);
  for(const [f,name] of list){
   const p=await ctx.newPage();await p.setViewportSize({width:390,height:844});
   await p.goto(`http://127.0.0.1:8899/${f}.dc.html`);await p.waitForTimeout(900);await p.evaluate(()=>document.fonts.ready);
   const h=await p.evaluate(()=>{const m=document.querySelector('main');const c=m.parentElement;const over=m.scrollHeight-m.clientHeight;c.style.height=(844+over)+'px';return 844+over});
   await p.setViewportSize({width:390,height:h});await p.waitForTimeout(300);
   const chk=await p.evaluate(()=>{const m=document.querySelector('main');return m.scrollHeight-m.clientHeight});
   await p.screenshot({path:`${OUT}/${dir}/${name}-completa.png`});
   console.log(scheme,f,h,'sobrante',chk);await p.close();}
  await ctx.close();}
 await b.close()})();
