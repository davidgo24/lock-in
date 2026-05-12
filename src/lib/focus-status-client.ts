/** Tell the server when a focus timer is running so friends can see "active" (best-effort). */
export function postFocusStatus(
  endsAtMs: number | null,
  projectId: string | null = null,
) {
  const body =
    endsAtMs == null
      ? { endsAt: null, projectId: null }
      : {
          endsAt: new Date(endsAtMs).toISOString(),
          projectId: projectId && projectId.length > 0 ? projectId : null,
        };
  void fetch("/api/me/focus-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
