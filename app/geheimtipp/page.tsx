"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OptionPills from "@/components/OptionPills";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { Feature, GeheimtippResult, GeocodeHit, RichPoi } from "@/lib/types";

const CATS = [
  { value: "aussicht", label: "Aussicht" },
  { value: "sehenswuerdigkeit", label: "Sehenswürdigkeiten" },
  { value: "badestelle", label: "Badestellen" },
  { value: "natur", label: "Natur" },
  { value: "gastro", label: "Gastronomie" },
];

const METHOD: MethodContent = {
  intro:
    "Der Geheimtipp-Radar lenkt Gäste bewusst weg von überlaufenen Hotspots hin zu gleichwertigen, aber unbekannten Alternativen — ein Werkzeug gegen Overtourism.",
  sources: [
    "OpenStreetMap (Overpass API) — alle Orte der gewählten Kategorie im Umkreis von 25 km",
    "Wikipedia-Pageviews (Wikimedia-API) — ECHTE monatliche Aufrufzahlen je Hotspot: Overtourism messbar gemacht",
    "Wikimedia Commons (Geosearch) — freie Fotos aus < 150 m Umkreis für Geheimtipps ohne eigenen Wikipedia-Artikel",
    "OSM-Tags — Öffnungszeiten/Website · FOSSGIS-Valhalla — Route",
  ],
  steps: [
    "Wir laden alle Orte der Kategorie und bestimmen die „Hotspots\" (Wikipedia/Wikidata-Prominenz) — samt ihrer echten Wikipedia-Aufrufe des letzten Monats.",
    "Geheimtipps = Orte OHNE Prominenz-Signale, möglichst weit von den Hotspots — mit Qualitätsfilter: Kleinst-Denkmäler, Wegkreuze & Co. fliegen raus, Substanz-Signale (Öffnungszeiten, Website, Höhe …) zählen.",
    "Für Gems ohne Wikipedia-Foto suchen wir freie Commons-Fotos aus der unmittelbaren Umgebung.",
    "Die Smart-Kombi schlägt vor: früh zum bekanntesten Hotspot (vor den Bussen), danach zum passenden Geheimtipp.",
  ],
  scoring: [
    "Hotspot = hohe Prominenz (wikidata, wikipedia, Foto, Website) — die Aufrufzahlen machen den Unterschied sichtbar (z. B. 22.000/Monat vs. ~0).",
    "Geheimtipp-Score 0–100 = relative Entfernung zum nächsten Hotspot (bis 15 km).",
  ],
  limits: [
    "Bewusst KEINE KI-Beschreibung: Geheimtipps haben per Definition keine Wikipedia-Fakten, die man zitieren könnte — wir würden sonst raten.",
    "Commons-Umgebungsfotos zeigen die unmittelbare Umgebung — nicht garantiert exakt das Objekt (als Hinweis markiert).",
    "„Unbekannt in OSM\" heißt nicht automatisch „unentdeckt\" — lokal kann ein Ort durchaus bekannt sein.",
  ],
};

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

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.hidden_gems.map((g) => ({
      id: g.id,
      name: g.name,
      lat: g.lat,
      lng: g.lng,
      emoji: "💎",
      color: "#16a34a",
      category_label: `Geheimtipp · Score ${g.gem_score}/100`,
      meta_right: `${g.distance_from_hotspot_km} km abseits`,
      ai_why: g.why,
      description: g.description,
      image: g.image,
      wiki_url: g.wiki_url,
      open_now: g.open_now,
      opening_hours: g.opening_hours,
      website: g.website,
      phone: g.phone,
      wheelchair: g.wheelchair,
      cuisine: g.cuisine,
      notes: g.photo_note ? ["📷 Foto aus unmittelbarer Umgebung (Commons)"] : undefined,
    }));
  }, [result]);

  const hotspotFeatures = useMemo<Feature[]>(() => {
    if (!result) return [];
    return result.hotspots.map((h) => ({
      type: "Feature" as const,
      properties: { name: `⭐ ${h.name}`, sub: "bekannter Hotspot", color: "#dc2626" },
      geometry: { type: "Point" as const, coordinates: [h.lng, h.lat] },
    }));
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
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Geheimtipp-Radar für unsere Region"
          routeMode="car"
          extraFeatures={hotspotFeatures}
        >
          {result.hotspots.length > 0 && (
            <div className="rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
              <p className="mb-2 text-sm font-semibold text-red-800">🔴 Die Hotspots — mit echten Besucherzahlen (Wikipedia-Aufrufe/Monat)</p>
              <div className="flex flex-wrap gap-1.5">
                {result.hotspots.map((h) => (
                  <span key={h.name} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
                    ⭐ {h.name}
                    {h.views_month != null && <span className="text-red-400"> · {h.views_month.toLocaleString("de-DE")} Aufrufe/Monat</span>}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-red-500">
                💎 Deine Geheimtipps unten: ~0 Wikipedia-Aufrufe — genau darum sind sie ruhig.
              </p>
            </div>
          )}
          {result.combo && (
            <div className="rounded-2xl bg-teal-50 p-4 ring-1 ring-teal-200">
              <p className="mb-1 text-sm font-semibold text-teal-800">🕗 Smart-Kombi für den Tag</p>
              <p className="text-sm text-teal-900">{result.combo.tipp}</p>
            </div>
          )}
        </RichResults>
      )}
    </main>
  );
}
