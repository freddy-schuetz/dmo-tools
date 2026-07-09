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
  Beobachtungsturm: { emoji: "🗼", color: "#b45309" },
  Besucherzentrum: { emoji: "ℹ️", color: "#7c3aed" },
  Schutzgebiet: { emoji: "🌿", color: "#16a34a" },
  "Feuchtgebiet/Moor": { emoji: "🦆", color: "#0891b2" },
  Naturbeobachtung: { emoji: "🔭", color: "#64748b" },
};

const METHOD: MethodContent = {
  intro:
    "Der Radar zeigt, WO man in der Region Natur und Tiere beobachten kann — und, dank echter GBIF-Sichtungsdaten, WELCHE Arten dort tatsächlich schon dokumentiert wurden. Wichtig: Er lenkt bewusst zu den Orten, die dafür GEMACHT sind.",
  sources: [
    "OpenStreetMap (Overpass API) — Beobachtungshütten & -türme, Natur-Besucherzentren, Schutzgebiete (als Flächen), Feuchtgebiete/Moore",
    "GBIF (Global Biodiversity Information Facility) — dokumentierte Tier-Sichtungen (Region + Top-Spots)",
    "Wikipedia — Artenfotos, Beschreibung/Foto der Gebiete · KI — Einordnung · Valhalla — Route",
  ],
  steps: [
    "Wir suchen alle Beobachtungsorte im Umkreis — Hütten, Türme und Besucherzentren zuerst, denn die sind für Gäste eingerichtet.",
    "Schutzgebiete zeigen wir als grüne Flächen auf der Karte (nicht nur als Punkt) — mit Verhaltens-Hinweis je Gebiet.",
    "Über GBIF fragen wir ab, welche Tierarten in der Region (und an den Top-Spots) dokumentiert wurden — mit Wikipedia-Foto je Art.",
    "Die Top-Spots reichern wir mit Wikipedia-Text/Foto an; eine KI ordnet faktenbasiert ein, warum sich der Ort eignet.",
  ],
  scoring: [
    "„Dokumentierte Arten\" sind reale, von Menschen gemeldete GBIF-Beobachtungen — eine Sichtung ist damit möglich, aber nie garantiert.",
    "Beobachtungshütten, -türme und Besucherzentren stehen oben — sie sind die touristischen Einstiegspunkte.",
    "Schutzgebiete tragen einen Hinweis: Wege nicht verlassen, Brut- & Ruhezeiten beachten; streng geschützte Gebiete/Kernzonen sind markiert (Betreten meist untersagt).",
  ],
  limits: [
    "GBIF-Daten sind meldungsabhängig: gut besuchte Gebiete wirken artenreicher, weil dort mehr gemeldet wird.",
    "Die Zugangsregeln je Gebiet sind aus OSM-Tags abgeleitet — verbindlich ist immer die Beschilderung vor Ort bzw. die Schutzgebietsverordnung.",
    "Deutsche Artnamen fehlen manchmal — dann zeigen wir den wissenschaftlichen Namen.",
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
        badges: s.for_visitors ? ["für Besucher eingerichtet"] : undefined,
        notes: s.access_note ? [`🚷 ${s.access_note}`] : undefined,
      }));
  }, [result, active]);

  // Schutzgebiete als grüne Flächen auf der Karte
  const zones = useMemo(() => {
    if (!result?.areas?.features?.length) return [];
    return [{ id: "reserves", data: result.areas, color: "#16a34a", fillOpacity: 0.14 }];
  }, [result]);

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
          zones={zones}
        >
          {result.region_species && result.region_species.length > 0 && (
            <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
              <h2 className="mb-3 font-bold text-emerald-800">🐾 Diese Arten sind hier dokumentiert (GBIF)</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {result.region_species.map((s) => (
                  <a
                    key={s.name_de}
                    href={s.wiki_url ?? undefined}
                    target={s.wiki_url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-emerald-100 ${s.wiki_url ? "transition hover:ring-emerald-300" : "pointer-events-none"}`}
                  >
                    {s.image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={s.image} alt={s.name_de} loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-emerald-100 text-lg" aria-hidden>🐾</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-emerald-800">{s.name_de}</p>
                      <p className="text-[10px] text-emerald-500">{s.count.toLocaleString("de-DE")} Sichtungen</p>
                    </div>
                  </a>
                ))}
              </div>
              <p className="mt-2 text-xs text-emerald-600">
                Anzahl = gemeldete Beobachtungen · Fotos: Wikipedia · Sichtung möglich, nie garantiert.
              </p>
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
          {zones.length > 0 && (
            <p className="-mb-3 text-center text-xs text-slate-400">
              🟩 Grüne Flächen auf der Karte = Schutzgebiete (Wege nicht verlassen) · Punkte = Beobachtungsorte, anklickbar
            </p>
          )}
        </RichResults>
      )}
    </main>
  );
}
