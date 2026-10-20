import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "../src/rate-limit.js";

describe("rate limiting", () => {
  it("permite tests locales sin binding y usa el sujeto como key cuando existe", async () => {
    await expect(checkRateLimit(undefined, "subject")).resolves.toEqual({ configured: false, allowed: true });
    const limit = vi.fn().mockResolvedValue({ success: false });
    await expect(checkRateLimit({ limit }, "session-1")).resolves.toEqual({ configured: true, allowed: false });
    expect(limit).toHaveBeenCalledWith({ key: "session-1" });
  });
});
