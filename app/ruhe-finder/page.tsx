"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import MethodBox, { type MethodContent } from "@/components/MethodBox";
import AboutSection from "@/components/AboutSection";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, RuheResult } from "@/lib/types";

function scoreColor(s: number) {
  return s >= 75 ? "#16a34a" : s >= 50 ? "#eab308" : "#f97316";
}

const METHOD: MethodContent = {
  intro:
    "„Quiet Travel\" ist ein Wellness-Trend. Der Ruhe-Finder berechnet aus der Distanz zu Lärmquellen, welche Natur-Orte in der Region am ruhigsten sind.",
  sources: [
    "OpenStreetMap (Overpass API) — Natur-Orte (Gipfel, Aussicht, Park, Wald, Schutzgebiete) als Ruhe-Kandidaten",
    "OpenStreetMap — Lärmquellen: große Straßen, Bahnstrecken, Industrie, Städte, Flugplätze",
  ],
  steps: [
    "Wir sammeln Natur-Orte und Lärmquellen im gewählten Umkreis.",
    "Für jeden Ort berechnen wir die Luftlinien-Distanz zur nächsten Lärmquelle.",
    "Daraus ergibt sich ein Ruhe-Score von 0–100.",
    "Wir zeigen die 15 ruhigsten Plätze.",
  ],
  scoring: [
    "Ruhe-Score = Distanz zur nächsten Lärmquelle, gedeckelt bei 4 km (≥ 4 km = 100).",
    "🟢 ≥ 75 sehr ruhig · 🟡 ≥ 50 ruhig · 🟠 darunter mäßig ruhig.",
  ],
  limits: [
    "Grundlage ist die Nähe zu Lärmquellen, keine echte Schallmessung — lokale Faktoren (Wind, Topografie) fehlen.",
    "Temporärer Lärm (Baustellen, Events) ist nicht erfasst.",
  ],
};

export default function RuheFinder() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(15);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<RuheResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
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

  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.quiet_spots.map((s) => ({
        type: "Feature",
        properties: { cat: "quiet", name: s.name, sub: `Ruhe-Score ${s.score} · ${s.nearest_noise_km} km bis Lärm`, color: scoreColor(s.score) },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Ruhe-Finder</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Die ruhigsten Plätze der Region</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          „Quiet Travel" ist der Wellness-Trend. Wir berechnen aus der Distanz zu Straßen, Bahn und
          Industrie, wo du wirklich Ruhe findest — abseits des Lärms.
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

      {status === "running" && <RunningBox text="Ruhige Orte werden berechnet … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[440px]"
          />
          <p className="-mt-4 text-center text-xs text-slate-500">🟢 sehr ruhig · 🟡 ruhig · 🟠 mäßig ruhig</p>
          <ol className="space-y-2">
            {result.quiet_spots.map((s, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: scoreColor(s.score) }}>
                  {s.score}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.type} · {s.nearest_noise_km} km bis zur nächsten Lärmquelle</p>
                </div>
              </li>
            ))}
          </ol>
          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Ruhe-Finder für unsere Region" />
        </section>
      )}
    </main>
  );
}
