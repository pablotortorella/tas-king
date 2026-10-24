// Genera las capturas PNG de docs/diseno/cuentas-claras/capturas (claro y oscuro).
// Uso (ver README.md, sección "Regenerar las capturas"):
//   1. Carpeta temporal con los .dc.html de ../project y un support.js (el runtime del tipo Design).
//   2. python3 -m http.server 8899 --bind 127.0.0.1   (dentro de esa carpeta)
//   3. NODE_PATH=$(npm root -g) node capturar.js <carpeta-de-salida>
// Requiere Playwright. Si no hay acceso a Google Fonts, Inter cae a la tipografía del sistema.
const { chromium } = require('playwright');
const fs=require('fs');
const OUT=process.argv[2];
const boards=[
 ['NuevoGrupo','01-nuevo-grupo','phone'],['PuntoDePartida','02-punto-de-partida','phone'],['Importar','03-importar-splitwise','page'],
 ['Main','04-saldos','phone'],['Movimientos','05-movimientos-y-busqueda','phone'],['Agregar','06-agregar-movimiento','phone'],
 ['Detalle','07-detalle-y-revisiones','phone'],['SaldoDe','08-por-que-te-deben','phone'],['Escritorio','09-libro-en-escritorio','page'],['Personas','10-personas-y-acceso','phone']];
(async()=>{
  const b=await chromium.launch();
  for (const [scheme,dir] of [['light','claro'],['dark','oscuro']]){
    fs.mkdirSync(`${OUT}/${dir}`,{recursive:true});
    const ctx=await b.newContext({colorScheme:scheme,deviceScaleFactor:scheme==='light'?2:2});
    for (const [file,name,kind] of boards){
      const p=await ctx.newPage();
      await p.setViewportSize(kind==='phone'?{width:390,height:844}:{width:1280,height:900});
      p.on('pageerror',e=>console.log('pageerror',file,e.message.slice(0,200)));
      await p.route('**/fonts.googleapis.com/**',r=>r.abort());
      await p.goto('http://127.0.0.1:8899/'+file+'.dc.html'); await p.waitForTimeout(900);
      const shot=async(n,full)=>p.screenshot({path:`${OUT}/${dir}/${n}.png`,fullPage:!!full});
      await shot(name, kind==='page');
      if(file==='Main'){ try{await p.getByRole('button',{name:/USD/}).first().click({timeout:3000});await p.waitForTimeout(400);await shot('04b-saldos-usd');}catch(e){console.log('skip USD',e.message.slice(0,80));} }
      if(file==='Agregar'){ for(const [re,n] of [[/Ingreso/,'06b-agregar-ingreso'],[/Transferencia/,'06c-agregar-transferencia']]){ try{await p.getByRole('button',{name:re}).first().click({timeout:3000});await p.waitForTimeout(400);await shot(n);}catch(e){console.log('skip',n,e.message.slice(0,80));} } }
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
})();
