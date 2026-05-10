"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Archive,
  Clock,
  Flame,
  Folder,
  Pause,
  Play,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import {
  type WorkEntryRow,
} from "@/components/WorkEntriesFeed";
import {
  playStartCountdown,
  playTimerCompleteRing,
} from "@/lib/sounds";
import {
  notifyTimerComplete,
  notifyTimerPausedLong,
  requestTimerNotifyPermissionIfNeeded,
} from "@/lib/timer-notify";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";
import type { FriendsStatePayload } from "@/lib/friends";
import type { StatsBundle } from "@/lib/stats";
import {
  friendNoticeClass,
  type FriendNotice,
} from "@/components/activity-app/friend-notice-styles";
import { SaveSessionScreens } from "@/components/activity-app/SaveSessionScreens";
import { DashboardHeader } from "@/components/activity-app/DashboardHeader";
import { CommunitySidebar } from "@/components/activity-app/CommunitySidebar";
import type { ApiWorkEntry, ActivityNotificationRow } from "@/lib/work-client";
import { parseWorkEntryFromApi } from "@/lib/work-client";
import {
  PRESETS,
  CUSTOM_PRESET_IDX,
  TIMER_STORAGE_KEY,
  clampDurationSec,
  clearTimerStorage,
  MAX_TIMER_SEC,
  MIN_TIMER_SEC,
  parsePersisted,
  tryMigrateLegacyV1Key,
  writeTimerStorage,
} from "@/lib/activity-timer-local";

type Project = {
  id: string;
  name: string;
  isMisc: boolean;
  totalSec?: number;
  lastSessionAt?: string | null;
};

function projectHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function formatProjectTotal(sec: number): string {
  if (sec <= 0) return "No time yet";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m total`;
  return `${m}m total`;
}

function formatWeeklyHoursLine(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatRelativeShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 604800) return `${Math.round(s / 86400)}d ago`;
  return "a while ago";
}

const PAUSE_NUDGE_MS = 5 * 60 * 1000;

function presetIdxForDuration(totalSec: number): number {
  const i = PRESETS.findIndex((p) => p.seconds === totalSec);
  return i >= 0 ? i : CUSTOM_PRESET_IDX;
}

function splitHoursMinutes(totalSec: number): { h: number; m: number } {
  const s = clampDurationSec(totalSec);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${pad2(s)}`;
}

function localYmdFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Elapsed seconds when stopping early — save real time focused, at least 1 second. */
function durationSecToStore(raw: number): number {
  return Math.max(1, Math.round(raw));
}

function formatDurationLabel(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return m === 1 ? "1 min" : `${m} min`;
  return `${m} min ${s} sec`;
}

function defaultSelectedId(projects: Project[]) {
  const misc = projects.find((p) => p.isMisc);
  return misc?.id ?? projects[0]?.id ?? "";
}

