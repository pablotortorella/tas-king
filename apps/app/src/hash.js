// Huella SHA-256 (hexadecimal) de un texto: identifica archivos importados y solicitudes idempotentes.
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
