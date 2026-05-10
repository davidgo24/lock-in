export const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * Single source of truth for deriving the JWT signing key.
 * Middleware returns null when unset/short so requests fail closed without throwing during import.
 */
export function getSessionSecretKeyBytes(): Uint8Array | null {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < MIN_SESSION_SECRET_LENGTH) return null;
  return new TextEncoder().encode(s);
}

/** For routes that create/verify sessions — throws if misconfigured. */
export function requireSessionSecretKeyBytes(): Uint8Array {
  const key = getSessionSecretKeyBytes();
  if (!key) {
    throw new Error(
      `SESSION_SECRET must be at least ${MIN_SESSION_SECRET_LENGTH} characters`,
    );
  }
  return key;
}
