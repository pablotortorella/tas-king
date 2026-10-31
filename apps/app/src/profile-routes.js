import {
  listMemberPresentations, ProfileError, readOwnPresentation, readOwnProfile,
  saveOwnNickname, saveOwnProfile,
} from "./profiles.js";

const MAX_PROFILE_JSON_BYTES = 8 * 1024;

async function boundedJson(request) {
  if (!/^application\/json(?:\s*;|\s*$)/iu.test(request.headers.get("Content-Type") || "")) {
    throw new ProfileError("Se requiere JSON.", 415, "unsupported_media_type");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ProfileError("Falta el cuerpo de la solicitud.");
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PROFILE_JSON_BYTES) {
      await reader.cancel();
      throw new ProfileError("La solicitud es demasiado grande.", 413, "request_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ProfileError("JSON inválido."); }
}

function sendError(c, error) {
  if (!(error instanceof ProfileError)) throw error;
  return c.json({ error: error.message, code: error.code }, error.status);
}

export function registerProfileRoutes(app, { signedInUser, localUser, ensureLocalUser }) {
  async function actor(c) {
    const protectedUser = c.get("protectedUser");
    if (protectedUser) return protectedUser.user_id ?? protectedUser.id;
    const session = await signedInUser(c);
    if (session) return session.user_id;
    const host = new URL(c.req.url).hostname;
    const email = host === "localhost" || host === "127.0.0.1" ? localUser(c) : null;
    return email ? (await ensureLocalUser(c.env.DB, email)).id : null;
  }

  app.get("/api/me/profile", async c => {
    const userId = await actor(c);
    if (!userId) return c.json({ error: "Una sesión es requerida." }, 401);
    try { return c.json(await readOwnProfile(c.env.DB, userId)); }
    catch (error) { return sendError(c, error); }
  });

  app.patch("/api/me/profile", async c => {
    const userId = await actor(c);
    if (!userId) return c.json({ error: "Una sesión es requerida." }, 401);
    try { return c.json(await saveOwnProfile(c.env.DB, userId, await boundedJson(c.req.raw))); }
    catch (error) { return sendError(c, error); }
  });

  app.get("/api/groups/:groupId/me/presentation", async c => {
    const userId = await actor(c);
    if (!userId) return c.json({ error: "Una sesión es requerida." }, 401);
    try { return c.json(await readOwnPresentation(c.env.DB, c.req.param("groupId"), userId)); }
    catch (error) { return sendError(c, error); }
  });

  app.patch("/api/groups/:groupId/me/presentation", async c => {
    const userId = await actor(c);
    if (!userId) return c.json({ error: "Una sesión es requerida." }, 401);
    try { return c.json(await saveOwnNickname(c.env.DB, c.req.param("groupId"), userId, await boundedJson(c.req.raw))); }
    catch (error) { return sendError(c, error); }
  });

  app.get("/api/groups/:groupId/members", async c => {
    const userId = await actor(c);
    if (!userId) return c.json({ error: "Una sesión es requerida." }, 401);
    const groupIdOrSlug = c.req.param("groupId");
    const group = await c.env.DB.prepare("SELECT id FROM groups WHERE id = ?")
      .bind(groupIdOrSlug).first();
    if (!group) return c.json({ error: "Grupo no encontrado." }, 404);
    try { return c.json({ members: await listMemberPresentations(c.env.DB, group.id, userId) }); }
    catch (error) { return sendError(c, error); }
  });
}
