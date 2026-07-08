"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import OptionPills from "@/components/OptionPills";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { Feature, FeatureCollection, GeocodeHit, ThementourResult } from "@/lib/types";
import type { LineLayer } from "@/components/IsoMap";

const THEMES = [
  { value: "kultur", label: "🏛️ Kultur" },
  { value: "genuss", label: "🍺 Genuss" },
  { value: "natur", label: "🌲 Natur" },
  { value: "familie", label: "🎡 Familie" },
];
const LENGTHS = [
  { value: "kurz", label: "kurz" },
  { value: "mittel", label: "mittel" },
  { value: "lang", label: "lang" },
];

export default function Thementour() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [theme, setTheme] = useState("kultur");
  const [length, setLength] = useState("mittel");
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<ThementourResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Startpunkt auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/thementour/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, theme, length }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  const lines = useMemo<LineLayer[]>(() => {
    if (!result?.route) return [];
    return [{ id: "tour", data: result.route.geometry as Feature, color: "#9333ea", width: 5 }];
  }, [result]);

  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.stops.map((s) => ({
        type: "Feature",
        properties: { cat: "stop", name: `${s.order}. ${s.name}`, color: "#9333ea" },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      })),
    };
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Thementouren-Generator</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Themen-Rundtour auf Knopfdruck</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Wähle Start, Thema und Länge — wir stellen automatisch eine Fußweg-Rundtour zusammen, die
          passende Orte verbindet. Fertiger Content für deine Gäste.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Startpunkt</label>
          <AddressSearch placeholder="z. B. Marktplatz Bamberg" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="mb-1 block text-sm font-medium">Thema</span>
            <OptionPills options={THEMES} value={theme} onChange={setTheme} ariaLabel="Thema" />
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium">Länge</span>
            <OptionPills options={LENGTHS} value={length} onChange={setLength} ariaLabel="Länge" />
          </div>
          <button type="submit" disabled={status === "running"}
            className="ml-auto rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Baue Tour …" : "Tour erstellen"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Passende Orte werden verbunden und geroutet … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-5">
          {result.route && (
            <p className="text-center text-sm text-slate-600">
              🚶 Rundweg <strong>{result.route.distance_km} km</strong> · ca. <strong>{result.route.duration_min} Min</strong> · {result.stops.length} Stopps
            </p>
          )}
          <IsoMapDynamic
            center={[result.start.lng, result.start.lat]}
            zones={[]}
            lines={lines}
            pois={pois}
            markers={[{ lat: result.start.lat, lng: result.start.lng, color: "#1e3a5f" }]}
            heightClass="h-[460px]"
          />
          <ol className="space-y-2">
            {result.stops.map((s) => (
              <li key={s.order} className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-slate-200">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{s.order}</span>
                <span className="text-sm font-medium">{s.name}</span>
                {s.has_wiki && <span className="ml-auto text-xs text-brand-accent">Wikipedia ✓</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
