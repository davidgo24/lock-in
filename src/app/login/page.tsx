import { Suspense } from "react";
import { LoginClient } from "./login-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--background)] text-sm text-[var(--app-muted)]">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
