"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LoginClient() {
  const sp = useSearchParams();
  const nextPath = sp.get("next") || "/";

  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email, password }),
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
    <div className="relative flex min-h-dvh w-full max-w-[100vw] flex-col items-center justify-center overflow-x-clip bg-[var(--background)] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 sm:right-4 sm:top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-8 shadow-xl shadow-black/20 backdrop-blur-sm">
        <h1 className="font-display text-2xl tracking-tight text-[var(--foreground)]">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Welcome back — log your next sesh.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-xs font-medium text-[var(--app-muted)]">
              Email
            </label>
            <input
              type="email"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/40 placeholder:text-[var(--app-muted)] focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--app-muted)]">
              Password
            </label>
            <input
              type="password"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/40 placeholder:text-[var(--app-muted)] focus:ring-2"
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
            className="min-h-11 w-full rounded-xl bg-[var(--app-accent)] py-3 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25 transition hover:bg-[var(--app-accent-hover)] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--app-muted)]">
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-[var(--app-accent)] hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
