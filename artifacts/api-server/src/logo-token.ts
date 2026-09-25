import crypto from "node:crypto";

// Generated fresh per process: round tokens only need to stay valid for the
// lifetime of a round (seconds), never across a restart/redeploy, so there's
// no need to persist or share this key.
const key = crypto.randomBytes(32);
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type LogoTokenPayload = { itemId: string; themeId: string };

// Lets the server hand a catalog item's id/theme to the client (to fetch its
// image, check a guess, or file a report) without the client ever seeing
// either value itself — catalog ids are answer slugs (e.g.
// "brands:louisvuitton" for "Louis Vuitton"), so shipping them raw (or
// merely base64-encoded, which is trivially reversible and not actual
// secrecy) would hand out the answer before the round is over. The payload
// is AES-256-GCM encrypted, not just signed, so the token itself carries no
// recoverable information without the server's key.
export function signLogoToken(payload: LogoTokenPayload): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, encrypted, authTag].map((buf) => buf.toString("base64url")).join(".");
}

export function verifyLogoToken(token: unknown): LogoTokenPayload | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ivPart, dataPart, tagPart] = parts as [string, string, string];
  try {
    const iv = Buffer.from(ivPart, "base64url");
    const data = Buffer.from(dataPart, "base64url");
    const authTag = Buffer.from(tagPart, "base64url");
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) return null;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const parsed: unknown = JSON.parse(decrypted.toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).itemId !== "string" ||
      typeof (parsed as Record<string, unknown>).themeId !== "string"
    ) {
      return null;
    }
    return parsed as LogoTokenPayload;
  } catch {
    return null;
  }
}
