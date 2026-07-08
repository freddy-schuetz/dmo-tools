"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OptionPills from "@/components/OptionPills";
import RichResults from "@/components/RichResults";
import { type MethodContent } from "@/components/MethodBox";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { GeocodeHit, RichPoi, RuheResult } from "@/lib/types";

function scoreColor(s: number) {
  return s >= 75 ? "#16a34a" : s >= 50 ? "#eab308" : "#f97316";
}
const TYPE_EMOJI: Record<string, string> = {
  Gipfel: "🏔️", Aussichtspunkt: "👁️", Park: "🌳", Wald: "🌲", Schutzgebiet: "🌿",
};

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

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.quiet_spots.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      emoji: TYPE_EMOJI[s.type] ?? "🍃",
      color: scoreColor(s.score),
      category_label: s.type,
      meta_right: `Ruhe ${s.score}/100`,
      ai_why: `${s.nearest_noise_km} km bis zur nächsten Lärmquelle — hier ist es wirklich still.`,
      badges: s.score >= 75 ? ["sehr ruhig"] : undefined,
    }));
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
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Ruhe-Finder für unsere Region"
          routeMode="foot"
        />
      )}
    </main>
  );
}
