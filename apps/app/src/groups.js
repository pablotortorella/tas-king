import { createPlatformId, normalizeEmail, normalizeGroupName } from "./platform.js";
import { normalizeGroupPatch } from "./group-identity.js";
import { normalizeCurrency } from "./finance.js";
import { seedCategoriesStatement } from "./categories.js";

const RESERVED_SLUGS = new Set(["new"]);

export class GroupError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function groupSlugBase(name) {
  const normalized = name.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  return normalized.replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 70).replace(/-$/u, "") || "grupo";
}

function slugCandidate(base, number) {
  return number === 1 ? base : `${base}-${number}`;
}

function slugConflict(error) {
  return String(error?.message ?? error).includes("UNIQUE constraint failed: groups.slug");
}

async function ensureGroupSlug(db, group) {
  if (group.slug) return group.slug;
  const base = groupSlugBase(group.name);
  for (let number = 1; number <= 10000; number++) {
    const candidate = slugCandidate(base, number);
    if (RESERVED_SLUGS.has(candidate)) continue;
    try {
      const result = await db.prepare("UPDATE groups SET slug = ? WHERE id = ? AND slug IS NULL").bind(candidate, group.id).run();
      if (result.meta.changes) return candidate;
      const current = await db.prepare("SELECT slug FROM groups WHERE id = ?").bind(group.id).first();
      if (current?.slug) return current.slug;
    } catch (error) {
      if (!slugConflict(error)) throw error;
    }
  }
  throw new Error("No se pudo asignar una URL al grupo.");
}

export async function resolveGroup(db, idOrSlug) {
  const group = await db.prepare("SELECT id, name, slug, description, avatar_emoji, avatar_color FROM groups WHERE id = ? OR slug = ?").bind(idOrSlug, idOrSlug).first();
  return group ? { ...group, slug: await ensureGroupSlug(db, group) } : null;
}

export async function createGroupForUser(db, { userId, name, defaultCurrency = "COP" }) {
  const groupName = normalizeGroupName(name);
  if (!groupName) throw new Error("Nombre de grupo inválido.");
  const currency = normalizeCurrency(defaultCurrency);
  if (!currency) throw new Error("Moneda inválida.");
  const user = await db.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first();
  if (!user) throw new Error("Usuario no encontrado.");
  const groupId = createPlatformId("group");
  const ledgerId = createPlatformId("ledger");
  const eventId = createPlatformId("audit");
  const base = groupSlugBase(groupName);
  for (let number = 1; number <= 10000; number++) {
    const slug = slugCandidate(base, number);
    if (RESERVED_SLUGS.has(slug)) continue;
    try {
      await db.batch([
        db.prepare("INSERT INTO groups (id, name, slug) VALUES (?, ?, ?)").bind(groupId, groupName, slug),
        db.prepare("INSERT INTO memberships (group_id, user_id, role, membership_generation) VALUES (?, ?, 'owner', ?)").bind(groupId, userId, createPlatformId("membership")),
        db.prepare("INSERT INTO expense_ledgers (id, group_id, default_currency) VALUES (?, ?, ?)").bind(ledgerId, groupId, currency),
        db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, linked_user_id) VALUES (?, ?, ?, ?)").bind(ledgerId, createPlatformId("participant"), user.display_name, userId),
        db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'group_created', 'group', ?)").bind(eventId, userId, groupId, groupId),
        seedCategoriesStatement(db, ledgerId),
      ]);
      return { id: groupId, name: groupName, slug, role: "owner", ledgerId, defaultCurrency: currency };
    } catch (error) {
      if (!slugConflict(error)) throw error;
    }
  }
  throw new Error("No se pudo asignar una URL al grupo.");
}

export async function inviteToGroup(db, { groupId, inviterUserId, email, targetParticipantId = null }) {
  const group = await resolveGroup(db, groupId);
  if (!group) throw new Error("Grupo no encontrado.");
  groupId = group.id;
  const inviteeEmail = normalizeEmail(email);
  if (!inviteeEmail) throw new Error("Email inválido.");
  if (targetParticipantId) {
    const target = await db.prepare("SELECT p.id FROM ledger_participants p JOIN expense_ledgers l ON l.id = p.ledger_id WHERE l.group_id = ? AND p.id = ? AND p.linked_user_id IS NULL AND p.active = 1").bind(groupId, targetParticipantId).first();
    if (!target) throw new Error("Participante no disponible.");
  }
  const invitationId = createPlatformId("invite");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("INSERT INTO invitations (id, group_id, invitee_email, inviter_user_id, target_participant_id, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))").bind(invitationId, groupId, inviteeEmail, inviterUserId, targetParticipantId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'invitation_created', 'invitation', ?)").bind(eventId, inviterUserId, groupId, invitationId),
  ]);
  return { id: invitationId, email: inviteeEmail, status: "pending" };
}

