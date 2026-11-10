import { env } from 'cloudflare:workers';
import { describe,it,expect } from 'vitest';
import { app } from '../src/index.js';
import { upsertGoogleUser } from '../src/users.js';
import { createSession } from '../src/sessions.js';
import { createCsrfToken } from '../src/csrf.js';
import { identityIdForEmail } from '../src/tasking/db/helpers.js';

const ORIGIN='https://staging.homesuite.info',SECRET='t'.repeat(32);
async function person(){const n=crypto.randomUUID();const user=await upsertGoogleUser(env.DB,{sub:n,email:n+'@gmail.com',name:'Persona '+n});const session=await createSession(env.DB,{userId:user.id,secret:SECRET});return {...user,cookie:'__Host-homesuite_session='+encodeURIComponent(session.token),csrf:await createCsrfToken({sessionId:session.id,secret:SECRET})};}
async function active(){await env.DB.prepare("UPDATE tasking_transfer_state SET phase='active' WHERE id=1").run();}
function req(user,path,method='GET',body,headers={}){return app.request(ORIGIN+path,{method,headers:{...(user?{Cookie:user.cookie}:{}),...(method!=='GET'?{Origin:ORIGIN,'X-CSRF-Token':user?.csrf,'Content-Type':'application/json'}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})},{...env,SESSION_SECRET:SECRET});}

