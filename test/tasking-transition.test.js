import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { describe,it,expect } from 'vitest';
import { taskingTransition } from '../src/tasking-transition.js';
const context={...env,TASKING_TRANSITION_CONTROL:'true',TASKING_DESTINATION:'staging'};
const live=()=>env.DB.prepare("UPDATE tasking_origin_control SET phase='live' WHERE id=1").run();
describe('origen durante el corte',()=>{
 it('sin activar el control no consulta ni cambia el recorrido actual',async()=>{const app=new Hono();app.use('*',taskingTransition);app.get('/',c=>c.text('app actual'));expect(await(await app.request('https://old.example/',{},{})).text()).toBe('app actual');});
 it('drena una petición admitida y bloquea las nuevas antes del snapshot',async()=>{
  await live();let admitted;const started=new Promise(resolve=>{admitted=resolve;});let release;const gate=new Promise(resolve=>{release=resolve;});const app=new Hono();app.use('*',taskingTransition);app.get('/auth/callback',async c=>{admitted();await gate;return c.text('operación admitida');});app.post('/api/cards',c=>c.text('no debería ocurrir'));
  const inFlight=app.request('https://old.example/auth/callback',{},context);await started;
  expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM tasking_origin_leases').first()).n).toBe(1);
  await env.DB.prepare("UPDATE tasking_origin_control SET phase='draining'").run();const denied=await app.request('https://old.example/api/cards',{method:'POST'},context);expect(denied.status).toBe(503);expect((await denied.json()).code).toBe('tasking_maintenance');release();expect((await inFlight).status).toBe(200);expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM tasking_origin_leases').first()).n).toBe(0);await live();
 });
 it('congelado no ejecuta handlers de GET, archivos, OAuth ni mutaciones',async()=>{
  await env.DB.prepare("UPDATE tasking_origin_control SET phase='frozen'").run();let called=0;const app=new Hono();app.use('*',taskingTransition);app.all('*',c=>{called++;return c.text('negocio');});
  for(const [path,method,status] of [['/','GET',200],['/api/me','GET',410],['/api/cards','POST',410],['/auth/callback?code=privado','GET',302],['/uploads/file.txt','GET',302]])expect((await app.request('https://old.example'+path,{method},context)).status).toBe(status);
  expect(called).toBe(0);await live();
 });
});
