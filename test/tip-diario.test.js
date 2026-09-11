import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.js";
import { avanzarTip, hoyDelCliente } from "../src/routes/users.js";

// La regla del tip diario: un tip por día, propio de cada persona, sin saltear
// ninguno por ausencia. Ver openspec/changes/tip-diario/specs/tip-diario/spec.md

describe("avance del tip diario", () => {
  it("primera vez: empieza por el primer tip y lo graba", () => {
    expect(avanzarTip({ tipIndex: null, tipDate: null, hoy: "2026-09-11" }))
      .toEqual({ index: 0, date: "2026-09-11", guardar: true });
  });

  it("misma jornada: el tip no se mueve ni se vuelve a grabar", () => {
    expect(avanzarTip({ tipIndex: 4, tipDate: "2026-09-11", hoy: "2026-09-11" }))
      .toEqual({ index: 4, date: "2026-09-11", guardar: false });
  });

  it("día siguiente: avanza uno", () => {
    expect(avanzarTip({ tipIndex: 4, tipDate: "2026-09-11", hoy: "2026-09-12" }))
      .toEqual({ index: 5, date: "2026-09-12", guardar: true });
  });

  it("varios días de ausencia: avanza uno solo, no se saltea tips", () => {
    expect(avanzarTip({ tipIndex: 4, tipDate: "2026-08-01", hoy: "2026-09-11" }))
      .toEqual({ index: 5, date: "2026-09-11", guardar: true });
  });

  it("el contador sigue creciendo más allá del largo del catálogo", () => {
    // El ciclado lo resuelve el frontend con DAILY_TIPS[index % DAILY_TIPS.length],
    // así que acá el contador nunca vuelve a cero.
    expect(avanzarTip({ tipIndex: 73, tipDate: "2026-09-11", hoy: "2026-09-12" }).index).toBe(74);
  });

  it("un avance corrupto se trata como si no hubiera avance", () => {
    for (const roto of [undefined, "3", -1, 2.5, NaN]) {
      expect(avanzarTip({ tipIndex: roto, tipDate: "2026-09-11", hoy: "2026-09-11" }).index).toBe(0);
    }
  });

  it("dos personas con distinto avance ven tips distintos el mismo día", () => {
    const hoy = "2026-09-11";
    const ana = avanzarTip({ tipIndex: 2, tipDate: "2026-09-10", hoy });
    const beto = avanzarTip({ tipIndex: 40, tipDate: "2026-09-10", hoy });
    expect(ana.index).not.toBe(beto.index);
  });
});

describe("fecha del día", () => {
  it("usa la fecha del navegador para que el día cambie a la medianoche de la persona", () => {
    expect(hoyDelCliente("2026-09-11")).toBe("2026-09-11");
  });

  it("cae a la fecha del servidor si no llega o viene mal formada", () => {
    const hoyUTC = new Date().toISOString().slice(0, 10);
    for (const malo of [undefined, "", "ayer", "2026-9-1", "2026-09-11T10:00:00Z"]) {
      expect(hoyDelCliente(malo)).toBe(hoyUTC);
    }
  });
});

// ---------- El avance vive en la cuenta, no en el navegador ----------

async function me(email, today) {
  const res = await app.request(
    `http://localhost/api/me${today ? "?today=" + today : ""}`,
    { headers: { "X-Dev-User": email } },
    env,
  );
  expect(res.status).toBe(200);
  return res.json();
}

describe("GET /api/me expone y guarda el avance del tip", () => {
  it("alguien nuevo arranca en el primer tip", async () => {
    expect((await me("tip-nuevo@test.local", "2026-09-11")).tipIndex).toBe(0);
  });

  it("el tip no se mueve aunque recargue varias veces el mismo día", async () => {
    const email = "tip-mismodia@test.local";
    await me(email, "2026-09-11");
    expect((await me(email, "2026-09-11")).tipIndex).toBe(0);
    expect((await me(email, "2026-09-11")).tipIndex).toBe(0);
  });

  it("al día siguiente avanza uno y lo recuerda entre sesiones", async () => {
    const email = "tip-otrodia@test.local";
    await me(email, "2026-09-11");
    expect((await me(email, "2026-09-12")).tipIndex).toBe(1);
    // Vuelve a entrar ese mismo día, como si fuera desde otro dispositivo:
    // el avance está en la cuenta, así que ve el mismo tip.
    expect((await me(email, "2026-09-12")).tipIndex).toBe(1);
  });

  it("dos personas del mismo día pueden ir por distinto tip", async () => {
    const ana = "tip-ana@test.local", beto = "tip-beto@test.local";
    await me(ana, "2026-09-11");
    await me(beto, "2026-09-11");
    await me(ana, "2026-09-12");
    expect((await me(ana, "2026-09-12")).tipIndex).toBe(1);
    expect((await me(beto, "2026-09-11")).tipIndex).toBe(0);
  });

  it("sin el parámetro today igual devuelve un tip", async () => {
    expect((await me("tip-sin-fecha@test.local")).tipIndex).toBe(0);
  });
});
