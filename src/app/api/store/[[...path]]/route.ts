import { NextResponse } from "next/server";

import { proxyAuthenticatedRequest } from "@/lib/server/authenticated-proxy";

type RouteContext = { params: Promise<{ path?: string[] }> };
type ProxyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function upstreamPath(path: string[]): string | null {
  if (path[0] === "public") {
    return null;
  }
  const suffix = path.length > 0 ? `/${path.join("/")}` : "";
  return `/store${suffix}`;
}

async function proxy(request: Request, method: ProxyMethod, context: RouteContext) {
  const path = (await context.params).path ?? [];
  const upstream = upstreamPath(path);
  if (upstream == null) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  const timeoutMs = method === "POST" && path[0] === "setup" ? 60_000 : undefined;
  return proxyAuthenticatedRequest(request, upstream, method, timeoutMs == null ? undefined : { timeoutMs });
}

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, "GET", context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxy(request, "POST", context);
}

export async function PUT(request: Request, context: RouteContext) {
  return proxy(request, "PUT", context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxy(request, "PATCH", context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxy(request, "DELETE", context);
}
