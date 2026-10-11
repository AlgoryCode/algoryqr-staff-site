import { NextResponse } from "next/server";

import { handleStaffAuth } from "@/lib/server/staff-auth";

type RouteContext = { params: Promise<{ path?: string[] }> };
type ProxyMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function proxy(request: Request, method: ProxyMethod, context: RouteContext) {
  const path = (await context.params).path ?? [];
  const authResponse = await handleStaffAuth(request, method, path.join("/"));
  if (authResponse) return authResponse;
  return NextResponse.json({ message: "Not found" }, { status: 404 });
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
