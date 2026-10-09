import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Read and validate the encryption key.
 *
 * KEYCROVE_ENCRYPTION_KEY must contain exactly 32 random bytes
 * encoded as a Base64 string.
 *
 * Never commit this key to GitHub or expose it to the client.
 */
function getEncryptionKey() {
  const encodedKey = process.env.KEYCROVE_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error(
      "Encryption configuration is missing. Set KEYCROVE_ENCRYPTION_KEY in the server environment."
    );
  }

  const key = Buffer.from(encodedKey, "base64");

  if (
    key.length !== KEY_LENGTH ||
    key.toString("base64") !== encodedKey
  ) {
    throw new Error(
      "Invalid encryption key. It must be a valid Base64-encoded 32-byte key."
    );
  }

  return key;
}

/**
 * Encrypt a string using AES-256-GCM.
 *
 * A fresh, random initialization vector is generated for every
 * encryption operation.
 *
 * The returned object contains:
 * - version: encryption format version
 * - iv: initialization vector
 * - authTag: authentication tag
 * - ciphertext: encrypted data
 *
 * These values are Base64-encoded for convenient storage.
 */
export function encryptText(plaintext) {
  if (typeof plaintext !== "string") {
    throw new TypeError("The value to encrypt must be a string.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/**
 * Decrypt data previously produced by encryptText().
 *
 * AES-GCM verifies the authentication tag. If the encrypted data
 * or tag has been modified, decryption fails.
 */
export function decryptText(encryptedData) {
  if (
    !encryptedData ||
    encryptedData.version !== 1 ||
    typeof encryptedData.iv !== "string" ||
    typeof encryptedData.authTag !== "string" ||
    typeof encryptedData.ciphertext !== "string"
  ) {
    throw new TypeError("Invalid encrypted data format.");
  }

  const iv = Buffer.from(encryptedData.iv, "base64");
  const authTag = Buffer.from(encryptedData.authTag, "base64");
  const ciphertext = Buffer.from(
    encryptedData.ciphertext,
    "base64"
  );

  if (
    iv.length !== IV_LENGTH ||
    authTag.length !== AUTH_TAG_LENGTH ||
    iv.toString("base64") !== encryptedData.iv ||
    authTag.toString("base64") !== encryptedData.authTag ||
    ciphertext.toString("base64") !== encryptedData.ciphertext
  ) {
    throw new TypeError("Invalid encrypted data encoding.");
  }

  const key = getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * Encrypt a JSON-compatible value.
 *
 * Useful when a vault entry needs to be encrypted as a complete object.
 */
export function encryptJson(value) {
  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError("The value could not be converted to JSON.");
  }

  if (serialized === undefined) {
    throw new TypeError("The value must be JSON-serializable.");
  }

  return encryptText(serialized);
}

/**
 * Decrypt and parse a JSON value.
 */
export function decryptJson(encryptedData) {
  const plaintext = decryptText(encryptedData);

  try {
    return JSON.parse(plaintext);
  } catch {
    throw new Error("The decrypted data is not valid JSON.");
  }
}
