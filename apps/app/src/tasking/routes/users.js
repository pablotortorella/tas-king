import { readOwnProfile } from '../../profiles.js';
import { createCsrfToken } from '../../csrf.js';
import { avanzarTip, hoyDelCliente } from '../tips.js';
import { AVATAR_COLORS } from '../../profiles.js';

export function setupUserRoutes(app) {
  app.get('/api/tareas/me', async c => {
    const id=c.get('identity_id'), session=c.get('taskingSession');
    const [boards,identity,profile]=await Promise.all([
      c.env.DB.prepare(`SELECT b.*,m.role,(SELECT COUNT(*) FROM tasking_board_members x WHERE x.board_id=b.id) AS member_count FROM tasking_boards b JOIN tasking_board_members m ON m.board_id=b.id WHERE m.identity_id=? ORDER BY b.is_personal DESC,b.created_at`).bind(id).all(),
      c.env.DB.prepare('SELECT * FROM tasking_identities WHERE identity_id=?').bind(id).first(),
      readOwnProfile(c.env.DB,session.user_id),
    ]);
    const tip=avanzarTip({tipIndex:identity.tip_index,tipDate:identity.tip_date,hoy:hoyDelCliente(c.req.query('today'))});
    if(tip.guardar) await c.env.DB.prepare('UPDATE tasking_identities SET tip_index=?,tip_date=? WHERE identity_id=?').bind(tip.index,tip.date,id).run();
    return c.json({identity_id:id,contactEmail:session.email,isAdmin:!!identity.is_admin,tipIndex:tip.index,
      csrfToken:session.local?'':await createCsrfToken({sessionId:session.id,secret:c.env.SESSION_SECRET}),
      profile:{name:profile.displayName,avatarEmoji:profile.avatar.emoji||null,avatarColor:AVATAR_COLORS[profile.avatar.color]||null,photoUrl:profile.avatar.photoUrl||null},
      boards:boards.results.map(r=>({id:r.id,name:r.name,isPersonal:!!r.is_personal,role:r.role,ownerIdentityId:r.owner_identity_id,memberCount:r.member_count,dueSoonDays:r.due_soon_days,theme:r.theme,themePromptSeen:!!r.theme_prompt_seen}))});
  });
}
