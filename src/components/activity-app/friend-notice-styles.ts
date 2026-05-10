export type FriendNotice = {
  text: string;
  kind: "error" | "success" | "info";
};

export function friendNoticeClass(kind: FriendNotice["kind"]): string {
  if (kind === "error") return "text-red-500";
  if (kind === "success") return "text-emerald-600";
  return "text-[var(--foreground)]/90";
}
