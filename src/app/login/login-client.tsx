"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export function LoginClient() {
  const sp = useSearchParams();
  const nextPath = sp.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Login failed");
        return;
      }
      window.location.href = nextPath.startsWith("/") ? nextPath : "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-[#0a0f1a] to-slate-950 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm rounded-2xl border border-blue-500/25 bg-slate-900/90 p-8 shadow-lg shadow-blue-500/5 backdrop-blur-sm">
        <h1 className="text-xl font-semibold text-slate-100">Sign in</h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter the app password to continue.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-xs font-medium text-slate-400">
              Password
            </label>
            <input
              type="password"
              className="mt-1 min-h-11 w-full rounded-xl border border-blue-500/25 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none ring-blue-400/40 placeholder:text-slate-500 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-xl bg-blue-500 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
