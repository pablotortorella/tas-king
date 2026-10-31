// Auditoría automática de las 10 pantallas en claro y oscuro (Chromium).
// Mide en el DOM: contraste de TODO el texto contra su fondo efectivo (WCAG AA: 4,5, o 3 si es texto
// grande), tamaño de los controles táctiles (< 44 px), texto recortado, desbordes horizontales,
// tamaño de letra < 11 px, botones sin nombre y campos sin etiqueta. Escribe audit.json y un resumen.
// Uso: igual que capturar.js (mismo servidor en el puerto 8899 y carpeta fonts/). Sin argumentos.
// Límites: no evalúa contraste de bordes ni de íconos, ni estados hover o foco, ni fondos con degradé.
// Los resultados "tap" incluyen íconos decorativos y radios dentro de etiquetas: revisarlos a mano.
const { chromium } = require('playwright');
const screens=[['NuevoGrupo','phone'],['PuntoDePartida','phone'],['Importar','page'],['Main','phone'],['Movimientos','phone'],['Agregar','phone'],['Detalle','phone'],['SaldoDe','phone'],['Escritorio','page'],['Personas','phone']];
const GEORGIA=`@font-face{font-family:Georgia;src:url(http://127.0.0.1:8899/fonts/gelasio-latin-400-normal.woff2);font-weight:400}@font-face{font-family:Georgia;src:url(http://127.0.0.1:8899/fonts/gelasio-latin-700-normal.woff2);font-weight:700}`;
function pageAudit(){
  const parse=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return null;const a=m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);return {r:a[0],g:a[1],b:a[2],a:a.length>3?a[3]:1}};
  const comp=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1});
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const bgOf=el=>{ // composite ancestors bottom-up
    let layers=[],n=el,grad=false;
    while(n&&n.nodeType===1){const cs=getComputedStyle(n);const c=parse(cs.backgroundColor);
      if(cs.backgroundImage&&cs.backgroundImage!=='none')grad=true;
      if(c&&c.a>0)layers.push(c); if(c&&c.a>=1&&!grad)break; n=n.parentElement;}
    let base={r:255,g:255,b:255,a:1}; for(let i=layers.length-1;i>=0;i--)base=comp(layers[i],base); return {c:base,grad};
  };
  const opac=el=>{let o=1,n=el;while(n&&n.nodeType===1){o*=parseFloat(getComputedStyle(n).opacity);n=n.parentElement}return o};
  const out={contrast:[],layout:[],tap:[],fonts:new Set(),meta:{}};
  const W=document.documentElement.clientWidth;
  out.meta={sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,bodyH:document.body.scrollHeight,W};
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const seen=new Set();let t;
  while(t=walker.nextNode()){
    const txt=t.nodeValue.trim(); if(!txt)continue; const el=t.parentElement; if(!el||seen.has(el))continue; seen.add(el);
    if(['SCRIPT','STYLE','HELMET','NOSCRIPT'].includes(el.tagName))continue;
    const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none')continue;
    const r=el.getBoundingClientRect(); if(r.width===0||r.height===0)continue;
    let fg=parse(cs.color); const bgr=bgOf(el); const o=opac(el); fg={...fg,a:fg.a*o};
    const eff=comp(fg,bgr.c); const cr=ratio(eff,bgr.c);
    const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight);
    const large=fs>=24||(fs>=18.66&&fw>=700); const need=large?3:4.5;
    if(cr<need)out.contrast.push({txt:txt.slice(0,40),cr:+cr.toFixed(2),need,fs,fw,fg:cs.color,bg:`rgb(${bgr.c.r|0},${bgr.c.g|0},${bgr.c.b|0})`,grad:bgr.grad,tag:el.tagName+'.'+(el.className||'').toString().slice(0,20)});
    if(fs<11)out.layout.push({kind:'small-font',txt:txt.slice(0,30),fs});
  }
  // layout
  for(const el of document.body.querySelectorAll('*')){
    const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden')continue;
    const r=el.getBoundingClientRect(); if(r.width===0&&r.height===0)continue;
    if(['SCRIPT','STYLE','HELMET'].includes(el.tagName))continue;
    // clipped text
    if((cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.textOverflow==='ellipsis')&&el.scrollWidth>el.clientWidth+1&&el.children.length<4&&el.textContent.trim())
      out.layout.push({kind:'clipped',txt:el.textContent.trim().slice(0,40),sw:el.scrollWidth,cw:el.clientWidth});
    // offscreen horizontally (unless inside scroll container)
    if(r.right>W+1||r.left<-1){let n=el.parentElement,sc=false;while(n&&n!==document.body){const c=getComputedStyle(n);if(/(auto|scroll|hidden)/.test(c.overflowX)){sc=true;break}n=n.parentElement}
      if(!sc)out.layout.push({kind:'offscreen',tag:el.tagName,txt:(el.textContent||'').trim().slice(0,30),l:Math.round(r.left),r:Math.round(r.right)});}
    // tap targets
    const tag=el.tagName; const isCtl=['BUTTON','A','SELECT','TEXTAREA'].includes(tag)||(tag==='INPUT'&&!['hidden'].includes(el.type))||el.getAttribute('role')==='button'||el.getAttribute('tabindex')==='0'||cs.cursor==='pointer';
    if(isCtl&&!(el.children.length&&el.querySelector('button,a,input'))){ if(r.width<44||r.height<44)out.tap.push({tag,txt:((el.textContent||el.getAttribute('aria-label')||el.type||'')+'').trim().slice(0,28),w:Math.round(r.width),h:Math.round(r.height)});}
    cs.fontFamily&&out.fonts.add(cs.fontFamily.split(',')[0].replace(/['"]/g,''));
  }
  out.fonts=[...out.fonts];
  // images / svg without label
  out.meta.imgsNoAlt=[...document.querySelectorAll('img:not([alt])')].length;
  out.meta.btnNoName=[...document.querySelectorAll('button')].filter(b=>!(b.textContent.trim()||b.getAttribute('aria-label')||b.title)).length;
  out.meta.inputNoLabel=[...document.querySelectorAll('input,select,textarea')].filter(i=>!(i.id&&document.querySelector(`label[for="${i.id}"]`))&&!i.closest('label')&&!i.getAttribute('aria-label')).length;
  return out;
}
(async()=>{
  const b=await chromium.launch(); const res={};
  for(const scheme of ['light','dark']){
    const ctx=await b.newContext({colorScheme:scheme,deviceScaleFactor:1});
    await ctx.route('**/fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
    await ctx.addInitScript(`document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(GEORGIA)};document.head.appendChild(s)})`);
    for(const [f,kind] of screens){
      const p=await ctx.newPage(); await p.setViewportSize(kind==='phone'?{width:390,height:844}:{width:1280,height:900});
      await p.goto(`http://127.0.0.1:8899/${f}.dc.html`); await p.waitForTimeout(1200);
      await p.evaluate(()=>document.fonts.ready);
      res[`${f}|${scheme}`]=await p.evaluate(pageAudit); await p.close();
    }
    await ctx.close();
  }
  await b.close(); require('fs').writeFileSync('audit.json',JSON.stringify(res,null,1));
  for(const [k,v] of Object.entries(res)){console.log(`${k}: sw=${v.meta.sw}/${v.meta.W} sh=${v.meta.sh} contrast=${v.contrast.length} layout=${v.layout.length} tap=${v.tap.length} fonts=${v.fonts.join('/')} noname=${v.meta.btnNoName} nolabel=${v.meta.inputNoLabel}`)}
})();