describe('TasKing integrado, migración y aislamiento',()=>{
 it('bloquea el destino pendiente y conserva retorno seguro con tarjeta',async()=>{const u=await person();await env.DB.prepare("UPDATE tasking_transfer_state SET phase='pending'").run();expect((await req(u,'/api/tareas/me')).status).toBe(503);const guest=await req(null,'/tareas?card=abc');expect(guest.status).toBe(303);expect(guest.headers.get('Location')).toContain('%3Fcard%3Dabc');});
 it('aprovisiona un solo personal en accesos concurrentes sin grupos ni allowlist',async()=>{await active();const u=await person();const responses=await Promise.all([req(u,'/api/tareas/me'),req(u,'/api/tareas/me')]);expect(responses.map(r=>r.status)).toEqual([200,200]);const [a,b]=await Promise.all(responses.map(r=>r.json()));expect(a.boards).toHaveLength(1);expect(b.boards[0].id).toBe(a.boards[0].id);expect(a.profile.name).toBe(u.display_name);expect(a.csrfToken).toBeTruthy();expect((await req(u,'/api/me')).status).toBe(200);expect((await req(u,'/api/me')).headers.get('Cache-Control')).toContain('no-store');});
 it('recupera el personal importado incluso si HomeSuite se crea después',async()=>{await active();const email=crypto.randomUUID()+'@gmail.com',actor=await identityIdForEmail(email),board=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO tasking_identities(identity_id,legacy_email,name,created_at) VALUES(?,?,?,?)').bind(actor,email,'Nombre previo',1),env.DB.prepare("INSERT INTO tasking_boards(id,name,owner_identity_id,is_personal,created_at) VALUES(?,'Personal previo',?,1,1)").bind(board,actor),env.DB.prepare("INSERT INTO tasking_board_members(board_id,identity_id,role,created_at) VALUES(?,?,'owner',1)").bind(board,actor)]);const user=await upsertGoogleUser(env.DB,{sub:crypto.randomUUID(),email,name:'Nombre común'});const session=await createSession(env.DB,{userId:user.id,secret:SECRET});const result=await req({...user,cookie:'__Host-homesuite_session='+encodeURIComponent(session.token)},'/api/tareas/me');expect(result.status).toBe(200);const data=await result.json();expect(data.boards).toHaveLength(1);expect(data.boards[0].id).toBe(board);expect(data.profile.name).toBe('Nombre común');});
 it('conserva colaboración de tablero y revoca sin cerrar sesión HomeSuite',async()=>{await active();const owner=await person(),member=await person(),stranger=await person();const me=await (await req(owner,'/api/tareas/me')).json();const board=me.boards[0].id;
 expect((await req(owner,`/api/tareas/boards/${board}/members`,'POST',{email:member.email})).status).toBe(200);
 const invited=await (await req(member,'/api/tareas/me')).json();expect(invited.boards.some(b=>b.id===board)).toBe(true);
 expect((await req(member,`/api/tareas/boards/${board}/cards`,'POST',{title:'Tarjeta',column:'pendiente'})).status).toBe(200);
 expect((await req(stranger,`/api/tareas/boards/${board}/cards`)).status).toBe(403);
 expect((await req(member,`/api/tareas/boards/${board}`,'DELETE',{})).status).toBe(403);
 expect((await req(owner,`/api/tareas/boards/${board}/members/${invited.identity_id}`,'DELETE',{})).status).toBe(200);
 expect((await req(member,`/api/tareas/boards/${board}/cards`)).status).toBe(403);expect((await req(member,'/api/me')).status).toBe(200);
 });
 it('rechaza CSRF y asignación de otra persona ajena al tablero',async()=>{await active();const u=await person();const me=await (await req(u,'/api/tareas/me')).json();const path=`/api/tareas/boards/${me.boards[0].id}/cards`;
 expect((await req(u,path,'POST',{title:'No',column:'pendiente'},{'X-CSRF-Token':''})).status).toBe(403);
 expect((await req(u,path,'POST',{title:'No',column:'pendiente',assignee:'otra-identidad'})).status).toBe(400);
 });
});

describe('continuidad de identidad y seguridad de archivos',()=>{
 it('mantiene los tableros después de cambiar el email de la misma identidad Google',async()=>{
  await active();const u=await person();const before=await (await req(u,'/api/tareas/me')).json();
  const row=await env.DB.prepare('SELECT google_sub FROM users WHERE id=?').bind(u.id).first();
  await upsertGoogleUser(env.DB,{sub:row.google_sub,email:crypto.randomUUID()+'@gmail.com',name:'Nombre actualizado'});
  const after=await (await req(u,'/api/tareas/me')).json();expect(after.identity_id).toBe(before.identity_id);expect(after.boards[0].id).toBe(before.boards[0].id);expect(after.profile.name).toBe('Nombre actualizado');
 });
 it('una cookie heredada no sustituye a la sesión HomeSuite',async()=>{
  const response=await app.request(ORIGIN+'/api/tareas/me',{headers:{Cookie:'session=sesion-vieja'}},{...env,SESSION_SECRET:SECRET});expect(response.status).toBe(401);
 });
 it('descarga archivos sólo con permiso vigente y rechaza la sesión revocada',async()=>{
  await active();const u=await person(),other=await person();const me=await (await req(u,'/api/tareas/me')).json();const board=me.boards[0].id;
  const card=await (await req(u,`/api/tareas/boards/${board}/cards`,'POST',{title:'Adjuntos',column:'pendiente'})).json();
  const form=new FormData();form.append('files',new File(['contenido'],'texto.txt',{type:'text/plain'}));
  const response=await app.request(ORIGIN+`/api/tareas/cards/${card.id}/attachments`,{method:'POST',headers:{Cookie:u.cookie,Origin:ORIGIN,'X-CSRF-Token':u.csrf},body:form},{...env,SESSION_SECRET:SECRET});expect(response.status).toBe(200);
  const url=(await response.json()).attachments[0].url;const own=await req(u,url);expect(own.status).toBe(200);expect(await own.text()).toBe('contenido');expect(own.headers.get('Cache-Control')).toBe('private, no-store');expect(own.headers.get('Content-Disposition')).toContain('attachment');expect((await req(other,url)).status).toBe(404);
  await env.DB.prepare('UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(u.id).run();expect((await req(u,url)).status).toBe(303);
 });
});

it('conserva una lectura consistente del tablero sin consultas por cada entidad',async()=>{
 await active();const u=await person();const me=await (await req(u,'/api/tareas/me')).json();
 const calls=[];const originals=new WeakMap();
 function statement(native){const proxy=new Proxy(native,{get(target,name){if(name==='bind')return(...args)=>statement(target.bind(...args));if(['all','first','run','raw'].includes(name))return(...args)=>{calls.push({kind:name});return target[name](...args);};return target[name];}});originals.set(proxy,native);return proxy;}
 const db={prepare:sql=>statement(env.DB.prepare(sql)),batch:statements=>{calls.push({kind:'batch',statements:statements.length});return env.DB.batch(statements.map(s=>originals.get(s)||s));}};
 const res=await app.request(ORIGIN+`/api/tareas/boards/${me.boards[0].id}/cards`,{headers:{Cookie:u.cookie}},{...env,DB:db,SESSION_SECRET:SECRET});
 expect(res.status).toBe(200);expect(calls.length).toBeLessThanOrEqual(6);expect(calls.find(c=>c.kind==='batch')?.statements).toBe(9);
});

it('no reclama por email una cuenta externa que Google no acredita como autoridad',async()=>{
 await active();const email=crypto.randomUUID()+'@externo.example',id=await identityIdForEmail(email);
 await env.DB.prepare('INSERT INTO tasking_identities(identity_id,legacy_email,name,created_at) VALUES(?,?,?,1)').bind(id,email,'Pendiente').run();
 const user=await upsertGoogleUser(env.DB,{sub:crypto.randomUUID(),email,name:'Cuenta externa',emailAuthority:false});
 const session=await createSession(env.DB,{userId:user.id,secret:SECRET});
 const response=await req({cookie:'__Host-homesuite_session='+encodeURIComponent(session.token)},'/api/tareas/me');expect(response.status).toBe(409);expect((await response.json()).error).toContain('Pablitux');expect((await env.DB.prepare('SELECT user_id FROM tasking_identities WHERE identity_id=?').bind(id).first()).user_id).toBeNull();
});
it('el formulario de salida de TasKing revoca la sesión HomeSuite real',async()=>{
 const u=await person();const response=await req(u,'/tareas/salir');expect(response.status).toBe(200);const html=await response.text();const token=html.match(/name="_csrf" value="([^"]+)"/)[1];
 const result=await app.request(ORIGIN+'/auth/logout',{method:'POST',headers:{Cookie:u.cookie,Origin:ORIGIN,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({_csrf:token})},{...env,SESSION_SECRET:SECRET});expect(result.status).toBe(303);expect((await req(u,'/api/me')).status).toBe(401);
});
it('limita el JSON real sin Content-Length y no amplía endpoints comunes',async()=>{
 await active();const u=await person();const me=await(await req(u,'/api/tareas/me')).json();
 const large='x'.repeat(17*1024);const result=await req(u,`/api/tareas/boards/${me.boards[0].id}/cards`,'POST',{title:large,column:'pendiente'});expect(result.status).toBe(413);
 expect((await req(u,'/api/me')).status).toBe(200);
});
it('admite el límite heredado de 20 MiB y limpia una subida parcial que luego excede el límite',async()=>{
 await active();const u=await person();const me=await(await req(u,'/api/tareas/me')).json();
 const card=await(await req(u,`/api/tareas/boards/${me.boards[0].id}/cards`,'POST',{title:'Límite de archivo',column:'pendiente'})).json();
 const upload=body=>app.request(ORIGIN+`/api/tareas/cards/${card.id}/attachments`,{method:'POST',headers:{Cookie:u.cookie,Origin:ORIGIN,'X-CSRF-Token':u.csrf},body},{...env,SESSION_SECRET:SECRET});
 const form=new FormData();form.append('files',new File([new Uint8Array(20*1024*1024)],'limite.txt',{type:'text/plain'}));
 const result=await upload(form);expect(result.status).toBe(200);expect((await result.json()).attachments[0].size).toBe(20*1024*1024);
 const before=(await env.TASKING_BUCKET.list()).objects.map(o=>o.key).sort();
 const invalid=new FormData();invalid.append('files',new File(['primero'],'primero.txt',{type:'text/plain'}));invalid.append('files',new File([new Uint8Array(20*1024*1024+1)],'demasiado.txt',{type:'text/plain'}));
 expect((await upload(invalid)).status).toBe(413);expect((await env.TASKING_BUCKET.list()).objects.map(o=>o.key).sort()).toEqual(before);
 expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM tasking_attachments WHERE card_id=?').bind(card.id).first()).n).toBe(1);
});
