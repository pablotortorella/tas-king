import { moveResponse } from './tasking-move.js';
export async function taskingTransition(c,next){
  if(c.env.TASKING_TRANSITION_CONTROL!=='true')return next();
  const lease=crypto.randomUUID(),now=Date.now();
  const result=await c.env.DB.prepare("INSERT INTO tasking_origin_leases(id,started_at) SELECT ?,? WHERE (SELECT phase FROM tasking_origin_control WHERE id=1)='live'").bind(lease,now).run();
  if(!result.meta.changes){
    const state=await c.env.DB.prepare('SELECT phase FROM tasking_origin_control WHERE id=1').first();
    if(['frozen','moved'].includes(state?.phase))return moveResponse(c.req.raw,{TASKING_DESTINATION:c.env.TASKING_DESTINATION||'staging'});
    c.header('Retry-After','60');c.header('Cache-Control','no-store');
    if(c.req.path.startsWith('/api/'))return c.json({error:'Estamos trasladando Fun TasKing. Conservá tu borrador y volvé en un momento.',code:'tasking_maintenance'},503);
    return c.html('<!doctype html><html lang="es"><meta charset="utf-8"><title>Fun TasKing</title><h1>Estamos preparando la mudanza.</h1><p>Volvé en un momento. Si tenés una edición abierta, conservá el borrador.</p><p>Pablitux</p></html>',503);
  }
  try{return await next();}finally{await c.env.DB.prepare('DELETE FROM tasking_origin_leases WHERE id=?').bind(lease).run();}
}
