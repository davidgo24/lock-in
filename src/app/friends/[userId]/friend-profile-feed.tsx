"use client";

import { useRouter } from "next/navigation";
import {
  WorkEntriesFeed,
  type WorkEntryRow,
} from "@/components/WorkEntriesFeed";

export function FriendProfileFeed({
  entries,
  friendLabel,
  viewerUserId,
  viewerHasAvatar,
}: {
  entries: WorkEntryRow[];
  friendLabel: string;
  viewerUserId: string;
  viewerHasAvatar: boolean;
}) {
  const router = useRouter();
  return (
    <WorkEntriesFeed
      entries={entries}
      displayName={friendLabel}
      variant="you"
      title="Their sessions"
      subtitle="Logged focus blocks — same entries you see mixed into the friend feed."
      emptyMessage="No sessions logged yet."
      viewerUserId={viewerUserId}
      viewerHasAvatar={viewerHasAvatar}
      onRefresh={() => router.refresh()}
    />
  );
}
