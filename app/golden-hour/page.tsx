"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import RichResults from "@/components/RichResults";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { GeocodeHit, GoldenHourResult, RichPoi } from "@/lib/types";

const METHOD: MethodContent = {
  intro:
    "Der Finder verbindet Aussichtspunkte aus OpenStreetMap mit dem heutigen Sonnenstand — und hebt Spots hervor, deren Blickrichtung zum Sonnenuntergang passt. Die bekanntesten reichern wir mit Wikipedia-Wissen und Foto an.",
  sources: [
    "OpenStreetMap (Overpass API) — Aussichtspunkte, Gipfel und Aussichtstürme im Umkreis von 15 km",
    "Sonnenstand — im Browser bzw. Workflow berechnet (SunCalc-Verfahren, kein externer Dienst)",
    "Open-Meteo — aktuelle Bewölkung · Wikipedia — Kurztext + freies Foto · Valhalla — Route",
  ],
  steps: [
    "Wir berechnen Sonnenuntergang, Sonnenaufgang und den Sonnenuntergangs-Azimut für heute.",
    "Aus OpenStreetMap holen wir Aussichtspunkte und prüfen, ob ihre erfasste Blickrichtung zum Sonnenuntergang passt.",
    "Passende Spots ranken wir nach oben und reichern die Top-Spots mit Wikipedia-Text + Foto + KI-Einordnung an.",
    "Route zum Spot auf Wunsch direkt auf der Karte.",
  ],
  scoring: [
    "„Blick Richtung Sonnenuntergang\" = die in OSM erfasste Blickrichtung liegt innerhalb von 70° zum heutigen Sonnenuntergangs-Azimut.",
    "Die KI-Einordnung nutzt nur echte Wikipedia-/OSM-Fakten des Spots — ohne Fakten bleibt sie leer.",
  ],
  limits: [
    "Nur wenige Aussichtspunkte tragen in OSM eine Blickrichtung — ohne diese Angabe kann die Sonnenuntergangs-Eignung nicht bestätigt werden.",
    "Die Bewölkung ist eine Momentaufnahme; das Wetter kann sich bis zur goldenen Stunde ändern.",
  ],
};

export default function GoldenHour() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<GoldenHourResult>(token);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst einen Ort auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/golden-hour/start", {
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

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    return result.spots.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      emoji: s.faces_sunset ? "🌅" : "📷",
      color: s.faces_sunset ? "#f59e0b" : "#0ea5e9",
      category_label: `${s.cat}${s.elevation ? ` · ${s.elevation} m` : ""}`,
      distance_km: s.distance_km,
      description: s.description,
      ai_why: s.ai_why,
      image: s.image,
      wiki_url: s.wiki_url,
      website: s.website,
      wheelchair: s.wheelchair,
      badges: s.faces_sunset ? ["Blick Richtung Sonnenuntergang"] : undefined,
    }));
  }, [result]);

  const cloudLabel = (c: number | null) =>
    c == null ? "" : c < 30 ? "meist klar ☀️" : c < 70 ? "teils bewölkt ⛅" : "stark bewölkt ☁️";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Golden-Hour-Fotospots</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Der beste Sonnenuntergang heute</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Aussichtspunkte, Gipfel und Türme rund um deinen Ort — mit heutiger Sonnenuntergangszeit.
          Spots mit passender Blickrichtung sind hervorgehoben.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <label className="mb-1 block text-sm font-medium">Ort / Region</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1"><AddressSearch placeholder="z. B. Füssen" onSelect={setHit} /></div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Fotospots finden"}
          </button>
        </div>
        {startError && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Aussichtspunkte und Sonnenstand werden berechnet … (10–30 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Golden-Hour-Fotospots für unsere Region"
          routeMode="foot"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-amber-50 p-5 text-center ring-1 ring-amber-200">
              <p className="text-3xl font-bold text-amber-600">🌅 {result.sunset_time ?? "—"}</p>
              <p className="text-sm text-amber-800">Sonnenuntergang heute</p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-3xl font-bold text-brand">🌄 {result.sunrise_time ?? "—"}</p>
              <p className="text-sm text-slate-500">Sonnenaufgang</p>
            </div>
            <div className="rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-slate-200">
              <p className="text-lg font-bold text-brand">{cloudLabel(result.cloud_cover_pct) || "—"}</p>
              <p className="text-sm text-slate-500">Sicht heute{result.cloud_cover_pct != null ? ` (${result.cloud_cover_pct}% Wolken)` : ""}</p>
            </div>
          </div>
        </RichResults>
      )}
    </main>
  );
}
