import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const base = process.env.N8N_BASE;
  const secret = process.env.N8N_DMO_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }
  const token = req.nextUrl.searchParams.get("token");
  if (!token || !/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }
  try {
    const res = await fetch(`${base}/webhook/dmo-status?token=${encodeURIComponent(token)}`, {
      headers: { "x-dmo-secret": secret },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
    // Kein sauberes JSON (z.B. n8n gerade durch schweren Code-Node blockiert) -> transient, weiter pollen
    const data = await res.json().catch(() => ({ status: "running" }));
    return NextResponse.json(data, { status: 200 });
  } catch {
    // Timeout/Netz-Blip ist NICHT terminal: der Check laeuft weiter -> "running" zurueckgeben,
    // damit das Frontend weiterpollt statt faelschlich abzubrechen.
    return NextResponse.json({ status: "running" }, { status: 200 });
  }
}
