import { identityIdForEmail, normalizeEmail, TaskingError } from './db/helpers.js';
export const TABLES=['identities','boards','board_members','columns','cards','comments','attachments','labels','card_labels','checklists','checklist_items','goals','card_goals','audit_log'];
const COMPOSITE={board_members:['board_id','identity_id'],columns:['board_id','id'],card_labels:['card_id','label_id'],card_goals:['card_id','goal_id'],identities:['identity_id']};
export const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export async function hash(value){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
const key=(table,row)=>canonical((COMPOSITE[table]||['id']).map(k=>row[k]));
const bad=message=>{throw new TaskingError(message,409,'tasking_transfer_conflict');};
export async function extractTransfer(source,bucket,{batchId=crypto.randomUUID(),environment}={}){
  if(!['staging','production','test'].includes(environment))bad('Ambiente de extracción explícito requerido.');
  const control=await source.prepare('SELECT phase FROM tasking_origin_control WHERE id=1').first();
  if(!['frozen','moved'].includes(control?.phase))bad('Bloquear y drenar el origen antes de extraer.');
  const raw={};for(const name of ['users',...TABLES.slice(1)])raw[name]=(await source.prepare('SELECT * FROM '+name).all()).results;
  const actors=new Map();
  async function actor(email,user){if(!email)return null;const normalized=normalizeEmail(email);if(user&&actors.has(normalized)&&actors.get(normalized).legacy_user_id!==user.id)bad('Emails heredados ambiguos.');if(!actors.has(normalized))actors.set(normalized,{identity_id:await identityIdForEmail(normalized),legacy_email:normalized,legacy_user_id:user?.id??null,user_id:null,verified_sub:null,name:user?.name||normalized.split('@')[0],avatar_emoji:user?.avatar_emoji??null,avatar_color:user?.avatar_color??null,is_admin:user?.is_admin?1:0,tip_index:user?.tip_index??null,tip_date:user?.tip_date??null,created_at:user?.created_at??0});return actors.get(normalized).identity_id;}
  for(const user of raw.users)await actor(user.email,user);
  const rows={};
  for(const name of TABLES.slice(1)){rows[name]=[];for(const sourceRow of raw[name]){const row={};for(const [column,value] of Object.entries(sourceRow)){if(column==='email'||column.endsWith('_email'))row[column==='email'?'identity_id':column.replace(/_email$/,'_identity_id')]=await actor(value);else row[column]=value;}rows[name].push(row);}}
  rows.identities=Array.from(actors.values());
  for(const name of TABLES)rows[name].sort((a,b)=>key(name,a).localeCompare(key(name,b)));
  validateRelations(rows);
  const files=[];
  for(const attachment of rows.attachments){const object=await bucket.get(attachment.stored_name);if(!object)bad('Falta un archivo del origen.');const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==attachment.size)bad('Tamaño de archivo diferente.');files.push({key:attachment.stored_name,size:bytes.length,mime:attachment.mime,hash:await hash(bytes)});}
  const data={version:1,batchId,environment,rows,files};return {...data,manifestHash:await hash(canonical(data))};
}
export function validateRelations(rows){
  for(const name of TABLES)if(!Array.isArray(rows[name]))bad('Manifiesto incompleto: '+name);
  if(new Set(rows.attachments.map(a=>a.stored_name)).size!==rows.attachments.length)bad('Claves de adjunto duplicadas.');
  const maps=Object.fromEntries(TABLES.map(name=>[name,new Map(rows[name].map(row=>[key(name,row),row]))]));
  for(const name of TABLES)if(maps[name].size!==rows[name].length)bad('Identificadores duplicados: '+name);
  const ids=name=>new Set(rows[name].map(r=>name==='identities'?r.identity_id:r.id));
  const actors=ids('identities'),boards=ids('boards'),cards=new Map(rows.cards.map(r=>[r.id,r])),labels=new Map(rows.labels.map(r=>[r.id,r])),goals=new Map(rows.goals.map(r=>[r.id,r])),checks=ids('checklists'),personals=new Set();
  for(const b of rows.boards){if(!actors.has(b.owner_identity_id))bad('Titular ausente.');if(b.is_personal){if(personals.has(b.owner_identity_id))bad('Personal duplicado.');personals.add(b.owner_identity_id);}const owners=rows.board_members.filter(m=>m.board_id===b.id&&m.role==='owner');if(owners.length!==1||owners[0].identity_id!==b.owner_identity_id)bad('Titularidad inconsistente.');}
  for(const m of rows.board_members)if(!boards.has(m.board_id)||!actors.has(m.identity_id)||!['owner','member'].includes(m.role))bad('Membresía inconsistente.');
  for(const col of rows.columns)if(!boards.has(col.board_id))bad('Columna sin tablero.');
  for(const c of rows.cards)if(!boards.has(c.board_id)||!maps.columns.has(canonical([c.board_id,c.column_id]))||(c.assignee_identity_id&&!actors.has(c.assignee_identity_id)))bad('Tarjeta inconsistente.');
  for(const name of ['comments','attachments','checklists'])for(const row of rows[name])if(!cards.has(row.card_id))bad('Recurso sin tarjeta: '+name);
  for(const c of rows.comments)if(c.author_identity_id&&!actors.has(c.author_identity_id))bad('Autoría ausente.');
  for(const i of rows.checklist_items)if(!checks.has(i.checklist_id))bad('Ítem sin checklist.');
  for(const name of ['labels','goals'])for(const row of rows[name])if(!boards.has(row.board_id))bad('Recurso sin tablero.');
  for(const row of rows.card_labels)if(!cards.has(row.card_id)||cards.get(row.card_id).board_id!==labels.get(row.label_id)?.board_id)bad('Etiqueta de otro tablero.');
  for(const row of rows.card_goals)if(!cards.has(row.card_id)||cards.get(row.card_id).board_id!==goals.get(row.goal_id)?.board_id)bad('Objetivo de otro tablero.');
}
async function inspectSnapshot(snapshot){const {manifestHash,...data}=snapshot;if(snapshot.version!==1||manifestHash!==await hash(canonical(data)))bad('Manifiesto alterado o versión inválida.');validateRelations(snapshot.rows);}
export async function loadTransfer(db,targetBucket,sourceBucket,snapshot){
  await inspectSnapshot(snapshot);
  const state=await db.prepare('SELECT * FROM tasking_transfer_state WHERE id=1').first();
  if(state.phase==='active'){if(state.manifest_hash===snapshot.manifestHash)return;bad('El destino ya recibe escrituras.');}
  if(state.batch_id&&state.batch_id!==snapshot.batchId)bad('Hay otro lote de traslado en curso.');
  const batch=await db.prepare('SELECT manifest_hash FROM tasking_transfer_batches WHERE id=?').bind(snapshot.batchId).first();
  if(batch&&batch.manifest_hash!==snapshot.manifestHash)bad('El lote tiene contenido diferente.');
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO tasking_transfer_batches(id,manifest_hash,status) VALUES(?,?,'loading')").bind(snapshot.batchId,snapshot.manifestHash),
    db.prepare("UPDATE tasking_transfer_state SET phase='loading',batch_id=?,manifest_hash=? WHERE id=1").bind(snapshot.batchId,snapshot.manifestHash),
  ]);
  const journal=(await db.prepare('SELECT table_name,entity_key,content_hash FROM tasking_transfer_objects WHERE batch_id=?').bind(snapshot.batchId).all()).results;
  const loadedObjects=new Map(journal.map(r=>[r.table_name+':'+r.entity_key,r.content_hash]));
  for(const table of TABLES){
    const allowed=new Set((await db.prepare('PRAGMA table_info(tasking_'+table+')').all()).results.map(c=>c.name));
    const existingRows=new Map((await db.prepare('SELECT * FROM tasking_'+table).all()).results.map(row=>[key(table,row),row]));
    const statements=[];
    for(const row of snapshot.rows[table]){
      const rowHash=await hash(canonical(row)),entityKey=key(table,row),loaded=loadedObjects.get(table+':'+entityKey);
      if(loaded){if(loaded!==rowHash)bad('Una entidad cambió al reintentar.');continue;}
      const fields=Object.keys(row);if(fields.some(f=>!allowed.has(f)))bad('Columna no soportada en '+table);
      // An interrupted CLI SQL file can leave a row without its journal entry.
      // Adopt it only when all fields match; never overwrite conflicting content.
      const existing=existingRows.get(entityKey);
      if(existing&&canonical(existing)!==canonical(row))bad('La entidad de destino difiere: '+table);
      if(!existing)statements.push(db.prepare('INSERT INTO tasking_'+table+'('+fields.join(',')+') VALUES('+fields.map(()=>'?').join(',')+')').bind(...fields.map(f=>row[f])));
      statements.push(db.prepare('INSERT INTO tasking_transfer_objects(batch_id,table_name,entity_key,content_hash) VALUES(?,?,?,?)').bind(snapshot.batchId,table,entityKey,rowHash));
    }
    for(let offset=0;offset<statements.length;offset+=100)await db.batch(statements.slice(offset,offset+100));
  }
  for(const file of snapshot.files){
    let object=await targetBucket.get(file.key);
    if(object){const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==file.size||await hash(bytes)!==file.hash)bad('El archivo de destino difiere.');continue;}
    object=await sourceBucket.get(file.key);if(!object)bad('Archivo ausente al copiar.');const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==file.size||await hash(bytes)!==file.hash)bad('Archivo de origen modificado.');
    await targetBucket.put(file.key,bytes,{httpMetadata:{contentType:file.mime},customMetadata:{taskingTransferHash:file.hash}});
  }
  // Loading domain relations fires revision triggers; restore the snapshot revision last.
  for(const board of snapshot.rows.boards)await db.prepare('UPDATE tasking_boards SET sync_version=? WHERE id=?').bind(board.sync_version,board.id).run();
  await verifyTransfer(db,targetBucket,snapshot);
  await db.batch([db.prepare("UPDATE tasking_transfer_batches SET status='ready' WHERE id=?").bind(snapshot.batchId),db.prepare("UPDATE tasking_transfer_state SET phase='ready' WHERE id=1").bind()]);
}
export async function verifyTransfer(db,bucket,snapshot){
  await inspectSnapshot(snapshot);
  for(const name of TABLES){const rows=(await db.prepare('SELECT * FROM tasking_'+name).all()).results.sort((a,b)=>key(name,a).localeCompare(key(name,b)));if(canonical(rows)!==canonical(snapshot.rows[name]))bad('Diferencia de contenido en '+name);}
  const foreign=(await db.prepare('PRAGMA foreign_key_check').all()).results;if(foreign.length)bad('Referencias huérfanas.');
  if(snapshot.files.length!==snapshot.rows.attachments.length)bad('Cobertura de archivos incompleta.');
  for(const file of snapshot.files){const object=await bucket.get(file.key);if(!object)bad('Falta un adjunto en destino.');const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==file.size||await hash(bytes)!==file.hash)bad('Archivo de destino inválido.');}
  return {tables:TABLES.length,files:snapshot.files.length,manifestHash:snapshot.manifestHash};
}
export async function activateTransfer(db,bucket,snapshot){
  const state=await db.prepare('SELECT * FROM tasking_transfer_state WHERE id=1').first();
  if(state.phase==='active'&&state.manifest_hash===snapshot.manifestHash)return;
  if(state.phase!=='ready'||state.manifest_hash!==snapshot.manifestHash)bad('El lote no está conciliado.');
  await verifyTransfer(db,bucket,snapshot);
  await db.batch([db.prepare("UPDATE tasking_transfer_state SET phase='active',activated_at=CURRENT_TIMESTAMP WHERE id=1 AND phase='ready'").bind(),db.prepare("UPDATE tasking_transfer_batches SET status='active' WHERE id=?").bind(snapshot.batchId)]);
}

