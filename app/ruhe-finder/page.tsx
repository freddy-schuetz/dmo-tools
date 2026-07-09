"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OptionPills from "@/components/OptionPills";
import RichResults from "@/components/RichResults";
import AuditScore from "@/components/AuditScore";
import { type MethodContent } from "@/components/MethodBox";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { GeocodeHit, RichPoi, RuheResult } from "@/lib/types";

const TYPE_EMOJI: Record<string, string> = {
  Gipfel: "🏔️", Aussichtspunkt: "👁️", Park: "🌳", Wald: "🌲", Schutzgebiet: "🌿",
};

function scoreColor(s: number) {
  return s >= 75 ? "#16a34a" : s >= 50 ? "#eab308" : "#f97316";
}

const METHOD: MethodContent = {
  intro:
    "„Quiet Travel“ ist ein Wellness-Trend. Der Ruhe-Finder zeigt die Stille einer Region als Karte (Ruhe-Heatmap), bewertet Orte nach ZWEI Faktoren — Verkehrslärm UND Besucherströme — und beschreibt, was man dort stattdessen hört.",
  sources: [
    "OpenStreetMap — Natur-Orte (Gipfel, Aussicht, Park, Wald, Schutzgebiete) als Ruhe-Kandidaten",
    "OpenStreetMap — Lärmquellen: große Straßen, Bahnstrecken, Industrie, Städte, Flugplätze · Bäche/Flüsse für die Klangkulisse",
    "OpenStreetMap — Wikipedia-prominente Touristen-Hotspots (zweiter Faktor: Besucherströme)",
    "GBIF — dokumentierte Vogelarten der Region (mit Wikipedia-Foto) · Wikipedia — Texte/Fotos der Orte · Valhalla — Stille-Spaziergang",
  ],
  steps: [
    "Wir rastern die Region und berechnen je Zelle die Distanz zur nächsten Lärmquelle → Ruhe-Heatmap + Ruhe-Index.",
    "Jeder Natur-Ort bekommt zwei Werte: Abstand zum Verkehrslärm UND Abstand zu bekannten Touristen-Hotspots.",
    "Für die Klangkulisse prüfen wir Bäche in Hörweite (< 350 m), Wald/Park — und welche Vögel laut GBIF hier dokumentiert sind.",
    "Aus den stillsten benachbarten Orten baut Valhalla automatisch einen Stille-Spaziergang (Rundweg).",
  ],
  scoring: [
    "Stille-Score = 60 % Verkehrslärm-Distanz (4 km = Maximum) + 40 % Hotspot-Distanz (5 km = Maximum).",
    "Ruhe-Index der Region = Mittelwert der Heatmap-Zellen (100 = überall ≥ 4 km zur nächsten Lärmquelle).",
    "Vogelarten sind echte GBIF-Meldungen — Vogelgesang ist wahrscheinlich, nie garantiert.",
  ],
  limits: [
    "Grundlage ist die Nähe zu Lärmquellen (Luftlinie), keine Schallmessung — Wind, Topografie und Tageszeit fehlen.",
    "Bewusst keine Dezibel-Angaben: das wäre ohne Messung Pseudo-Präzision.",
    "Temporärer Lärm (Baustellen, Events, Landwirtschaft) ist nicht erfasst.",
  ],
};

