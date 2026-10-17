import { NextResponse } from "next/server";

import type { AgentDebugPayload } from "@/lib/agent-debug-types";
import { agentDebugLogServer } from "@/lib/server/agent-debug-log";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  try {
    const body = (await req.json()) as AgentDebugPayload;
    if (body?.location && body?.message) {
      agentDebugLogServer(body);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
