import { TASKING_FAVICON } from './tasking-favicon.js';
const DESTINATIONS=Object.freeze({production:'https://app.homesuite.info',staging:'https://staging.homesuite.info'});
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CSS=':root{color-scheme:light dark;font-family:system-ui,sans-serif;background:#F1E9FB;color:#291c3f}body{max-width:38rem;margin:10vh auto;padding:1.5rem}main{background:#fff;color:#291c3f;padding:clamp(1.5rem,5vw,3rem);border-radius:1rem;box-shadow:0 1rem 3rem #5B21B622}img{width:4rem;height:4rem}h1{font-size:clamp(2rem,6vw,3rem)}p{line-height:1.65}.button{display:inline-block;background:#5B21B6;color:white;padding:.9rem 1.3rem;border-radius:.6rem;text-decoration:none;font-weight:700}.button:focus-visible{outline:3px solid #d29034;outline-offset:4px}@media(prefers-color-scheme:dark){:root{background:#18111f}main{background:#271e32;color:#f2eafb}}';
function response(body,status=200,type='text/html; charset=utf-8',extra={},head=false){return new Response(head?null:body,{status,headers:{'Content-Type':type,'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",...extra}});}
export function migrationTarget(request,env={}){
  const url=new URL(request.url),base=DESTINATIONS[env.TASKING_DESTINATION||'staging'];
  if(!base)throw new Error('Ambiente de destino inválido.');
  let path='/tareas';
  if(url.pathname==='/releases'||url.pathname==='/releases.html')path='/tareas/novedades';
  if(url.pathname==='/terminos'||url.pathname==='/terminos.html')path='/tareas/terminos-anteriores';
  if(url.pathname.startsWith('/uploads/')){const key=url.pathname.slice(9);if(/^[a-zA-Z0-9_.-]{1,180}$/.test(key))path='/tareas/adjuntos/'+encodeURIComponent(key);}
  const result=new URL(path,base),card=url.searchParams.get('card');
  if(path==='/tareas'&&/^[a-zA-Z0-9_-]{1,160}$/.test(card||''))result.searchParams.set('card',card);
  return result.href;
}
export function moveResponse(request,env={}){
  const url=new URL(request.url),head=request.method==='HEAD';
  const target=migrationTarget(request,env);
  const expired=new Headers();
  for(const name of ['session','oauth_state'])expired.append('Set-Cookie',name+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');
  if(url.pathname==='/auth/callback'){const res=response('',302,'text/plain',{'Location':'/#mudanza'},head);for(const cookie of expired.getSetCookie())res.headers.append('Set-Cookie',cookie);return res;}
  if(url.pathname==='/healthz')return response(JSON.stringify({status:'ok',service:'tasking-move',mode:'moved'}),200,'application/json',{},head);
  if(url.pathname.startsWith('/api/')||!['GET','HEAD'].includes(request.method))return response(JSON.stringify({error:'Fun TasKing se mudó a HomeSuite.',code:'tasking_migrated',destination:new URL('/tareas',target).href}),410,'application/json',{},head);
  if(url.pathname==='/favicon.ico')return response('',302,'text/plain',{'Location':'/favicon.svg'},head);
  if(url.pathname==='/favicon.svg')return response(TASKING_FAVICON,200,'image/svg+xml',{},head);
  if(url.pathname==='/mudanza.css')return response(CSS,200,'text/css',{},head);
  if(/\.(?:js|css|map)$/.test(url.pathname))return response('Recurso retirado: Fun TasKing se mudó a HomeSuite.',410,url.pathname.endsWith('.js')?'text/javascript':'text/plain',{},head);
  if(url.pathname.startsWith('/uploads/')&&request.headers.get('Sec-Fetch-Mode')!=='navigate'&&!request.headers.get('Accept')?.includes('text/html'))return response('',302,'text/plain',{'Location':target},head);
  const content='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nos mudamos · Fun TasKing</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/mudanza.css"></head><body><main><img src="/favicon.svg" alt=""><h1>¡Nos mudamos!</h1><p>Fun TasKing ahora vive en HomeSuite.</p><p>Entrá con la misma cuenta de Google que usabas acá. En Tareas vas a encontrar tu tablero personal y los tableros que compartís.</p><p>Si tenés cualquier consulta, contactame.</p><p><strong>Pablitux</strong></p><a class="button" href="'+escape(target)+'">Ir a HomeSuite</a></main></body></html>';
  const res=response(content,200,'text/html; charset=utf-8',{},head);for(const cookie of expired.getSetCookie())res.headers.append('Set-Cookie',cookie);return res;
}
export default {fetch(request,env){const result=moveResponse(request,env);console.log(JSON.stringify({event:'tasking_move',method:request.method,status:result.status,environment:env.TASKING_DESTINATION||'staging',version:'tasking-move-v1',route:new URL(request.url).pathname.startsWith('/api/')?'api':new URL(request.url).pathname==='/auth/callback'?'oauth':new URL(request.url).pathname.startsWith('/uploads/')?'attachment':'navigation'}));return result;}};
