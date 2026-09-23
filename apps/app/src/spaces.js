import { createPlatformId, normalizeEmail, normalizeSpaceName } from "./platform.js";

export async function createSpaceForUser(db, { userId, name }) {
  const spaceName = normalizeSpaceName(name);
  if (!spaceName) throw new Error("Nombre de espacio inválido.");
  const spaceId = createPlatformId("space");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("INSERT INTO spaces (id, name) VALUES (?, ?)").bind(spaceId, spaceName),
    db.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES (?, ?, 'owner')").bind(spaceId, userId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'space_created', 'space', ?)").bind(eventId, userId, spaceId, spaceId),
  ]);
  return { id: spaceId, name: spaceName, role: "owner" };
}

export async function inviteToSpace(db, { spaceId, inviterUserId, email }) {
  const inviteeEmail = normalizeEmail(email);
  if (!inviteeEmail) throw new Error("Email inválido.");
  const invitationId = createPlatformId("invite");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("INSERT INTO invitations (id, space_id, invitee_email, inviter_user_id) VALUES (?, ?, ?, ?)").bind(invitationId, spaceId, inviteeEmail, inviterUserId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'invitation_created', 'invitation', ?)").bind(eventId, inviterUserId, spaceId, invitationId),
  ]);
  return { id: invitationId, email: inviteeEmail, status: "pending" };
}

export async function cancelInvitation(db, { invitationId, spaceId, actorUserId }) {
  const pending = await db.prepare("SELECT id FROM invitations WHERE id = ? AND space_id = ? AND status = 'pending'").bind(invitationId, spaceId).first();
  if (!pending) throw new Error("Invitación pendiente no encontrada.");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("UPDATE invitations SET status = 'canceled', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND space_id = ? AND status = 'pending'").bind(invitationId, spaceId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'invitation_canceled', 'invitation', ?)").bind(eventId, actorUserId, spaceId, invitationId),
  ]);
}

export async function resolveInvitation(db, { invitationId, userId, email, accepted }) {
  const invitation = await db.prepare("SELECT id, space_id FROM invitations WHERE id = ? AND invitee_email = ? AND status = 'pending'").bind(invitationId, email).first();
  if (!invitation) throw new Error("Invitación pendiente no encontrada.");
  const action = accepted ? "invitation_accepted" : "invitation_rejected";
  const status = accepted ? "accepted" : "rejected";
  const statements = [
    db.prepare("UPDATE invitations SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, invitationId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, 'invitation', ?)").bind(createPlatformId("audit"), userId, invitation.space_id, action, invitationId),
  ];
  if (accepted) statements.splice(1, 0, db.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES (?, ?, 'member')").bind(invitation.space_id, userId));
  await db.batch(statements);
  return invitation.space_id;
}

export async function ensureLocalUser(db, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Identidad local inválida.");
  const existing = await db.prepare("SELECT id, email, display_name FROM users WHERE email = ?").bind(normalized).first();
  if (existing) return existing;
  const id = createPlatformId("user");
  const name = normalized.split("@")[0];
  await db.prepare("INSERT INTO users (id, google_sub, email, display_name) VALUES (?, ?, ?, ?)").bind(id, `local:${normalized}`, normalized, name).run();
  return { id, email: normalized, display_name: name };
}
