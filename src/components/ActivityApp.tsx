"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
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
import { FriendsInFocusStrip } from "@/components/activity-app/FriendsInFocusStrip";
import { DashboardSectionNav } from "@/components/activity-app/dashboard/DashboardSectionNav";
import { FocusAreasSidebar } from "@/components/activity-app/dashboard/FocusAreasSidebar";
import { FocusTimerPanel } from "@/components/activity-app/dashboard/FocusTimerPanel";
import { DashboardInsightsPanel } from "@/components/activity-app/dashboard/DashboardInsightsPanel";
import type { ApiWorkEntry, ActivityNotificationRow } from "@/lib/work-client";
import { parseWorkEntryFromApi } from "@/lib/work-client";
import {
  defaultSelectedId,
  durationSecToStore,
  localYmdFromDate,
  presetIdxForDuration,
  splitHoursMinutes,
  type DashboardProject,
} from "@/lib/activity-dashboard-format";
import { postFocusStatus } from "@/lib/focus-status-client";
import { hapticSuccess } from "@/lib/haptics";
import {
  PRESETS,
  TIMER_STORAGE_KEY,
  clampDurationSec,
  clearTimerStorage,
  parsePersisted,
  tryMigrateLegacyV1Key,
  writeTimerStorage,
} from "@/lib/activity-timer-local";

const PAUSE_NUDGE_MS = 5 * 60 * 1000;

type ActivityAppProps = {
  initialProjects: DashboardProject[];
  initialArchivedProjects: DashboardProject[];
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
  const [projects, setProjects] = useState<DashboardProject[]>(initialProjects);
  const [archivedProjects, setArchivedProjects] = useState<DashboardProject[]>(
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
  /** Wall time when pause began — for persisting project switches while paused. */
  const pausedSinceRef = useRef<number | null>(null);
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
  const [friendRequestBusy, setFriendRequestBusy] = useState(false);
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
    }): DashboardProject => ({
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
      if (prev && (pJson.projects ?? []).some((x: DashboardProject) => x.id === prev)) {
        return prev;
      }
      const misc = (pJson.projects ?? []).find((x: DashboardProject) => x.isMisc);
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

  /** Keep server focus + localStorage aligned if the user switches focus area mid-session. */
  useEffect(() => {
    if (!running || arming) return;
    if (!paused) {
      const end = timerEndsAtRef.current;
      if (end == null) return;
      postFocusStatus(end, selectedId);
      writeTimerStorage({
        v: 2,
        selectedId,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: false,
        remaining: Math.max(0, Math.ceil((end - Date.now()) / 1000)),
        endsAt: end,
        pausedSince: null,
      });
      return;
    }
    const since = pausedSinceRef.current;
    if (since == null) return;
    writeTimerStorage({
      v: 2,
      selectedId,
      durationSec: durationSecRef.current,
      presetIdx: presetIdxRef.current,
      paused: true,
      remaining: remainingRef.current,
      endsAt: null,
      pausedSince: since,
    });
  }, [selectedId, running, paused, arming]);

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
    pausedSinceRef.current = null;
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
      pausedSinceRef.current = since;
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
    pausedSinceRef.current = null;
    postFocusStatus(p.endsAt, p.selectedId);
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
    pausedSinceRef.current = since;
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
      pausedSinceRef.current = null;
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
      postFocusStatus(endsAt, selectedIdRef.current);
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
      pausedSinceRef.current = null;
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
      postFocusStatus(endsAt, selectedIdRef.current);
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
    pausedSinceRef.current = null;
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
      pausedSinceRef.current = null;
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
    pausedSinceRef.current = null;
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
      hapticSuccess();
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

  async function sendFriendRequestWithHandle(
    handleInput: string,
    opts?: { clearDraftOnSuccess?: boolean },
  ) {
    setFriendNotice(null);
    const normalized = normalizeHandleInput(handleInput);
    const he = validateHandle(normalized);
    if (he) {
      setFriendNotice({ text: he, kind: "error" });
      return;
    }
    setFriendRequestBusy(true);
    try {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handleInput }),
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
      if (opts?.clearDraftOnSuccess) setRequestHandleDraft("");
      setFriendNotice({ text: "Request sent.", kind: "success" });
      void loadAll();
    } finally {
      setFriendRequestBusy(false);
    }
  }

  async function sendFriendRequest() {
    await sendFriendRequestWithHandle(requestHandleDraft, {
      clearDraftOnSuccess: true,
    });
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

      <FriendsInFocusStrip
        friendsState={friendsState}
        avatarCacheBust={avatarCacheBust}
      />

      <DashboardSectionNav />

      <div className="mt-4 flex flex-col gap-8 xl:grid xl:grid-cols-[260px_minmax(0,1fr)_minmax(0,300px)] xl:items-start xl:gap-8">
        <FocusAreasSidebar
          projects={projects}
          archivedProjects={archivedProjects}
          selectedId={selectedId}
          onSelectProject={setSelectedId}
          arming={arming}
          running={running}
          newProjectName={newProjectName}
          onNewProjectNameChange={setNewProjectName}
          addingProject={addingProject}
          onAddingProjectChange={setAddingProject}
          onAddProject={() => void addProject()}
          onArchiveFocusArea={(id) => void archiveFocusArea(id)}
          onRestoreArchived={(id) => void restoreArchivedProject(id)}
          pendingArchiveId={pendingArchiveId}
        />

        <main className="order-1 flex min-w-0 flex-col gap-6 xl:order-2">
          <FocusTimerPanel
            selectedProject={selectedProject}
            projects={projects}
            selectedId={selectedId}
            onSelectProject={setSelectedId}
            arming={arming}
            remaining={remaining}
            durationSec={durationSec}
            running={running}
            paused={paused}
            presetIdx={presetIdx}
            onApplyPreset={applyPreset}
            customHours={customHm.h}
            customMinutes={customHm.m}
            onCustomHoursMinutesChange={applyCustomHoursMinutes}
            onStartSession={() => void startTimer()}
            onPauseOrResume={() =>
              paused ? void resumeTimer() : pauseSession()
            }
            onStopAndLog={() => stopAndLogSession()}
            onDiscardTap={() => onDiscardTap()}
            pendingDiscard={pendingDiscard}
          />

          <DashboardInsightsPanel
            stats={stats}
            totalLabel={totalLabel}
            weeklyPct={weeklyPct}
            goalEdit={goalEdit}
            goalDraft={goalDraft}
            onGoalDraftChange={setGoalDraft}
            onBeginGoalEdit={() => {
              setGoalDraft(String(stats?.weeklyGoalHours.toFixed(1) ?? "7"));
              setGoalEdit(true);
            }}
            onSaveWeeklyGoal={() =>
              void (async () => {
                const v = Number(goalDraft);
                await fetch("/api/settings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ weeklyGoalHours: v }),
                });
                setGoalEdit(false);
                void loadAll();
              })()
            }
          />
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
          friendRequestBusy={friendRequestBusy}
          onSendFriendRequestToHandle={(h) =>
            void sendFriendRequestWithHandle(h)
          }
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