export async function cancelInvitation(db, { invitationId, groupId, actorUserId }) {
  const group = await resolveGroup(db, groupId);
  if (!group) throw new Error("Grupo no encontrado.");
  groupId = group.id;
  const pending = await db.prepare("SELECT id FROM invitations WHERE id = ? AND group_id = ? AND status = 'pending'").bind(invitationId, groupId).first();
  if (!pending) throw new Error("Invitación pendiente no encontrada.");
  const eventId = createPlatformId("audit");
  await db.batch([
    db.prepare("UPDATE invitations SET status = 'canceled', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND group_id = ? AND status = 'pending'").bind(invitationId, groupId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'invitation_canceled', 'invitation', ?)").bind(eventId, actorUserId, groupId, invitationId),
  ]);
}

export async function resolveInvitation(db, { invitationId, userId, email, accepted }) {
  const invitation = await db.prepare("SELECT id, group_id, target_participant_id FROM invitations WHERE id = ? AND invitee_email = ? AND status = 'pending' AND expires_at > CURRENT_TIMESTAMP").bind(invitationId, email).first();
  if (!invitation) throw new Error("Invitación pendiente no encontrada.");
  const action = accepted ? "invitation_accepted" : "invitation_rejected";
  const status = accepted ? "accepted" : "rejected";
  const statements = [
    db.prepare("UPDATE invitations SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, invitationId),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?, 'invitation', ?)").bind(createPlatformId("audit"), userId, invitation.group_id, action, invitationId),
  ];
  if (accepted) {
    const ledger = await db.prepare("SELECT id FROM expense_ledgers WHERE group_id = ?").bind(invitation.group_id).first();
    if (!ledger) throw new Error("Grupo no disponible.");
    const participant = invitation.target_participant_id
      ? await db.prepare("SELECT id FROM ledger_participants WHERE ledger_id = ? AND id = ? AND linked_user_id IS NULL AND active = 1").bind(ledger.id, invitation.target_participant_id).first()
      : null;
    if (invitation.target_participant_id && !participant) throw new Error("Participante no disponible.");
    const user = await db.prepare("SELECT display_name FROM users WHERE id = ?").bind(userId).first();
    statements.splice(1, 0, db.prepare("INSERT INTO memberships (group_id, user_id, role, membership_generation) VALUES (?, ?, 'member', ?)").bind(invitation.group_id, userId, createPlatformId("membership")));
    statements.splice(2, 0, invitation.target_participant_id
      ? db.prepare("UPDATE ledger_participants SET linked_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE ledger_id = ? AND id = ? AND linked_user_id IS NULL").bind(userId, ledger.id, invitation.target_participant_id)
      : db.prepare("INSERT INTO ledger_participants (ledger_id, id, display_name, linked_user_id) VALUES (?, ?, ?, ?)").bind(ledger.id, createPlatformId("participant"), user.display_name, userId));
  }
  await db.batch(statements);
  return invitation.group_id;
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


// Cambia la identidad del grupo (nombre, descripción, emoji y color); solo la persona titular. Lo que no se envía no cambia.
export async function updateGroup(db, { groupId, userId, ...patch }) {
  const next = normalizeGroupPatch(patch);
  const group = await resolveGroup(db, groupId);
  if (!group) throw new GroupError("Grupo no encontrado.", 404);
  const membership = await db.prepare("SELECT role FROM memberships WHERE group_id = ? AND user_id = ?").bind(group.id, userId).first();
  if (!membership) throw new GroupError("Grupo no encontrado.", 404);
  if (membership.role !== "owner") throw new GroupError("Sólo el titular puede administrar el grupo.", 403);
  const merged = {
    name: next.name ?? group.name,
    description: "description" in next ? next.description : group.description,
    emoji: "emoji" in next ? next.emoji : group.avatar_emoji,
    color: "color" in next ? next.color : group.avatar_color,
  };
  await db.batch([
    db.prepare("UPDATE groups SET name = ?, description = ?, avatar_emoji = ?, avatar_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(merged.name, merged.description, merged.emoji, merged.color, group.id),
    db.prepare("INSERT INTO platform_audit_events (id, actor_user_id, group_id, action, entity_type, entity_id) VALUES (?, ?, ?, 'group_updated', 'group', ?)").bind(createPlatformId("audit"), userId, group.id, group.id),
  ]);
  return { id: group.id, slug: group.slug, ...merged };
}
