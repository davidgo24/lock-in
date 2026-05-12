import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { publicLabel } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { getRecentEntriesForFriendProfile } from "@/lib/work-entries";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FriendProfileFeed } from "./friend-profile-feed";

type Props = { params: Promise<{ userId: string }> };

export default async function FriendProfilePage({ params }: Props) {
  const viewerId = await getSessionUserId();
  if (!viewerId) redirect("/login");

  const { userId } = await params;
  if (userId === viewerId) {
    redirect("/profile");
  }

  const entries = await getRecentEntriesForFriendProfile(viewerId, userId);
  if (entries === null) notFound();

  const friend = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      handle: true,
      avatarBytes: true,
      activeFocusEndsAt: true,
      activeFocusProject: { select: { name: true, isMisc: true } },
    },
  });
  if (!friend) notFound();

  const friendMini = {
    id: userId,
    displayName: friend.displayName,
    handle: friend.handle,
    avatarBytes: friend.avatarBytes,
  };
  const label = publicLabel(friendMini);
  const hasAvatar =
    friend.avatarBytes != null && friend.avatarBytes.length > 0;

  const now = new Date();
  const focusActive =
    friend.activeFocusEndsAt != null &&
    friend.activeFocusEndsAt.getTime() > now.getTime();
  const focusLabel =
    focusActive && friend.activeFocusProject
      ? friend.activeFocusProject.isMisc
        ? "General"
        : friend.activeFocusProject.name
      : null;

  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 sm:right-4 sm:top-4">
        <ThemeToggle />
      </div>
      <Link
        href="/"
        className="text-sm font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="mt-6 flex items-center gap-4">
        {hasAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/avatar/${userId}`}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 rounded-full border border-[var(--app-border)] object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent-muted)] text-xl font-semibold text-[var(--app-accent)]">
            {label.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-xl text-[var(--foreground)]">
            {label}
          </h1>
          {friend.handle ? (
            <p className="text-sm text-[var(--app-muted)]">@{friend.handle}</p>
          ) : null}
          {focusActive && focusLabel ? (
            <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              In focus · {focusLabel}
            </p>
          ) : (
            <p className="mt-2 text-xs text-[var(--app-muted)]">
              Not in a live session right now
            </p>
          )}
        </div>
      </div>

      <div className="mt-8">
        <FriendProfileFeed
          entries={entries}
          friendLabel={label}
          friendUserId={userId}
          friendHasAvatar={hasAvatar}
        />
      </div>
    </div>
  );
}
