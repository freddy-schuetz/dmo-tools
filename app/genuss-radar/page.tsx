"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { GenussResult, GeocodeHit, RichPoi } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = {
  Weingut: "#9333ea", Brauerei: "#d97706", Brennerei: "#b45309", Käserei: "#eab308",
  Hofladen: "#16a34a", Metzgerei: "#dc2626", Konditorei: "#db2777", Hofgemüse: "#65a30d",
  Wochenmarkt: "#0ea5e9", Erzeuger: "#64748b",
};

const METHOD: MethodContent = {
  intro:
    "Der Genuss-Radar bündelt die authentischen, regionalen Erzeuger rund um deinen Ort — mit aktuellem „geöffnet\"-Status, Öffnungszeiten und Website, damit Gäste direkt losfahren können.",
  sources: [
    "OpenStreetMap (Overpass API) — Hofläden, Weingüter, Brauereien, Brennereien, Käsereien, Metzgereien, Wochenmärkte (15 km)",
    "OSM-Tags — Öffnungszeiten, Website, Telefon, Barrierefreiheit · Wikipedia — Foto/Text bei bekannten Betrieben",
    "FOSSGIS-Valhalla — Route zum Erzeuger",
  ],
  steps: [
    "Wir suchen alle Erzeuger-Typen im Umkreis aus OpenStreetMap.",
    "Aus den OSM-Öffnungszeiten berechnen wir, ob gerade geöffnet ist.",
    "Die nächstgelegenen Betriebe reichern wir mit Website/Telefon und — wo vorhanden — Wikipedia-Foto an.",
    "Route zum Betrieb auf Wunsch direkt auf der Karte.",
  ],
  limits: [
    "„geöffnet jetzt\" beruht auf den in OSM hinterlegten Öffnungszeiten — Feiertage/Sonderöffnungen sind selten erfasst.",
    "Sehr kleine Hofläden ohne OSM-Eintrag fehlen; ein leeres Ergebnis heißt nicht, dass es keine Erzeuger gibt.",
  ],
};

export default function GenussRadar() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<GenussResult>(token);
  const [active, setActive] = useState<string[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    setActive([]);
    try {
      const res = await fetch("/api/genuss-radar/start", {
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

  const types = useMemo(() => Array.from(new Set(result?.producers.map((p) => p.type) ?? [])), [result]);
  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.producers
      .filter((p) => active.length === 0 || active.includes(p.type))
      .map((p) => ({
        id: p.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        color: TYPE_COLOR[p.type] ?? "#64748b",
        category_label: p.type,
        distance_km: p.distance_km,
        description: p.description,
        image: p.image,
        wiki_url: p.wiki_url,
        open_now: p.open_now,
        website: p.website,
        phone: p.phone,
        wheelchair: p.wheelchair,
      }));
  }, [result, active]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Genuss-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Regionale Erzeuger &amp; Spezialitäten</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Hofläden, Weingüter, Brauereien, Käsereien, Wochenmärkte — die authentischen, regionalen
          Genuss-Adressen rund um deinen Ort, mit „geöffnet jetzt" und Route.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Ort / Region</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Bernkastel-Kues" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Erzeuger finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Regionale Erzeuger werden gesucht … (5–20 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Genuss-Radar für unsere Region"
          routeMode="car"
        >
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = active.length === 0 || active.includes(t);
              return (
                <button key={t} type="button"
                  onClick={() => setActive((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${on ? "text-white" : "bg-white text-slate-500 ring-slate-300"}`}
                  style={on ? { backgroundColor: TYPE_COLOR[t] ?? "#64748b", borderColor: TYPE_COLOR[t] ?? "#64748b" } : {}}>
                  {t}
                </button>
              );
            })}
          </div>
        </RichResults>
      )}
    </main>
  );
}
