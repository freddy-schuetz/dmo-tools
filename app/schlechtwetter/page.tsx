"use client";

import { useEffect, useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import { rainviewerTiles } from "@/lib/rainviewer";
import type { GeocodeHit, RichPoi, SchlechtwetterResult } from "@/lib/types";

const CAT_EMOJI: Record<string, string> = {
  Museum: "🏛️", Aquarium: "🐠", "Therme/Bad": "♨️", Erlebnisbad: "🏊", Kino: "🎬",
  Theater: "🎭", Kulturzentrum: "🎨", Planetarium: "🪐", Bowling: "🎳", Kletterhalle: "🧗", Indoor: "🏠",
};

const METHOD: MethodContent = {
  intro:
    "Der Schlechtwetter-Radar verbindet das Live-Wetter mit den besten Indoor-Zielen in der Nähe — damit auch ein Regentag ein guter Urlaubstag wird.",
  sources: [
    "Open-Meteo — aktuelle Temperatur, Niederschlag und Regenwahrscheinlichkeit der nächsten Stunden",
    "OpenStreetMap (Overpass API) — Museen, Aquarien, Thermen, Kinos, Theater, Kletterhallen, Erlebnisbäder (12 km)",
    "OSM-Tags — „geöffnet jetzt\", Öffnungszeiten, Website · Wikipedia — Foto/Text bei bekannten Häusern",
  ],
  steps: [
    "Wir prüfen das aktuelle Wetter und ob in den nächsten Stunden Regen wahrscheinlich ist.",
    "Passend dazu holen wir Indoor-Ziele aus OpenStreetMap und berechnen ihren „geöffnet\"-Status.",
    "Die nächstgelegenen Ziele reichern wir mit Wikipedia-Foto/Text und Website an.",
    "Route zum Ziel auf Wunsch direkt auf der Karte.",
  ],
  limits: [
    "Die Wetterempfehlung ist eine Momentaufnahme; kurzfristige Schauer lassen sich nie exakt vorhersagen.",
    "„geöffnet jetzt\" beruht auf OSM-Öffnungszeiten — Feiertage sind selten erfasst.",
  ],
};

export default function Schlechtwetter() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<SchlechtwetterResult>(token);
  const [radarOn, setRadarOn] = useState(true);
  const [radarTiles, setRadarTiles] = useState<string[] | null>(null);

  // Regenradar-Kacheln (RainViewer) laden, sobald ein Ergebnis da ist
  useEffect(() => {
    if (status === "done" && !radarTiles) rainviewerTiles().then(setRadarTiles).catch(() => {});
  }, [status, radarTiles]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/schlechtwetter/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.pois.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      emoji: CAT_EMOJI[p.cat] ?? "🏠",
      color: "#7c3aed",
      category_label: p.cat,
      distance_km: p.distance_km,
      description: p.description,
      image: p.image,
      wiki_url: p.wiki_url,
      open_now: p.open_now,
      opening_hours: p.opening_hours,
      website: p.website,
      phone: p.phone,
      wheelchair: p.wheelchair,
    }));
  }, [result]);

  const rasterLayers = radarOn && radarTiles ? [{ id: "rain", tiles: radarTiles, opacity: 0.6 }] : [];
  const hours = result?.weather.hours ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Schlechtwetter-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Was tun, wenn es regnet?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Live-Wetter plus die besten Indoor-Ziele in der Nähe: Museen, Thermen, Kinos, Kletterhallen,
          Erlebnisbäder — mit „geöffnet jetzt", Foto und Route.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Ort</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Füssen" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Indoor-Ziele finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Wetter und Indoor-Ziele werden geladen … (10–30 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Schlechtwetter-Radar für unsere Region"
          routeMode="car"
          rasterLayers={rasterLayers}
        >
          <div className={`rounded-2xl p-5 ring-1 ${result.weather.recommendation === "indoor" ? "bg-amber-50 ring-amber-300" : "bg-sky-50 ring-sky-200"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold text-brand">
                {result.weather.temp != null ? `${Math.round(result.weather.temp)}°C · ` : ""}
                {result.weather.summary}
              </p>
              {radarTiles && (
                <button
                  type="button"
                  onClick={() => setRadarOn((v) => !v)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${radarOn ? "bg-brand text-white ring-brand" : "bg-white text-slate-600 ring-slate-300"}`}
                >
                  🌧️ Regenradar {radarOn ? "an" : "aus"}
                </button>
              )}
            </div>
            {hours.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Regenwahrscheinlichkeit nächste Stunden</p>
                <div className="flex items-end gap-1.5">
                  {hours.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-16 w-full items-end rounded bg-white/70">
                        <div
                          className={`w-full rounded ${h.prob >= 50 ? "bg-blue-600" : h.prob >= 20 ? "bg-sky-400" : "bg-slate-300"}`}
                          style={{ height: `${Math.max(6, h.prob)}%` }}
                          title={`${h.prob}%`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{h.t}</span>
                      <span className="text-[10px] font-medium text-slate-600">{h.prob}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </RichResults>
      )}
    </main>
  );
}
