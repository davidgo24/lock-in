import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { publicLabel } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileTabBar } from "@/components/activity-app/MobileTabBar";
import { ProfileIdentityClient } from "./profile-identity-client";

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/profile");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      displayName: true,
      handle: true,
      avatarBytes: true,
    },
  });
  if (!user) redirect("/login?next=/profile");

  const hasAvatar =
    user.avatarBytes != null && user.avatarBytes.length > 0;
  const label = publicLabel({
    id: userId,
    displayName: user.displayName,
    handle: user.handle,
    avatarBytes: user.avatarBytes,
  });
  const displayLine =
    user.displayName?.trim() || (user.handle ? `@${user.handle}` : "You");

  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-4 py-8 pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))] xl:pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex gap-2 sm:right-4 sm:top-4">
        <ThemeToggle />
      </div>
      <Link
        href="/"
        className="text-sm font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="mt-6 flex flex-col items-center gap-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-6 shadow-lg shadow-black/10 sm:flex-row sm:items-center sm:gap-6">
        {hasAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/avatar/${userId}`}
            alt=""
            width={112}
            height={112}
            className="h-28 w-28 shrink-0 rounded-full border-2 border-[var(--app-border)] object-cover"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-[var(--app-border)] bg-[var(--app-accent-muted)] text-3xl font-semibold text-[var(--app-accent)]">
            {label.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-display text-2xl tracking-tight text-[var(--foreground)]">
            {displayLine}
          </p>
          {user.handle ? (
            <p className="mt-1 text-base text-[var(--app-muted)]">
              @{user.handle}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--app-muted)]">
              No handle yet — add one below so friends can find you.
            </p>
          )}
          <p className="mt-3 text-xs text-[var(--app-muted)]">
            {user.email}
          </p>
          <Link
            href="/friends"
            className="mt-4 inline-flex text-sm font-medium text-[var(--app-accent)] underline underline-offset-2"
          >
            Manage friends
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <ProfileIdentityClient
          key={`${user.displayName ?? ""}\0${user.handle ?? ""}`}
          viewerUserId={userId}
          initialDisplayName={user.displayName ?? ""}
          initialHandle={user.handle ?? ""}
          initialHasAvatar={hasAvatar}
          publicLabel={label}
        />
      </div>
      <MobileTabBar />
    </div>
  );
}
