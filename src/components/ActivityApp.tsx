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
  Clock,
  Flame,
  Folder,
  LogOut,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  WorkEntriesFeed,
  type WorkEntryRow,
} from "@/components/WorkEntriesFeed";
import {
  playStartCountdown,
  playTimerCompleteRing,
} from "@/lib/sounds";
import {
  notifyTimerComplete,
  requestTimerNotifyPermissionIfNeeded,
} from "@/lib/timer-notify";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";
import type { FriendsStatePayload } from "@/lib/friends";
import type { StatsBundle } from "@/lib/stats";

type FriendNotice = {
  text: string;
  kind: "error" | "success" | "info";
};

function friendNoticeClass(kind: FriendNotice["kind"]): string {
  if (kind === "error") return "text-red-500";
  if (kind === "success") return "text-emerald-600";
  return "text-[var(--foreground)]/90";
}

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

const PRESETS = [
  { label: "30m", seconds: 30 * 60 },
  { label: "1h", seconds: 60 * 60 },
  { label: "2h", seconds: 120 * 60 },
] as const;

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

const TIMER_STORAGE_KEY = "activity-tracker-timer-v1";

type PersistedTimer = {
  v: 1;
  endsAt: number;
  durationSec: number;
  presetIdx: number;
  selectedId: string;
};

function parsePersisted(raw: string | null): PersistedTimer | null {
  if (raw == null || typeof window === "undefined") return null;
  try {
    const o = JSON.parse(raw) as Partial<PersistedTimer>;
    if (o.v !== 1) return null;
    if (typeof o.endsAt !== "number" || typeof o.durationSec !== "number")
      return null;
    if (typeof o.presetIdx !== "number" || typeof o.selectedId !== "string")
      return null;
    if (
      !Number.isFinite(o.endsAt) ||
      o.durationSec < 1 ||
      o.presetIdx < 0 ||
      o.presetIdx >= PRESETS.length
    ) {
      return null;
    }
    return o as PersistedTimer;
  } catch {
    return null;
  }
}

function writeTimerStorage(p: PersistedTimer) {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota */
  }
}

