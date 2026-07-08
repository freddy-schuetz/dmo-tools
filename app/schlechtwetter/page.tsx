"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import PoiList from "@/components/PoiList";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, SchlechtwetterResult } from "@/lib/types";

export default function Schlechtwetter() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<SchlechtwetterResult>(token);

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

  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.pois.map((p) => ({
        type: "Feature",
        properties: { cat: "indoor", name: p.name, sub: `${p.cat} · ${p.distance_km} km`, color: "#7c3aed" },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Schlechtwetter-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Was tun, wenn es regnet?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Live-Wetter plus die besten Indoor-Ziele in der Nähe: Museen, Thermen, Kinos, Kletterhallen,
          Erlebnisbäder. Damit auch der Regentag ein guter Urlaubstag wird.
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

      {status === "running" && <RunningBox text="Wetter und Indoor-Ziele werden geladen … (5–25 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <div className={`rounded-2xl p-5 text-center ring-1 ${result.weather.recommendation === "indoor" ? "bg-amber-50 ring-amber-300" : "bg-sky-50 ring-sky-200"}`}>
            <p className="text-lg font-semibold text-brand">
              {result.weather.temp != null ? `${Math.round(result.weather.temp)}°C · ` : ""}
              {result.weather.summary}
            </p>
          </div>
          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[440px]"
          />
          <PoiList
            items={result.pois.map((p) => ({
              id: p.id,
              name: p.name,
              sub: `${p.cat}${p.open_now === true ? " · geöffnet" : p.open_now === false ? " · geschlossen" : ""}`,
              right: `${p.distance_km} km`,
            }))}
            emptyText="Keine Indoor-Ziele in der Nähe gefunden."
          />
        </section>
      )}
    </main>
  );
}
