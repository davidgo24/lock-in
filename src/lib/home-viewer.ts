import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const homeViewerSelect = {
  displayName: true,
  email: true,
  avatarBytes: true,
} as const satisfies Prisma.UserSelect;

export type HomeViewer = Prisma.UserGetPayload<{ select: typeof homeViewerSelect }>;

export async function getHomeViewer(userId: string): Promise<HomeViewer | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: homeViewerSelect,
  });
}

export function homeViewerHasAvatar(v: HomeViewer): boolean {
  return v.avatarBytes != null && v.avatarBytes.length > 0;
}
