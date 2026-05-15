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
  type SessionPhase,
  clampDurationSec,
  clearTimerStorage,
  parsePersisted,
  tryMigrateLegacyV1Key,
  writeTimerStorage,
} from "@/lib/activity-timer-local";
import { fireFocusCompleteConfetti } from "@/lib/timer-confetti";
import { TimerBreakOffer } from "@/components/activity-app/TimerBreakOffer";

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
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>("focus");
  const [overtimeSec, setOvertimeSec] = useState(0);
  const [breakOfferOpen, setBreakOfferOpen] = useState(false);
  const [breakDraftMinutes, setBreakDraftMinutes] = useState(5);
  const [breakRemaining, setBreakRemaining] = useState(0);
  const [breakTotalSec, setBreakTotalSec] = useState(0);

  const sessionPhaseRef = useRef<SessionPhase>("focus");
  const overtimeSecRef = useRef(0);
  /** Baseline stored as `overtimeSec` in persistence (see `PersistedTimerV3`). */
  const overtimeWallBaselineSecRef = useRef(0);
  /** Wall-clock start of current overtime running segment, or null if not accruing. */
  const overtimeRunStartedAtRef = useRef<number | null>(null);
  const breakEndsAtRef = useRef<number | null>(null);
  const breakRemainingSecRef = useRef<number | null>(null);
  const celebrationFiredRef = useRef(false);
  const pausedRef = useRef(false);

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
  const [sidebarTab, setSidebarTab] = useState<"you" | "community">(() =>
    initialFriendsState.incoming.length > 0 ? "community" : "you",
  );
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
  const prevIncomingCountRef = useRef(initialFriendsState.incoming.length);

  function readOvertimeDisplaySec(): number {
    const b = overtimeWallBaselineSecRef.current;
    const t0 = overtimeRunStartedAtRef.current;
    if (t0 == null) return b;
    return b + Math.max(0, Math.floor((Date.now() - t0) / 1000));
  }

  /** Fold an in-progress overtime segment into the baseline (pause, break, etc.). */
  function foldOvertimeRunningIntoBaseline(): number {
    const t0 = overtimeRunStartedAtRef.current;
    const b = overtimeWallBaselineSecRef.current;
    if (t0 == null) return b;
    const total = b + Math.max(0, Math.floor((Date.now() - t0) / 1000));
    overtimeWallBaselineSecRef.current = total;
    overtimeRunStartedAtRef.current = null;
    return total;
  }

  function resetOvertimeWall() {
    overtimeWallBaselineSecRef.current = 0;
    overtimeRunStartedAtRef.current = null;
    setOvertimeSec(0);
    overtimeSecRef.current = 0;
  }

  useEffect(() => {
    presetIdxRef.current = presetIdx;
  }, [presetIdx]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    sessionPhaseRef.current = sessionPhase;
  }, [sessionPhase]);
  useEffect(() => {
    overtimeSecRef.current = overtimeSec;
  }, [overtimeSec]);

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
      const nextHas = !!(pj as { hasAvatar?: boolean }).hasAvatar;
      setViewerHasAvatar((prev) => {
        if (prev !== nextHas) {
          setAvatarCacheBust((n) => n + 1);
        }
        return nextHas;
      });
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
    const phase = sessionPhaseRef.current;
    if (phase === "focus" && !paused) {
      const end = timerEndsAtRef.current;
      if (end == null) return;
      postFocusStatus(end, selectedId);
      writeTimerStorage({
        v: 3,
        selectedId,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: false,
        sessionPhase: "focus",
        remaining: Math.max(0, Math.ceil((end - Date.now()) / 1000)),
        endsAt: end,
        pausedSince: null,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      return;
    }
    if (phase === "focus" && paused) {
      const since = pausedSinceRef.current;
      if (since == null) return;
      writeTimerStorage({
        v: 3,
        selectedId,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: true,
        sessionPhase: "focus",
        remaining: remainingRef.current,
        endsAt: null,
        pausedSince: since,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      return;
    }
    if (phase === "overtime") {
      writeTimerStorage({
        v: 3,
        selectedId,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused,
        sessionPhase: "overtime",
        remaining: 0,
        endsAt: null,
        pausedSince: paused ? pausedSinceRef.current : null,
        overtimeSec: overtimeWallBaselineSecRef.current,
        overtimeRunStartedAt: paused
          ? null
          : overtimeRunStartedAtRef.current,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      return;
    }
    if (phase === "break") {
      writeTimerStorage({
        v: 3,
        selectedId,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused,
        sessionPhase: "break",
        remaining: 0,
        endsAt: null,
        pausedSince: paused ? pausedSinceRef.current : null,
        overtimeSec: overtimeWallBaselineSecRef.current,
        overtimeRunStartedAt: null,
        breakEndsAt: paused ? null : breakEndsAtRef.current,
        breakRemainingSec:
          paused && breakRemainingSecRef.current != null
            ? breakRemainingSecRef.current
            : null,
        breakTotalSec,
      });
    }
  }, [selectedId, running, paused, arming, sessionPhase, breakTotalSec]);

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
    if (sessionPhaseRef.current !== "focus") return;
    const end = timerEndsAtRef.current;
    if (end == null) return;
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    if (left > 0) {
      setRemaining(left);
      return;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerEndsAtRef.current = null;
    sessionPhaseRef.current = "overtime";
    setSessionPhase("overtime");
    overtimeWallBaselineSecRef.current = 0;
    overtimeRunStartedAtRef.current = Date.now();
    setOvertimeSec(0);
    overtimeSecRef.current = 0;
    setBreakTotalSec(0);
    remainingRef.current = 0;
    setRemaining(0);
    clearPauseNudge();
    postFocusStatus(null);
    if (playSoundOnComplete && !celebrationFiredRef.current) {
      celebrationFiredRef.current = true;
      void playTimerCompleteRing();
      notifyTimerComplete();
      fireFocusCompleteConfetti();
    }
    writeTimerStorage({
      v: 3,
      selectedId: selectedIdRef.current,
      durationSec: durationSecRef.current,
      presetIdx: presetIdxRef.current,
      paused: false,
      sessionPhase: "overtime",
      remaining: 0,
      endsAt: null,
      pausedSince: null,
      overtimeSec: 0,
      overtimeRunStartedAt: Date.now(),
      breakEndsAt: null,
      breakRemainingSec: null,
      breakTotalSec: 0,
    });
    setBreakOfferOpen(true);
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

    if (p.sessionPhase === "overtime") {
      celebrationFiredRef.current = true;
      sessionPhaseRef.current = "overtime";
      setSessionPhase("overtime");
      const baseline = p.overtimeSec;
      overtimeWallBaselineSecRef.current = baseline;
      timerEndsAtRef.current = null;
      breakEndsAtRef.current = null;
      breakRemainingSecRef.current = null;
      setBreakRemaining(0);
      setBreakTotalSec(0);
      setRemaining(0);
      setRunning(true);
      postFocusStatus(null);
      setBreakOfferOpen(false);
      if (p.paused) {
        overtimeRunStartedAtRef.current = null;
        setOvertimeSec(baseline);
        overtimeSecRef.current = baseline;
        setPaused(true);
        const since = p.pausedSince ?? Date.now();
        pausedSinceRef.current = since;
        schedulePauseNudge(since);
        writeTimerStorage({
          ...p,
          v: 3,
          sessionPhase: "overtime",
          remaining: 0,
          endsAt: null,
          breakEndsAt: null,
          breakRemainingSec: null,
          breakTotalSec: 0,
          overtimeSec: baseline,
          overtimeRunStartedAt: null,
        });
        return;
      }
      overtimeRunStartedAtRef.current =
        p.overtimeRunStartedAt != null
          ? p.overtimeRunStartedAt
          : Date.now();
      const disp =
        baseline +
        Math.max(
          0,
          Math.floor(
            (Date.now() - overtimeRunStartedAtRef.current) / 1000,
          ),
        );
      setOvertimeSec(disp);
      overtimeSecRef.current = disp;
      setPaused(false);
      pausedSinceRef.current = null;
      writeTimerStorage({
        ...p,
        v: 3,
        sessionPhase: "overtime",
        remaining: 0,
        endsAt: null,
        pausedSince: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
        overtimeSec: baseline,
        overtimeRunStartedAt: overtimeRunStartedAtRef.current,
      });
      return;
    }

    if (p.sessionPhase === "break") {
      celebrationFiredRef.current = true;
      sessionPhaseRef.current = "break";
      setSessionPhase("break");
      overtimeWallBaselineSecRef.current = p.overtimeSec;
      overtimeRunStartedAtRef.current = null;
      overtimeSecRef.current = p.overtimeSec;
      setOvertimeSec(p.overtimeSec);
      timerEndsAtRef.current = null;
      setRemaining(0);
      setRunning(true);
      postFocusStatus(null);
      setBreakOfferOpen(false);

      if (p.paused && p.breakRemainingSec != null) {
        breakEndsAtRef.current = null;
        breakRemainingSecRef.current = p.breakRemainingSec;
        setBreakRemaining(p.breakRemainingSec);
        const bt =
          p.breakTotalSec > 0
            ? p.breakTotalSec
            : Math.max(p.breakRemainingSec ?? 1, 1);
        setBreakTotalSec(bt);
        setPaused(true);
        const since = p.pausedSince ?? Date.now();
        pausedSinceRef.current = since;
        schedulePauseNudge(since);
        writeTimerStorage({
          ...p,
          v: 3,
          paused: true,
          breakEndsAt: null,
          breakRemainingSec: p.breakRemainingSec,
          breakTotalSec: bt,
          overtimeRunStartedAt: null,
        });
        return;
      }

      if (p.breakEndsAt == null) {
        clearTimerStorage();
        return;
      }

      breakEndsAtRef.current = p.breakEndsAt;
      breakRemainingSecRef.current = null;
      const brLeft = Math.max(
        0,
        Math.ceil((p.breakEndsAt - Date.now()) / 1000),
      );
      setBreakRemaining(brLeft);
      const bt =
        p.breakTotalSec > 0 ? p.breakTotalSec : Math.max(brLeft, 1);
      setBreakTotalSec(bt);
      if (brLeft <= 0) {
        sessionPhaseRef.current = "overtime";
        setSessionPhase("overtime");
        breakEndsAtRef.current = null;
        setPaused(false);
        pausedSinceRef.current = null;
        setBreakTotalSec(0);
        overtimeRunStartedAtRef.current = Date.now();
        writeTimerStorage({
          ...p,
          v: 3,
          sessionPhase: "overtime",
          paused: false,
          remaining: 0,
          endsAt: null,
          pausedSince: null,
          breakEndsAt: null,
          breakRemainingSec: null,
          breakTotalSec: 0,
          overtimeSec: overtimeWallBaselineSecRef.current,
          overtimeRunStartedAt: overtimeRunStartedAtRef.current,
        });
        {
          const b = overtimeWallBaselineSecRef.current;
          setOvertimeSec(b);
          overtimeSecRef.current = b;
        }
        return;
      }
      setPaused(false);
      pausedSinceRef.current = null;
      writeTimerStorage({
        ...p,
        v: 3,
        paused: false,
        breakRemainingSec: null,
        breakTotalSec: bt,
        overtimeSec: overtimeWallBaselineSecRef.current,
        overtimeRunStartedAt: null,
      });
      return;
    }

    if (p.paused) {
      const rem = Math.min(p.remaining, p.durationSec);
      timerEndsAtRef.current = null;
      setRemaining(rem);
      setRunning(true);
      setPaused(true);
      sessionPhaseRef.current = "focus";
      setSessionPhase("focus");
      postFocusStatus(null);
      const since = p.pausedSince ?? Date.now();
      pausedSinceRef.current = since;
      schedulePauseNudge(since);
      writeTimerStorage({
        v: 3,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: true,
        sessionPhase: "focus",
        remaining: rem,
        endsAt: null,
        pausedSince: since,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      return;
    }

    if (p.endsAt == null) {
      clearTimerStorage();
      return;
    }

    const left = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000));
    if (left <= 0) {
      const drift = Math.max(0, Math.floor((Date.now() - p.endsAt) / 1000));
      timerEndsAtRef.current = null;
      sessionPhaseRef.current = "overtime";
      setSessionPhase("overtime");
      overtimeWallBaselineSecRef.current = drift;
      overtimeRunStartedAtRef.current = Date.now();
      setOvertimeSec(drift);
      overtimeSecRef.current = drift;
      setRemaining(0);
      setRunning(true);
      setPaused(false);
      pausedSinceRef.current = null;
      celebrationFiredRef.current = true;
      postFocusStatus(null);
      setBreakOfferOpen(false);
      breakEndsAtRef.current = null;
      breakRemainingSecRef.current = null;
      setBreakRemaining(0);
      setBreakTotalSec(0);
      writeTimerStorage({
        v: 3,
        selectedId: p.selectedId,
        durationSec: p.durationSec,
        presetIdx: p.presetIdx,
        paused: false,
        sessionPhase: "overtime",
        remaining: 0,
        endsAt: null,
        pausedSince: null,
        overtimeSec: drift,
        overtimeRunStartedAt: Date.now(),
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      return;
    }

    sessionPhaseRef.current = "focus";
    setSessionPhase("focus");
    timerEndsAtRef.current = p.endsAt;
    setRemaining(left);
    setRunning(true);
    setPaused(false);
    pausedSinceRef.current = null;
    postFocusStatus(p.endsAt, p.selectedId);
    writeTimerStorage({
      v: 3,
      selectedId: p.selectedId,
      durationSec: p.durationSec,
      presetIdx: p.presetIdx,
      paused: false,
      sessionPhase: "focus",
      remaining: left,
      endsAt: p.endsAt,
      pausedSince: null,
      overtimeSec: 0,
      overtimeRunStartedAt: null,
      breakEndsAt: null,
      breakRemainingSec: null,
      breakTotalSec: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate; schedulePauseNudge is intentional
  }, [initialProjects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!running || paused || sessionPhase !== "focus") return;
    const tick = () => {
      syncFromEndTime(true);
    };
    clearTick();
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      clearTick();
    };
  }, [running, paused, sessionPhase, syncFromEndTime]);

  useEffect(() => {
    if (!running || paused || sessionPhase !== "overtime") return;
    const tick = () => {
      const t0 = overtimeRunStartedAtRef.current;
      const b = overtimeWallBaselineSecRef.current;
      const n = t0 != null ? b + Math.floor((Date.now() - t0) / 1000) : b;
      setOvertimeSec(n);
      overtimeSecRef.current = n;
      writeTimerStorage({
        v: 3,
        selectedId: selectedIdRef.current,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: false,
        sessionPhase: "overtime",
        remaining: 0,
        endsAt: null,
        pausedSince: null,
        overtimeSec: b,
        overtimeRunStartedAt: t0,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, paused, sessionPhase]);

  useEffect(() => {
    if (!running || paused || sessionPhase !== "break") return;
    const tick = () => {
      const end = breakEndsAtRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setBreakRemaining(left);
      if (left > 0) return;
      sessionPhaseRef.current = "overtime";
      setSessionPhase("overtime");
      breakEndsAtRef.current = null;
      breakRemainingSecRef.current = null;
      setBreakTotalSec(0);
      overtimeRunStartedAtRef.current = Date.now();
      writeTimerStorage({
        v: 3,
        selectedId: selectedIdRef.current,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: false,
        sessionPhase: "overtime",
        remaining: 0,
        endsAt: null,
        pausedSince: null,
        overtimeSec: overtimeWallBaselineSecRef.current,
        overtimeRunStartedAt: overtimeRunStartedAtRef.current,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      {
        const b = overtimeWallBaselineSecRef.current;
        setOvertimeSec(b);
        overtimeSecRef.current = b;
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, paused, sessionPhase]);

  useEffect(() => {
    if (!running || sessionPhase !== "break" || paused) return;
    writeTimerStorage({
      v: 3,
      selectedId: selectedIdRef.current,
      durationSec: durationSecRef.current,
      presetIdx: presetIdxRef.current,
      paused: false,
      sessionPhase: "break",
      remaining: 0,
      endsAt: null,
      pausedSince: null,
      overtimeSec: overtimeWallBaselineSecRef.current,
      overtimeRunStartedAt: null,
      breakEndsAt: breakEndsAtRef.current,
      breakRemainingSec: null,
      breakTotalSec,
    });
  }, [running, paused, sessionPhase, breakRemaining, breakTotalSec]);

  useEffect(() => {
    if (!running || paused) return;
    const bumpWallClocks = () => {
      const phase = sessionPhaseRef.current;
      if (phase === "focus") {
        syncFromEndTime(true);
      } else if (phase === "overtime") {
        const n = readOvertimeDisplaySec();
        setOvertimeSec(n);
        overtimeSecRef.current = n;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        bumpWallClocks();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", bumpWallClocks);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", bumpWallClocks);
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
    const phase = sessionPhaseRef.current;
    const since = Date.now();
    pausedSinceRef.current = since;
    setPaused(true);
    requestTimerNotifyPermissionIfNeeded();

    if (phase === "focus") {
      timerEndsAtRef.current = null;
      const rem = remainingRef.current;
      writeTimerStorage({
        v: 3,
        selectedId: selectedIdRef.current,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: true,
        sessionPhase: "focus",
        remaining: rem,
        endsAt: null,
        pausedSince: since,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      postFocusStatus(null);
      schedulePauseNudge(since);
      return;
    }

    if (phase === "overtime") {
      const total = foldOvertimeRunningIntoBaseline();
      setOvertimeSec(total);
      overtimeSecRef.current = total;
      writeTimerStorage({
        v: 3,
        selectedId: selectedIdRef.current,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: true,
        sessionPhase: "overtime",
        remaining: 0,
        endsAt: null,
        pausedSince: since,
        overtimeSec: total,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
      });
      postFocusStatus(null);
      schedulePauseNudge(since);
      return;
    }

    if (phase === "break") {
      const end = breakEndsAtRef.current;
      const remBr =
        end != null
          ? Math.max(0, Math.ceil((end - Date.now()) / 1000))
          : breakRemaining;
      breakEndsAtRef.current = null;
      breakRemainingSecRef.current = remBr;
      setBreakRemaining(remBr);
      writeTimerStorage({
        v: 3,
        selectedId: selectedIdRef.current,
        durationSec: durationSecRef.current,
        presetIdx: presetIdxRef.current,
        paused: true,
        sessionPhase: "break",
        remaining: 0,
        endsAt: null,
        pausedSince: since,
        overtimeSec: overtimeWallBaselineSecRef.current,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: remBr,
        breakTotalSec,
      });
      schedulePauseNudge(since);
    }
  }

  async function resumeTimer() {
    if (!running || !paused || arming) return;
    const phase = sessionPhaseRef.current;
    setArming(true);
    try {
      clearPauseNudge();
      pausedSinceRef.current = null;
      setPaused(false);
      if (phase === "focus") {
        const rem = remainingRef.current;
        const endsAt = Date.now() + rem * 1000;
        timerEndsAtRef.current = endsAt;
        writeTimerStorage({
          v: 3,
          selectedId: selectedIdRef.current,
          durationSec: durationSecRef.current,
          presetIdx: presetIdxRef.current,
          paused: false,
          sessionPhase: "focus",
          remaining: rem,
          endsAt,
          pausedSince: null,
          overtimeSec: 0,
          overtimeRunStartedAt: null,
          breakEndsAt: null,
          breakRemainingSec: null,
          breakTotalSec: 0,
        });
        postFocusStatus(endsAt, selectedIdRef.current);
        setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        return;
      }
      if (phase === "overtime") {
        overtimeRunStartedAtRef.current = Date.now();
        writeTimerStorage({
          v: 3,
          selectedId: selectedIdRef.current,
          durationSec: durationSecRef.current,
          presetIdx: presetIdxRef.current,
          paused: false,
          sessionPhase: "overtime",
          remaining: 0,
          endsAt: null,
          pausedSince: null,
          overtimeSec: overtimeWallBaselineSecRef.current,
          overtimeRunStartedAt: overtimeRunStartedAtRef.current,
          breakEndsAt: null,
          breakRemainingSec: null,
          breakTotalSec: 0,
        });
        postFocusStatus(null);
        return;
      }
      if (phase === "break") {
        const rem =
          breakRemainingSecRef.current != null
            ? breakRemainingSecRef.current
            : Math.max(0, breakRemaining);
        const endsAt = Date.now() + rem * 1000;
        breakEndsAtRef.current = endsAt;
        breakRemainingSecRef.current = null;
        setBreakRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        writeTimerStorage({
          v: 3,
          selectedId: selectedIdRef.current,
          durationSec: durationSecRef.current,
          presetIdx: presetIdxRef.current,
          paused: false,
          sessionPhase: "break",
          remaining: 0,
          endsAt: null,
          pausedSince: null,
          overtimeSec: overtimeWallBaselineSecRef.current,
          overtimeRunStartedAt: null,
          breakEndsAt: endsAt,
          breakRemainingSec: null,
          breakTotalSec,
        });
      }
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
      celebrationFiredRef.current = false;
      sessionPhaseRef.current = "focus";
      setSessionPhase("focus");
      resetOvertimeWall();
      breakEndsAtRef.current = null;
      breakRemainingSecRef.current = null;
      setBreakRemaining(0);
      setBreakOfferOpen(false);
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
        v: 3,
        selectedId: sid,
        durationSec: dur,
        presetIdx: capturedPresetIdx,
        paused: false,
        sessionPhase: "focus",
        remaining: Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
        endsAt,
        pausedSince: null,
        overtimeSec: 0,
        overtimeRunStartedAt: null,
        breakEndsAt: null,
        breakRemainingSec: null,
        breakTotalSec: 0,
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
    breakEndsAtRef.current = null;
    breakRemainingSecRef.current = null;
    clearTimerStorage();
    setRunning(false);
    setPaused(false);
    clearPauseNudge();
    setRemaining(durationSecRef.current);
    pausedSinceRef.current = null;
    postFocusStatus(null);
    celebrationFiredRef.current = false;
    sessionPhaseRef.current = "focus";
    setSessionPhase("focus");
    resetOvertimeWall();
    setBreakRemaining(0);
    setBreakOfferOpen(false);
    setBreakTotalSec(0);
  }

  function submitBreakFromOffer() {
    if (sessionPhaseRef.current === "overtime") {
      const total = foldOvertimeRunningIntoBaseline();
      setOvertimeSec(total);
      overtimeSecRef.current = total;
    }
    const m = Math.max(1, Math.min(120, Math.floor(breakDraftMinutes || 5)));
    const sec = m * 60;
    setBreakTotalSec(sec);
    sessionPhaseRef.current = "break";
    setSessionPhase("break");
    const end = Date.now() + sec * 1000;
    breakEndsAtRef.current = end;
    breakRemainingSecRef.current = null;
    setBreakRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    setBreakOfferOpen(false);
    writeTimerStorage({
      v: 3,
      selectedId: selectedIdRef.current,
      durationSec: durationSecRef.current,
      presetIdx: presetIdxRef.current,
      paused: false,
      sessionPhase: "break",
      remaining: 0,
      endsAt: null,
      pausedSince: null,
      overtimeSec: overtimeWallBaselineSecRef.current,
      overtimeRunStartedAt: null,
      breakEndsAt: end,
      breakRemainingSec: null,
      breakTotalSec: sec,
    });
  }

  function endBreakEarly() {
    if (sessionPhaseRef.current !== "break") return;
    sessionPhaseRef.current = "overtime";
    setSessionPhase("overtime");
    breakEndsAtRef.current = null;
    breakRemainingSecRef.current = null;
    setBreakRemaining(0);
    setBreakTotalSec(0);
    overtimeRunStartedAtRef.current = Date.now();
    const b = overtimeWallBaselineSecRef.current;
    setOvertimeSec(b);
    overtimeSecRef.current = b;
    writeTimerStorage({
      v: 3,
      selectedId: selectedIdRef.current,
      durationSec: durationSecRef.current,
      presetIdx: presetIdxRef.current,
      paused: false,
      sessionPhase: "overtime",
      remaining: 0,
      endsAt: null,
      pausedSince: null,
      overtimeSec: b,
      overtimeRunStartedAt: overtimeRunStartedAtRef.current,
      breakEndsAt: null,
      breakRemainingSec: null,
      breakTotalSec: 0,
    });
  }

  function stopAndLogSession() {
    if (!running) return;
    if (pendingDiscardTimerRef.current) {
      clearTimeout(pendingDiscardTimerRef.current);
      pendingDiscardTimerRef.current = null;
    }
    setPendingDiscard(false);
    const phase = sessionPhaseRef.current;

    if (phase === "overtime" || phase === "break") {
      clearTick();
      timerEndsAtRef.current = null;
      breakEndsAtRef.current = null;
      breakRemainingSecRef.current = null;
      clearTimerStorage();
      setRunning(false);
      setPaused(false);
      clearPauseNudge();
      pausedSinceRef.current = null;
      postFocusStatus(null);
      const logged = durationSecToStore(
        durationSecRef.current + readOvertimeDisplaySec(),
      );
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
      celebrationFiredRef.current = false;
      sessionPhaseRef.current = "focus";
      setSessionPhase("focus");
      resetOvertimeWall();
      setBreakRemaining(0);
      setBreakOfferOpen(false);
      setBreakTotalSec(0);
      return;
    }

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
      sessionPhaseRef.current = "focus";
      setSessionPhase("focus");
      resetOvertimeWall();
      setBreakRemaining(0);
      setBreakOfferOpen(false);
      setBreakTotalSec(0);
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
          sessionPhaseRef.current = "focus";
          setSessionPhase("focus");
          resetOvertimeWall();
          setBreakRemaining(0);
          setBreakOfferOpen(false);
          setBreakTotalSec(0);
        }}
      />
    );
  }

  return (
    <div className="mx-auto box-border min-h-svh w-full min-w-0 max-w-[1400px] px-3 py-5 sm:px-5 sm:py-7 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <DashboardHeader
        appName={appName}
        stats={stats}
        notif={notif}
        notifOpen={notifOpen}
        notifPanelRef={notifPanelRef}
        onToggleNotifPanel={toggleNotifPanel}
        onLogout={logout}
        pendingFriendRequests={friendsState.incoming.length}
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
            sessionPhase={sessionPhase}
            overtimeSec={overtimeSec}
            breakRemaining={breakRemaining}
            breakTotalSec={breakTotalSec}
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
            onEndBreakEarly={endBreakEarly}
            onOpenBreakOffer={() => setBreakOfferOpen(true)}
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
          workEntries={workEntries}
          friendFeed={friendFeed}
          friendsState={friendsState}
          sidebarTab={sidebarTab}
          onSidebarTab={setSidebarTab}
          refreshEntryFeeds={refreshEntryFeeds}
        />
      </div>
      <TimerBreakOffer
        open={breakOfferOpen}
        breakMinutes={breakDraftMinutes}
        onBreakMinutesChange={(m) =>
          setBreakDraftMinutes(Math.max(1, Math.min(120, Math.floor(m) || 1)))
        }
        onStartBreak={submitBreakFromOffer}
        onNotNow={() => setBreakOfferOpen(false)}
      />
    </div>
  );
}
