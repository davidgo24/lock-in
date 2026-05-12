"use client";

import {
  WorkEntriesFeed,
  type WorkEntryRow,
} from "@/components/WorkEntriesFeed";

export function FriendProfileFeed({
  entries,
  friendLabel,
  friendUserId,
  friendHasAvatar,
}: {
  entries: WorkEntryRow[];
  friendLabel: string;
  friendUserId: string;
  friendHasAvatar: boolean;
}) {
  return (
    <WorkEntriesFeed
      entries={entries}
      displayName={friendLabel}
      variant="you"
      title="Their sessions"
      subtitle="Logged focus blocks — same entries you see mixed into the friend feed."
      emptyMessage="No sessions logged yet."
      viewerUserId={friendUserId}
      viewerHasAvatar={friendHasAvatar}
    />
  );
}
