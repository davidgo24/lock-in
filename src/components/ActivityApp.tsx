"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Clock,
  Flame,
  LogOut,
  Play,
  Plus,
  Trash2,
  Trophy,
} from "lucide-react";
import { ContributionHeatmap } from "@/components/ContributionHeatmap";
import {
  playStartCountdown,
  playTimerCompleteRing,
} from "@/lib/sounds";
import type { StatsBundle } from "@/lib/stats";

type Project = { id: string; name: string; isMisc: boolean };

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

function defaultSelectedId(projects: Project[]) {
  const misc = projects.find((p) => p.isMisc);
  return misc?.id ?? projects[0]?.id ?? "";
}

type ActivityAppProps = {
  initialProjects: Project[];
  initialStats: StatsBundle;
};

export function ActivityApp({ initialProjects, initialStats }: ActivityAppProps) {
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

  const loadAll = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch("/api/projects"),
      fetch("/api/stats"),
    ]);
    const pJson = await pRes.json();
    const sJson = await sRes.json();
    setProjects(pJson.projects ?? []);

    setStats({
      heatmap: sJson.heatmap ?? {},
      totalMinutesYear: sJson.totalMinutesYear ?? 0,
      streak: sJson.streak ?? 0,
      sessionCount: sJson.sessionCount ?? 0,
      weeklyLoggedMinutes: sJson.weeklyLoggedMinutes ?? 0,
      weeklyGoalHours: sJson.weeklyGoalHours ?? 7,
    });

    setSelectedId((prev) => {
      if (prev && (pJson.projects ?? []).some((x: Project) => x.id === prev)) {
        return prev;
      }
      const misc = (pJson.projects ?? []).find((x: Project) => x.isMisc);
      return misc?.id ?? (pJson.projects?.[0]?.id ?? "");
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    durationSecRef.current = durationSec;
  }, [durationSec]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!running) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setRunning(false);
          const pid = selectedIdRef.current;
          const dur = durationSecRef.current;
          completedMeta.current = { projectId: pid, durationSec: dur };
          setSaveProjectId(pid);
          setShowSave(true);
          void playTimerCompleteRing();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  function applyPreset(idx: number) {
    if (running || arming) return;
    setPresetIdx(idx);
    const sec = PRESETS[idx].seconds;
    setDurationSec(sec);
    setRemaining(sec);
  }

  async function startTimer() {
    if (!selectedId || running || showSave || arming) return;
    setArming(true);
    try {
      try {
        const c = new AudioContext();
        await c.resume();
        await c.close();
      } catch {
        /* ignore */
      }
      await playStartCountdown();
      setRemaining(durationSec);
      setRunning(true);
    } finally {
      setArming(false);
    }
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
        alert((j as { error?: string }).error ?? "Could not save");
        return;
      }
      setShowSave(false);
      setSummary("");
      completedMeta.current = null;
      setSaveProjectId(null);
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
    if (!confirm("Delete this project and its saved history?")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    void loadAll();
  }

  async function logout() {
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
        Math.round(
          (stats.weeklyLoggedMinutes / (stats.weeklyGoalHours * 60)) * 100,
        ),
      )
    : 0;

  const saveProject =
    saveProjectId != null
      ? projects.find((p) => p.id === saveProjectId)
      : undefined;

  if (showSave && !saveProject) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-slate-400">
          This project is no longer available. Discard and return to the
          dashboard.
        </p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white active:scale-[0.99]"
          onClick={() => {
            setShowSave(false);
            setSaveProjectId(null);
            completedMeta.current = null;
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
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
                My Activity
              </h1>
              <p className="mt-1 text-sm text-slate-400 sm:text-base">
                Track progress and see your activity
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-11 shrink-0 rounded-lg border border-blue-500/25 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-300 active:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="rounded-2xl border border-blue-500/25 bg-slate-900/80 p-6 shadow-lg shadow-blue-500/5 backdrop-blur-sm sm:p-8">
          <h2 className="text-center text-base font-medium text-slate-100 sm:text-lg">
            Session Completed for{" "}
            <span className="font-semibold text-blue-300">{saveProject.name}</span>
          </h2>

          <label className="mt-6 block text-sm font-semibold text-slate-200 sm:mt-8">
            What did you accomplish?
          </label>
          <textarea
            className="mt-2 min-h-[140px] w-full rounded-xl border border-blue-500/25 bg-slate-950/80 px-3 py-3 text-base text-slate-100 outline-none ring-blue-400/30 placeholder:text-slate-500 focus:ring-2"
            placeholder="Describe your progress..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />

          <button
            type="button"
            disabled={saving || summary.trim().length < 1}
            onClick={() => void saveSession()}
            className="mt-6 min-h-11 w-full rounded-xl bg-blue-400 py-3 text-sm font-medium text-slate-950 shadow-lg shadow-blue-500/20 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Session"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 py-6 sm:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
            My Activity
          </h1>
          <p className="mt-1 text-sm text-slate-400 sm:text-base">
            Track progress and see your activity
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-3 rounded-full border border-blue-500/25 bg-slate-900/70 px-4 py-2 text-sm text-slate-200 backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 shrink-0 text-orange-400" />
              {stats?.streak ?? 0}
            </span>
            <span className="h-4 w-px bg-blue-500/30" />
            <span className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 shrink-0 text-amber-400" />
              {stats?.sessionCount ?? 0}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-slate-900/50 px-3 py-2.5 text-sm text-slate-300 active:bg-slate-800"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-12 lg:gap-6">
        <section className="lg:col-span-4">
          <div className="rounded-2xl border border-blue-500/25 bg-slate-900/70 p-5 shadow-lg shadow-blue-500/5 backdrop-blur-sm sm:p-6">
            <div className="flex flex-col items-center">
              <div className="relative h-36 w-36 max-w-[min(100%,9rem)]">
                <svg className="-rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    className="stroke-slate-800"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    className="stroke-blue-500 transition-[stroke-dashoffset] duration-500"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${circ} ${circ}`}
                    strokeDashoffset={circ * (1 - progress)}
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-2xl font-semibold tabular-nums text-slate-100 sm:text-3xl">
                    {arming ? "…" : formatClock(remaining)}
                  </div>
                  <Clock className="mt-1 h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Project
              </label>
              <select
                className="mt-1 min-h-11 w-full appearance-none rounded-xl border border-blue-500/25 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none ring-blue-400/30 focus:ring-2 disabled:opacity-60"
                value={selectedId}
                disabled={running || arming}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.isMisc ? "Misc. tasks" : p.name}
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
                      ? "border-blue-400 bg-blue-500 text-white shadow-md shadow-blue-500/25"
                      : "border-blue-500/20 bg-slate-950/50 text-slate-200 active:bg-slate-800"
                  } disabled:opacity-50`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedId || running || arming}
              onClick={() => void startTimer()}
              className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-sm font-medium text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4 shrink-0 fill-current" />
              {arming ? "Get ready…" : "Start Timer"}
            </button>

            <div className="mt-6 border-t border-blue-500/15 pt-4">
              {!addingProject ? (
                <button
                  type="button"
                  disabled={running || arming}
                  onClick={() => setAddingProject(true)}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-400 disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  New project
                </button>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="min-h-11 flex-1 rounded-xl border border-blue-500/25 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none ring-blue-400/30 focus:ring-2"
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => void addProject()}
                    className="min-h-11 shrink-0 rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white"
                  >
                    Add
                  </button>
                </div>
              )}

              <ul className="mt-3 space-y-2">
                {projects
                  .filter((p) => !p.isMisc)
                  .map((p) => (
                    <li
                      key={p.id}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-blue-500/15 bg-slate-950/40 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-slate-200">{p.name}</span>
                      <button
                        type="button"
                        disabled={running || arming}
                        title="Delete project"
                        onClick={() => void deleteProject(p.id)}
                        className="flex shrink-0 touch-manipulation p-2 text-slate-500 hover:text-red-400 disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-5 lg:col-span-8 lg:space-y-6">
          <div className="rounded-2xl border border-blue-500/25 bg-slate-900/70 p-5 shadow-lg shadow-blue-500/5 backdrop-blur-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                Activity Overview
              </h2>
              <span className="text-sm text-slate-400">{totalLabel}</span>
            </div>
            <ContributionHeatmap heatmap={stats.heatmap} />
          </div>

          <div className="rounded-2xl border border-blue-500/25 bg-slate-900/70 p-5 shadow-lg shadow-blue-500/5 backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  Weekly Goal Progress
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {weeklyPct}% Complete
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
                  className="min-h-11 shrink-0 rounded-lg border border-blue-500/25 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-200 active:bg-slate-800"
                >
                  Update Goal
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="min-h-11 w-24 rounded-lg border border-blue-500/25 bg-slate-950/80 px-2 py-2 text-base text-slate-100"
                    value={goalDraft}
                    onChange={(e) => setGoalDraft(e.target.value)}
                  />
                  <button
                    type="button"
                    className="min-h-11 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white"
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

            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-blue-950/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-[width] duration-500"
                style={{ width: `${weeklyPct}%` }}
              />
            </div>
            <p className="mt-3 text-right text-xs text-slate-500">
              Goal: {stats?.weeklyGoalHours ?? 7}h
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