// Cross-database cutover: fence the origin before enabling the destination.
// Abort can win before this fence, but can never reopen an origin marked moved.
export async function commitTransfer(source,db,targetBucket,sourceBucket,snapshot){
  await inspectSnapshot(snapshot);
  const target=await db.prepare('SELECT phase,manifest_hash FROM tasking_transfer_state WHERE id=1').first();
  if(!['ready','active'].includes(target.phase)||target.manifest_hash!==snapshot.manifestHash)bad('El lote no está conciliado.');
  await source.prepare("UPDATE tasking_origin_control SET phase='moved' WHERE id=1 AND phase='frozen' AND NOT EXISTS(SELECT 1 FROM tasking_origin_leases)").run();
  const origin=await source.prepare('SELECT phase FROM tasking_origin_control WHERE id=1').first();
  if(origin?.phase!=='moved')bad('El origen debe estar congelado y drenado antes de activar.');
  // Re-extract after the persistent fence: an aborted/reopened source may have
  // changed since the original snapshot, even when the destination still matches.
  const current=await extractTransfer(source,sourceBucket,{batchId:snapshot.batchId,environment:snapshot.environment});
  if(current.manifestHash!==snapshot.manifestHash)bad('El origen cambió desde el snapshot. Mantenerlo cerrado y conciliar un lote actualizado antes de activar.');
  await activateTransfer(db,targetBucket,snapshot);
}
export async function abortTransfer(source,db){
  const target=await db.prepare('SELECT phase,activated_at FROM tasking_transfer_state WHERE id=1').first();
  if(target.phase==='active'||target.activated_at)bad('HomeSuite ya recibió escrituras; no se puede reabrir la copia vieja.');
  await source.prepare("UPDATE tasking_origin_control SET phase='live' WHERE id=1 AND phase<>'moved'").run();
  if((await source.prepare('SELECT phase FROM tasking_origin_control WHERE id=1').first())?.phase!=='live')bad('El corte ya inició su activación. Mantener el origen cerrado y completar o reparar el destino.');
}
