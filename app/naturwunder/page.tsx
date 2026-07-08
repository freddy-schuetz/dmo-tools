"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import PoiList from "@/components/PoiList";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, NaturwunderResult } from "@/lib/types";

const TYPE_META: Record<string, { emoji: string; color: string }> = {
  Wasserfall: { emoji: "💧", color: "#0ea5e9" },
  Höhle: { emoji: "🕳️", color: "#78716c" },
  Quelle: { emoji: "🌊", color: "#06b6d4" },
  Felsentor: { emoji: "🪨", color: "#a16207" },
  Doline: { emoji: "⭕", color: "#57534e" },
  Felswand: { emoji: "🧗", color: "#b45309" },
  Felsformation: { emoji: "🪨", color: "#a16207" },
  "Naturdenkmal-Baum": { emoji: "🌳", color: "#16a34a" },
  Naturwunder: { emoji: "✨", color: "#64748b" },
};

export default function Naturwunder() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<NaturwunderResult>(token);
  const [active, setActive] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    setActive([]);
    try {
      const res = await fetch("/api/naturwunder/start", {
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

  const types = useMemo(() => Array.from(new Set(result?.wonders.map((w) => w.type) ?? [])), [result]);
  const shown = useMemo(
    () => (result ? result.wonders.filter((w) => active.length === 0 || active.includes(w.type)) : []),
    [result, active]
  );
  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: shown.map((w) => ({
        type: "Feature",
        properties: { cat: "wonder", name: w.name, sub: `${w.type} · ${w.distance_km} km`, color: TYPE_META[w.type]?.color ?? "#64748b" },
        geometry: { type: "Point", coordinates: [w.lng, w.lat] },
      })),
    };
  }, [shown, result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Naturwunder-Finder</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Die Naturwunder deiner Region</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Wasserfälle, Höhlen, Quellen, Felsentore und Naturdenkmäler — verstreut in OpenStreetMap,
          hier erstmals gesammelt auf einer Karte.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Ort / Region</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Berchtesgaden" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Naturwunder finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Naturwunder werden gesucht … (5–25 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = active.length === 0 || active.includes(t);
              return (
                <button key={t} type="button"
                  onClick={() => setActive((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${on ? "text-white" : "bg-white text-slate-500 ring-slate-300"}`}
                  style={on ? { backgroundColor: TYPE_META[t]?.color ?? "#64748b", borderColor: TYPE_META[t]?.color ?? "#64748b" } : {}}>
                  {TYPE_META[t]?.emoji} {t}
                </button>
              );
            })}
          </div>
          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={pois}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[440px]"
          />
          <PoiList
            items={shown.map((w) => ({
              id: w.id,
              name: `${TYPE_META[w.type]?.emoji ?? "✨"} ${w.name}`,
              sub: w.type,
              right: `${w.distance_km} km`,
            }))}
            emptyText="Keine Naturwunder in dieser Auswahl."
          />
        </section>
      )}
    </main>
  );
}
