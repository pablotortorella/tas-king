export function setupAdminRoutes(app) {
  app.use('/api/tareas/admin/*',async(c,next)=>{
    const actor=await c.env.DB.prepare('SELECT is_admin FROM tasking_identities WHERE identity_id=?').bind(c.get('identity_id')).first();
    if(!actor?.is_admin) return c.json({error:'Solo administradores de TasKing.'},403);
    await next();
  });
  app.get('/api/tareas/admin/users',async c=>{
    const rows=await c.env.DB.prepare('SELECT identity_id,legacy_email AS contactEmail,name,is_admin FROM tasking_identities ORDER BY legacy_email').all();
    return c.json({users:rows.results});
  });
  app.post('/api/tareas/admin/set-admin',async c=>{
    const {identityId,isAdmin}=await c.req.json();
    if(identityId===c.get('identity_id')) return c.json({error:'No podés cambiar tu propio rol.'},400);
    if(typeof identityId!=='string'||typeof isAdmin!=='boolean')return c.json({error:'Rol inválido.'},400);
    const result=await c.env.DB.prepare('UPDATE tasking_identities SET is_admin=? WHERE identity_id=?').bind(isAdmin?1:0,identityId).run();
    return result.meta.changes?c.json({ok:true}):c.json({error:'Cuenta no encontrada.'},404);
  });
  app.get('/api/tareas/admin/stats',async c=>{
    const rows=await c.env.DB.batch([
      c.env.DB.prepare('SELECT COUNT(*) AS count FROM tasking_identities'),
      c.env.DB.prepare('SELECT COUNT(*) AS count FROM tasking_boards'),
      c.env.DB.prepare('SELECT COUNT(*) AS count FROM tasking_cards WHERE archived=0'),
      c.env.DB.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(size),0) AS totalSize FROM tasking_attachments'),
      c.env.DB.prepare(`SELECT i.identity_id,p.name,COUNT(DISTINCT b.id) AS boards,COUNT(DISTINCT c.id) AS cards,COUNT(DISTINCT cm.id) AS comments FROM tasking_identities i JOIN tasking_presentations p ON p.identity_id=i.identity_id LEFT JOIN tasking_boards b ON b.owner_identity_id=i.identity_id LEFT JOIN tasking_cards c ON c.board_id=b.id LEFT JOIN tasking_comments cm ON cm.author_identity_id=i.identity_id GROUP BY i.identity_id ORDER BY cards DESC LIMIT 10`),
    ]);
    return c.json({users:rows[0].results[0].count,boards:rows[1].results[0].count,cards:rows[2].results[0].count,files:rows[3].results[0],topUsers:rows[4].results.map(r=>({...r,activity:r.cards+r.comments+r.boards})),timestamp:Date.now()});
  });
}