/** Tell the server when a focus timer is running so friends can see “active” (best-effort). */
function postFocusStatus(endsAtMs: number | null) {
  const body =
    endsAtMs == null
      ? { endsAt: null }
      : { endsAt: new Date(endsAtMs).toISOString() };
  void fetch("/api/me/focus-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

type ActivityAppProps = {
  initialProjects: Project[];
  initialArchivedProjects: Project[];
  initialStats: StatsBundle;
  initialWorkEntries: WorkEntryRow[];
  initialFriendFeed: WorkEntryRow[];
  initialFriendsState: FriendsStatePayload;
  displayName: string;
  appName: string;
  viewerUserId: string;
  initialViewerHasAvatar: boolean;
};

export function ActivityApp({
  initialProjects,
  initialArchivedProjects,
  initialStats,
  initialWorkEntries,
  initialFriendFeed,
  initialFriendsState,
  displayName,
  appName,
  viewerUserId,
  initialViewerHasAvatar,
}: ActivityAppProps) {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>(
    initialArchivedProjects,
  );
  const [stats, setStats] = useState<StatsBundle>(initialStats);
  const [selectedId, setSelectedId] = useState(() =>
    defaultSelectedId(initialProjects),
  );
  const [presetIdx, setPresetIdx] = useState(0);
  const [durationSec, setDurationSec] = useState(PRESETS[0].seconds);
  const [remaining, setRemaining] = useState(PRESETS[0].seconds);
  const [running, setRunning] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [goalEdit, setGoalEdit] = useState(false);
  const [goalDraft, setGoalDraft] = useState("7");
  const [arming, setArming] = useState(false);
  const [paused, setPaused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationSecRef = useRef(durationSec);
  const selectedIdRef = useRef(selectedId);
  const presetIdxRef = useRef(presetIdx);
  const pauseNudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedMeta = useRef<{ projectId: string; durationSec: number } | null>(
    null,
  );
  const [saveProjectId, setSaveProjectId] = useState<string | null>(null);
  const [sessionSaveHint, setSessionSaveHint] = useState<{
    durationSec: number;
    early: boolean;
  } | null>(null);

  const remainingRef = useRef(remaining);
  const timerEndsAtRef = useRef<number | null>(null);
  const [workEntries, setWorkEntries] =
    useState<WorkEntryRow[]>(initialWorkEntries);
  const [friendFeed, setFriendFeed] =
    useState<WorkEntryRow[]>(initialFriendFeed);
  const [notif, setNotif] = useState<{
    items: ActivityNotificationRow[];
    unreadCount: number;
  }>({ items: [], unreadCount: 0 });
  const [notifOpen, setNotifOpen] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);
  const [friendsState, setFriendsState] =
    useState<FriendsStatePayload>(initialFriendsState);
  const [handleDraft, setHandleDraft] = useState(
    initialFriendsState.myHandle ?? "",
  );
  const [requestHandleDraft, setRequestHandleDraft] = useState("");
  const [friendNotice, setFriendNotice] = useState<FriendNotice | null>(null);
  const [handleSaving, setHandleSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"you" | "community">(() =>
    initialFriendsState.incoming.length > 0 ? "community" : "you",
  );
  /** Community tab: full friends UI is heavy — keep a slim summary until the user expands. */
  const [friendsPanelExpanded, setFriendsPanelExpanded] = useState(false);
  const [viewerHasAvatar, setViewerHasAvatar] = useState(initialViewerHasAvatar);
  const [avatarCacheBust, setAvatarCacheBust] = useState(0);
  const [dashNotice, setDashNotice] = useState<FriendNotice | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState(false);
  const pendingDiscardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const pendingArchiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [pendingUnfriendId, setPendingUnfriendId] = useState<string | null>(
    null,
  );
  const pendingUnfriendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevIncomingCountRef = useRef(initialFriendsState.incoming.length);

  useEffect(() => {
    presetIdxRef.current = presetIdx;
  }, [presetIdx]);

  const loadAll = useCallback(async () => {
    const [pRes, sRes, eRes, fRes, ffRes, nRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/stats"),
      fetch("/api/entries"),
      fetch("/api/friends"),
      fetch("/api/entries/friends"),
      fetch("/api/notifications"),
    ]);
    const pJson = await pRes.json();
    const sJson = await sRes.json();
    const eJson = await eRes.json();
    const fJson = (await fRes.json()) as FriendsStatePayload;
    const ffJson = await ffRes.json();

    setWorkEntries(
      (eJson.entries ?? []).map((e: ApiWorkEntry) => parseWorkEntryFromApi(e)),
    );

    if (fRes.ok) {
      setFriendsState(fJson);
      setHandleDraft(fJson.myHandle ?? "");
    }

    if (ffRes.ok) {
      setFriendFeed(
        (ffJson.entries ?? []).map((e: ApiWorkEntry) =>
          parseWorkEntryFromApi(e),
        ),
      );
    }

    if (nRes.ok) {
      const nJson = await nRes.json();
      setNotif({
        items: (nJson.items ?? []) as ActivityNotificationRow[],
        unreadCount:
          typeof nJson.unreadCount === "number" ? nJson.unreadCount : 0,
      });
    }

    const mapProj = (x: {
      id: string;
      name: string;
      isMisc: boolean;
      totalSec?: number;
      lastSessionAt?: string | null;
    }): Project => ({
      id: x.id,
      name: x.name,
      isMisc: x.isMisc,
      totalSec: typeof x.totalSec === "number" ? x.totalSec : 0,
      lastSessionAt: x.lastSessionAt ?? null,
    });

    setProjects((pJson.projects ?? []).map(mapProj));
    setArchivedProjects((pJson.archivedProjects ?? []).map(mapProj));

    setStats({
      heatmap: sJson.heatmap ?? {},
      heatmapRangeStart: sJson.heatmapRangeStart ?? localYmdFromDate(new Date()),
      totalMinutesYear: sJson.totalMinutesYear ?? 0,
      streak: sJson.streak ?? 0,
      sessionCount: sJson.sessionCount ?? 0,
      weeklyLoggedMinutes: sJson.weeklyLoggedMinutes ?? 0,
      weeklyGoalHours: sJson.weeklyGoalHours ?? 7,
      activeProjectsCount: sJson.activeProjectsCount ?? 1,
    });

    setSelectedId((prev) => {
      if (prev && (pJson.projects ?? []).some((x: Project) => x.id === prev)) {
        return prev;
      }
      const misc = (pJson.projects ?? []).find((x: Project) => x.isMisc);
      return misc?.id ?? (pJson.projects?.[0]?.id ?? "");
    });

    const profRes = await fetch("/api/profile");
    if (profRes.ok) {
      const pj = await profRes.json();
      setViewerHasAvatar(!!(pj as { hasAvatar?: boolean }).hasAvatar);
    }
  }, []);

  const refreshEntryFeeds = useCallback(async () => {
    const [eRes, ffRes, nRes] = await Promise.all([
      fetch("/api/entries"),
      fetch("/api/entries/friends"),
      fetch("/api/notifications"),
    ]);
    const eJson = await eRes.json();
    const ffJson = await ffRes.json();
    setWorkEntries(
      (eJson.entries ?? []).map((e: ApiWorkEntry) => parseWorkEntryFromApi(e)),
    );
    if (ffRes.ok) {
      setFriendFeed(
        (ffJson.entries ?? []).map((e: ApiWorkEntry) =>
          parseWorkEntryFromApi(e),
        ),
      );
    }
    if (nRes.ok) {
      const nJson = await nRes.json();
      setNotif({
        items: (nJson.items ?? []) as ActivityNotificationRow[],
        unreadCount:
          typeof nJson.unreadCount === "number" ? nJson.unreadCount : 0,
      });
    }
  }, []);

  async function toggleNotifPanel() {
    if (notifOpen) {
      setNotifOpen(false);
      return;
    }
    setNotifOpen(true);
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const nRes = await fetch("/api/notifications");
    if (nRes.ok) {
      const nJson = await nRes.json();
      setNotif({
        items: (nJson.items ?? []) as ActivityNotificationRow[],
        unreadCount: 0,
      });
    }
  }

  /* Open Community when `?tab=community` — syncs URL (external) → UI. */
  useLayoutEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "community") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- `tab` query param is external navigation state
      setSidebarTab("community");
    }
    if (typeof window !== "undefined" && tab) {
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [searchParams]);

  useEffect(() => {
    const n = friendsState.incoming.length;
    if (n > prevIncomingCountRef.current) {
      setSidebarTab("community");
    }
    prevIncomingCountRef.current = n;
  }, [friendsState.incoming.length]);

  useEffect(() => {
    if (sidebarTab !== "community") return;
    const refreshFriends = () => {
      void (async () => {
        const res = await fetch("/api/friends");
        if (!res.ok) return;
        const j = (await res.json()) as FriendsStatePayload;
        setFriendsState(j);
      })();
    };
    refreshFriends();
    const id = setInterval(refreshFriends, 35_000);
    return () => clearInterval(id);
  }, [sidebarTab]);

  useEffect(() => {
    void (async () => {
      const nRes = await fetch("/api/notifications");
      if (nRes.ok) {
        const nJson = await nRes.json();
        setNotif({
          items: (nJson.items ?? []) as ActivityNotificationRow[],
          unreadCount:
            typeof nJson.unreadCount === "number" ? nJson.unreadCount : 0,
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    function onDocMouseDown(ev: MouseEvent) {
      if (
        notifPanelRef.current &&
        !notifPanelRef.current.contains(ev.target as Node)
      ) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [notifOpen]);

  useEffect(() => {
    return () => {
      if (pendingDiscardTimerRef.current) {
        clearTimeout(pendingDiscardTimerRef.current);
      }
      if (pendingArchiveTimerRef.current) {
        clearTimeout(pendingArchiveTimerRef.current);
      }
      if (pendingUnfriendTimerRef.current) {
        clearTimeout(pendingUnfriendTimerRef.current);
      }
      clearPauseNudge();
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTick();
    };
  }, []);

  useEffect(() => {
    durationSecRef.current = durationSec;
  }, [durationSec]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  function clearTick() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function clearPauseNudge() {
    if (pauseNudgeTimerRef.current != null) {
      clearTimeout(pauseNudgeTimerRef.current);
      pauseNudgeTimerRef.current = null;
    }
  }

  function schedulePauseNudge(pausedSince: number) {
    clearPauseNudge();
    const delay = Math.max(0, PAUSE_NUDGE_MS - (Date.now() - pausedSince));
    pauseNudgeTimerRef.current = setTimeout(() => {
      pauseNudgeTimerRef.current = null;
      notifyTimerPausedLong();
      setDashNotice({
        text: "Still there? Your timer is paused — tap Resume when you’re back.",
        kind: "info",
      });
    }, delay);
  }

  const syncFromEndTime = useCallback((playSoundOnComplete: boolean) => {
    const end = timerEndsAtRef.current;
    if (end == null) return;
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    if (left > 0) {
      setRemaining(left);
      return;
    }
    timerEndsAtRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clearTimerStorage();
    setRunning(false);
    setPaused(false);
    clearPauseNudge();
    const pid = selectedIdRef.current;
    const dur = durationSecRef.current;
    completedMeta.current = { projectId: pid, durationSec: dur };
    setSaveProjectId(pid);
    setSessionSaveHint({
      durationSec: dur,
      early: false,
    });
    setShowSave(true);
    setRemaining(0);
    postFocusStatus(null);
    if (playSoundOnComplete) void playTimerCompleteRing();
    if (playSoundOnComplete) notifyTimerComplete();
  }, []);

  const timerHydratedRef = useRef(false);
  /* Timer persistence lives in localStorage; sync once after mount (client external store). */
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (timerHydratedRef.current) return;
    timerHydratedRef.current = true;
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    let p = parsePersisted(raw);
    if (!p) p = tryMigrateLegacyV1Key();
    if (!p) return;

    if (!initialProjects.some((x) => x.id === p.selectedId)) {
      clearTimerStorage();
      return;
    }
    durationSecRef.current = p.durationSec;
    selectedIdRef.current = p.selectedId;
    presetIdxRef.current = p.presetIdx;
    setDurationSec(p.durationSec);
    setPresetIdx(p.presetIdx);
    setSelectedId(p.selectedId);

    if (p.paused) {
      const rem = Math.min(p.remaining, p.durationSec);
      timerEndsAtRef.current = null;
      setRemaining(rem);
      setRunning(true);
      setPaused(true);
      postFocusStatus(null);
      const since = p.pausedSince ?? Date.now();
      schedulePauseNudge(since);
      writeTimerStorage({
        v: 2,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: true,
        remaining: rem,
        endsAt: null,
        pausedSince: since,
      });
      return;
    }

    if (p.endsAt == null) {
      clearTimerStorage();
      return;
    }

    timerEndsAtRef.current = p.endsAt;
    const left = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000));
    if (left <= 0) {
      timerEndsAtRef.current = null;
      clearTimerStorage();
      setRemaining(0);
      setRunning(false);
      setPaused(false);
      completedMeta.current = {
        projectId: p.selectedId,
        durationSec: p.durationSec,
      };
      setSaveProjectId(p.selectedId);
      setSessionSaveHint({
        durationSec: p.durationSec,
        early: false,
      });
      setShowSave(true);
      return;
    }
    setRemaining(left);
    setRunning(true);
    setPaused(false);
    postFocusStatus(p.endsAt);
    writeTimerStorage({
      v: 2,
      selectedId: p.selectedId,
      durationSec: p.durationSec,
      presetIdx: p.presetIdx,
      paused: false,
      remaining: left,
      endsAt: p.endsAt,
      pausedSince: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate; schedulePauseNudge is intentional
  }, [initialProjects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!running || paused) return;
    const tick = () => {
      syncFromEndTime(true);
    };
    clearTick();
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      clearTick();
    };
  }, [running, paused, syncFromEndTime]);

  useEffect(() => {
    if (!running || paused) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        syncFromEndTime(true);
      }
    };
    const onFocus = () => {
      syncFromEndTime(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [running, paused, syncFromEndTime]);

  function applyPreset(idx: number) {
    if (running || arming) return;
    setPresetIdx(idx);
    const sec = clampDurationSec(PRESETS[idx].seconds);
    setDurationSec(sec);
    setRemaining(sec);
  }

  function applyCustomHoursMinutes(h: number, m: number) {
    if (running || arming) return;
    const H = Math.min(24, Math.max(0, Math.floor(Number.isFinite(h) ? h : 0)));
    const M = Math.min(59, Math.max(0, Math.floor(Number.isFinite(m) ? m : 0)));
    const total = clampDurationSec(H * 3600 + M * 60);
    setPresetIdx(presetIdxForDuration(total));
    setDurationSec(total);
    setRemaining(total);
  }

  function pauseSession() {
    if (!running || paused || arming) return;
    clearTick();
    timerEndsAtRef.current = null;
    const rem = remainingRef.current;
    const since = Date.now();
    setPaused(true);
    requestTimerNotifyPermissionIfNeeded();
    writeTimerStorage({
      v: 2,
      selectedId: selectedIdRef.current,
      durationSec: durationSecRef.current,
      presetIdx: presetIdxRef.current,
      paused: true,
      remaining: rem,
      endsAt: null,
      pausedSince: since,
    });
    postFocusStatus(null);
    schedulePauseNudge(since);
  }

  async function resumeTimer() {
    if (!running || !paused || arming) return;
    setArming(true);
    try {
      const rem = remainingRef.current;
      const endsAt = Date.now() + rem * 1000;
      timerEndsAtRef.current = endsAt;
      setPaused(false);
      clearPauseNudge();
      writeTimerStorage({
        v: 2,
        selectedId: selectedIdRef.current,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: false,
        remaining: rem,
        endsAt,
        pausedSince: null,
      });
      postFocusStatus(endsAt);
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    } finally {
      setArming(false);
    }
  }

  async function startTimer() {
    if (!selectedId || running || showSave || arming) return;
    if (pendingDiscardTimerRef.current) {
      clearTimeout(pendingDiscardTimerRef.current);
      pendingDiscardTimerRef.current = null;
    }
    setPendingDiscard(false);
    setDashNotice(null);
    setArming(true);
    const capturedPresetIdx = presetIdx;
    try {
      try {
        const c = new AudioContext();
        await c.resume();
        await c.close();
      } catch {
        /* ignore */
      }
      requestTimerNotifyPermissionIfNeeded();
      await playStartCountdown();
      const dur = durationSecRef.current;
      const sid = selectedIdRef.current;
      const endsAt = Date.now() + dur * 1000;
      timerEndsAtRef.current = endsAt;
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
      setRunning(true);
      setPaused(false);
      clearPauseNudge();
      writeTimerStorage({
        v: 2,
        selectedId: sid,
        durationSec: dur,
        presetIdx: capturedPresetIdx,
        paused: false,
        remaining: Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
        endsAt,
        pausedSince: null,
      });
      postFocusStatus(endsAt);
    } finally {
      setArming(false);
    }
  }

  function onDiscardTap() {
    if (!running) return;
    if (!pendingDiscard) {
      setPendingDiscard(true);
      setDashNotice({
        text: "Tap Discard again within a few seconds to cancel this session (nothing saved).",
        kind: "info",
      });
      if (pendingDiscardTimerRef.current) {
        clearTimeout(pendingDiscardTimerRef.current);
      }
      pendingDiscardTimerRef.current = setTimeout(() => {
        setPendingDiscard(false);
        pendingDiscardTimerRef.current = null;
      }, 5000);
      return;
    }
    if (pendingDiscardTimerRef.current) {
      clearTimeout(pendingDiscardTimerRef.current);
      pendingDiscardTimerRef.current = null;
    }
    setPendingDiscard(false);
    setDashNotice(null);
    discardSession();
  }

  function discardSession() {
    if (!running) return;
    if (pendingDiscardTimerRef.current) {
      clearTimeout(pendingDiscardTimerRef.current);
      pendingDiscardTimerRef.current = null;
    }
    setPendingDiscard(false);
    clearTick();
    timerEndsAtRef.current = null;
    clearTimerStorage();
    setRunning(false);
    setPaused(false);
    clearPauseNudge();
    setRemaining(durationSecRef.current);
    postFocusStatus(null);
  }

  function stopAndLogSession() {
    if (!running) return;
    if (pendingDiscardTimerRef.current) {
      clearTimeout(pendingDiscardTimerRef.current);
      pendingDiscardTimerRef.current = null;
    }
    setPendingDiscard(false);
    const total = durationSecRef.current;
    const end = timerEndsAtRef.current;
    const rem =
      end != null
        ? Math.max(0, Math.ceil((end - Date.now()) / 1000))
        : remainingRef.current;
    const rawElapsed = Math.max(0, total - rem);
    if (rawElapsed < 1) {
      clearTick();
      timerEndsAtRef.current = null;
      clearTimerStorage();
      setRunning(false);
      setPaused(false);
      clearPauseNudge();
      setRemaining(total);
      postFocusStatus(null);
      setDashNotice({
        text: "No time on the clock yet — start the timer or tap Discard.",
        kind: "error",
      });
      return;
    }
    clearTick();
    timerEndsAtRef.current = null;
    clearTimerStorage();
    setRunning(false);
    setPaused(false);
    clearPauseNudge();
    postFocusStatus(null);
    const logged = durationSecToStore(rawElapsed);
    completedMeta.current = {
      projectId: selectedIdRef.current,
      durationSec: logged,
    };
    setSaveProjectId(selectedIdRef.current);
    setSessionSaveHint({
      durationSec: logged,
      early: true,
    });
    setShowSave(true);
  }

  async function saveSession() {
    const meta = completedMeta.current;
    if (!meta) return;
    setSaving(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: meta.projectId,
          durationSec: meta.durationSec,
          workDate: localYmdFromDate(new Date()),
          summary: summary.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setDashNotice({
          text: (j as { error?: string }).error ?? "Could not save",
          kind: "error",
        });
        return;
      }
      setDashNotice(null);
      setShowSave(false);
      setSummary("");
      completedMeta.current = null;
      setSaveProjectId(null);
      setSessionSaveHint(null);
      setRemaining(durationSec);
      void loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function addProject() {
    const name = newProjectName.trim();
    if (!name) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    setNewProjectName("");
    setAddingProject(false);
    const j = await res.json();
    setSelectedId(j.project.id);
    void loadAll();
  }

  async function archiveFocusArea(id: string) {
    if (running || arming) return;
    if (pendingArchiveId !== id) {
      if (pendingArchiveTimerRef.current) {
        clearTimeout(pendingArchiveTimerRef.current);
      }
      setPendingArchiveId(id);
      setDashNotice({
        text: "Tap the archive icon again to hide this focus area from the timer. Your logged time and activity history stay put.",
        kind: "info",
      });
      pendingArchiveTimerRef.current = setTimeout(() => {
        setPendingArchiveId(null);
        pendingArchiveTimerRef.current = null;
      }, 5000);
      return;
    }
    if (pendingArchiveTimerRef.current) {
      clearTimeout(pendingArchiveTimerRef.current);
      pendingArchiveTimerRef.current = null;
    }
    setPendingArchiveId(null);
    setDashNotice(null);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDashNotice({
        text: "Could not archive this focus area.",
        kind: "error",
      });
      return;
    }
    void loadAll();
  }

  async function restoreArchivedProject(id: string) {
    if (running || arming) return;
    const res = await fetch(`/api/projects/${id}/restore`, { method: "POST" });
    if (!res.ok) {
      setDashNotice({
        text: "Could not restore this focus area.",
        kind: "error",
      });
      return;
    }
    void loadAll();
  }

  async function logout() {
    clearTick();
    clearPauseNudge();
    timerEndsAtRef.current = null;
    clearTimerStorage();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const progress = durationSec > 0 ? 1 - remaining / durationSec : 0;
  const circ = 2 * Math.PI * 44;
  const customHm = splitHoursMinutes(durationSec);

  const totalLabel = stats
    ? `Total: ${Math.floor(stats.totalMinutesYear / 60)}h ${stats.totalMinutesYear % 60}m`
    : "Total: —";

  const weeklyPct = stats
    ? Math.min(
        100,
        Math.ceil(
          (stats.weeklyLoggedMinutes / (stats.weeklyGoalHours * 60)) * 100,
        ),
      )
    : 0;

  const saveProject =
    saveProjectId != null
      ? projects.find((p) => p.id === saveProjectId)
      : undefined;

  const selectedProject = projects.find((p) => p.id === selectedId);

  function copyAppLink() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/?tab=community`;
    void navigator.clipboard.writeText(url).then(
      () => {
        setFriendNotice({
          text: "Invite link copied — opens Community for new signups.",
          kind: "success",
        });
      },
      () => {
        setFriendNotice({
          text: `Could not copy. Send them: ${url}`,
          kind: "info",
        });
      },
    );
  }

  async function saveMyHandle() {
    setFriendNotice(null);
    const normalized = normalizeHandleInput(handleDraft);
    const he = validateHandle(normalized);
    if (he) {
      setFriendNotice({ text: he, kind: "error" });
      return;
    }
    setHandleSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handleDraft }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFriendNotice({
          text:
            (j as { error?: string }).error ?? "Could not save handle",
          kind: "error",
        });
        return;
      }
      await loadAll();
      setFriendNotice({
        text: "Handle saved — friends can find you.",
        kind: "success",
      });
    } finally {
      setHandleSaving(false);
    }
  }

  async function sendFriendRequest() {
    setFriendNotice(null);
    const normalized = normalizeHandleInput(requestHandleDraft);
    const he = validateHandle(normalized);
    if (he) {
      setFriendNotice({ text: he, kind: "error" });
      return;
    }
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: requestHandleDraft }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFriendNotice({
        text:
          (j as { error?: string }).error ??
            (res.status === 404 ? "User does not exist." : "Request failed"),
        kind: "error",
      });
      return;
    }
    setFriendsState(j as FriendsStatePayload);
    setRequestHandleDraft("");
    setFriendNotice({ text: "Request sent.", kind: "success" });
    void loadAll();
  }

  async function acceptRequest(requestId: string) {
    setFriendNotice(null);
    const res = await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFriendNotice({
        text: (j as { error?: string }).error ?? "Could not accept",
        kind: "error",
      });
      return;
    }
    setFriendsState(j as FriendsStatePayload);
    setFriendNotice({
      text: "You're connected — their activity shows below.",
      kind: "success",
    });
    void loadAll();
  }

  async function rejectRequest(requestId: string) {
    setFriendNotice(null);
    const res = await fetch("/api/friends/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFriendNotice({
        text: (j as { error?: string }).error ?? "Could not decline",
        kind: "error",
      });
      return;
    }
    setFriendsState(j as FriendsStatePayload);
    setFriendNotice({ text: "Request declined.", kind: "info" });
    void loadAll();
  }

  async function removeFriend(otherUserId: string) {
    if (pendingUnfriendId !== otherUserId) {
      if (pendingUnfriendTimerRef.current) {
        clearTimeout(pendingUnfriendTimerRef.current);
      }
      setPendingUnfriendId(otherUserId);
      setDashNotice({
        text: "Tap Remove again to unfriend — you will stop seeing each other's activity.",
        kind: "info",
      });
      pendingUnfriendTimerRef.current = setTimeout(() => {
        setPendingUnfriendId(null);
        pendingUnfriendTimerRef.current = null;
      }, 5000);
      return;
    }
    if (pendingUnfriendTimerRef.current) {
      clearTimeout(pendingUnfriendTimerRef.current);
      pendingUnfriendTimerRef.current = null;
    }
    setPendingUnfriendId(null);
    setFriendNotice(null);
    const res = await fetch(`/api/friends/${otherUserId}`, {
      method: "DELETE",
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFriendNotice({
        text: (j as { error?: string }).error ?? "Could not remove",
        kind: "error",
      });
      return;
    }
    setFriendsState(j as FriendsStatePayload);
    setDashNotice(null);
    setFriendNotice({ text: "Removed from friends.", kind: "info" });
    void loadAll();
  }

  async function cancelOutgoingRequest(requestId: string) {
    setFriendNotice(null);
    const res = await fetch("/api/friends/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFriendNotice({
        text: (j as { error?: string }).error ?? "Could not cancel request",
        kind: "error",
      });
      return;
    }
    setFriendsState(j as FriendsStatePayload);
    setFriendNotice({ text: "Request cancelled.", kind: "info" });
    void loadAll();
  }

  if (showSave) {
    return (
      <SaveSessionScreens
        missingProject={!saveProject}
        saveProject={saveProject}
        sessionSaveHint={sessionSaveHint}
        summary={summary}
        onSummaryChange={setSummary}
        saving={saving}
        onSaveSession={() => void saveSession()}
        onLogout={() => void logout()}
        onBackToDashboard={() => {
          setShowSave(false);
          setSaveProjectId(null);
          completedMeta.current = null;
          setSessionSaveHint(null);
          setRemaining(durationSec);
        }}
        formatDurationLabel={formatDurationLabel}
      />
    );
  }

  return (
    <div className="mx-auto box-border min-h-dvh w-full min-w-0 max-w-[1400px] px-3 py-5 sm:px-5 sm:py-7 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DashboardHeader
        appName={appName}
        stats={stats}
        notif={notif}
        notifOpen={notifOpen}
        notifPanelRef={notifPanelRef}
        onToggleNotifPanel={toggleNotifPanel}
        onLogout={logout}
      />

      {dashNotice ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2.5 text-sm shadow-sm"
          role={dashNotice.kind === "error" ? "alert" : "status"}
        >
          <p
            className={`min-w-0 flex-1 ${friendNoticeClass(dashNotice.kind)}`}
          >
            {dashNotice.text}
          </p>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-[var(--app-muted)] hover:bg-[var(--background)]"
            aria-label="Dismiss"
            onClick={() => setDashNotice(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-8 xl:grid xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,300px)] xl:items-start xl:gap-8">
        <aside className="order-2 min-w-0 xl:sticky xl:top-4 xl:order-1 xl:self-start">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
            <h2 className="font-display text-lg text-[var(--foreground)]">
              Focus areas
            </h2>
            <p className="mt-0.5 text-xs text-[var(--app-muted)]">
              Classes, placements, thesis, life admin — tap one for the timer
            </p>
            <ul className="mt-4 space-y-2">
              {projects.map((p) => {
                const label = p.isMisc ? "General" : p.name;
                const active = p.id === selectedId;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={running || arming}
                      onClick={() => setSelectedId(p.id)}
                      className={`flex w-full min-h-[4.25rem] items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "border-[var(--app-accent)] bg-[var(--app-accent)]/10"
                          : "border-[var(--app-border)] bg-[var(--background)]/40 hover:border-[var(--app-accent-muted)]"
                      } disabled:opacity-50`}
                    >
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: `hsl(${projectHue(label)} 50% 52%)`,
                        }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {label}
                        </p>
                        <p className="text-xs text-[var(--app-muted)]">
                          {formatProjectTotal(p.totalSec ?? 0)}
                          <span className="opacity-50"> · </span>
                          {formatRelativeShort(p.lastSessionAt)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 border-t border-[var(--app-border)] pt-4">
              {!addingProject ? (
                <button
                  type="button"
                  disabled={running || arming}
                  onClick={() => setAddingProject(true)}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--app-border)] text-sm font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent)]/5 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Add focus area
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="min-h-11 flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                    placeholder="e.g. Practicum, thesis, MFT coursework"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void addProject()}
                    className="min-h-11 shrink-0 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>

            <p className="mt-3 text-[10px] text-[var(--app-muted)]">
              Archive removes an area from the timer only — your streak, weekly
              progress, and activity feed stay intact.
            </p>
            <ul className="mt-2 space-y-1 border-t border-[var(--app-border)] pt-3">
              {projects
                .filter((p) => !p.isMisc)
                .map((p) => (
                  <li
                    key={`del-${p.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-xs text-[var(--app-muted)]"
                  >
                    <span className="truncate">{p.name}</span>
                    <button
                      type="button"
                      disabled={running || arming}
                      title="Archive focus area (keeps your history)"
                      onClick={() => void archiveFocusArea(p.id)}
                      className={`shrink-0 rounded p-1.5 text-[var(--app-muted)] hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-40 ${
                        pendingArchiveId === p.id
                          ? "ring-2 ring-[var(--app-accent)] ring-offset-2 ring-offset-[var(--app-surface-card)]"
                          : ""
                      }`}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
            </ul>

            {archivedProjects.length > 0 ? (
              <div className="mt-4 border-t border-[var(--app-border)] pt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                  Archived
                </p>
                <p className="mt-1 text-[10px] text-[var(--app-muted)]">
                  Restore anytime — all past sessions and stats still count.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {archivedProjects.map((p) => (
                    <li
                      key={`arc-${p.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border)]/70 bg-[var(--background)]/35 px-2 py-1.5 text-xs"
                    >
                      <span className="truncate text-[var(--app-muted)]">
                        {p.name}
                      </span>
                      <button
                        type="button"
                        disabled={running || arming}
                        onClick={() => void restoreArchivedProject(p.id)}
                        className="shrink-0 rounded-md border border-[var(--app-border)] px-2 py-1 text-[10px] font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-40"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="order-1 flex min-w-0 flex-col gap-6 xl:order-2">
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-7">
            <p className="font-display text-lg text-[var(--foreground)] sm:text-xl">
              What are you focusing on?
            </p>
            {selectedProject ? (
              <p className="mt-1 text-xs text-[var(--app-muted)]">
                On{" "}
                <span className="font-medium text-[var(--foreground)]/80">
                  {selectedProject.isMisc
                    ? "General"
                    : selectedProject.name}
                </span>
              </p>
            ) : null}

            <div className="mt-5 flex justify-center">
              <div className="relative h-40 w-40 max-w-[min(100%,10rem)] shrink-0">
                <svg className="-rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    className="stroke-[var(--background)]"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    className="stroke-[var(--app-accent)] transition-[stroke-dashoffset] duration-500"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${circ} ${circ}`}
                    strokeDashoffset={circ * (1 - progress)}
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-semibold tabular-nums text-[var(--foreground)]">
                    {arming ? "…" : formatClock(remaining)}
                  </div>
                  {running ? (
                    <span
                      className={`mt-0.5 text-[10px] font-medium uppercase tracking-wider sm:text-xs ${
                        paused
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-[var(--app-accent)]"
                      }`}
                    >
                      {paused ? "Paused" : "In progress"}
                    </span>
                  ) : null}
                  <Clock className="mt-1 h-4 w-4 text-[var(--app-muted)]" />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
                Focus area
              </label>
              <select
                className="mt-1 min-h-11 w-full appearance-none rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2 disabled:opacity-60"
                value={selectedId}
                disabled={running || arming}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.isMisc ? "General" : p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={running || arming}
                  onClick={() => applyPreset(i)}
                  className={`min-h-11 flex-1 rounded-xl border px-2 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                    presetIdx === i
                      ? "border-[var(--app-accent)] bg-[var(--app-accent)] text-white shadow-md shadow-[var(--app-accent)]/30"
                      : "border-[var(--app-border)] bg-[var(--background)]/50 text-[var(--foreground)] active:opacity-90"
                  } disabled:opacity-50`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--background)]/30 p-3 sm:p-4">
              <label className="text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
                Custom length
              </label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={24}
                  disabled={running || arming}
                  aria-label="Hours"
                  className="min-h-11 w-[4.5rem] rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-center text-base tabular-nums text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2 disabled:opacity-50"
                  value={customHm.h}
                  onChange={(e) =>
                    applyCustomHoursMinutes(
                      parseInt(e.target.value, 10) || 0,
                      customHm.m,
                    )
                  }
                />
                <span className="text-sm text-[var(--app-muted)]">h</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  disabled={running || arming}
                  aria-label="Minutes"
                  className="min-h-11 w-[4.5rem] rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-center text-base tabular-nums text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2 disabled:opacity-50"
                  value={customHm.m}
                  onChange={(e) =>
                    applyCustomHoursMinutes(
                      customHm.h,
                      parseInt(e.target.value, 10) || 0,
                    )
                  }
                />
                <span className="text-sm text-[var(--app-muted)]">m</span>
                {presetIdx === CUSTOM_PRESET_IDX && !(running || arming) ? (
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-[var(--app-accent)]">
                    Custom
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[var(--app-muted)] sm:text-[11px]">
                Between {MIN_TIMER_SEC / 60} minute and {MAX_TIMER_SEC / 3600}{" "}
                hours. Values are clipped to that range.
              </p>
            </div>

            {!running ? (
              <button
                type="button"
                disabled={!selectedId || arming}
                onClick={() => void startTimer()}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] py-3.5 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/30 transition hover:bg-[var(--app-accent-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4 shrink-0 fill-current" />
                {arming ? "Get ready…" : "Start session"}
              </button>
            ) : (
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={arming}
                  onClick={() =>
                    paused ? void resumeTimer() : pauseSession()
                  }
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--background)]/50 py-3.5 text-sm font-medium text-[var(--foreground)] active:scale-[0.99] disabled:opacity-50"
                >
                  {paused ? (
                    <>
                      <Play className="h-4 w-4 shrink-0 fill-current" />
                      {arming ? "…" : "Resume"}
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 shrink-0" />
                      Pause
                    </>
                  )}
                </button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => stopAndLogSession()}
                    className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--app-accent)] py-3.5 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25 active:scale-[0.99]"
                  >
                    Stop &amp; log
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscardTap()}
                    className={`flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-medium active:opacity-90 ${
                      pendingDiscard
                        ? "border-[var(--app-accent)] bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                        : "border-[var(--app-border)] bg-[var(--background)]/50 text-[var(--foreground)]"
                    }`}
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    {pendingDiscard ? "Tap again to discard" : "Discard"}
                  </button>
                </div>
              </div>
            )}

            <p className="mt-3 text-center text-[10px] leading-snug text-[var(--app-muted)] sm:text-[11px]">
              Pause anytime; after 5 minutes paused we&apos;ll nudge you (in the
              app and via notification if you allowed it). On your phone: turn the
              volume up — when time&apos;s up you&apos;ll hear a chime and a short
              vibration.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2 py-3 text-center sm:px-3">
              <Clock className="mx-auto h-4 w-4 text-[var(--app-accent)]" />
              <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:text-base">
                {formatWeeklyHoursLine(stats?.weeklyLoggedMinutes ?? 0)}
              </p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--app-muted)] sm:text-[10px]">
                This week
              </p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2 py-3 text-center sm:px-3">
              <Flame className="mx-auto h-4 w-4 text-[var(--app-accent)]" />
              <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:text-base">
                {stats?.streak ?? 0}
              </p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--app-muted)] sm:text-[10px]">
                Day streak
              </p>
            </div>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] px-2 py-3 text-center sm:px-3">
              <Folder className="mx-auto h-4 w-4 text-[var(--app-accent)]" />
              <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--foreground)] sm:text-base">
                {stats?.activeProjectsCount ?? 1}
              </p>
              <p className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--app-muted)] sm:text-[10px]">
                Areas
              </p>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <h2 className="font-display text-lg text-[var(--foreground)]">
                Activity over time
              </h2>
              <span className="text-xs text-[var(--app-muted)]">{totalLabel}</span>
            </div>
            <ContributionHeatmap
              heatmap={stats.heatmap}
              rangeStartKey={stats.heatmapRangeStart}
            />
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg text-[var(--foreground)]">
                  Weekly goal
                </h2>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  {weeklyPct}% of {stats?.weeklyGoalHours ?? 7}h target
                </p>
              </div>
              {!goalEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setGoalDraft(
                      String(stats?.weeklyGoalHours.toFixed(1) ?? "7"),
                    );
                    setGoalEdit(true);
                  }}
                  className="min-h-10 shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-3 py-2 text-sm text-[var(--foreground)] active:opacity-90"
                >
                  Edit goal
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="min-h-10 w-24 rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-2 py-2 text-base text-[var(--foreground)]"
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="min-h-10 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white"
                    onClick={async () => {
                      const v = Number(goalDraft);
                      await fetch("/api/settings", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ weeklyGoalHours: v }),
                      });
                      setGoalEdit(false);
                      void loadAll();
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--background)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--app-accent)] to-[var(--app-highlight)] transition-[width] duration-500"
                style={{ width: `${weeklyPct}%` }}
              />
            </div>
          </div>
        </main>

        <CommunitySidebar
          displayName={displayName}
          viewerUserId={viewerUserId}
          viewerHasAvatar={viewerHasAvatar}
          avatarCacheBust={avatarCacheBust}
          onViewerAvatarChange={(has) => {
            setViewerHasAvatar(has);
            setAvatarCacheBust((n) => n + 1);
            if (has) {
              setFriendNotice({
                text: "Profile photo updated.",
                kind: "success",
              });
            }
          }}
          onAvatarNotice={(msg, kind) => setFriendNotice({ text: msg, kind })}
          workEntries={workEntries}
          friendFeed={friendFeed}
          friendsState={friendsState}
          sidebarTab={sidebarTab}
          onSidebarTab={setSidebarTab}
          friendsPanelExpanded={friendsPanelExpanded}
          onFriendsPanelExpanded={setFriendsPanelExpanded}
          friendNotice={friendNotice}
          handleDraft={handleDraft}
          onHandleDraftChange={setHandleDraft}
          requestHandleDraft={requestHandleDraft}
          onRequestHandleDraftChange={setRequestHandleDraft}
          handleSaving={handleSaving}
          pendingUnfriendId={pendingUnfriendId}
          onSaveMyHandle={() => void saveMyHandle()}
          onSendFriendRequest={() => void sendFriendRequest()}
          onAcceptRequest={(id) => void acceptRequest(id)}
          onRejectRequest={(id) => void rejectRequest(id)}
          onRemoveFriend={(userId) => void removeFriend(userId)}
          onCancelOutgoing={(id) => void cancelOutgoingRequest(id)}
          onCopyAppLink={copyAppLink}
          refreshEntryFeeds={refreshEntryFeeds}
        />
      </div>
    </div>
  );
}
