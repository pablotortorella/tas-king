import { env } from 'cloudflare:workers';
import { applyD1Migrations } from 'cloudflare:test';
import { describe,it,expect,beforeEach } from 'vitest';
import { extractTransfer,loadTransfer,verifyTransfer,activateTransfer,TABLES } from '../src/tasking/transfer.js';
import { resolveIdentity,ensurePersonalBoard } from '../src/tasking/db/helpers.js';
import { upsertGoogleUser } from '../src/users.js';

async function reset(){
 await env.TASKING_BUCKET.delete('transfer-file.txt');
 await env.LEGACY_TASKING_DB.prepare("UPDATE tasking_origin_control SET phase='live'").run();
 for(const stmt of env.TEST_LEGACY_SEED.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await env.LEGACY_TASKING_DB.prepare(stmt).run();
 await env.DB.prepare("UPDATE tasking_transfer_state SET phase='pending',batch_id=NULL,manifest_hash=NULL").run();
 await env.DB.batch([...TABLES.slice().reverse().map(t=>env.DB.prepare('DELETE FROM tasking_'+t)),env.DB.prepare('DELETE FROM tasking_transfer_objects'),env.DB.prepare('DELETE FROM tasking_transfer_batches')]);
 await env.SOURCE_TASKING_BUCKET.put('transfer-file.txt','contenido de ejemplo',{httpMetadata:{contentType:'text/plain'}});
 await env.LEGACY_TASKING_DB.prepare("INSERT INTO attachments(id,card_id,stored_name,original_name,mime,size,created_at) VALUES('att-transfer','card-seed','transfer-file.txt','ejemplo.txt','text/plain',20,1)").run();
 for(const stmt of "\nINSERT INTO board_members(board_id,email,role,created_at) VALUES('board-e2e','invitada@gmail.com','member',1);\nINSERT INTO comments(id,card_id,text,author_email,created_at) VALUES('comment-transfer','card-seed','Comentario previo','invitada@gmail.com',1);\nINSERT INTO checklists(id,card_id,name,created_at) VALUES('check-transfer','card-seed','Lista previa',1);\nINSERT INTO checklist_items(id,checklist_id,text,position,checked,created_at) VALUES('item-transfer','check-transfer','Hecho',0,1,1);\nINSERT INTO goals(id,board_id,title,created_at) VALUES('goal-transfer','board-e2e','Objetivo previo',1);\nINSERT INTO card_goals(card_id,goal_id) VALUES('card-seed','goal-transfer');\nINSERT INTO card_labels(card_id,label_id) VALUES('card-seed','label-seed');\nINSERT INTO audit_log(id,board_id,card_id,action,email,ts,details) VALUES('audit-transfer','board-e2e','card-seed','card_created','invitada@gmail.com',1,'{}');\n".split(';').map(s=>s.trim()).filter(Boolean))await env.LEGACY_TASKING_DB.prepare(stmt).run();
 await env.LEGACY_TASKING_DB.prepare("UPDATE tasking_origin_control SET phase='frozen'").run();
}
beforeEach(reset);
describe('traslado íntegro y reanudable',()=>{
 it('copia filas y bytes, reintenta y habilita sólo después de conciliar',async()=>{
  for(const stmt of env.TEST_FINANCIAL_SEED.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await env.DB.prepare(stmt).run();
  const finances=await env.DB.prepare('SELECT * FROM ledger_entries ORDER BY id').all();
  expect(finances.results.length).toBeGreaterThan(0);
  const snapshot=await extractTransfer(env.LEGACY_TASKING_DB,env.SOURCE_TASKING_BUCKET,{environment:'test'});
  expect(snapshot.rows.identities).toHaveLength(2);
  for(const table of TABLES)expect(snapshot.rows[table].length,table).toBeGreaterThan(0);
  await loadTransfer(env.DB,env.TASKING_BUCKET,env.SOURCE_TASKING_BUCKET,snapshot);
  expect((await env.DB.prepare('SELECT phase FROM tasking_transfer_state').first()).phase).toBe('ready');
  await loadTransfer(env.DB,env.TASKING_BUCKET,env.SOURCE_TASKING_BUCKET,snapshot);
  expect(await verifyTransfer(env.DB,env.TASKING_BUCKET,snapshot)).toMatchObject({files:1});
  expect(await env.DB.prepare('SELECT * FROM ledger_entries ORDER BY id').all()).toMatchObject({results:finances.results});
  await activateTransfer(env.DB,env.TASKING_BUCKET,snapshot);
  const user=await upsertGoogleUser(env.DB,{sub:crypto.randomUUID(),email:'e2e-admin@test.local',name:'Perfil HomeSuite',emailAuthority:true});
  const actor=await resolveIdentity(env.DB,user.id);expect(actor.legacy_user_id).toBe('user-e2e');
  expect((await ensurePersonalBoard(env.DB,actor.identity_id)).id).toBe('board-e2e');
  expect(await (await env.TASKING_BUCKET.get('transfer-file.txt')).text()).toBe('contenido de ejemplo');
 });
 it('bloquea corrupción y mantiene oculto un lote incompleto',async()=>{
  const snapshot=await extractTransfer(env.LEGACY_TASKING_DB,env.SOURCE_TASKING_BUCKET,{environment:'test'});
  await env.SOURCE_TASKING_BUCKET.delete('transfer-file.txt');
  await expect(loadTransfer(env.DB,env.TASKING_BUCKET,env.SOURCE_TASKING_BUCKET,snapshot)).rejects.toThrow('Archivo ausente');
  expect((await env.DB.prepare('SELECT phase FROM tasking_transfer_state').first()).phase).toBe('loading');
  await env.SOURCE_TASKING_BUCKET.put('transfer-file.txt','contenido de ejemplo');
  await loadTransfer(env.DB,env.TASKING_BUCKET,env.SOURCE_TASKING_BUCKET,snapshot);
  await env.TASKING_BUCKET.put('transfer-file.txt','corrupto');
  await expect(activateTransfer(env.DB,env.TASKING_BUCKET,snapshot)).rejects.toThrow('Archivo de destino inválido');
 });
 it('el cerrojo persiste ante código antiguo y permite abortar antes de escrituras nuevas',async()=>{
  await expect(env.LEGACY_TASKING_DB.prepare("UPDATE cards SET title='escritura vieja' WHERE id='card-seed'").run()).rejects.toThrow('read-only');
  await env.LEGACY_TASKING_DB.prepare("UPDATE tasking_origin_control SET phase='live'").run();
  await env.LEGACY_TASKING_DB.prepare("UPDATE cards SET title='aborto seguro' WHERE id='card-seed'").run();
  expect((await env.LEGACY_TASKING_DB.prepare("SELECT title FROM cards WHERE id='card-seed'").first()).title).toBe('aborto seguro');
 });
});
it('reanuda una fila idéntica guardada antes del journal y recupera una invitada posterior',async()=>{
 const snapshot=await extractTransfer(env.LEGACY_TASKING_DB,env.SOURCE_TASKING_BUCKET,{environment:'test'}),row=snapshot.rows.identities[0],fields=Object.keys(row);
 await env.DB.prepare('INSERT INTO tasking_identities('+fields.join(',')+') VALUES('+fields.map(()=>'?').join(',')+')').bind(...fields.map(f=>row[f])).run();
 await loadTransfer(env.DB,env.TASKING_BUCKET,env.SOURCE_TASKING_BUCKET,snapshot);await activateTransfer(env.DB,env.TASKING_BUCKET,snapshot);
 const invited=await upsertGoogleUser(env.DB,{sub:crypto.randomUUID(),email:'invitada@gmail.com',name:'Invitada HomeSuite'}),actor=await resolveIdentity(env.DB,invited.id);
 expect((await env.DB.prepare('SELECT role FROM tasking_board_members WHERE board_id=? AND identity_id=?').bind('board-e2e',actor.identity_id).first()).role).toBe('member');
 const personal=await ensurePersonalBoard(env.DB,actor.identity_id);expect(personal.id).not.toBe('board-e2e');
 expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM tasking_transfer_objects WHERE table_name=?').bind('identities').first()).n).toBe(2);
});