export default function RuheFinder() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(15);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [showWalk, setShowWalk] = useState(false);
  const { status, result, errorMessage } = usePolling<RuheResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    setShowWalk(false);
    try {
      const res = await fetch("/api/ruhe-finder/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, radius_km: radius }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  // Ruhe-Heatmap: rot = Lärmkorridor, tiefgrün = wirklich still
  const heatCells = useMemo(() => {
    if (!result?.grid?.length) return [];
    const step = result.step_km ?? 2;
    const hLat = step / 2 / 111;
    const features = result.grid.map((c) => {
      const hLng = step / 2 / (111 * Math.cos((c.lat * Math.PI) / 180));
      return {
        type: "Feature" as const,
        properties: { dist_km: c.dist_km },
        geometry: {
          type: "Polygon" as const,
          coordinates: [[
            [c.lng - hLng, c.lat - hLat],
            [c.lng + hLng, c.lat - hLat],
            [c.lng + hLng, c.lat + hLat],
            [c.lng - hLng, c.lat + hLat],
            [c.lng - hLng, c.lat - hLat],
          ]],
        },
      };
    });
    return [{
      id: "quiet",
      data: { type: "FeatureCollection" as const, features },
      property: "dist_km",
      stops: [[0, "#dc2626"], [1, "#f97316"], [2, "#eab308"], [3, "#84cc16"], [4.5, "#15803d"]] as [number, string][],
      opacity: 0.45,
    }];
  }, [result]);

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.quiet_spots.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      emoji: TYPE_EMOJI[s.type] ?? "🍃",
      color: scoreColor(s.stille_score),
      category_label: s.type,
      meta_right: `Stille ${s.stille_score}/100`,
      description: s.description,
      ai_why: s.ai_why,
      image: s.image,
      wiki_url: s.wiki_url,
      badges: [
        `🚗 Verkehr ${s.nearest_noise_km} km entfernt`,
        ...(s.crowd_km != null ? [`👥 Hotspots ${s.crowd_km} km entfernt`] : []),
        ...(s.sounds ?? []),
      ],
    }));
  }, [result]);

  const walkLines = useMemo(() => {
    if (!showWalk || !result?.stille_route) return [];
    return [{ id: "stille-walk", data: result.stille_route.geometry, color: "#0d9488", width: 4, dashed: true }];
  }, [showWalk, result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Ruhe-Finder</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Die ruhigsten Plätze der Region</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Die Stille deiner Region als Karte: fern von Straßen, Bahn <em>und</em> Touristenströmen —
          mit der Klangkulisse, die dich dort erwartet, und einem fertigen Stille-Spaziergang.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Ort / Region</label>
          <AddressSearch placeholder="z. B. Lübbenau, Spreewald" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Umkreis:</span>
            <OptionPills options={[{ value: 10, label: "10 km" }, { value: 15, label: "15 km" }, { value: 20, label: "20 km" }]} value={radius} onChange={setRadius} ariaLabel="Umkreis" />
          </div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Ruhe finden"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Ruhe-Heatmap, Klangkulisse und Stille-Spaziergang werden berechnet … (20–60 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Ruhe-Finder für unsere Region"
          routeMode="foot"
          heatCells={heatCells}
          extraLines={walkLines}
        >
          <AuditScore
            score={result.ruhe_index}
            title={`Ruhe-Index · ${radius} km Umkreis`}
            subtitle={`${result.quiet_spots.length} stille Orte gefunden · Basis: Distanz zu Straßen, Bahn, Industrie & Städten`}
            labels={{ good: "Überwiegend still", mid: "Gemischt", bad: "Stark verlärmt" }}
          />

          {result.region_birds && result.region_birds.length > 0 && (
            <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
              <h2 className="mb-3 font-bold text-emerald-800">🎧 Die Klangkulisse: Diese Vögel sind hier dokumentiert</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {result.region_birds.map((s) => (
                  <a
                    key={s.name_de}
                    href={s.wiki_url ?? undefined}
                    target={s.wiki_url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-emerald-100 ${s.wiki_url ? "transition hover:ring-emerald-300" : "pointer-events-none"}`}
                  >
                    {s.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.image} alt={s.name_de} loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-100" aria-hidden>🐦</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-emerald-800">{s.name_de}</p>
                      <p className="text-[10px] text-emerald-500">{s.count.toLocaleString("de-DE")}×</p>
                    </div>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-xs text-emerald-600">GBIF-Meldungen · Fotos: Wikipedia · Vogelgesang wahrscheinlich, nie garantiert.</p>
            </div>
          )}

          {result.stille_route && (
            <div className="rounded-2xl bg-teal-50 p-5 ring-1 ring-teal-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-teal-800">🚶 Stille-Spaziergang (automatisch erstellt)</h2>
                  <p className="mt-1 text-sm text-teal-700">
                    Rundweg <strong>{result.stille_route.distance_km} km</strong> · ca. <strong>{result.stille_route.duration_min} Min</strong> — über {result.stille_route.stops.join(" → ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWalk((v) => !v)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition ${showWalk ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-teal-700 ring-teal-300"}`}
                >
                  {showWalk ? "● auf der Karte" : "🗺 Auf Karte zeigen"}
                </button>
              </div>
            </div>
          )}

          <p className="-mb-3 text-center text-xs text-slate-400">
            Heatmap: 🟥 laut (nahe Verkehr) → 🟩 still · Punkte = stillste Orte (anklickbar)
          </p>
        </RichResults>
      )}
    </main>
  );
}
