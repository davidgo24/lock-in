"use client";

import { useState } from "react";

export function FriendMiniAvatar(props: {
  userId: string;
  hasAvatar: boolean;
  initial: string;
  cacheBust: number;
}) {
  const { userId, hasAvatar, initial, cacheBust } = props;
  const [failed, setFailed] = useState(false);
  if (hasAvatar && !failed) {
    const qs = cacheBust > 0 ? `?v=${cacheBust}` : "";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/avatar/${userId}${qs}`}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full border border-[var(--app-border)] object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent)]/10 text-xs font-semibold text-[var(--app-accent)]"
      aria-hidden
    >
      {initial}
    </div>
  );
}
