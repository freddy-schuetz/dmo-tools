"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import MethodBox, { type MethodContent } from "@/components/MethodBox";
import AboutSection from "@/components/AboutSection";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, LadenWandernResult } from "@/lib/types";

const METHOD: MethodContent = {
  intro:
    "Charge & Hike findet Ladesäulen, die direkt an einem Wanderparkplatz nahe eines Wanderweg-Zugangs liegen — „Park dein E-Auto, lade, während du wanderst\".",
  sources: [
    "OpenStreetMap (Overpass API) — Ladestationen, Parkplätze, Wanderweg-Zugänge (Trailhead/Wegweiser/Aussicht/Gipfel) im Umkreis von 15 km",
    "OSM-Tags — Steckertypen und Ladeleistung (kW)",
  ],
  steps: [
    "Wir laden Ladesäulen, Parkplätze und Wander-Startpunkte der Region.",
    "Eine Säule qualifiziert sich, wenn ein Parkplatz ≤ 400 m UND ein Wanderweg-Zugang ≤ 1500 m liegt.",
    "Wir markieren Schnelllader und zeigen den nächsten Wander-Hinweis.",
    "Per Deep-Link geht es direkt zur Navigation.",
  ],
  scoring: [
    "Schnelllader = CCS/CHAdeMO oder ≥ 50 kW.",
    "Sortierung nach Entfernung zum Suchort.",
  ],
  limits: [
    "„Wanderweg-Zugang\" leiten wir aus OSM-Signalen ab — die tatsächliche Wegqualität prüfen wir nicht.",
    "Ladesäulen-Verfügbarkeit/-Leistung ist OSM-Stand und kann abweichen.",
  ],
};

function gmaps(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function LadenWandern() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<LadenWandernResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/laden-wandern/start", {
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

  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.spots.map((s) => ({
        type: "Feature",
        properties: { cat: "spot", name: s.name, sub: s.trail_hint ?? "", color: s.fast ? "#16a34a" : "#0ea5e9" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Charge &amp; Hike</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Laden, während du wanderst</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Ladesäulen an Wanderparkplätzen: Park dein E-Auto, geh wandern — und komm zu einem vollen
          Akku zurück. Die perfekte Kombi für aktive E-Auto-Gäste.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Region / Ort</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Winterberg, Sauerland" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Spots finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Ladesäulen an Wanderparkplätzen werden gesucht … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[420px]"
          />
          <p className="-mt-4 text-center text-xs text-slate-500">🟩 Schnelllader · 🔵 Normallader</p>
          <ul className="space-y-3">
            {result.spots.map((s) => (
              <li key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-brand">🥾⚡ {s.name}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {s.max_kw != null && <span className="font-semibold">{s.max_kw} kW</span>}
                    {s.fast && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-ok">Schnelllader</span>}
                    <span className="text-slate-400">{s.distance_km} km</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {s.parking ? `🅿️ ${s.parking}` : ""} {s.trail_hint ? `· 🥾 ${s.trail_hint}` : ""}
                </p>
                <div className="mt-2 text-sm">
                  <a href={gmaps(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand-accent">
                    Route zum Spot ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>

          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Charge-&-Hike für unsere Region" />
        </section>
      )}
    </main>
  );
}
