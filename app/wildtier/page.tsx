"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import PoiList from "@/components/PoiList";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, WildtierResult } from "@/lib/types";

const TYPE_META: Record<string, { emoji: string; color: string }> = {
  "Beobachtungshütte": { emoji: "🦅", color: "#d97706" },
  Schutzgebiet: { emoji: "🌿", color: "#16a34a" },
  "Feuchtgebiet/Moor": { emoji: "🦆", color: "#0891b2" },
  Naturbeobachtung: { emoji: "🔭", color: "#64748b" },
};

export default function Wildtier() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(20);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<WildtierResult>(token);
  const [active, setActive] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    setActive([]);
    try {
      const res = await fetch("/api/wildtier/start", {
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

  const types = useMemo(() => Array.from(new Set(result?.spots.map((s) => s.type) ?? [])), [result]);
  const shown = useMemo(
    () => (result ? result.spots.filter((s) => active.length === 0 || active.includes(s.type)) : []),
    [result, active]
  );
  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: shown.map((s) => ({
        type: "Feature",
        properties: { cat: "wild", name: s.name, sub: `${s.type} · ${s.distance_km} km`, color: TYPE_META[s.type]?.color ?? "#64748b" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [shown, result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Wildtier-Beobachtung</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Natur &amp; Tiere beobachten</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Beobachtungshütten, Naturschutzgebiete und Feuchtgebiete rund um deinen Ort — für
          Naturliebhaber und nachhaltigen Öko-Tourismus.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Ort / Region</label>
          <AddressSearch placeholder="z. B. Federsee, Bad Buchau" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Umkreis:</span>
            <OptionPills options={[{ value: 15, label: "15 km" }, { value: 25, label: "25 km" }]} value={radius} onChange={setRadius} ariaLabel="Umkreis" />
          </div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Beobachtungsorte finden"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Beobachtungsorte werden gesucht … (5–25 Sekunden)" />}
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
            items={shown.map((s) => ({
              id: s.id,
              name: `${TYPE_META[s.type]?.emoji ?? "🔭"} ${s.name}`,
              sub: s.type,
              right: `${s.distance_km} km`,
            }))}
            emptyText="Keine Beobachtungsorte in dieser Auswahl."
          />
        </section>
      )}
    </main>
  );
}
