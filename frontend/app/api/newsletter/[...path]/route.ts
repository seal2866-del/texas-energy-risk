import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://texas-energy-risk-production.up.railway.app";

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path    = params.path.join("/");
  const url     = `${BACKEND}/api/newsletter/${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const auth = req.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  const body = req.method !== "GET" ? await req.text() : undefined;

  const res = await fetch(url, {
    method:  req.method,
    headers,
    body,
  });

  const data = await res.text();
  return new NextResponse(data, {
    status:  res.status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET    = handler;
export const POST   = handler;
export const PATCH  = handler;
export const DELETE = handler;
