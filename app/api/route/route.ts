import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 25;

// Proxy für den synchronen Routing-WF (dmo-route): Secret serverseitig anhängen.
// GET ?from=lat,lng&to=lat,lng&mode=foot|bike|car -> { ok, geometry, distance_km, duration_min }
export async function GET(req: NextRequest) {
  const base = process.env.N8N_BASE;
  const secret = process.env.N8N_DMO_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const mode = sp.get("mode") ?? "foot";
  const ll = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
  if (!ll.test(from) || !ll.test(to)) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  try {
    const url =
      `${base}/webhook/dmo-route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${encodeURIComponent(mode)}`;
    const res = await fetch(url, {
      headers: { "x-dmo-secret": secret },
      signal: AbortSignal.timeout(22_000),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({ ok: false, error: "upstream_error" }));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "upstream_unreachable" }, { status: 502 });
  }
}
