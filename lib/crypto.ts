import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * AES-256-GCM encryption for access tokens at rest.
 * TOKEN_ENCRYPTION_KEY must be 32 bytes, hex-encoded (64 hex chars).
 * Generate one with: openssl rand -hex 32
 */

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "hex");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes hex (64 chars)");
  return buf;
}

/** Returns iv.ciphertext.authTag, each base64url-encoded. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, enc, tag].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(stored: string): string {
  const [ivB64, encB64, tagB64] = stored.split(".");
  if (!ivB64 || !encB64 || !tagB64) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Verify Meta's X-Hub-Signature-256 header: "sha256=<hmac-sha256(appSecret, rawBody)>".
 * Constant-time comparison; returns false on any malformed input.
 */
export function verifyMetaSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  appSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
