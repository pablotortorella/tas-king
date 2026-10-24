import { createPlatformId, normalizeEmail, normalizeSpaceName } from "./platform.js";
import { normalizeCurrency } from "./finance.js";

const RESERVED_SLUGS = new Set(["new"]);

export function spaceSlugBase(name) {
  const normalized = name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  return normalized.replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 70).replace(/-$/u, "") || "grupo";
}

function slugCandidate(base, number) {
  return number === 1 ? base : `${base}-${number}`;
}

function slugConflict(error) {
  return String(error?.message ?? error).includes("UNIQUE constraint failed: spaces.slug");
}

async function ensureSpaceSlug(db, space) {
  if (space.slug) return space.slug;
  const base = spaceSlugBase(space.name);
  for (let number = 1; number <= 10000; number++) {
    const candidate = slugCandidate(base, number);
    if (RESERVED_SLUGS.has(candidate)) continue;
    try {
      const result = await db.prepare("UPDATE spaces SET slug = ? WHERE id = ? AND slug IS NULL").bind(candidate, space.id).run();
      if (result.meta.changes) return candidate;
      const current = await db.prepare("SELECT slug FROM spaces WHERE id = ?").bind(space.id).first();
      if (current?.slug) return current.slug;
    } catch (error) {
      if (!slugConflict(error)) throw error;
    }
  }
  throw new Error("No se pudo asignar una URL al grupo.");
}

export async function resolveSpace(db, idOrSlug) {
  const space = await db.prepare("SELECT id, name, slug FROM spaces WHERE id = ? OR slug = ?").bind(idOrSlug, idOrSlug).first();
  return space ? { ...space, slug: await ensureSpaceSlug(db, space) } : null;
}

export async function createSpaceForUser(db, { userId, name, defaultCurrency = "COP" }) {
  const spaceName = normalizeSpaceName(name);
  if (!spaceName) throw new Error("Nombre de espacio inválido.");
  const currency = normalizeCurrency(defaultCurrency);
  if (!currency) throw new Error("Moneda inválida.");
  const user = await db.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first();
  if (!user) throw new Error("Usuario no encontrado.");
  const spaceId = createPlatformId("space");
  const ledgerId = createPlatformId("ledger");
  const eventId = createPlatformId("audit");
  const base = spaceSlugBase(spaceName);
  for (let number = 1; number <= 10000; number++) {
    const slug = slugCandidate(base, number);
    if (RESERVED_SLUGS.has(slug)) continue;
    try {
      await db.batch([
        db.prepare("INSERT INTO spaces (id, name, slug) VALUES (?, ?, ?)").bind(spaceId, spaceName, slug),
        db.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES (?, ?, 'owner')").bind(spaceId, userId),
        db.prepare("INSERT INTO expense_ledgers (id, space_id, default_currency) VALUES (?, ?, ?)").bind(ledgerId, spaceId, currency),
        db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, linked_user_id) VALUES (?, ?, ?, ?)").bind(ledgerId, createPlatformId("participant"), user.display_name, userId),
        db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'space_created', 'space', ?)").bind(eventId, userId, spaceId, spaceId),
      ]);
      return { id: spaceId, name: spaceName, slug, role: "owner", ledgerId, defaultCurrency: currency };
    } catch (error) {
      if (!slugConflict(error)) throw error;
    }
  }
  throw new Error("No se pudo asignar una URL al grupo.");
}

