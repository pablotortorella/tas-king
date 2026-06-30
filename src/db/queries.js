// ---------- Database Queries ----------

import { membership } from "./helpers.js";

const uid = () => crypto.randomUUID();

export function extOf(name) {
  const i = (name || "").lastIndexOf(".");
  return i > 0 ? name.slice(i) : "";
}

export function attachmentToJSON(a) {
  return {
    id: a.id,
    originalName: a.original_name,
    mime: a.mime,
    size: a.size,
    isImage: (a.mime || "").startsWith("image/"),
    url: "/uploads/" + a.stored_name,
  };
}

export function commentToJSON(r) {
  return {
    id: r.id,
    text: r.text,
    ts: r.created_at,
    author: r.author_email ? {
      email: r.author_email,
      name: r.author_name || r.author_email.split("@")[0],
      avatarEmoji: r.author_emoji || null,
      avatarColor: r.author_color || null,
    } : null,
  };
}

export function checklistItemToJSON(r) {
  return { id: r.id, checklistId: r.checklist_id, text: r.text, checked: !!r.checked, position: r.position };
}

export function checklistToJSON(cl, itemsByChecklist) {
  return {
    id: cl.id,
    cardId: cl.card_id,
    name: cl.name,
    position: cl.position,
    items: (itemsByChecklist.get(cl.id) || []).map(checklistItemToJSON),
  };
}

export function cardToJSON(c, commentsByCard, attsByCard, labelsByCard, checklistsByCard, goalsByCard) {
  const comments = (commentsByCard.get(c.id) || []).map(commentToJSON);
  const attachments = (attsByCard.get(c.id) || []).map(attachmentToJSON);
  const labels = labelsByCard?.get(c.id) || [];
  const checklists = checklistsByCard?.get(c.id) || [];
  const goals = goalsByCard?.get(c.id) || [];
  return {
    id: c.id,
    title: c.title,
    column: c.column_id,
    details: c.details,
    due: c.due,
    archived: !!c.archived,
    archivedAt: c.archived_at || undefined,
    position: c.position,
    assignee: c.assignee_email || null,
    created: c.created_at,
    comments,
    attachments,
    labels,
    checklists,
    goals,
  };
}

export async function getBoard(db, boardId) {
  const [cards, comments, atts, labels, cls, items, goals] = await Promise.all([
    db.prepare("SELECT * FROM cards WHERE board_id = ? ORDER BY column_id, position ASC").bind(boardId).all(),
    db.prepare(`SELECT cm.id, cm.card_id, cm.text, cm.created_at, cm.author_email,
        u.name AS author_name, u.avatar_emoji AS author_emoji, u.avatar_color AS author_color
      FROM comments cm
      JOIN cards c ON c.id = cm.card_id
      LEFT JOIN users u ON u.email = cm.author_email
      WHERE c.board_id = ? ORDER BY cm.created_at ASC`).bind(boardId).all(),
    db.prepare("SELECT a.* FROM attachments a JOIN cards c ON c.id = a.card_id WHERE c.board_id = ? ORDER BY a.created_at ASC").bind(boardId).all(),
    db.prepare(`SELECT cl.card_id, l.id, l.name, l.color, l.position
      FROM card_labels cl
      JOIN labels l ON l.id = cl.label_id
      WHERE l.board_id = ? ORDER BY l.position, l.name ASC`).bind(boardId).all(),
    db.prepare(`SELECT ch.* FROM checklists ch JOIN cards c ON c.id = ch.card_id WHERE c.board_id = ? ORDER BY ch.position ASC`).bind(boardId).all(),
    db.prepare(`SELECT ci.* FROM checklist_items ci JOIN checklists ch ON ch.id = ci.checklist_id JOIN cards c ON c.id = ch.card_id WHERE c.board_id = ? ORDER BY ci.position ASC`).bind(boardId).all(),
    db.prepare(`SELECT cg.card_id, g.id, g.title, g.position
      FROM card_goals cg
      JOIN goals g ON g.id = cg.goal_id
      WHERE g.board_id = ? ORDER BY g.position, g.title ASC`).bind(boardId).all(),
  ]);
  const commentsByCard = new Map();
  for (const r of comments.results) {
    if (!commentsByCard.has(r.card_id)) commentsByCard.set(r.card_id, []);
    commentsByCard.get(r.card_id).push(r);
  }
  const attsByCard = new Map();
  for (const r of atts.results) {
    if (!attsByCard.has(r.card_id)) attsByCard.set(r.card_id, []);
    attsByCard.get(r.card_id).push(r);
  }
  const labelsByCard = new Map();
  for (const r of labels.results) {
    if (!labelsByCard.has(r.card_id)) labelsByCard.set(r.card_id, []);
    labelsByCard.get(r.card_id).push({ id: r.id, name: r.name, color: r.color });
  }
  const itemsByChecklist = new Map();
  for (const r of items.results) {
    if (!itemsByChecklist.has(r.checklist_id)) itemsByChecklist.set(r.checklist_id, []);
    itemsByChecklist.get(r.checklist_id).push(r);
  }
  const checklistsByCard = new Map();
  for (const r of cls.results) {
    if (!checklistsByCard.has(r.card_id)) checklistsByCard.set(r.card_id, []);
    checklistsByCard.get(r.card_id).push(checklistToJSON(r, itemsByChecklist));
  }
  const goalsByCard = new Map();
  for (const r of goals.results) {
    if (!goalsByCard.has(r.card_id)) goalsByCard.set(r.card_id, []);
    goalsByCard.get(r.card_id).push({ id: r.id, title: r.title });
  }
  const version = cards.results.reduce((max, c) => Math.max(max, c.updated_at || 0), 0);
  return { version, cards: cards.results.map(c => cardToJSON(c, commentsByCard, attsByCard, labelsByCard, checklistsByCard, goalsByCard)) };
}

