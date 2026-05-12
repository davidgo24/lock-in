import { prisma } from "@/lib/prisma";
import { friendshipKeyPair } from "@/lib/friends";
import { normalizeHandleInput } from "@/lib/handle";

/** New accounts are connected with this account so the creator is everyone's first friend. */
export const WELCOME_FRIEND_HANDLE = "imtiredboss";

/**
 * Ensures an undirected friendship between `newUserId` and the welcome account.
 * No-ops if the handle does not exist, or if user is the welcome account.
 */
export async function ensureWelcomeFriendship(newUserId: string): Promise<void> {
  const handle = normalizeHandleInput(WELCOME_FRIEND_HANDLE);
  const welcome = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  if (!welcome || welcome.id === newUserId) return;

  const [a, b] = friendshipKeyPair(newUserId, welcome.id);
  try {
    await prisma.friendship.create({
      data: { userAId: a, userBId: b },
    });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code?: string }).code)
        : "";
    if (code === "P2002") return;
    throw e;
  }
}
