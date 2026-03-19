import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? "";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// ---------------------------------------------------------------------------
// Token encryption / decryption (AES-256-GCM)
// ---------------------------------------------------------------------------

/**
 * Encrypts a token using AES-256-GCM.
 * Returns a base64-encoded string containing IV + ciphertext + auth tag.
 */
export function encryptToken(token: string): string {
  const key = deriveKey(TOKEN_ENCRYPTION_KEY);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(token, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString("base64");
}

/**
 * Decrypts a token that was encrypted with encryptToken().
 */
export function decryptToken(encrypted: string): string {
  const key = deriveKey(TOKEN_ENCRYPTION_KEY);
  const buffer = Buffer.from(encrypted, "base64");

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const ciphertext = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Derives a 32-byte key from the encryption key string using SHA-256.
 */
function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}
