"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import PoiList from "@/components/PoiList";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { EautoAusflugResult, FeatureCollection, GeocodeHit } from "@/lib/types";

export default function EautoAusflug() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [range, setRange] = useState(150);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<EautoAusflugResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst deinen Standort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/eauto-ausflug/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, range_km: range }),
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
      features: result.trips.map((t) => ({
        type: "Feature",
        properties: { cat: "trip", name: t.name, sub: `${t.drive_min} Min · Laden vor Ort`, color: "#9333ea" },
        geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      })),
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">E-Auto-Tagesausflug</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Reichweiten-sichere Ausflüge mit Ladesäule</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Wir zeigen nur Ziele, die du mit einer Ladung hin und zurück schaffst <strong>und</strong> die
          eine Ladesäule vor Ort haben. Keine Reichweiten-Angst.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Dein Standort / Unterkunft</label>
          <AddressSearch placeholder="z. B. Köln" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Reichweite:</span>
            <OptionPills
              options={[{ value: 100, label: "100 km" }, { value: 150, label: "150 km" }, { value: 250, label: "250 km" }]}
              value={range}
              onChange={setRange}
              ariaLabel="Reichweite"
            />
          </div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Ausflüge finden"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Reichweiten-sichere Ziele werden berechnet … (10–50 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <p className="text-sm text-slate-600">
            <strong>{result.trips.length}</strong> Ausflugsziele in Reichweite ({result.range_km} km) mit Lademöglichkeit vor Ort.
          </p>
          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[440px]"
          />
          <PoiList
            items={result.trips.map((t) => ({
              id: t.name + t.lat,
              name: t.name,
              sub: `🚗 ${t.drive_min} Min · ${t.distance_km} km · ⚡ ${t.charger.name}${t.charger.max_kw ? ` (${t.charger.max_kw} kW)` : ""}`,
              right: `${t.drive_min} Min`,
            }))}
            emptyText="Keine passenden Ziele gefunden."
          />
        </section>
      )}
    </main>
  );
}
