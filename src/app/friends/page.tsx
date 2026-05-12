import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { getFriendsState } from "@/lib/friends";
import { FriendsManageClient } from "./friends-manage-client";

export default async function FriendsManagePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/friends");

  const friendsState = await getFriendsState(userId);

  return (
    <div className="min-h-dvh bg-[var(--background)]">
      <FriendsManageClient initialFriendsState={friendsState} />
    </div>
  );
}
