# DMO-Toolbox (Frontend)

**13 touristische Tools für Destinationen (DMOs)** auf OpenStreetMap-Basis — eine Next.js-16-App,
ausgeliefert über 13 Subdomains aus **einer** App (Host-Rewrite in `proxy.ts`).

| Cluster | Subdomain | Tool |
|---|---|---|
| Daten | `daten-check` | Destinations-Datencheck (OSM-Datenqualität + PDF/Lead) |
| Daten | `lade-luecken` | Lade-Lücken-Radar (E-Auto-Readiness der Region) |
| Content | `thementour` | Thementouren-Generator (auto-geroutete Rundtour) |
| Content | `genuss-radar` | Genuss-Radar (Hofläden/Winzer/Brauereien) |
| Content | `golden-hour` | Golden-Hour-Fotospots (Sonnenuntergang + Aussicht) |
| Content | `naturwunder` | Naturwunder-Finder (Wasserfälle/Höhlen/…) |
| Service | `schlechtwetter` | Schlechtwetter-Radar (Indoor + Live-Wetter) |
| Service | `ruhe-finder` | Ruhe-Finder (Quiet-Travel-Score) |
| Service | `geheimtipp` | Geheimtipp-Radar (Besucherlenkung/Anti-Overtourism) |
| Service | `wildtier` | Wildtier-Beobachtungs-Radar |
| E-Mobilität | `laden-erleben` | Laden & Erleben (Ladepause als Erlebnis) |
| E-Mobilität | `eauto-ausflug` | E-Auto-Tagesausflug (reichweiten-sicher + Ladesäule) |
| E-Mobilität | `laden-wandern` | Charge & Hike (laden am Wanderparkplatz) |

Lokal (`localhost:3000`) sind alle Tools direkt über ihren Pfad erreichbar; `/` verlinkt alle 13.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · MapLibre GL 5 · turf.js.
Gemeinsame Bausteine aus `../isochrone-tools` übernommen (IsoMap, AddressSearch, ScoreGauge,
PoiList, usePolling, n8nProxy, proxy.ts-Muster).

## Backend

n8n (launchkit), async Token-Polling. Die App proxyt serverseitig (Secrets bleiben im Server):
`app/api/<tool>/start` → `/webhook/dmo-<tool>`, `app/api/status` → `/webhook/dmo-status`.
Details: [`../../workflows/dmo-tools/README.md`](../../workflows/dmo-tools/README.md).

## Env

- `N8N_BASE` = `https://n8n.friedemann-schuetz.de`
- `N8N_DMO_SECRET` = Webhook-Secret (muss zu den n8n-Workflows passen)
- `NOMINATIM_EMAIL` = Kontakt für den Nominatim-User-Agent

## Entwicklung & Deploy

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # vor jedem Deploy grün prüfen
```

Vercel (GitHub-Integration), **`git push origin main`** (nicht `vercel deploy --prod`).
Git-Autor-Mail = GitHub-Mail (`friedemann.schuetz@posteo.de`). 13 Domains im Vercel-Projekt,
DNS je Subdomain CNAME → `cname.vercel-dns.com` (oder ein Wildcard `*`).
