import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { publicLabel } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { ThemeToggle } from "@/components/ThemeToggle";
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

  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex gap-2 sm:right-4 sm:top-4">
        <ThemeToggle />
      </div>
      <Link
        href="/"
        className="text-sm font-medium text-[var(--app-accent)] underline-offset-2 hover:underline"
      >
        ← Dashboard
      </Link>
      <h1 className="mt-6 font-display text-2xl text-[var(--foreground)]">
        Your profile
      </h1>
      <p className="mt-1 text-sm text-[var(--app-muted)]">
        How you show up to friends — handle, photo, and name summary.
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
          Overview
        </p>
        <p className="mt-2 text-sm text-[var(--foreground)]">
          <span className="font-medium">{label}</span>
        </p>
        <p className="mt-1 text-xs text-[var(--app-muted)]">
          {user.displayName?.trim()
            ? "Display name is set at sign-up."
            : "Add a display name next time you create an account — yours is empty."}
        </p>
        <p className="mt-3 text-xs text-[var(--app-muted)]">
          Email <span className="text-[var(--foreground)]/80">{user.email}</span>
        </p>
      </div>

      <div className="mt-6">
        <ProfileIdentityClient
          viewerUserId={userId}
          initialHandle={user.handle ?? ""}
          initialHasAvatar={hasAvatar}
          publicLabel={label}
        />
      </div>
    </div>
  );
}