export async function getCardRow(db, id) {
  return db.prepare("SELECT * FROM cards WHERE id = ?").bind(id).first();
}

export async function cardJSONById(db, id) {
  const c = await getCardRow(db, id);
  if (!c) return null;
  const [comments, atts, labels, cls, goals] = await Promise.all([
    db.prepare(`SELECT cm.id, cm.text, cm.created_at, cm.author_email,
        u.name AS author_name, u.avatar_emoji AS author_emoji, u.avatar_color AS author_color
      FROM comments cm LEFT JOIN users u ON u.email = cm.author_email
      WHERE cm.card_id = ? ORDER BY cm.created_at ASC`).bind(id).all(),
    db.prepare("SELECT * FROM attachments WHERE card_id = ? ORDER BY created_at ASC").bind(id).all(),
    db.prepare(`SELECT l.id, l.name, l.color
      FROM card_labels cl
      JOIN labels l ON l.id = cl.label_id
      WHERE cl.card_id = ? ORDER BY l.position, l.name ASC`).bind(id).all(),
    db.prepare("SELECT * FROM checklists WHERE card_id = ? ORDER BY position ASC").bind(id).all(),
    db.prepare(`SELECT g.id, g.title
      FROM card_goals cg
      JOIN goals g ON g.id = cg.goal_id
      WHERE cg.card_id = ? ORDER BY g.position, g.title ASC`).bind(id).all(),
  ]);
  const labelsByCard = new Map([[id, labels.results.map(l => ({ id: l.id, name: l.name, color: l.color }))]]);
  const goalsByCard = new Map([[id, goals.results.map(g => ({ id: g.id, title: g.title }))]]);
  const itemsByChecklist = new Map();
  for (const cl of cls.results) {
    const its = await db.prepare("SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position ASC").bind(cl.id).all();
    itemsByChecklist.set(cl.id, its.results);
  }
  const checklistsByCard = new Map([[id, cls.results.map(cl => checklistToJSON(cl, itemsByChecklist))]]);
  return cardToJSON(c, new Map([[id, comments.results]]), new Map([[id, atts.results]]), labelsByCard, checklistsByCard, goalsByCard);
}

export async function nextPosition(db, boardId, columnId) {
  const row = await db.prepare("SELECT MAX(position) AS m FROM cards WHERE board_id = ? AND column_id = ?")
    .bind(boardId, columnId).first();
  return (row && row.m != null ? row.m : 0) + 1;
}

export async function cardWithAccess(c) {
  const card = await getCardRow(c.env.DB, c.req.param("id"));
  if (!card) return { error: c.json({ error: "No existe la tarjeta." }, 404) };
  if (!(await membership(c.env.DB, card.board_id, c.get("email")))) {
    return { error: c.json({ error: "Sin acceso a esta tarjeta." }, 403) };
  }
  return { card };
}

export function replaceCommentsStmts(db, cardId, comments) {
  const stmts = [db.prepare("DELETE FROM comments WHERE card_id = ?").bind(cardId)];
  const ins = db.prepare("INSERT INTO comments (id, card_id, text, created_at) VALUES (?, ?, ?, ?)");
  (comments || []).forEach(cm => {
    const text = (cm && cm.text ? String(cm.text) : "").trim();
    if (text) stmts.push(ins.bind(uid(), cardId, text, cm.ts || Date.now()));
  });
  return stmts;
}

export function auditRowToJSON(r) {
  return {
    id: r.id,
    cardId: r.card_id || null,
    cardTitle: r.card_title || null,
    action: r.action,
    email: r.email,
    ts: r.ts,
    details: JSON.parse(r.details || "{}"),
    author: {
      name: r.author_name || r.email.split("@")[0],
      avatarEmoji: r.avatar_emoji || null,
      avatarColor: r.avatar_color || null,
    },
  };
}
