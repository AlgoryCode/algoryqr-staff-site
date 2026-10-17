"use client";

import type { AgentDebugPayload } from "@/lib/agent-debug-types";

export function agentDebugLogClient(payload: AgentDebugPayload): void {
  if (process.env.NODE_ENV === "production") return;
  fetch("/api/debug-agent/log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
