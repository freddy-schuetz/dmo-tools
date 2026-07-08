"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, LadeLueckenResult } from "@/lib/types";

export default function LadeLuecken() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(15);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<LadeLueckenResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst eine Region auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/lade-luecken/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, radius_km: radius }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Die Analyse konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Die Analyse konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  // Grid-Zellen (rot = Lücke, grün = versorgt) + Ladesäulen in EINE POI-FeatureCollection
  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    const cells = result.grid.map((c) => ({
      type: "Feature" as const,
      properties: {
        cat: "cell",
        name: c.gap ? "Lade-Lücke" : "versorgt",
        sub: `${c.dist_km} km zur nächsten Säule`,
        color: c.gap ? "#dc2626" : "#16a34a",
      },
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    }));
    const chargers = result.chargers.features.map((f) => ({
      ...f,
      properties: { ...f.properties, color: "#1e3a5f", cat: "charger" },
    }));
    return { type: "FeatureCollection", features: [...cells, ...chargers] };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Lade-Lücken-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Wo fehlt E-Auto-Ladeinfrastruktur?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Immer mehr Gäste reisen mit dem E-Auto an. Wir rastern deine Region und zeigen die
          „Lade-Wüsten" — Bereiche, die weiter als 5 km von der nächsten Ladesäule entfernt sind.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Region / Ort</label>
          <AddressSearch placeholder="z. B. Vulkaneifel" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Umkreis:</span>
            <OptionPills
              options={[{ value: 15, label: "15 km" }, { value: 25, label: "25 km" }]}
              value={radius}
              onChange={setRadius}
              ariaLabel="Umkreis"
            />
          </div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Analysiere …" : "Region analysieren"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Ladeinfrastruktur wird gerastert … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-3xl font-bold text-brand">{result.summary.charger_count}</p>
              <p className="text-sm text-slate-500">Ladestationen</p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className={`text-3xl font-bold ${result.summary.gap_pct > 25 ? "text-bad" : result.summary.gap_pct > 10 ? "text-warn" : "text-ok"}`}>
                {result.summary.gap_pct}%
              </p>
              <p className="text-sm text-slate-500">der Fläche &gt; 5 km entfernt</p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-3xl font-bold text-brand">{result.summary.worst_dist_km} km</p>
              <p className="text-sm text-slate-500">größte Lücke</p>
            </div>
          </div>

          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#0ea5e9" }]}
            heightClass="h-[480px]"
          />
          <p className="-mt-4 text-center text-xs text-slate-500">
            🟥 Lade-Lücke (&gt; 5 km) · 🟩 versorgt · 🔵 Ladestation · hellblau: Zentrum
          </p>
        </section>
      )}
    </main>
  );
}
