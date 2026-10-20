export const RATE_LIMIT_RETRY_SECONDS = 60;

export async function checkRateLimit(limiter, key) {
  if (!limiter || typeof limiter.limit !== "function") return { configured: false, allowed: true };
  const result = await limiter.limit({ key });
  return { configured: true, allowed: result?.success === true };
}
