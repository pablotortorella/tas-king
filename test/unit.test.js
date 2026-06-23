import { describe, expect, it } from "vitest";
import {
  attachmentToJSON,
  cardToJSON,
  commentToJSON,
  extOf,
  signSession,
  verifySession,
} from "../src/index.js";

describe("helpers puros", () => {
  it("extrae extensiones sin inventarlas", () => {
    expect(extOf("captura.final.png")).toBe(".png");
    expect(extOf("README")).toBe("");
    expect(extOf(".env")).toBe("");
    expect(extOf(null)).toBe("");
  });

  it("normaliza adjuntos y detecta imágenes", () => {
    expect(attachmentToJSON({
      id: "a1", original_name: "foto.png", mime: "image/png",
      size: 12, stored_name: "uuid.png",
    })).toEqual({
      id: "a1", originalName: "foto.png", mime: "image/png", size: 12,
      isImage: true, url: "/uploads/uuid.png",
    });
  });

  it("normaliza comentarios con y sin perfil de autor", () => {
    expect(commentToJSON({
      id: "cm1", text: "Listo", created_at: 10,
      author_email: "ana@example.com", author_name: "Ana",
      author_emoji: "🚀", author_color: "#123456",
    })).toEqual({
      id: "cm1", text: "Listo", ts: 10,
      author: { email: "ana@example.com", name: "Ana", avatarEmoji: "🚀", avatarColor: "#123456" },
    });
    expect(commentToJSON({ id: "cm2", text: "Viejo", created_at: 11, author_email: null }).author).toBeNull();
  });

  it("arma una tarjeta y conserva sus relaciones", () => {
    const comments = new Map([["c1", [{ id: "cm", text: "Hola", created_at: 2, author_email: null }]]]);
    const attachments = new Map([["c1", [{ id: "a", original_name: "x.pdf", mime: "application/pdf", size: 3, stored_name: "x" }]]]);
    const card = cardToJSON({
      id: "c1", title: "Tarea", column_id: "pendiente", details: "Detalle", due: "2026-06-30",
      archived: 0, archived_at: null, position: 1, assignee_email: null, created_at: 1,
    }, comments, attachments);
    expect(card).toMatchObject({ id: "c1", column: "pendiente", archived: false, comments: [{ id: "cm" }] });
    expect(card.attachments[0]).toMatchObject({ id: "a", isImage: false });
  });
});

describe("sesiones", () => {
  it("firma y verifica una sesión", async () => {
    const token = await signSession({ email: "ana@example.com", exp: Date.now() + 60_000 }, "secreto");
    await expect(verifySession(token, "secreto")).resolves.toMatchObject({ email: "ana@example.com" });
  });

  it("rechaza firma alterada, secreto incorrecto y expiración", async () => {
    const valid = await signSession({ email: "ana@example.com", exp: Date.now() + 60_000 }, "secreto");
    await expect(verifySession(valid + "x", "secreto")).resolves.toBeNull();
    await expect(verifySession(valid, "otro")).resolves.toBeNull();
    const expired = await signSession({ email: "ana@example.com", exp: Date.now() - 1 }, "secreto");
    await expect(verifySession(expired, "secreto")).resolves.toBeNull();
  });
});
