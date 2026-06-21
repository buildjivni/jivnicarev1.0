import crypto from "crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Helper to derive a 32-byte key from our environment variable
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Cryptography failed: ENCRYPTION_KEY / JWT_SECRET environment variable is missing!");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

// Helper to get the HMAC secret key
function getHmacSecret(): string {
  const secret = process.env.HMAC_SECRET_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Cryptography failed: HMAC_SECRET_KEY / JWT_SECRET environment variable is missing!");
  }
  return secret;
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns a colon-separated string: "iv:authTag:encryptedContent"
 */
export function encrypt(text: string): string {
  if (!text) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a colon-separated encrypted string ("iv:authTag:encryptedContent") using AES-256-GCM.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      // If not encrypted in the expected format, return as is (e.g. for pre-existing plain data or fallback)
      return encryptedText;
    }
    
    const [ivHex, authTagHex, encryptedContent] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedContent, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption failed:", error);
    return encryptedText;
  }
}

/**
 * Generates a deterministic SHA-256 HMAC hash of a phone number for indexing and lookups.
 */
export function generatePhoneHash(phone: string): string {
  if (!phone) return "";
  const cleanedPhone = phone.trim();
  return crypto
    .createHmac("sha256", getHmacSecret())
    .update(cleanedPhone)
    .digest("hex");
}
