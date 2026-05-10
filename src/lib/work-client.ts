import type { WorkEntryRow } from "@/components/WorkEntriesFeed";

export type ActivityNotificationRow = {
  id: string;
  type: "CLAP" | "COMMENT";
  readAt: string | null;
  createdAt: string;
  actorLabel: string;
  sessionId: string;
  sessionSummarySnippet: string;
};

export type ApiWorkEntry = {
  id: string;
  summary: string;
  durationSec: number;
  createdAt: string | Date;
  workDate: string | Date;
  project: { name: string; isMisc: boolean };
  authorLabel?: string;
  authorUserId?: string;
  authorHasAvatar?: boolean;
  social?: {
    clapCount: number;
    clappedByMe: boolean;
    comments: {
      authorLabel: string;
      authorUserId: string;
      authorHasAvatar: boolean;
      body: string;
      createdAt: string;
    }[];
    myComment: string | null;
  };
};

export function parseWorkEntryFromApi(e: ApiWorkEntry): WorkEntryRow {
  return {
    id: e.id,
    summary: e.summary,
    durationSec: e.durationSec,
    createdAt:
      typeof e.createdAt === "string"
        ? e.createdAt
        : new Date(e.createdAt).toISOString(),
    workDate:
      typeof e.workDate === "string"
        ? e.workDate.slice(0, 10)
        : new Date(e.workDate).toISOString().slice(0, 10),
    project: e.project,
    authorLabel: e.authorLabel,
    authorUserId: e.authorUserId,
    authorHasAvatar: e.authorHasAvatar,
    social: e.social,
  };
}
