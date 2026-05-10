/** Strip @ and lowercase; does not validate length/charset. */
export function normalizeHandleInput(raw: string): string {
  return raw.trim().replace(/^@+/u, "").toLowerCase();
}

/** Returns error message or null if valid. */
export function validateHandle(handle: string): string | null {
  if (handle.length < 3 || handle.length > 30) {
    return "Handle must be 3–30 characters.";
  }
  if (!/^[a-z0-9_]+$/u.test(handle)) {
    return "Use lowercase letters, numbers, and underscores only.";
  }
  return null;
}
