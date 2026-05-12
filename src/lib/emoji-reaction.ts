/**
 * Normalize a user-chosen reaction to exactly one Unicode grapheme cluster
 * (one “character” from the user’s perspective, including ZWJ sequences).
 */
export function normalizeReactionEmoji(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (
    typeof Intl === "undefined" ||
    typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter !== "function"
  ) {
    return t.length <= 8 ? t.slice(0, 8) : null;
  }
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const parts = [...seg.segment(t)];
  if (parts.length === 0) return null;
  if (parts.length > 1) return null;
  const out = parts[0]!.segment;
  if (out.length > 32) return null;
  if (/[\u0000-\u001F\u007F]/.test(out)) return null;
  return out;
}

export const REACTION_QUICK_PICKS = [
  "👏",
  "❤️",
  "🔥",
  "💪",
  "✨",
  "🎉",
  "👍",
  "😮",
  "🙌",
  "💯",
  "🌟",
  "✅",
] as const;
