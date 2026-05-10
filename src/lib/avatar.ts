/** Max avatar upload size (8 MiB — typical phone photos exceed 512KB). */
export const AVATAR_MAX_MIB = 8;
export const AVATAR_MAX_BYTES = AVATAR_MAX_MIB * 1024 * 1024;

const JPEG = [0xff, 0xd8, 0xff] as const;
const PNG = [0x89, 0x50, 0x4e, 0x47] as const;
const GIF = [0x47, 0x49, 0x46] as const;

function matchPrefix(buf: Uint8Array, prefix: readonly number[]): boolean {
  if (buf.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (buf[i] !== prefix[i]) return false;
  }
  return true;
}

/** RIFF....WEBP at offset 8 */
function isWebp(buf: Uint8Array): boolean {
  if (buf.length < 12) return false;
  if (buf[0] !== 0x52 || buf[1] !== 0x49 || buf[2] !== 0x46 || buf[3] !== 0x46)
    return false;
  if (
    buf[8] !== 0x57 ||
    buf[9] !== 0x45 ||
    buf[10] !== 0x42 ||
    buf[11] !== 0x50
  )
    return false;
  return true;
}

export function sniffAvatarMime(buf: Uint8Array): string | null {
  if (matchPrefix(buf, JPEG)) return "image/jpeg";
  if (matchPrefix(buf, PNG)) return "image/png";
  if (matchPrefix(buf, GIF)) return "image/gif";
  if (isWebp(buf)) return "image/webp";
  return null;
}

export function validateAvatarFile(buf: Uint8Array): { mime: string } | null {
  if (buf.length < 12 || buf.length > AVATAR_MAX_BYTES) return null;
  const mime = sniffAvatarMime(buf);
  if (!mime) return null;
  return { mime };
}
