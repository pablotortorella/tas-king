import { TASKING_HISTORY } from './history.js';
import { page } from '../route-kit.js';
import { Hono } from 'hono';
import { signedInUser, sessionSecret } from '../route-kit.js';
import { ensureLocalUser } from '../groups.js';
import { inspectCsrfRequest, createCsrfToken } from '../csrf.js';
import { checkRateLimit } from '../rate-limit.js';
import { ensurePersonalBoard, resolveIdentity, TaskingError } from './db/helpers.js';
import { TASKING_DOCUMENT } from './document.js';
import { setupBoardRoutes } from './routes/boards.js';
import { setupCardRoutes } from './routes/cards.js';
import { setupColumnRoutes } from './routes/columns.js';
import { setupChecklistRoutes } from './routes/checklists.js';
import { setupGoalRoutes } from './routes/goals.js';
import { setupLabelRoutes } from './routes/labels.js';
import { setupMetricsRoutes } from './routes/metrics.js';
import { setupUserRoutes } from './routes/users.js';
import { setupAdminRoutes } from './routes/admin.js';
import { setupUploadRoutes } from './routes/uploads.js';

export const TASKING_JSON_LIMIT=2*1024*1024+16*1024;
export const TASKING_UPLOAD_LIMIT=200*1024*1024+64*1024;
export function taskingBodyLimit(path){
  if(/^\/api\/tareas\/cards\/[^/]+\/attachments$/.test(path)) return TASKING_UPLOAD_LIMIT;
  return path.endsWith('/import')?TASKING_JSON_LIMIT:16*1024;
}
export async function readBounded(request,limit){
  if(Number(request.headers.get('Content-Length'))>limit)throw new TaskingError('La solicitud es demasiado grande.',413);
  const reader=request.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new TaskingError('La solicitud es demasiado grande.',413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function taskingActive(db){return (await db.prepare('SELECT phase FROM tasking_transfer_state WHERE id=1').first())?.phase==='active';}
async function sessionFor(c){
  const session=await signedInUser(c);if(session)return session;
  const host=new URL(c.req.url).hostname;
  if((host==='localhost'||host==='127.0.0.1')&&c.env.DEV_LOCAL_MODE==='true'){
    const email=c.req.header('X-HomeSuite-Dev-Email')||c.env.DEV_LOCAL_EMAIL;
    if(email){const user=await ensureLocalUser(c.env.DB,email);return {user_id:user.id,email:user.email,id:'local',local:true};}
  }
  return null;
}
const login=c=>c.redirect('/auth/google?returnTo='+encodeURIComponent(new URL(c.req.url).pathname+new URL(c.req.url).search),303);
export function registerTaskingRoutes(app){
  const router=new Hono();
  router.onError((error,c)=>{if(error instanceof TaskingError)return c.json({error:error.message,code:error.code},error.status);console.error('[tasking]',JSON.stringify({event:'request_failed',name:error.name}));return c.json({error:'No pudimos completar la operación.'},500);});
  async function protect(c,next){
    c.header('Cache-Control','private, no-store');
    const session=await sessionFor(c);
    if(!session)return c.req.path.startsWith('/api/')?c.json({error:'Iniciá sesión con HomeSuite.'},401):login(c);
    if(!await taskingActive(c.env.DB))return c.json({error:'Estamos preparando el traslado. Volvé en un momento.',code:'tasking_pending'},503);
    if(!['GET','HEAD','OPTIONS'].includes(c.req.method)){
      if(!session.local){
        if(!c.req.header('X-CSRF-Token'))return c.json({error:'Solicitud no verificada.'},403);
        if(!(await inspectCsrfRequest(c.req.raw,{sessionId:session.id,secret:sessionSecret(c.env)})).valid)return c.json({error:'Solicitud no verificada.'},403);
      }
      const limit=await checkRateLimit(c.env.MUTATION_RATE_LIMITER,session.id);
      if(c.env.REQUIRE_RATE_LIMITS==='true'&&!limit.configured)return c.json({error:'Protección temporalmente no disponible.'},503);
      if(!limit.allowed){c.header('Retry-After','60');return c.json({error:'Demasiadas solicitudes.'},429);}
      if(!c.req.path.endsWith('/attachments')||c.req.method!=='POST'){
        const bytes=await readBounded(c.req.raw,taskingBodyLimit(c.req.path));
        if(bytes.length===0){c.req.json=async()=>({});}else{
          if(!(c.req.header('Content-Type')||'').startsWith('application/json'))return c.json({error:'Se requiere JSON.'},415);
          let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{return c.json({error:'JSON inválido.'},400);}
          c.req.json=async()=>body;
        }
      }
    }
    const actor=await resolveIdentity(c.env.DB,session.user_id);
    c.set('identity_id',actor.identity_id);c.set('taskingSession',session);
    if(c.req.path==='/api/tareas/me')await ensurePersonalBoard(c.env.DB,actor.identity_id);
    await next();
  }
  router.use('/api/tareas/*',protect);
  router.use('/tareas/adjuntos/*',protect);
  router.get('/tareas',async c=>{
    if(!await sessionFor(c))return login(c);
    if(!await taskingActive(c.env.DB))return c.html('<!doctype html><html lang="es"><meta charset="utf-8"><title>Fun TasKing</title><h1>Estamos preparando el traslado.</h1><p>Podés seguir usando <a href="'+(new URL(c.req.url).hostname==='app.homesuite.info'?'https://tas-king.pablotortorella.workers.dev':'https://tas-king-staging.pablotortorella.workers.dev')+'">Fun TasKing</a>.</p></html>',503);
    const session=await sessionFor(c);const actor=await resolveIdentity(c.env.DB,session.user_id);await ensurePersonalBoard(c.env.DB,actor.identity_id);
    c.header('Cache-Control','private, no-store');return c.html(TASKING_DOCUMENT);
  });
  router.get('/tareas/salir',async c=>{
    const session=await signedInUser(c);if(!session)return c.redirect('/',303);
    const token=await createCsrfToken({sessionId:session.id,secret:sessionSecret(c.env)});
    c.header('Cache-Control','private, no-store');
    return c.html(page('Salir de HomeSuite','<h1>Salir de HomeSuite</h1><form method="post" action="/auth/logout"><input type="hidden" name="_csrf" value="'+token+'"><button type="submit">Salir</button></form><p><a href="/tareas">Volver a TasKing</a></p>',{favicon:'/tareas/favicon.v1.svg'}));
  });
  router.get('/tareas/:history', c => {
    const content=TASKING_HISTORY[c.req.param('history')];
    if(!content)return c.notFound();
    return c.html(page('Archivo de Fun TasKing','<p>Archivo histórico de Fun TasKing. <a href="https://homesuite.info/terminos">Ver los términos vigentes de HomeSuite</a>.</p>'+content,{favicon:'/tareas/favicon.v1.svg'}));
  });
  setupUserRoutes(router);setupBoardRoutes(router);setupCardRoutes(router);setupColumnRoutes(router);setupChecklistRoutes(router);setupGoalRoutes(router);setupLabelRoutes(router);setupMetricsRoutes(router);setupUploadRoutes(router);setupAdminRoutes(router);
  app.route('/',router);
}
