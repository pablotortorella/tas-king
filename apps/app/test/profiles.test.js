import { describe, expect, it } from "vitest";
import {
  googleDisplayName, googlePictureUrl, normalizeEmoji, normalizeNickname,
  normalizeVisibleName, presentProfile,
} from "../src/profiles.js";

describe("contrato común de perfil", () => {
  it("normaliza límites y rechaza entradas ambiguas", () => {
    expect(normalizeVisibleName("  Ana   María ")).toBe("Ana María");
    expect(() => normalizeVisibleName(" ")).toThrow();
    expect(() => normalizeVisibleName("a".repeat(121))).toThrow();
    expect(() => normalizeVisibleName("Ana\u0000")).toThrow();
    expect(normalizeNickname("  ")).toBeNull();
    expect(normalizeNickname(" Papá  de Celes ")).toBe("Papá de Celes");
    expect(() => normalizeNickname("a".repeat(61))).toThrow();
    expect(normalizeEmoji("👩🏽‍🚀")).toBe("👩🏽‍🚀");
    expect(normalizeEmoji("🇨🇴")).toBe("🇨🇴");
    expect(() => normalizeEmoji("🙂🙂")).toThrow();
    expect(() => normalizeEmoji("A")).toThrow();
  });

  it("acepta sólo fotos Google seguras y tolera claims de proveedor defectuosos", () => {
    expect(googlePictureUrl("https://lh3.googleusercontent.com/a/photo")).toBe("https://lh3.googleusercontent.com/a/photo");
    expect(googlePictureUrl("http://lh3.googleusercontent.com/a/photo")).toBeNull();
    expect(googlePictureUrl("https://lh3.googleusercontent.com.evil.test/a")).toBeNull();
    expect(googlePictureUrl("https://user@lh3.googleusercontent.com/a")).toBeNull();
    expect(googleDisplayName("  Ana   María  ")).toBe("Ana María");
    expect(googleDisplayName("\u0000")).toBeNull();
    expect(googleDisplayName("a".repeat(121))).toHaveLength(120);
  });

  it("resuelve el modo Google con inicial alternativa y oculta la foto en modo emoji", () => {
    const row = {
      user_id: "person_1", name_source: "google", google_display_name: "Ana",
      avatar_mode: "google", google_picture_url: null, avatar_emoji: "🌻", avatar_color: "amber",
    };
    expect(presentProfile(row, "Mamá de Celeste")).toMatchObject({
      displayName: "Ana", nickname: "Mamá de Celeste",
      avatar: { mode: "google", type: "initial", initial: "A", photoUrl: null },
    });
    expect(presentProfile({ ...row, avatar_mode: "emoji", google_picture_url: "https://lh3.googleusercontent.com/a" }).avatar).toMatchObject({
      mode: "emoji", type: "emoji", emoji: "🌻", photoUrl: null,
    });
  });
});
