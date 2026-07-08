import { NextRequest, NextResponse } from "next/server";

// Host → Tool-Pfad. Jede Subdomain zeigt auf dieselbe Vercel-App;
// lokal (localhost) funktionieren die Pfade /<tool> direkt.
// Next 16: "proxy" ist die Nachfolge-Konvention von "middleware".
const HOSTS: Record<string, string> = {
  // Audit/Daten
  "daten-check.friedemann-schuetz.de": "/daten-check",
  "lade-luecken.friedemann-schuetz.de": "/lade-luecken",
  // Content/Marketing
  "thementour.friedemann-schuetz.de": "/thementour",
  "genuss-radar.friedemann-schuetz.de": "/genuss-radar",
  "golden-hour.friedemann-schuetz.de": "/golden-hour",
  "naturwunder.friedemann-schuetz.de": "/naturwunder",
  // Gäste-Service
  "schlechtwetter.friedemann-schuetz.de": "/schlechtwetter",
  "ruhe-finder.friedemann-schuetz.de": "/ruhe-finder",
  "geheimtipp.friedemann-schuetz.de": "/geheimtipp",
  "wildtier.friedemann-schuetz.de": "/wildtier",
  // E-Mobilität
  "laden-erleben.friedemann-schuetz.de": "/laden-erleben",
  "eauto-ausflug.friedemann-schuetz.de": "/eauto-ausflug",
  "laden-wandern.friedemann-schuetz.de": "/laden-wandern",
};

export default function proxy(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const prefix = HOSTS[host];
  if (!prefix) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith(prefix)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? prefix : `${prefix}${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
