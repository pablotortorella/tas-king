import { describe, it, expect } from "vitest";
import { deployMessage, MAX_MESSAGE_LENGTH } from "../scripts/deploy-message.mjs";

describe("deployMessage", () => {
  it("arma «<sha7> · <rama>» con el árbol limpio", () => {
    expect(deployMessage({ sha: "6afbb87", branch: "main", dirty: false })).toBe("6afbb87 · main");
  });

  it("recorta un SHA largo a 7 caracteres", () => {
    expect(deployMessage({ sha: "6afbb87d82beeb0000000000000000000000abcd", branch: "main", dirty: false })).toBe("6afbb87 · main");
  });

  it("marca los cambios sin commitear", () => {
    expect(deployMessage({ sha: "6afbb87", branch: "feature/x", dirty: true })).toBe("6afbb87 · feature/x · con cambios sin commitear");
  });

  it("recorta la rama con «…» para no pasar de 100 caracteres, también con árbol sucio", () => {
    const branch = "feature/" + "rama-larguisima-".repeat(10);
    for (const dirty of [false, true]) {
      const message = deployMessage({ sha: "6afbb87", branch, dirty });
      expect(message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
      expect(message.startsWith("6afbb87 · feature/")).toBe(true);
      expect(message).toContain("…");
      expect(message.endsWith("con cambios sin commitear")).toBe(dirty);
    }
  });

  it("lanza con un SHA inválido", () => {
    for (const sha of ["", "abc", "xyz1234", undefined, "6afbb87".repeat(8)]) {
      expect(() => deployMessage({ sha, branch: "main", dirty: false })).toThrow(/SHA/);
    }
  });
});
