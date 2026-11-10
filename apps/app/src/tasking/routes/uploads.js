import { membership, logEvent, TaskingError } from '../db/helpers.js';
import { cardWithAccess, attachmentToJSON } from '../db/queries.js';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE, MAX_ATTACHMENTS_PER_CARD } from '../constants.js';
import { multipartFiles } from '../multipart.js';

function keyFor(file){const ext=/\.(jpe?g|png|webp|gif|pdf|txt|csv|docx?|xlsx?)$/i.exec(file.name)?.[0]?.toLowerCase()||'';return crypto.randomUUID()+ext;}
export function setupUploadRoutes(app){
  app.get('/tareas/adjuntos/:key',async c=>{
    const key=c.req.param('key');if(!/^[a-zA-Z0-9_.-]{1,180}$/.test(key))return c.notFound();
    const att=await c.env.DB.prepare('SELECT a.*,c.board_id FROM tasking_attachments a JOIN tasking_cards c ON c.id=a.card_id WHERE a.stored_name=?').bind(key).first();
    if(!att||!await membership(c.env.DB,att.board_id,c.get('identity_id')))return c.notFound();
    const object=await c.env.TASKING_BUCKET?.get(key);if(!object)return c.notFound();
    const safeImage=/^image\/(jpeg|png|webp|gif)$/.test(att.mime);
    const headers=new Headers({'Content-Type':ALLOWED_MIME_TYPES.has(att.mime)?att.mime:'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':(safeImage?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(att.original_name.replace(/[\r\n]/g,''))});
    return new Response(object.body,{headers});
  });
  app.post('/api/tareas/cards/:id/attachments',async c=>{
    const {card,error}=await cardWithAccess(c);if(error)return error;
    if(!c.env.TASKING_BUCKET)throw new TaskingError('El almacenamiento no está disponible.',503);
    const existing=await c.env.DB.prepare('SELECT COUNT(*) AS n FROM tasking_attachments WHERE card_id=?').bind(card.id).first();
    const created=[];let committed=false;
    try{
      for await(const file of multipartFiles(c.req.raw,{fileLimit:MAX_FILE_SIZE,totalLimit:200*1024*1024+64*1024})){
        if(existing.n+created.length>=MAX_ATTACHMENTS_PER_CARD)throw new TaskingError('Máximo 10 archivos por tarjeta.',400);
        if(!ALLOWED_MIME_TYPES.has(file.mime))throw new TaskingError('Tipo de archivo no permitido.',400);
        const stored_name=keyFor(file),id=crypto.randomUUID();
        await c.env.TASKING_BUCKET.put(stored_name,file.bytes,{httpMetadata:{contentType:file.mime}});
        created.push({id,stored_name,original_name:file.name.slice(0,255),mime:file.mime,size:file.bytes.length,created_at:Date.now()});
      }
      if(!await membership(c.env.DB,card.board_id,c.get('identity_id')))throw new TaskingError('El acceso fue revocado.',403);
      if(created.length)await c.env.DB.batch([
        ...created.map(a=>c.env.DB.prepare(`INSERT INTO tasking_attachments(id,card_id,stored_name,original_name,mime,size,created_at) VALUES(?,?,?,?,?,?,?)`).bind(a.id,card.id,a.stored_name,a.original_name,a.mime,a.size,a.created_at)),
        c.env.DB.prepare('INSERT INTO tasking_audit_log(id,board_id,card_id,action,identity_id,ts,details) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),card.board_id,card.id,'attachment_added',c.get('identity_id'),Date.now(),JSON.stringify({files:created.map(a=>a.original_name)})),
      ]);
      committed=true;
      return c.json({attachments:created.map(attachmentToJSON)});
    }catch(error){if(!committed)for(const file of created)await c.env.TASKING_BUCKET.delete(file.stored_name);throw error;}
  });
  app.delete('/api/tareas/attachments/:id',async c=>{
    const file=await c.env.DB.prepare('SELECT a.*,c.board_id FROM tasking_attachments a JOIN tasking_cards c ON c.id=a.card_id WHERE a.id=?').bind(c.req.param('id')).first();
    if(!file)return c.notFound();if(!await membership(c.env.DB,file.board_id,c.get('identity_id')))return c.json({error:'Sin acceso.'},403);
    await c.env.DB.prepare('DELETE FROM tasking_attachments WHERE id=?').bind(file.id).run();await c.env.TASKING_BUCKET.delete(file.stored_name);await logEvent(c.env.DB,file.board_id,file.card_id,'attachment_deleted',c.get('identity_id'),{});return c.json({deleted:1});
  });
}