export async function inviteToSpace(db, { spaceId, inviterUserId, email, targetParticipantId = null }) {
  const space = await resolveSpace(db, spaceId);
  if (!space) throw new Error("Grupo no encontrado.");
  spaceId = space.id;
  const inviteeEmail = normalizeEmail(email);
  if (!inviteeEmail) throw new Error("Email inválido.");
  if (targetParticipantId) {
    const target = await db.prepare("SELECT p.id FROM ledger_participants p JOIN expense_ledgers l ON l.id = p.ledger_id WHERE l.space_id = ? AND p.id = ? AND p.linked_user_id IS NULL AND p.active = 1").bind(spaceId, targetParticipantId).first();
    if (!target) throw new Error("Participante no disponible.");
  }
  const invitationId = createPlatformId("invite");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("INSERT INTO invitations (id, space_id, invitee_email, inviter_user_id, target_participant_id, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))").bind(invitationId, spaceId, inviteeEmail, inviterUserId, targetParticipantId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'invitation_created', 'invitation', ?)").bind(eventId, inviterUserId, spaceId, invitationId),
  ]);
  return { id: invitationId, email: inviteeEmail, status: "pending" };
}

export async function cancelInvitation(db, { invitationId, spaceId, actorUserId }) {
  const space = await resolveSpace(db, spaceId);
  if (!space) throw new Error("Grupo no encontrado.");
  spaceId = space.id;
  const pending = await db.prepare("SELECT id FROM invitations WHERE id = ? AND space_id = ? AND status = 'pending'").bind(invitationId, spaceId).first();
  if (!pending) throw new Error("Invitación pendiente no encontrada.");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("UPDATE invitations SET status = 'canceled', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND space_id = ? AND status = 'pending'").bind(invitationId, spaceId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'invitation_canceled', 'invitation', ?)").bind(eventId, actorUserId, spaceId, invitationId),
  ]);
}

export async function resolveInvitation(db, { invitationId, userId, email, accepted }) {
  const invitation = await db.prepare("SELECT id, space_id, target_participant_id FROM invitations WHERE id = ? AND invitee_email = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP").bind(invitationId, email).first();
  if (!invitation) throw new Error("Invitación pendiente no encontrada.");
  const action = accepted ? "invitation_accepted" : "invitation_rejected";
  const status = accepted ? "accepted" : "rejected";
  const statements = [
    db.prepare("UPDATE invitations SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, invitationId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, 'invitation', ?)").bind(createPlatformId("audit"), userId, invitation.space_id, action, invitationId),
  ];
  if (accepted) {
    const ledger = await db.prepare("SELECT id FROM expense_ledgers WHERE space_id = ?").bind(invitation.space_id).first();
    if (!ledger) throw new Error("Libro no disponible.");
    const participant = invitation.target_participant_id
      ? await db.prepare("SELECT id FROM ledger_participants WHERE ledger_id = ? AND id = ? AND linked_user_id IS NULL AND active = 1").bind(ledger.id, invitation.target_participant_id).first()
      : null;
    if (invitation.target_participant_id && !participant) throw new Error("Participante no disponible.");
    const user = await db.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first();
    statements.splice(1, 0, db.prepare("INSERT INTO memberships (space_id, user_id, role) VALUES (?, ?, 'member')").bind(invitation.space_id, userId));
    statements.splice(2, 0, invitation.target_participant_id
      ? db.prepare("UPDATE ledger_participants SET linked_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND linked_user_id IS NULL").bind(userId, ledger.id, invitation.target_participant_id)
      : db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, linked_user_id) VALUES (?, ?, ?, ?)").bind(ledger.id, createPlatformId("participant"), user.display_name, userId));
  }
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


export async function renameSpace(db, { spaceId, userId, name }) {
  const spaceName = normalizeSpaceName(name);
  if (!spaceName) throw new Error("Nombre de espacio inválido.");
  const space = await resolveSpace(db, spaceId);
  if (!space) throw new Error("Grupo no encontrado.");
  spaceId = space.id;
  const membership = await db.prepare("SELECT role FROM memberships WHERE space_id = ? AND user_id = ?").bind(spaceId, userId).first();
  if (membership?.role !== "owner") throw new Error("Sólo el titular puede renombrar el espacio.");
  await db.batch([
    db.prepare("UPDATE spaces SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(spaceName, spaceId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, space_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'space_renamed', 'space', ?)").bind(createPlatformId("audit"), userId, spaceId, spaceId),
  ]);
  return { id: spaceId, name: spaceName, slug: space.slug };
}
