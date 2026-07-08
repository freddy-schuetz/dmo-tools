"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OptionPills from "@/components/OptionPills";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { GeocodeHit, RichPoi, WildtierResult } from "@/lib/types";

const TYPE_META: Record<string, { emoji: string; color: string }> = {
  "Beobachtungshütte": { emoji: "🦅", color: "#d97706" },
  Schutzgebiet: { emoji: "🌿", color: "#16a34a" },
  "Feuchtgebiet/Moor": { emoji: "🦆", color: "#0891b2" },
  Naturbeobachtung: { emoji: "🔭", color: "#64748b" },
};

const METHOD: MethodContent = {
  intro:
    "Der Radar zeigt, WO man in der Region Natur und Tiere beobachten kann — und, dank echter GBIF-Sichtungsdaten, WELCHE Arten dort tatsächlich schon dokumentiert wurden.",
  sources: [
    "OpenStreetMap (Overpass API) — Beobachtungshütten, Naturschutzgebiete, Feuchtgebiete/Moore im Umkreis",
    "GBIF (Global Biodiversity Information Facility) — dokumentierte Tier-Sichtungen (Region + Top-Spots)",
    "Wikipedia — Beschreibung/Foto der Gebiete · KI — Einordnung · Valhalla — Route",
  ],
  steps: [
    "Wir suchen alle Beobachtungsorte im Umkreis aus OpenStreetMap.",
    "Über GBIF fragen wir ab, welche Tierarten in der Region (und an den Top-Spots) bereits dokumentiert wurden.",
    "Die Top-Spots reichern wir mit Wikipedia-Text/Foto an; eine KI ordnet faktenbasiert ein, warum sich der Ort eignet.",
    "Route zum Beobachtungsort auf Wunsch direkt auf der Karte.",
  ],
  scoring: [
    "„Dokumentierte Arten\" sind reale, von Menschen gemeldete GBIF-Beobachtungen — eine Sichtung ist damit möglich, aber nie garantiert.",
    "Beobachtungshütten stehen oben, da sie am zuverlässigsten Tierbeobachtung ermöglichen.",
  ],
  limits: [
    "GBIF-Daten sind meldungsabhängig: gut besuchte Gebiete wirken artenreicher, weil dort mehr gemeldet wird.",
    "Deutsche Artnamen fehlen manchmal — dann zeigen wir den wissenschaftlichen Namen.",
    "Wildtiere sind wild: bitte Schutzgebiete und Ruhezonen respektieren.",
  ],
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
  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.spots
      .filter((s) => active.length === 0 || active.includes(s.type))
      .map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        emoji: TYPE_META[s.type]?.emoji ?? "🔭",
        color: TYPE_META[s.type]?.color ?? "#64748b",
        category_label: s.type,
        distance_km: s.distance_km,
        description: s.description,
        ai_why: s.ai_why,
        image: s.image,
        wiki_url: s.wiki_url,
        website: s.website,
        wheelchair: s.wheelchair,
        species: s.species,
        badges: s.protected ? ["Schutzgebiet"] : undefined,
      }));
  }, [result, active]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Wildtier-Beobachtung</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Natur &amp; Tiere beobachten</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Beobachtungshütten, Naturschutzgebiete und Feuchtgebiete — plus echte Sichtungsdaten (GBIF):
          welche Arten hier tatsächlich dokumentiert sind.
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

      {status === "running" && <RunningBox text="Beobachtungsorte + GBIF-Sichtungen werden geladen … (15–45 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Wildtier-Beobachtungs-Radar für unsere Region"
          routeMode="foot"
        >
          {result.region_species && result.region_species.length > 0 && (
            <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
              <h2 className="mb-2 font-bold text-emerald-800">🐾 In dieser Region dokumentiert (GBIF)</h2>
              <div className="flex flex-wrap gap-1.5">
                {result.region_species.map((s) => (
                  <span key={s.name_de} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                    {s.name_de} <span className="text-emerald-400">· {s.count}</span>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-emerald-600">Anzahl = gemeldete Beobachtungen. Sichtung möglich, nie garantiert.</p>
            </div>
          )}
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
        </RichResults>
      )}
    </main>
  );
}
