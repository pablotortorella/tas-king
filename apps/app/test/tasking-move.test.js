import { describe,it,expect } from 'vitest';
import { moveResponse,migrationTarget } from '../../../src/tasking-move.js';
const origin='https://tas-king.pablotortorella.workers.dev';
const env={TASKING_DESTINATION:'production'};
describe('Worker antiguo: aviso y compatibilidad',()=>{
 it('avisa con firma, contacto y un botón, sin redirigir ni aceptar una cuenta declarada',async()=>{const res=moveResponse(new Request(origin+'/?returnTo=https://evil.example&email=otra@example.test'),env);const html=await res.text();expect(res.status).toBe(200);expect(res.headers.get('Location')).toBeNull();expect(html).toContain('¡Nos mudamos!');expect(html).toContain('Pablitux');expect(html).toContain('contactame');expect(html).toContain('href="https://app.homesuite.info/tareas"');expect(html).not.toContain('evil.example');expect(html).not.toContain('otra@example.test');expect(html).not.toContain('http-equiv');expect(html).not.toContain('<script');});
 it('conserva tarjeta y distingue ambientes sin confiar en Host o query',()=>{expect(migrationTarget(new Request(origin+'/?card=card-123&host=evil.example'),env)).toBe('https://app.homesuite.info/tareas?card=card-123');expect(migrationTarget(new Request(origin),{TASKING_DESTINATION:'staging'})).toBe('https://staging.homesuite.info/tareas');});
 it('mantiene el favicon como imagen y no como HTML',async()=>{const res=moveResponse(new Request(origin+'/favicon.svg'),env);expect(res.headers.get('Content-Type')).toBe('image/svg+xml');expect(await res.text()).toContain('<svg');});
 it('no reproduce ningún método de API ni devuelve datos del origen',async()=>{for(const method of ['GET','POST','PATCH','PUT','DELETE','OPTIONS']){const res=moveResponse(new Request(origin+'/api/cards',{method}),env);expect(res.status).toBe(410);expect(res.headers.get('Location')).toBeNull();expect((await res.json()).code).toBe('tasking_migrated');}});
 it('limpia callback antes de mostrar el aviso y no filtra credenciales',async()=>{const res=moveResponse(new Request(origin+'/auth/callback?code=privado&state=secreto'),env);expect(res.headers.get('Location')).toBe('/#mudanza');expect(await res.text()).not.toContain('privado');});
 it('no convierte recursos antiguos en una segunda aplicación',async()=>{const js=moveResponse(new Request(origin+'/js/app.js'),env);expect(js.status).toBe(410);const file=moveResponse(new Request(origin+'/uploads/uuid.pdf'),env);expect(file.status).toBe(302);expect(file.headers.get('Location')).toBe('https://app.homesuite.info/tareas/adjuntos/uuid.pdf');const nav=moveResponse(new Request(origin+'/uploads/uuid.pdf',{headers:{'Sec-Fetch-Mode':'navigate'}}),env);expect(nav.status).toBe(200);expect(await nav.text()).toContain('Ir a HomeSuite');});
});

import { evaluarPuenteTasking } from '../../../scripts/homesuite-coherencia.mjs';
it('la comprobación operativa verifica el aviso y detecta una segunda app activa',async()=>{
 expect(await evaluarPuenteTasking('production',(url,opts)=>Promise.resolve(moveResponse(new Request(url,opts),env)))).toEqual([]);
 const failures=await evaluarPuenteTasking('production',()=>Promise.resolve(new Response('<h1>App vieja</h1>')));expect(failures.length).toBeGreaterThan(0);
});
