"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { GeocodeHit, NaturwunderResult, RichPoi } from "@/lib/types";

const TYPE_META: Record<string, { emoji: string; color: string }> = {
  Wasserfall: { emoji: "💧", color: "#0ea5e9" },
  Stromschnellen: { emoji: "🌊", color: "#0284c7" },
  Höhle: { emoji: "🕳️", color: "#78716c" },
  "Schlucht/Klamm": { emoji: "🏞️", color: "#0d9488" },
  Vulkan: { emoji: "🌋", color: "#b91c1c" },
  Krater: { emoji: "🌋", color: "#dc2626" },
  Gletscher: { emoji: "🧊", color: "#38bdf8" },
  Düne: { emoji: "🏜️", color: "#d97706" },
  Thermalquelle: { emoji: "♨️", color: "#e11d48" },
  Findling: { emoji: "🪨", color: "#57534e" },
  Fossilienfundstelle: { emoji: "🦕", color: "#92400e" },
  Quelle: { emoji: "💦", color: "#06b6d4" },
  Felsentor: { emoji: "🪨", color: "#a16207" },
  Doline: { emoji: "⭕", color: "#57534e" },
  Felswand: { emoji: "🧗", color: "#b45309" },
  Felsformation: { emoji: "🪨", color: "#a16207" },
  "Naturdenkmal-Baum": { emoji: "🌳", color: "#16a34a" },
  Naturdenkmal: { emoji: "⭐", color: "#ca8a04" },
  Naturwunder: { emoji: "✨", color: "#64748b" },
};

const METHOD: MethodContent = {
  intro:
    "Naturwunder sind in OpenStreetMap über viele einzelne Tags verstreut. Wir sammeln 18 Typen gebündelt auf einer Karte — von Wasserfällen über Vulkane und Klammen bis zu Fossilienfundstellen — und reichern die bekanntesten mit Wikipedia-Wissen, Fotos und KI-Einordnung an.",
  sources: [
    "OpenStreetMap (Overpass API) — 18 Naturwunder-Typen im Umkreis von 20 km: Wasserfälle, Stromschnellen, Höhlen, Schluchten/Klammen, Vulkane & Krater, Gletscher, Dünen, Thermalquellen, Findlinge, Fossilienfundstellen, Felsentore, Dolinen, Felswände, amtliche Naturdenkmäler u. a.",
    "Wikipedia (REST-API) — Kurzbeschreibung, freies Foto und Quell-Link, sofern verknüpft",
    "FOSSGIS-Valhalla — fußläufige Route vom Suchort zum Spot",
  ],
  steps: [
    "Wir suchen alle Natur-Highlights im Umkreis — seltene „Wow“-Typen in einer eigenen Abfrage, damit sie nicht von häufigen Felsen/Quellen verdrängt werden.",
    "Benannte und über Wikipedia/Wikidata belegte Wunder ranken wir nach oben.",
    "Für Abwechslung mischen wir die Typen (Round-Robin) — statt 30 Wasserfällen siehst du die Bandbreite der Region.",
    "Die Top-Spots bekommen Wikipedia-Text + Foto + KI-Satz; dazu Fallhöhe/Höhenlage, wo OSM sie kennt.",
  ],
  scoring: [
    "Häufige Typen (Quellen, Felsen, Felswände) zählen nur mit Namen — unbenannte Massenware fliegt raus.",
    "Die KI-Einordnung basiert ausschließlich auf den echten Wikipedia-/OSM-Fakten — ohne Fakten bleibt sie leer.",
    "Fotos nur aus offenen Quellen (Wikipedia/Wikimedia Commons); Quelle verlinkt.",
  ],
  limits: [
    "Nicht jede Region hat Vulkane oder Gletscher — angezeigt wird, was die Region wirklich hergibt.",
    "Unbenannte oder nicht verknüpfte Naturphänomene erscheinen ohne Text/Foto — sie sind trotzdem real.",
    "Die Datendichte schwankt je Region; in gut gepflegten Gebieten ist das Ergebnis reicher.",
  ],
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
  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.wonders
      .filter((w) => active.length === 0 || active.includes(w.type))
      .map((w) => ({
        id: w.id,
        name: w.name,
        lat: w.lat,
        lng: w.lng,
        emoji: TYPE_META[w.type]?.emoji ?? "✨",
        color: TYPE_META[w.type]?.color ?? "#64748b",
        category_label: [
          w.type,
          w.height ? `↕ ${w.height} m` : null,
          w.ele ? `⛰ ${w.ele} m ü. M.` : null,
        ].filter(Boolean).join(" · "),
        distance_km: w.distance_km,
        description: w.description,
        ai_why: w.ai_why,
        image: w.image,
        wiki_url: w.wiki_url,
        open_now: w.open_now,
        website: w.website,
        phone: w.phone,
        wheelchair: w.wheelchair,
        badges: w.designation ? [w.designation] : undefined,
      }));
  }, [result, active]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Naturwunder-Finder</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Die Naturwunder deiner Region</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Wasserfälle, Höhlen, Klammen, Vulkane, Gletscher, Thermalquellen, Findlinge,
          Fossilienfundstellen und mehr — 18 Naturwunder-Typen aus OpenStreetMap,
          gesammelt auf einer Karte, mit Wikipedia-Wissen, Fotos und Route.
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

      {status === "running" && <RunningBox text="Naturwunder werden gesucht & mit Wikipedia angereichert … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Naturwunder-Finder für unsere Region"
          routeMode="foot"
        >
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
