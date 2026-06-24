// ---------- Routes: Uploads (File Serving) ----------

import { membership, logEvent } from "../db/helpers.js";
import { resolveEmail } from "../middleware/auth.js";
import { getClientIP } from "../middleware/logging.js";
import { RATE_LIMITS, MAX_FILE_SIZE, MAX_ATTACHMENTS_PER_CARD, ALLOWED_MIME_TYPES } from "../constants.js";
import { checkRateLimit, trackRequest } from "../middleware/rateLimit.js";
import { extOf, attachmentToJSON } from "../db/queries.js";

const uid = () => crypto.randomUUID();
const now = () => Date.now();

export function setupUploadRoutes(app) {
  // Servir archivos desde R2
  app.get("/uploads/:key", async c => {
    const ip = getClientIP(c);
    const allowed = await checkRateLimit(c.env.DB, ip, "/uploads", RATE_LIMITS.uploadAttachment);
    if (!allowed) {
      await trackRequest(c.env.DB, ip, "/uploads", c.req.method);
      return c.json({ error: "Demasiadas solicitudes de descarga. Intentá de nuevo más tarde." }, 429);
    }
    await trackRequest(c.env.DB, ip, "/uploads", c.req.method);

    // Validar autenticación
    const email = await resolveEmail(c);
    if (!email) return c.json({ error: "No autenticado." }, 401);

    const key = c.req.param("key");

    // Buscar adjunto y validar acceso
    const att = await c.env.DB.prepare(
      `SELECT a.*, c.board_id FROM attachments a
       JOIN cards c ON a.card_id = c.id
       WHERE a.stored_name = ?`
    ).bind(key).first();

    if (!att) return c.notFound();

    // Validar membresía del tablero
    const isMember = await membership(c.env.DB, att.board_id, email);
    if (!isMember) return c.json({ error: "Sin acceso a este archivo." }, 403);

    // Servir archivo
    const obj = await c.env.BUCKET.get(key);
    if (!obj) return c.notFound();

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "private, max-age=31536000");
    return new Response(obj.body, { headers });
  });

  // Subir archivos a una tarjeta
  app.post("/api/cards/:id/attachments", async c => {
    const email = c.get("email");
    const cardId = c.req.param("id");

    // Obtener tarjeta y validar acceso
    const card = await c.env.DB.prepare("SELECT board_id FROM cards WHERE id = ?").bind(cardId).first();
    if (!card) return c.json({ error: "No existe la tarjeta." }, 404);
    if (!(await membership(c.env.DB, card.board_id, email))) {
      return c.json({ error: "Sin acceso a esta tarjeta." }, 403);
    }

    // Contar adjuntos existentes
    const existing = await c.env.DB.prepare(
      "SELECT COUNT(*) as n FROM attachments WHERE card_id = ?"
    ).bind(cardId).first();

    const form = await c.req.formData();
    const files = form.getAll("files").filter(f => typeof f === "object" && f.arrayBuffer);

    // Validar cantidad total
    if (existing.n + files.length > MAX_ATTACHMENTS_PER_CARD) {
      return c.json({
        error: `Máximo ${MAX_ATTACHMENTS_PER_CARD} archivos por tarjeta. Ya hay ${existing.n}.`
      }, 400);
    }

    const created = [];
    for (const file of files) {
      // Validar tamaño
      if (file.size > MAX_FILE_SIZE) {
        return c.json({ error: "Archivo demasiado grande (máx. 20 MB)." }, 413);
      }

      // Validar MIME type
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return c.json({
          error: `Tipo de archivo no permitido: ${file.type || "desconocido"}`
        }, 400);
      }

      const key = uid() + extOf(file.name);
      await c.env.BUCKET.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
      });
      const id = uid();
      await c.env.DB.prepare(
        `INSERT INTO attachments (id, card_id, stored_name, original_name, mime, size, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, cardId, key, file.name, file.type, file.size, now()).run();
      created.push(attachmentToJSON({
        id, original_name: file.name, mime: file.type, size: file.size, stored_name: key,
      }));
    }
    if (created.length > 0) {
      await logEvent(c.env.DB, card.board_id, cardId, "attachment_added", email,
        { files: created.map(f => f.originalName) });
    }
    return c.json({ attachments: created });
  });

  // Eliminar un adjunto
  app.delete("/api/attachments/:id", async c => {
    const email = c.get("email");
    const a = await c.env.DB.prepare("SELECT * FROM attachments WHERE id = ?").bind(c.req.param("id")).first();
    if (!a) return c.json({ error: "No existe el adjunto." }, 404);
    const card = await c.env.DB.prepare("SELECT board_id FROM cards WHERE id = ?").bind(a.card_id).first();
    if (card && !(await membership(c.env.DB, card.board_id, email))) {
      return c.json({ error: "Sin acceso a este adjunto." }, 403);
    }
    await c.env.DB.prepare("DELETE FROM attachments WHERE id = ?").bind(a.id).run();
    await c.env.BUCKET.delete(a.stored_name);
    return c.json({ deleted: 1 });
  });
}
