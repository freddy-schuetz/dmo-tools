"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import PoiList from "@/components/PoiList";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeheimtippResult, GeocodeHit } from "@/lib/types";

const CATS = [
  { value: "aussicht", label: "Aussicht" },
  { value: "sehenswuerdigkeit", label: "Sehenswürdigkeiten" },
  { value: "badestelle", label: "Badestellen" },
  { value: "natur", label: "Natur" },
  { value: "gastro", label: "Gastronomie" },
];

export default function Geheimtipp() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [category, setCategory] = useState("sehenswuerdigkeit");
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<GeheimtippResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst eine Region auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/geheimtipp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, category }),
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
      features: [
        ...result.hotspots.map((h) => ({
          type: "Feature" as const,
          properties: { cat: "hot", name: h.name, sub: "bekannter Hotspot", color: "#dc2626" },
          geometry: { type: "Point" as const, coordinates: [h.lng, h.lat] },
        })),
        ...result.hidden_gems.map((g) => ({
          type: "Feature" as const,
          properties: { cat: "gem", name: g.name, sub: `Geheimtipp · ${g.distance_from_hotspot_km} km abseits`, color: "#16a34a" },
          geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] },
        })),
      ],
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Geheimtipp-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Abseits der überlaufenen Hotspots</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Statt zu den bekannten, überfüllten Orten — wir finden die gleichwertigen, aber unbekannten
          Alternativen. Besucherlenkung gegen Overtourism.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Region</label>
          <AddressSearch placeholder="z. B. Mosel, Cochem" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mb-1 block text-sm font-medium">Kategorie</span>
            <OptionPills options={CATS} value={category} onChange={setCategory} ariaLabel="Kategorie" />
          </div>
          <button type="submit" disabled={status === "running"}
            className="ml-auto rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Geheimtipps finden"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Bekannte Hotspots und versteckte Alternativen werden ermittelt … (10–30 Sekunden)" />}
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
          <p className="-mt-4 text-center text-xs text-slate-500">🔴 bekannter Hotspot · 🟢 Geheimtipp</p>
          <div className="rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
            <h2 className="mb-2 font-bold text-green-800">🟢 Geheimtipps</h2>
            <PoiList
              items={result.hidden_gems.map((g, i) => ({
                id: `${g.name}${i}`,
                name: g.name,
                sub: `${g.distance_from_hotspot_km} km abseits der Hotspots · ${g.why}`,
                right: `${g.gem_score}`,
              }))}
              emptyText="Keine Geheimtipps gefunden."
            />
          </div>
          {result.hotspots.length > 0 && (
            <p className="text-center text-xs text-slate-500">
              Bekannte Hotspots (rot auf der Karte): {result.hotspots.map((h) => h.name).join(", ")}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
