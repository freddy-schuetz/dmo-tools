"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OptionPills from "@/components/OptionPills";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { EautoAusflugResult, GeocodeHit, RichPoi } from "@/lib/types";

const METHOD: MethodContent = {
  intro:
    "Der Check nimmt E-Auto-Gästen die Reichweiten-Angst: Er zeigt nur Ausflugsziele, die mit einer Ladung reichweiten-sicher hin und zurück erreichbar sind UND vor Ort eine Ladesäule haben.",
  sources: [
    "OpenStreetMap (Overpass API) — Ausflugsziele (Attraktionen, Museen, Burgen, Gipfel …) + Ladestationen",
    "FOSSGIS-Valhalla (Matrix) — reale Auto-Fahrzeit und -distanz vom Standort zu jedem Ziel",
    "Wikipedia — Foto/Text der Ziele · OSM-Tags — Öffnungszeiten/Website",
  ],
  steps: [
    "Wir suchen Ausflugsziele in fahrbarer Entfernung, die eine Ladesäule ≤ 2 km entfernt haben.",
    "Valhalla berechnet die echte Fahrstrecke; nur reichweiten-sichere Ziele (hin + zurück) bleiben übrig.",
    "Die Ziele reichern wir mit Wikipedia-Foto/Text und Öffnungszeiten an.",
    "Route zum Ziel auf Wunsch direkt auf der Karte (Auto).",
  ],
  scoring: [
    "„reichweiten-sicher\" = Hin- und Rückfahrt (2 × Fahrdistanz) liegen innerhalb der gewählten Reichweite.",
    "Nur Ziele mit Ladesäule in ≤ 2 km werden gezeigt — Laden vor Ort ist garantiert eingeplant.",
  ],
  limits: [
    "Reale Reichweite hängt von Fahrweise, Wetter und Fahrzeug ab — wir rechnen bewusst konservativ.",
    "Ladesäulen-Verfügbarkeit/-Leistung ist OSM-Stand; eine Säule kann belegt oder defekt sein.",
  ],
};

export default function EautoAusflug() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [range, setRange] = useState(150);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<EautoAusflugResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst deinen Standort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/eauto-ausflug/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, range_km: range }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.trips.map((t) => ({
      id: t.id ?? t.name + t.lat,
      name: t.name,
      lat: t.lat,
      lng: t.lng,
      emoji: "🚗",
      color: "#9333ea",
      category_label: `${t.distance_km} km Fahrt`,
      meta_right: `${t.drive_min} Min`,
      description: t.description,
      image: t.image,
      wiki_url: t.wiki_url,
      website: t.website,
      open_now: t.open_now,
      wheelchair: t.wheelchair,
      badges: [`⚡ Laden vor Ort${t.charger.max_kw ? ` · ${t.charger.max_kw} kW` : ""}`],
    }));
  }, [result]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">E-Auto-Tagesausflug</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Reichweiten-sichere Ausflüge mit Ladesäule</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Wir zeigen nur Ziele, die du mit einer Ladung hin und zurück schaffst <strong>und</strong> die
          eine Ladesäule vor Ort haben. Keine Reichweiten-Angst.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Dein Standort / Unterkunft</label>
          <AddressSearch placeholder="z. B. Köln" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Reichweite:</span>
            <OptionPills
              options={[{ value: 100, label: "100 km" }, { value: 150, label: "150 km" }, { value: 250, label: "250 km" }]}
              value={range}
              onChange={setRange}
              ariaLabel="Reichweite"
            />
          </div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Ausflüge finden"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Reichweiten-sichere Ziele werden berechnet & angereichert … (15–50 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="E-Auto-Tagesausflug-Check für unsere Region"
          routeMode="car"
        >
          <p className="text-sm text-slate-600">
            <strong>{result.trips.length}</strong> Ausflugsziele in Reichweite ({result.range_km} km) mit Lademöglichkeit vor Ort.
          </p>
        </RichResults>
      )}
    </main>
  );
}
