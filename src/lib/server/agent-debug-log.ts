import { appendFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentDebugPayload } from "@/lib/agent-debug-types";

const SESSION_ID = "7ed3fa";
const LOG_BASENAME = `debug-${SESSION_ID}.log`;
const INGEST_URL = "http://127.0.0.1:7469/ingest/96358f82-1dd1-4ef2-844d-5be009c90611";

function logFilePath(): string {
  const fromEnv = process.env.AGENT_DEBUG_LOG_PATH?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), LOG_BASENAME);
}

export function agentDebugLogServer(payload: AgentDebugPayload): void {
  if (process.env.NODE_ENV === "production") return;
  const entry = {
    sessionId: SESSION_ID,
    timestamp: Date.now(),
    ...payload,
  };
  try {
    appendFileSync(logFilePath(), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // ignore
  }
  fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION_ID },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
