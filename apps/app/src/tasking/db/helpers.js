import { DEFAULT_COLUMNS } from './columns.js';

export class TaskingError extends Error {
  constructor(message, status = 409, code = 'tasking_conflict') { super(message); this.status = status; this.code = code; }
}
export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export async function identityIdForEmail(email) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeEmail(email)));
  return 'ti_' + Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
}
export async function ensureUser(db, email) {
  email = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new TaskingError('Email inválido.', 400);
  const known = await db.prepare('SELECT i.identity_id FROM tasking_identities i JOIN users u ON u.id=i.user_id WHERE u.email=?').bind(email).first();
  if (known) return known.identity_id;
  const id = await identityIdForEmail(email);
  await db.prepare('INSERT OR IGNORE INTO tasking_identities(identity_id,legacy_email,name,created_at) VALUES(?,?,?,?)').bind(id,email,email.split('@')[0],Date.now()).run();
  return (await db.prepare('SELECT identity_id FROM tasking_identities WHERE legacy_email=?').bind(email).first()).identity_id;
}
export async function resolveIdentity(db, userId) {
  const linked = await db.prepare('SELECT * FROM tasking_identities WHERE user_id=?').bind(userId).first();
  if (linked) return linked;
  const user = await db.prepare('SELECT id,email,google_sub FROM users WHERE id=?').bind(userId).first();
  if (!user) throw new TaskingError('Iniciá sesión con tu cuenta habitual.',401);
  const pending = await db.prepare('SELECT * FROM tasking_identities WHERE legacy_email=?').bind(normalizeEmail(user.email)).first();
  if (pending?.user_id && pending.user_id !== userId) throw new TaskingError('No pudimos recuperar tu cuenta. Contactá a Pablitux.');
  // Existing accounts can be linked by an explicitly verified transfer mapping as well.
  const authority = user.email.endsWith('@gmail.com') || user.google_sub.startsWith('local:') || await db.prepare('SELECT 1 AS ok FROM tasking_verified_accounts WHERE user_id=? AND google_sub=?').bind(userId,user.google_sub).first();
  if (pending && !authority && pending.verified_sub !== user.google_sub) throw new TaskingError('No pudimos verificar tu cuenta anterior. Contactá a Pablitux.');
  const id = pending?.identity_id ?? await ensureUser(db,user.email);
  await db.prepare('UPDATE tasking_identities SET user_id=?,verified_sub=? WHERE identity_id=? AND (user_id IS NULL OR user_id=?) AND (verified_sub IS NULL OR verified_sub=?)').bind(userId,user.google_sub,id,userId,user.google_sub).run();
  const identity = await db.prepare('SELECT * FROM tasking_identities WHERE user_id=?').bind(userId).first();
  if (!identity || identity.identity_id !== id) throw new TaskingError('La cuenta está vinculada a otra identidad. Contactá a Pablitux.');
  return identity;
}
export async function ensurePersonalBoard(db, identityId) {
  const existing = await db.prepare('SELECT id FROM tasking_boards WHERE owner_identity_id=? AND is_personal=1').bind(identityId).first();
  if(existing)return existing;
  const id = 'personal_' + identityId;
  const t = Date.now();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO tasking_boards(id,name,owner_identity_id,is_personal,created_at) SELECT ?, 'Mi tablero', ?, 1, ? WHERE NOT EXISTS(SELECT 1 FROM tasking_boards WHERE owner_identity_id=? AND is_personal=1)").bind(id,identityId,t,identityId),
    db.prepare("INSERT OR IGNORE INTO tasking_board_members(board_id,identity_id,role,created_at) SELECT id,?,'owner',? FROM tasking_boards WHERE owner_identity_id=? AND is_personal=1").bind(identityId,t,identityId),
    ...DEFAULT_COLUMNS.map(col=>db.prepare('INSERT OR IGNORE INTO tasking_columns(id,board_id,name,position,is_done,created_at) SELECT ?,id,?,?,?,? FROM tasking_boards WHERE owner_identity_id=? AND is_personal=1 AND id=?').bind(col.id,col.name,col.position,col.is_done,t,identityId,id)),
  ]);
  return db.prepare('SELECT id FROM tasking_boards WHERE owner_identity_id=? AND is_personal=1').bind(identityId).first();
}
export function membership(db, boardId, identityId) {
  return db.prepare('SELECT role FROM tasking_board_members WHERE board_id=? AND identity_id=?').bind(boardId,identityId).first();
}
export async function logEvent(db,boardId,cardId,action,identityId,details={}) {
  await db.prepare('INSERT INTO tasking_audit_log(id,board_id,card_id,action,identity_id,ts,details) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),boardId,cardId||null,action,identityId,Date.now(),JSON.stringify(details)).run();
}
export async function resolveAssignee(db,boardId,value) {
  if (!value) return null;
  const row = await db.prepare('SELECT m.identity_id FROM tasking_board_members m JOIN tasking_identities i ON i.identity_id=m.identity_id WHERE m.board_id=? AND (m.identity_id=? OR i.legacy_email=?)').bind(boardId,String(value),normalizeEmail(value)).first();
  if (!row) throw new TaskingError('La persona asignada no pertenece al tablero.',400);
  return row.identity_id;
}
