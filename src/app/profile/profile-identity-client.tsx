"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeHandleInput, validateHandle } from "@/lib/handle";
import {
  friendNoticeClass,
  type FriendNotice,
} from "@/components/activity-app/friend-notice-styles";
import { AVATAR_MAX_MIB } from "@/lib/avatar";

type Props = {
  viewerUserId: string;
  initialHandle: string;
  initialHasAvatar: boolean;
  publicLabel: string;
};

export function ProfileIdentityClient({
  viewerUserId,
  initialHandle,
  initialHasAvatar,
  publicLabel: labelPreview,
}: Props) {
  const router = useRouter();
  const [handleDraft, setHandleDraft] = useState(initialHandle);
  const [hasAvatar, setHasAvatar] = useState(initialHasAvatar);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [handleSaving, setHandleSaving] = useState(false);
  const [notice, setNotice] = useState<FriendNotice | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);

  async function saveHandle() {
    setNotice(null);
    const normalized = normalizeHandleInput(handleDraft);
    const err = validateHandle(normalized);
    if (err) {
      setNotice({ text: err, kind: "error" });
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
        setNotice({
          text: (j as { error?: string }).error ?? "Could not save handle",
          kind: "error",
        });
        return;
      }
      setNotice({ text: "Handle saved.", kind: "success" });
      router.refresh();
    } finally {
      setHandleSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-card)] p-5 shadow-lg shadow-black/10">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">
        Identity & photo
      </p>
      <p className="mt-1 text-xs text-[var(--app-muted)]">
        Preview: <span className="font-medium text-[var(--foreground)]">{labelPreview}</span>
      </p>

      {notice ? (
        <p
          className={`mt-3 text-sm ${friendNoticeClass(notice.kind)}`}
          role={notice.kind === "error" ? "alert" : undefined}
        >
          {notice.text}
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
            onClick={() => void saveHandle()}
          >
            {handleSaving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="text-xs text-[var(--app-muted)]">
          3–30 characters: lowercase letters, numbers, underscores.
        </p>
      </div>

      <div className="mt-6 space-y-2 border-t border-[var(--app-border)] pt-5">
        <label className="text-xs font-medium text-[var(--app-muted)]">
          Profile photo
        </label>
        <p className="text-xs text-[var(--app-muted)]">
          JPEG, PNG, GIF, or WebP — max {AVATAR_MAX_MIB} MB.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {hasAvatar && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/avatar/${viewerUserId}${cacheBust > 0 ? `?v=${cacheBust}` : ""}`}
              alt=""
              width={72}
              height={72}
              className="h-[4.5rem] w-[4.5rem] rounded-full border border-[var(--app-border)] object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-[var(--app-border)] bg-[var(--app-accent-muted)] text-lg font-semibold text-[var(--app-accent)]">
              {labelPreview.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <label className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-[var(--app-border)] bg-[var(--background)]/50 px-3 py-2 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:opacity-50">
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="sr-only"
              disabled={avatarBusy}
              onChange={(ev) => {
                const file = ev.target.files?.[0];
                ev.target.value = "";
                if (!file) return;
                setAvatarBusy(true);
                const fd = new FormData();
                fd.set("file", file);
                void (async () => {
                  try {
                    const res = await fetch("/api/profile/avatar", {
                      method: "POST",
                      body: fd,
                    });
                    const j = (await res.json().catch(() => ({}))) as {
                      error?: string;
                    };
                    if (!res.ok) {
                      setNotice({
                        text: j.error ?? "Could not upload photo.",
                        kind: "error",
                      });
                      return;
                    }
                    setHasAvatar(true);
                    setImgFailed(false);
                    setCacheBust((n) => n + 1);
                    setNotice({ text: "Photo updated.", kind: "success" });
                    router.refresh();
                  } finally {
                    setAvatarBusy(false);
                  }
                })();
              }}
            />
            {avatarBusy ? "Uploading…" : "Choose image"}
          </label>
          {hasAvatar ? (
            <button
              type="button"
              disabled={avatarBusy}
              className="min-h-10 rounded-lg border border-[var(--app-border)] px-3 py-2 text-xs text-[var(--app-muted)] disabled:opacity-50"
              onClick={() => {
                setAvatarBusy(true);
                void (async () => {
                  try {
                    const res = await fetch("/api/profile/avatar", {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      setHasAvatar(false);
                      setImgFailed(false);
                      setNotice({ text: "Photo removed.", kind: "info" });
                      router.refresh();
                    } else {
                      const j = (await res.json().catch(() => ({}))) as {
                        error?: string;
                      };
                      setNotice({
                        text: j.error ?? "Could not remove photo.",
                        kind: "error",
                      });
                    }
                  } finally {
                    setAvatarBusy(false);
                  }
                })();
              }}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
