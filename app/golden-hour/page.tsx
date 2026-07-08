"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import PoiList from "@/components/PoiList";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, GoldenHourResult } from "@/lib/types";

export default function GoldenHour() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<GoldenHourResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/golden-hour/start", {
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
        properties: { cat: "spot", name: s.name, sub: s.faces_sunset ? "Blick Richtung Sonnenuntergang" : s.cat, color: s.faces_sunset ? "#f59e0b" : "#0ea5e9" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [result]);

  const cloudLabel = (c: number | null) =>
    c == null ? "" : c < 30 ? "meist klar ☀️" : c < 70 ? "teils bewölkt ⛅" : "stark bewölkt ☁️";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Golden-Hour-Fotospots</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Der beste Sonnenuntergang heute</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Aussichtspunkte, Gipfel und Türme rund um deinen Ort — mit heutiger Sonnenuntergangszeit.
          Spots mit passender Blickrichtung sind hervorgehoben.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Ort / Region</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Füssen" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Fotospots finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Aussichtspunkte und Sonnenstand werden berechnet … (5–25 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
              <p className="text-3xl font-bold text-amber-600">🌅 {result.sunset_time ?? "—"}</p>
              <p className="text-sm text-amber-800">Sonnenuntergang heute</p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-3xl font-bold text-brand">🌄 {result.sunrise_time ?? "—"}</p>
              <p className="text-sm text-slate-500">Sonnenaufgang</p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-lg font-bold text-brand">{cloudLabel(result.cloud_cover_pct) || "—"}</p>
              <p className="text-sm text-slate-500">Sicht heute{result.cloud_cover_pct != null ? ` (${result.cloud_cover_pct}% Wolken)` : ""}</p>
            </div>
          </div>

          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[440px]"
          />
          <p className="-mt-4 text-center text-xs text-slate-500">🟠 Blick Richtung Sonnenuntergang · 🔵 weiterer Aussichtspunkt</p>

          <PoiList
            items={result.spots.map((s) => ({
              id: s.id,
              name: `${s.faces_sunset ? "🌅 " : ""}${s.name}`,
              sub: `${s.cat}${s.elevation ? ` · ${s.elevation} m` : ""}${s.faces_sunset ? " · Blick Richtung Sonnenuntergang" : ""}`,
              right: `${s.distance_km} km`,
            }))}
            emptyText="Keine Aussichtspunkte gefunden."
          />
        </section>
      )}
    </main>
  );
}
