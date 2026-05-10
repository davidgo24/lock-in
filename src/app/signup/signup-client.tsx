"use client";

import Link from "next/link";
import { useState } from "react";

export function SignupClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Could not sign up");
        return;
      }
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full max-w-[100vw] flex-col items-center justify-center overflow-x-clip bg-[var(--background)] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-8 shadow-xl shadow-black/20 backdrop-blur-sm">
        <h1 className="font-display text-2xl tracking-tight text-[var(--foreground)]">
          Sign up
        </h1>
        <p className="mt-1 text-sm text-[var(--app-muted)]">
          Create your space to clock sessions and track proof.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div>
            <label className="text-xs font-medium text-[var(--app-muted)]">
              Display name{" "}
              <span className="font-normal opacity-70">(optional)</span>
            </label>
            <input
              type="text"
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--app-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none ring-[var(--app-accent)]/40 placeholder:text-[var(--app-muted)] focus:ring-2"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you appear on your feed"
              maxLength={80}
              autoComplete="nickname"
            />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
            <p className="mt-1 text-xs text-[var(--app-muted)]">
              At least 8 characters.
            </p>
          </div>
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-xl bg-[var(--app-accent)] py-3 text-sm font-medium text-white shadow-lg shadow-[var(--app-accent)]/25 transition hover:bg-[var(--app-accent-hover)] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-[var(--app-muted)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--app-accent)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
