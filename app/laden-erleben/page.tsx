"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import MethodBox, { type MethodContent } from "@/components/MethodBox";
import AboutSection from "@/components/AboutSection";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, LadenErlebenResult } from "@/lib/types";

const METHOD: MethodContent = {
  intro:
    "Ladezeit ist keine Totzeit. Das Tool zeigt Ladesäulen und — im 600-m-Fußradius — was man während der Ladepause erleben kann: Café, Museum, Aussicht, Altstadt.",
  sources: [
    "OpenStreetMap (Overpass API) — Ladestationen (mit Stecker/Leistung) + Erlebnis-POIs im Umkreis von 8 km",
    "OSM-Tags — Steckertypen, maximale Ladeleistung (kW), Betreiber",
  ],
  steps: [
    "Wir laden alle Ladesäulen und Erlebnis-POIs der Umgebung.",
    "Je Säule ermitteln wir, was in 600 m Fußweg liegt (Café, Museum, Aussicht …).",
    "Wir bewerten die Steckertypen/Leistung und markieren Schnelllader.",
    "Ranking nach „schönste Ladepause\" (viele Erlebnisse + Schnelllade-Bonus).",
  ],
  scoring: [
    "Schnelllader = CCS/CHAdeMO-Stecker oder ≥ 50 kW.",
    "Ranking bevorzugt Säulen mit vielen Erlebnissen im Fußradius.",
  ],
  limits: [
    "Ladeleistung/Verfügbarkeit ist OSM-Stand; eine Säule kann belegt oder defekt sein.",
    "Nur öffentlich getaggte POIs erscheinen als „Erlebnis\".",
  ],
};

function gmaps(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function LadenErleben() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<LadenErlebenResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/laden-erleben/start", {
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
      features: result.stations.map((s) => ({
        type: "Feature",
        properties: { cat: "charger", name: s.name, sub: `${s.max_kw ?? "?"} kW · ${s.nearby.length} Erlebnisse nah`, color: s.fast ? "#16a34a" : "#0ea5e9" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Laden & Erleben</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Ladepause? Wird zum Erlebnis.</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Die 30–45 Minuten Ladezeit sind keine Totzeit. Wir zeigen dir Ladesäulen — und was du
          währenddessen zu Fuß erreichst: Café, Museum, Aussicht, Altstadt.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Wo bist du?</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Freiburg" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Ladesäulen finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Ladesäulen und Erlebnisse werden gesucht … (10–40 Sekunden)" />}
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
          <p className="-mt-4 text-center text-xs text-slate-500">🟩 Schnelllader · 🔵 Normallader · anklickbar</p>

          <ul className="space-y-3">
            {result.stations.map((s) => (
              <li key={s.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-brand">⚡ {s.name}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {s.max_kw != null && <span className="font-semibold">{s.max_kw} kW</span>}
                    {s.fast && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-ok">Schnelllader</span>}
                    {s.connectors.length > 0 && <span className="text-xs text-slate-500">{s.connectors.join(", ")}</span>}
                  </span>
                </div>
                {s.nearby.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.nearby.map((n, i) => (
                      <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {n.name} · {n.dist_m} m
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Keine Erlebnisse im 600-m-Fußradius.</p>
                )}
                <div className="mt-2 text-sm">
                  <a href={gmaps(s.lat, s.lng)} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand-accent">
                    Route zur Säule ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>

          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Laden-&-Erleben für unsere Region" />
        </section>
      )}
    </main>
  );
}
