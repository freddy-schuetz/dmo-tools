"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import PoiCard from "@/components/PoiCard";
import MethodBox, { type MethodContent } from "@/components/MethodBox";
import AboutSection from "@/components/AboutSection";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { Feature, FeatureCollection, GeocodeHit, RichPoi, ThementourResult } from "@/lib/types";
import type { LineLayer } from "@/components/IsoMap";

const THEMES = [
  { value: "kultur", label: "🏛️ Kultur" },
  { value: "genuss", label: "🍺 Genuss" },
  { value: "natur", label: "🌲 Natur" },
  { value: "familie", label: "🎡 Familie" },
];
const LENGTHS = [
  { value: "kurz", label: "kurz" },
  { value: "mittel", label: "mittel" },
  { value: "lang", label: "lang" },
];
const TRAVELS = [
  { value: "foot", label: "🚶 zu Fuß" },
  { value: "bike", label: "🚲 per Rad" },
];

// GPX-Export: Route + Stopps als Wegpunkte, rein clientseitig aus der Geometrie
function downloadGpx(result: ThementourResult) {
  if (!result.route) return;
  const coords = (result.route.geometry.geometry as { coordinates: number[][] }).coordinates;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const wpts = result.stops.map((s) => `  <wpt lat="${s.lat}" lon="${s.lng}"><name>${esc(`${s.order}. ${s.name}`)}</name></wpt>`).join("\n");
  const trkpts = coords.map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`).join("\n");
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="dmo-tools / friedemann-schuetz.de" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${esc(`Thementour ${result.theme} · ${result.start_label}`)}</name></metadata>
${wpts}
  <trk><name>${esc(`Thementour (${result.travel === "bike" ? "Rad" : "zu Fuß"}, ${result.route.distance_km} km)`)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `thementour-${result.theme}.gpx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Mini-Höhenprofil als Inline-SVG
function ElevationSparkline({ profile }: { profile: number[] }) {
  const w = 280, h = 48;
  const min = Math.min(...profile), max = Math.max(...profile);
  const span = Math.max(max - min, 10);
  const pts = profile.map((e, i) => `${((i / (profile.length - 1)) * w).toFixed(1)},${(h - ((e - min) / span) * (h - 6) - 3).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" aria-label="Höhenprofil">
      <polyline points={pts} fill="none" stroke="#9333ea" strokeWidth="2" strokeLinejoin="round" />
      <text x="0" y={h - 1} fontSize="9" fill="#94a3b8">{min} m</text>
      <text x={w} y="8" fontSize="9" fill="#94a3b8" textAnchor="end">{max} m</text>
    </svg>
  );
}

const METHOD: MethodContent = {
  intro:
    "Der Generator stellt aus passenden Orten deiner Wahl automatisch eine fußläufige Rundtour zusammen — inklusive echter Wegführung und angereicherter Stopps. Fertiger Content für DMO-Websites.",
  sources: [
    "OpenStreetMap (Overpass API) — themenpassende Orte (Kultur/Genuss/Natur/Familie) rund um den Startpunkt",
    "FOSSGIS-Valhalla — reale Rundtour zu Fuß ODER per Rad (Start → Stopps → Start)",
    "Open-Meteo Elevation — Höhenprofil & Höhenmeter entlang der Route",
    "Wikipedia — Kurztext/Foto der Stopps · KI — 1 Satz je Stopp (faktenbasiert) · OSM-Tags — Öffnungszeiten/Website",
  ],
  steps: [
    "Wir suchen themenpassende Orte im Umkreis — zu Fuß kompakt, per Rad die Highlights im großen Radius (räumlich gestreut statt Innenstadt-Klumpen).",
    "Per Nearest-Neighbor entsteht die Reihenfolge; Valhalla berechnet die echte Rundtour (Fuß-/Radwege).",
    "Höhenprofil + Höhenmeter kommen aus einem Geländemodell; die Stopps bekommen Wikipedia-Text/Foto und einen KI-Satz.",
    "Per GPX-Export nimmst du die Tour direkt mit zu Komoot, Garmin oder Outdooractive.",
  ],
  limits: [
    "Die Reihenfolge ist heuristisch (Nearest-Neighbor), nicht die mathematisch kürzeste Route.",
    "Höhendaten aus ~90-m-Raster — Näherung, keine Vermessung.",
    "Personen-Gedenkorte (z. B. Stolpersteine) werden bewusst nicht als Tour-Stopps verwendet.",
  ],
};

export default function Thementour() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [theme, setTheme] = useState("kultur");
  const [length, setLength] = useState("mittel");
  const [travel, setTravel] = useState("foot");
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<ThementourResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Startpunkt auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/thementour/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, theme, length, travel }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  const lines = useMemo<LineLayer[]>(() => {
    if (!result?.route) return [];
    return [{ id: "tour", data: result.route.geometry as Feature, color: "#9333ea", width: 5 }];
  }, [result]);

  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.stops.map((s) => ({
        type: "Feature",
        properties: { cat: "stop", name: `${s.order}. ${s.name}`, color: "#9333ea" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [result]);

  const stopPois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.stops.map((s) => ({
      id: s.id ?? String(s.order),
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      emoji: `${s.order}.`,
      color: "#9333ea",
      description: s.description,
      image: s.image,
      wiki_url: s.wiki_url,
      website: s.website,
      open_now: s.open_now,
      wheelchair: s.wheelchair,
    }));
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Thementouren-Generator</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Themen-Rundtour auf Knopfdruck</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Wähle Start, Thema und Länge — wir stellen automatisch eine Fußweg-Rundtour zusammen, die
          passende Orte verbindet. Fertiger Content für deine Gäste.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Startpunkt</label>
          <AddressSearch placeholder="z. B. Marktplatz Bamberg" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="mb-1 block text-sm font-medium">Thema</span>
            <OptionPills options={THEMES} value={theme} onChange={setTheme} ariaLabel="Thema" />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Länge</span>
            <OptionPills options={LENGTHS} value={length} onChange={setLength} ariaLabel="Länge" />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Unterwegs</span>
            <OptionPills options={TRAVELS} value={travel} onChange={setTravel} ariaLabel="Fortbewegung" />
          </div>
          <button type="submit" disabled={status === "running"}
            className="ml-auto rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Baue Tour …" : "Tour erstellen"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Passende Orte werden verbunden, geroutet und angereichert … (15–45 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          {result.route && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {result.travel === "bike" ? "🚲" : "🚶"} Rundweg <strong>{result.route.distance_km} km</strong> · ca. <strong>{result.route.duration_min} Min</strong> · {result.stops.length} Stopps
                  {result.route.ascent_m != null && (
                    <span className="text-slate-500"> · ↗ {result.route.ascent_m} Hm · ↘ {result.route.descent_m} Hm</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => downloadGpx(result)}
                  className="rounded-lg border border-brand px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-slate-50"
                >
                  ⬇ GPX für Komoot/Garmin
                </button>
              </div>
              {result.elevation_profile && result.elevation_profile.length > 5 && (
                <div className="mt-2">
                  <ElevationSparkline profile={result.elevation_profile} />
                </div>
              )}
            </div>
          )}
          <IsoMapDynamic
            center={[result.start.lng, result.start.lat]}
            zones={[]}
            lines={lines}
            pois={pois}
            markers={[{ lat: result.start.lat, lng: result.start.lng, color: "#1e3a5f" }]}
            heightClass="h-[460px]"
          />
          <div className="grid gap-3 lg:grid-cols-2">
            {stopPois.map((p) => (
              <PoiCard key={p.id} poi={p} origin={result.start} />
            ))}
          </div>
          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Thementouren-Generator für unsere Region" />
        </section>
      )}
    </main>
  );
}
