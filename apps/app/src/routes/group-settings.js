import { GroupError, updateGroup } from "../groups.js";
import { renderGroupSettings } from "../group-ui.js";
import { readLedger } from "../ledger.js";
import { csrfInput, formError, page, signedInUser, signInRequired } from "../route-kit.js";
import { ProfileError } from "../profiles.js";
import { noticeFor } from "../ui-parts.js";

const IDENTITY_FIELDS = ["name", "description", "emoji", "color"];

// «Administrar grupo»: nombre, descripción, emoji y color; enlace a Personas; archivar. Solo la persona titular.
export function registerGroupSettingsRoutes(app) {
  app.get("/groups/:groupId/settings", async (c) => {
    const user = await signedInUser(c);
    if (!user) return signInRequired(c);
    const key = c.req.param("groupId");
    const group = await c.env.DB.prepare("SELECT g.id, g.name, g.slug, g.description, g.avatar_emoji, g.avatar_color, m.role FROM groups g JOIN memberships m ON m.group_id = g.id WHERE (g.id = ? OR g.slug = ?) AND m.user_id = ?").bind(key, key, user.user_id).first();
    if (!group) return c.html(formError("Grupo no encontrado", "No tenés acceso a este grupo.", 404), 404);
    if (group.role !== "owner") return c.html(formError("No podés administrar este grupo", "Sólo el titular puede administrarlo.", 403), 403);
    const [csrf, data] = await Promise.all([
      csrfInput(c, user),
      readLedger(c.env.DB, { groupId: group.id, userId: user.user_id }),
    ]);
    const content = `${noticeFor(c.req.query("aviso"))}${renderGroupSettings({ group, data, csrf })}`;
    return c.html(page("Administrar grupo", content, { groupHref: `/groups/${encodeURIComponent(group.slug)}` }));
  });

  app.post("/groups/:groupId/settings", async (c) => {
    const user = c.get("protectedUser");
    try {
      const body = await c.req.parseBody();
      const patch = Object.fromEntries(IDENTITY_FIELDS.filter(field => typeof body[field] === "string").map(field => [field, body[field]]));
      const group = await updateGroup(c.env.DB, { groupId: c.req.param("groupId"), userId: user.user_id, ...patch });
      return c.redirect(`/groups/${encodeURIComponent(group.slug)}/settings?aviso=grupo-guardado`, 303);
    } catch (error) {
      if (!(error instanceof GroupError) && !(error instanceof ProfileError)) throw error;
      const status = error.status ?? 400;
      return c.html(formError(status === 403 ? "No podés administrar este grupo" : status === 404 ? "Grupo no encontrado" : "No pudimos guardar", error.message, status), status);
    }
  });
}
