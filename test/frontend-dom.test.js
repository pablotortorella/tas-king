import { describe, it, expect, vi, afterEach } from "vitest";
import {
  AVATAR_COLORS, avatarHtml, defaultColor, escapeHtml,
  fmtDate, relativeTime, shortName, uid,
} from "../public/js/core/dom.js";

afterEach(() => { vi.useRealTimers(); });

describe("escapeHtml", () => {
  it("escapa los cinco caracteres peligrosos", () => {
    expect(escapeHtml(`<a href="x" class='y'>&</a>`))
      .toBe("&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
  it("devuelve string vacío para null o undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
  it("deja intacto un texto sin caracteres especiales", () => {
    expect(escapeHtml("Tarjeta normal")).toBe("Tarjeta normal");
  });
});

describe("shortName", () => {
  it("toma la parte anterior a la arroba", () => {
    expect(shortName("pablo@example.com")).toBe("pablo");
  });
  it("tolera vacío", () => {
    expect(shortName("")).toBe("");
    expect(shortName(null)).toBe("");
  });
});

describe("defaultColor", () => {
  it("es estable: el mismo email da siempre el mismo color", () => {
    expect(defaultColor("a@b.com")).toBe(defaultColor("a@b.com"));
  });
  it("siempre devuelve un color de la paleta", () => {
    for (const e of ["", "a@b.com", "zzz", "áéí@x.com", "muy.largo.email@dominio.org"]) {
      expect(AVATAR_COLORS).toContain(defaultColor(e));
    }
  });
});

describe("avatarHtml", () => {
  it("usa el emoji cuando hay uno", () => {
    expect(avatarHtml({ email: "a@b.com", avatarEmoji: "🦊" })).toContain(">🦊<");
  });
  it("sin emoji usa la inicial en mayúscula", () => {
    expect(avatarHtml({ email: "pablo@example.com" })).toContain(">P<");
  });
  it("escapa el nombre en el title", () => {
    expect(avatarHtml({ email: "x@y.z", name: "Ana <b>" })).toContain('title="Ana &lt;b&gt;"');
  });
  it("respeta el color explícito por encima del derivado", () => {
    expect(avatarHtml({ email: "x@y.z", avatarColor: "#123456" })).toContain("background:#123456");
  });
  it("usa 22px por defecto y el tamaño pedido si se da", () => {
    expect(avatarHtml({ email: "x@y.z" })).toContain("width:22px");
    expect(avatarHtml({ email: "x@y.z" }, 16)).toContain("width:16px");
  });
  it("no rompe sin argumentos", () => {
    expect(() => avatarHtml()).not.toThrow();
    expect(avatarHtml()).toContain(">?<");
  });
});

describe("fmtDate", () => {
  it("devuelve vacío sin fecha", () => {
    expect(fmtDate("")).toBe("");
    expect(fmtDate(null)).toBe("");
  });
  it("formatea en día y mes abreviado", () => {
    // Interpreta la fecha como local, no UTC: por eso el día no se corre.
    expect(fmtDate("2026-03-15")).toMatch(/15/);
  });
});

describe("relativeTime", () => {
  it("menos de un minuto es 'ahora'", () => {
    expect(relativeTime(Date.now())).toBe("ahora");
  });
  it("usa minutos, horas y días según la distancia", () => {
    const ahora = Date.now();
    expect(relativeTime(ahora - 5 * 60_000)).toBe("hace 5 min");
    expect(relativeTime(ahora - 3 * 3_600_000)).toBe("hace 3h");
    expect(relativeTime(ahora - 4 * 86_400_000)).toBe("hace 4d");
  });
  it("a partir de 30 días muestra la fecha", () => {
    expect(relativeTime(Date.now() - 40 * 86_400_000)).toMatch(/\d/);
    expect(relativeTime(Date.now() - 40 * 86_400_000)).not.toMatch(/hace/);
  });
});

describe("uid", () => {
  it("no repite en llamadas consecutivas", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
  });
});