function clearTimerStorage() {
  try {
    localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type ActivityAppProps = {
  initialProjects: Project[];
  initialStats: StatsBundle;
  initialWorkEntries: WorkEntryRow[];
  initialFriendFeed: WorkEntryRow[];
  initialFriendsState: FriendsStatePayload;
  displayName: string;
  appName: string;
};

export function ActivityApp({
  initialProjects,
  initialStats,
  initialWorkEntries,
  initialFriendFeed,
  initialFriendsState,
  displayName,
  appName,
}: ActivityAppProps) {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationSecRef = useRef(durationSec);
  const selectedIdRef = useRef(selectedId);
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
  const [friendsState, setFriendsState] =
    useState<FriendsStatePayload>(initialFriendsState);
  const [handleDraft, setHandleDraft] = useState(
    initialFriendsState.myHandle ?? "",
  );
  const [requestHandleDraft, setRequestHandleDraft] = useState("");
  const [friendNotice, setFriendNotice] = useState<FriendNotice | null>(null);
  const [handleSaving, setHandleSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"you" | "community">("you");
  const [dashNotice, setDashNotice] = useState<FriendNotice | null>(null);
  const [pendingDiscard, setPendingDiscard] = useState(false);
  const pendingDiscardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [pendingUnfriendId, setPendingUnfriendId] = useState<string | null>(
    null,
  );
  const pendingUnfriendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const prevIncomingCountRef = useRef(initialFriendsState.incoming.length);

  const loadAll = useCallback(async () => {
    const [pRes, sRes, eRes, fRes, ffRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/stats"),
      fetch("/api/entries"),
      fetch("/api/friends"),
      fetch("/api/entries/friends"),
    ]);
    const pJson = await pRes.json();
    const sJson = await sRes.json();
    const eJson = await eRes.json();
    const fJson = (await fRes.json()) as FriendsStatePayload;
    const ffJson = await ffRes.json();
    const rawEntries = (eJson.entries ?? []) as Array<{
      id: string;
      summary: string;
      durationSec: number;
      createdAt: string;
      workDate: string;
      project: { name: string; isMisc: boolean };
    }>;
    setWorkEntries(
      rawEntries.map((e) => ({
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
      })),
    );

    if (fRes.ok) {
      setFriendsState(fJson);
      setHandleDraft(fJson.myHandle ?? "");
    }

    if (ffRes.ok) {
      const rawFriend = (ffJson.entries ?? []) as Array<{
        id: string;
        summary: string;
        durationSec: number;
        createdAt: string;
        workDate: string;
        project: { name: string; isMisc: boolean };
        authorLabel?: string;
      }>;
      setFriendFeed(
        rawFriend.map((e) => ({
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
        })),
      );
    }

    setProjects(
      (pJson.projects ?? []).map(
        (x: {
          id: string;
          name: string;
          isMisc: boolean;
          totalSec?: number;
          lastSessionAt?: string | null;
        }) => ({
          id: x.id,
          name: x.name,
          isMisc: x.isMisc,
          totalSec: typeof x.totalSec === "number" ? x.totalSec : 0,
          lastSessionAt: x.lastSessionAt ?? null,
        }),
      ),
    );

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
  }, []);

  useLayoutEffect(() => {
    if (initialFriendsState.incoming.length > 0) {
      setSidebarTab("community");
    }
  }, [initialFriendsState.incoming.length]);

  useLayoutEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "community") {
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
    return () => {
      if (pendingDiscardTimerRef.current) {
        clearTimeout(pendingDiscardTimerRef.current);
      }
      if (pendingDeleteTimerRef.current) {
        clearTimeout(pendingDeleteTimerRef.current);
      }
      if (pendingUnfriendTimerRef.current) {
        clearTimeout(pendingUnfriendTimerRef.current);
      }
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
    if (playSoundOnComplete) void playTimerCompleteRing();
    if (playSoundOnComplete) notifyTimerComplete();
  }, []);

  const timerHydratedRef = useRef(false);
  /* Timer persistence lives in localStorage; sync once after mount (client external store). */
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (timerHydratedRef.current) return;
    timerHydratedRef.current = true;
    const p = parsePersisted(localStorage.getItem(TIMER_STORAGE_KEY));
    if (!p) return;
    if (!initialProjects.some((x) => x.id === p.selectedId)) {
      clearTimerStorage();
      return;
    }
    durationSecRef.current = p.durationSec;
    selectedIdRef.current = p.selectedId;
    timerEndsAtRef.current = p.endsAt;
    setDurationSec(p.durationSec);
    setPresetIdx(p.presetIdx);
    setSelectedId(p.selectedId);

    const left = Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000));
    if (left <= 0) {
      timerEndsAtRef.current = null;
      clearTimerStorage();
      setRemaining(0);
      setRunning(false);
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
  }, [initialProjects]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      syncFromEndTime(true);
    };
    clearTick();
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      clearTick();
    };
  }, [running, syncFromEndTime]);

  useEffect(() => {
    if (!running) return;
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
  }, [running, syncFromEndTime]);

  function applyPreset(idx: number) {
    if (running || arming) return;
    setPresetIdx(idx);
    const sec = PRESETS[idx].seconds;
    setDurationSec(sec);
    setRemaining(sec);
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
      writeTimerStorage({
        v: 1,
        endsAt,
        durationSec: dur,
        presetIdx: capturedPresetIdx,
        selectedId: sid,
      });
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
    setRemaining(durationSecRef.current);
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
      setRemaining(total);
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

  async function deleteProject(id: string) {
    if (running || arming) return;
    if (pendingDeleteId !== id) {
      if (pendingDeleteTimerRef.current) {
        clearTimeout(pendingDeleteTimerRef.current);
      }
      setPendingDeleteId(id);
      setDashNotice({
        text: "Tap the trash icon again to permanently delete this focus area and its history.",
        kind: "info",
      });
      pendingDeleteTimerRef.current = setTimeout(() => {
        setPendingDeleteId(null);
        pendingDeleteTimerRef.current = null;
      }, 5000);
      return;
    }
    if (pendingDeleteTimerRef.current) {
      clearTimeout(pendingDeleteTimerRef.current);
      pendingDeleteTimerRef.current = null;
    }
    setPendingDeleteId(null);
    setDashNotice(null);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setDashNotice({ text: "Could not remove this focus area.", kind: "error" });
      return;
    }
    void loadAll();
  }

  async function logout() {
    clearTick();
    timerEndsAtRef.current = null;
    clearTimerStorage();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const progress = durationSec > 0 ? 1 - remaining / durationSec : 0;
  const circ = 2 * Math.PI * 44;

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

  if (showSave && !saveProject) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-[var(--app-muted)]">
          This focus area is no longer available. Discard and return to the
          dashboard.
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-[var(--app-accent)] px-4 py-2.5 text-sm font-medium text-white active:scale-[0.99]"
          onClick={() => {
            setShowSave(false);
            setSaveProjectId(null);
            completedMeta.current = null;
            setSessionSaveHint(null);
            setRemaining(durationSec);
          }}
        >
          Back
        </button>
      </div>
    );
  }

  if (showSave && saveProject) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6 sm:py-10 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-2xl tracking-tight text-[var(--foreground)] sm:text-3xl">
                Log this session
              </h1>
              <p className="mt-1 text-sm text-[var(--app-muted)] sm:text-base">
                A few words about what you did — that&apos;s your accountability
                trail.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void logout()}
                className="min-h-11 shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2.5 text-sm text-[var(--foreground)] active:opacity-90"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-6 shadow-xl shadow-black/15 backdrop-blur-sm sm:p-8">
          <h2 className="text-center text-base font-medium text-[var(--foreground)] sm:text-lg">
            Session for{" "}
            <span className="font-semibold text-[var(--app-accent)]">
              {saveProject.name}
            </span>
          </h2>
          {sessionSaveHint ? (
            <p className="mt-2 text-center text-sm text-[var(--app-muted)]">
              {sessionSaveHint.early
                ? `Saving ${formatDurationLabel(sessionSaveHint.durationSec)} — the time you focused before stopping.`
                : `Full block: ${formatDurationLabel(sessionSaveHint.durationSec)}.`}
            </p>
          ) : null}

          <label className="mt-6 block text-sm font-semibold text-[var(--foreground)] sm:mt-8">
            What did you work on?
          </label>
          <textarea
            className="mt-2 min-h-[140px] w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-3 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 placeholder:text-[var(--app-muted)] focus:ring-2"
            placeholder="Reading, coursework, clients, admin — whatever you focused on…"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />

          <button
            type="button"
            disabled={saving || summary.trim().length < 1}
            onClick={() => void saveSession()}
            className="mt-6 min-h-11 w-full rounded-xl bg-[var(--app-accent)] py-3 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25 transition hover:bg-[var(--app-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save session"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto box-border min-h-dvh w-full min-w-0 max-w-[1400px] px-3 py-5 sm:px-5 sm:py-7 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] pb-4">
        <div className="min-w-0">
          <p className="font-display truncate text-xl tracking-tight text-[var(--foreground)] sm:text-2xl">
            {appName}
          </p>
          <p className="text-xs text-[var(--app-muted)]">
            Focus sessions · stay accountable
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-1.5 text-xs text-[var(--foreground)] sm:flex sm:text-sm">
            <span className="flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-[var(--app-accent)]" />
              {stats?.streak ?? 0}
            </span>
            <span className="h-3 w-px bg-[var(--app-border)]" />
            <span className="flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-[var(--app-highlight)]" />
              {stats?.sessionCount ?? 0}
            </span>
          </div>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-card)] px-3 py-2 text-xs font-medium text-[var(--foreground)] sm:text-sm"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

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

            <ul className="mt-3 space-y-1 border-t border-[var(--app-border)] pt-3">
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
                      title="Delete focus area"
                      onClick={() => void deleteProject(p.id)}
                      className={`shrink-0 rounded p-1.5 text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 ${
                        pendingDeleteId === p.id
                          ? "ring-2 ring-[var(--app-accent)] ring-offset-2 ring-offset-[var(--app-surface-card)]"
                          : ""
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
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
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--app-accent)] sm:text-xs">
                      In progress
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
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
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
            )}

            <p className="mt-3 text-center text-[10px] leading-snug text-[var(--app-muted)] sm:text-[11px]">
              On your phone: turn the volume up. When time&apos;s up you&apos;ll
              hear a chime and feel a short vibration; if your browser asks to show
              notifications, allowing that helps when the tab is in the background.
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

        <aside className="order-3 min-w-0 xl:sticky xl:top-4 xl:self-start">
          <div
            className="mb-3 flex gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-1 shadow-sm"
            role="tablist"
            aria-label="Activity sidebar"
          >
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "you"}
              className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                sidebarTab === "you"
                  ? "bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                  : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
              }`}
              onClick={() => setSidebarTab("you")}
            >
              You
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sidebarTab === "community"}
              className={`relative min-h-10 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                sidebarTab === "community"
                  ? "bg-[var(--app-accent-muted)] text-[var(--foreground)]"
                  : "text-[var(--app-muted)] hover:text-[var(--foreground)]"
              }`}
              onClick={() => setSidebarTab("community")}
            >
              Community
              {friendsState.incoming.length > 0 ? (
                <span
                  className="ml-1 inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--app-accent)] px-1 text-[10px] font-semibold text-white"
                  aria-label={`${friendsState.incoming.length} pending requests`}
                >
                  {friendsState.incoming.length}
                </span>
              ) : null}
            </button>
          </div>

          {sidebarTab === "you" ? (
            <div
              className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5"
              role="tabpanel"
            >
              <WorkEntriesFeed
                entries={workEntries}
                displayName={displayName}
                title="Your activity"
                subtitle="Newest entries — your accountability trail."
                emptyMessage="Finish a focus block and log it to see entries here."
              />
              <p className="mt-4 text-center text-xs text-[var(--app-muted)]">
                <button
                  type="button"
                  className="text-[var(--app-accent)] underline"
                  onClick={() => setSidebarTab("community")}
                >
                  Community
                </button>{" "}
                · friend requests and shared activity
              </p>
            </div>
          ) : (
            <>
              <div
                className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm"
                role="tabpanel"
              >
                <h3 className="font-display text-lg text-[var(--foreground)]">
                  Friends
                </h3>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  Pick a unique handle, then send a request. They accept — you
                  both see each other&apos;s session logs (not one-way follows).
                  Friends see your note and which focus area you used for each
                  block.
                </p>

                {friendNotice ? (
                  <p
                    className={`mt-3 text-sm ${friendNoticeClass(friendNotice.kind)}`}
                    role={friendNotice.kind === "error" ? "alert" : undefined}
                  >
                    {friendNotice.text}
                  </p>
                ) : null}

                <div className="mt-4 space-y-2">
                  <label className="text-xs font-medium text-[var(--app-muted)]">
                    Your handle
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      className="min-h-10 w-full flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                      placeholder="e.g. alex_codes"
                      value={handleDraft}
                      onChange={(e) => setHandleDraft(e.target.value)}
                      maxLength={30}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      disabled={handleSaving}
                      className="min-h-10 shrink-0 rounded-lg bg-[var(--app-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      onClick={() => void saveMyHandle()}
                    >
                      {handleSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--app-muted)]">
                    3–30 characters: lowercase letters, numbers, underscores.
                    Used so friends can find you — not your password.
                  </p>
                </div>

                <div className="mt-5 space-y-2 border-t border-[var(--app-border)] pt-4">
                  <label className="text-xs font-medium text-[var(--app-muted)]">
                    Add a friend by handle
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      className="min-h-10 w-full flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--app-accent)]/30 focus:ring-2"
                      placeholder="@their_handle"
                      value={requestHandleDraft}
                      onChange={(e) => setRequestHandleDraft(e.target.value)}
                      maxLength={32}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      className="min-h-10 shrink-0 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-4 py-2 text-sm font-medium text-[var(--foreground)]"
                      onClick={() => void sendFriendRequest()}
                    >
                      Send request
                    </button>
                  </div>
                </div>

                {friendsState.incoming.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--app-border)] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      Incoming
                    </p>
                    <ul className="mt-2 space-y-2">
                      {friendsState.incoming.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm text-[var(--foreground)]">
                            {r.from.label}
                            {r.from.handle ? (
                              <span className="text-[var(--app-muted)]">
                                {" "}
                                · @{r.from.handle}
                              </span>
                            ) : null}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="min-h-9 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-medium text-white"
                              onClick={() => void acceptRequest(r.id)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="min-h-9 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--foreground)]"
                              onClick={() => void rejectRequest(r.id)}
                            >
                              Decline
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {friendsState.outgoing.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--app-border)] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      Pending
                    </p>
                    <ul className="mt-2 space-y-2">
                      {friendsState.outgoing.map((r) => (
                        <li
                          key={r.id}
                          className="flex flex-col gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="text-sm text-[var(--app-muted)]">
                            Waiting on {r.to.label}
                            {r.to.handle ? ` (@${r.to.handle})` : ""}
                          </span>
                          <button
                            type="button"
                            className="min-h-8 shrink-0 text-xs text-[var(--app-muted)] underline"
                            onClick={() => void cancelOutgoingRequest(r.id)}
                          >
                            Cancel request
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {friendsState.friends.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--app-border)] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                      Your friends
                    </p>
                    <ul className="mt-2 space-y-2">
                      {friendsState.friends.map((f) => (
                        <li
                          key={f.userId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--background)]/40 px-3 py-2"
                        >
                          <span className="min-w-0 truncate text-sm text-[var(--foreground)]">
                            {f.label}
                            {f.handle ? (
                              <span className="text-[var(--app-muted)]">
                                {" "}
                                · @{f.handle}
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            className={`shrink-0 text-xs underline ${
                              pendingUnfriendId === f.userId
                                ? "font-semibold text-[var(--app-accent)]"
                                : "text-[var(--app-muted)]"
                            }`}
                            onClick={() => void removeFriend(f.userId)}
                          >
                            {pendingUnfriendId === f.userId
                              ? "Tap again to remove"
                              : "Remove"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => copyAppLink()}
                  className="mt-4 w-full text-center text-xs text-[var(--app-muted)] underline"
                >
                  Copy invite link (Community tab for new signups)
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-4 shadow-lg shadow-black/10 backdrop-blur-sm sm:p-5">
                <WorkEntriesFeed
                  entries={friendFeed}
                  displayName=""
                  title="Friends&apos; activity"
                  subtitle="What they logged during their focus blocks."
                  emptyMessage={
                    friendsState.friends.length === 0
                      ? "Add a friend above to see their activity here."
                      : "Nothing logged yet — check back after their next session."
                  }
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
