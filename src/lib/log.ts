type JsonRecord = Record<string, unknown>;

function line(level: string, event: string, data?: JsonRecord) {
  const payload: JsonRecord = {
    level,
    event,
    t: new Date().toISOString(),
    ...(data ?? {}),
  };
  const s = JSON.stringify(payload);
  if (level === "error") console.error(s);
  else if (level === "warn") console.warn(s);
  else console.info(s);
}

/** Structured logs for observability (parse JSON in your log sink). */
export function logInfo(event: string, data?: JsonRecord) {
  line("info", event, data);
}

export function logWarn(event: string, data?: JsonRecord) {
  line("warn", event, data);
}

export function logError(event: string, data?: JsonRecord) {
  line("error", event, data);
}
