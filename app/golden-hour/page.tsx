"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import OptionPills from "@/components/OptionPills";
import RichResults from "@/components/RichResults";
import AuditScore from "@/components/AuditScore";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import type { MethodContent } from "@/components/MethodBox";
import { usePolling } from "@/lib/usePolling";
import type { GeocodeHit, GoldenHourResult, RichPoi } from "@/lib/types";

const MODES = [
  { value: "sunset", label: "🌇 Sonnenuntergang" },
  { value: "sunrise", label: "🌄 Sonnenaufgang" },
];

const METHOD: MethodContent = {
  intro:
    "Der Finder beantwortet die Fotografen-Frage komplett: WO stehen die richtigen Spots (Blickrichtung/Rundumblick), WANN ist goldene und blaue Stunde — und WIE GUT wird der Himmel voraussichtlich (Glow-Prognose aus Wolken-Stockwerken).",
  sources: [
    "OpenStreetMap (Overpass API) — Aussichtspunkte (mit Blickrichtung), Gipfel und Aussichtstürme (15 km) + Gewässer für den Spiegelungs-Check",
    "Sonnen- & Mondstand — im Workflow berechnet (SunCalc-Verfahren, kein externer Dienst)",
    "Open-Meteo — tiefe/mittlere/hohe Bewölkung stündlich, 7 Tage · Wikipedia — Foto/Text · KI — Einordnung · Valhalla — Route",
  ],
  steps: [
    "Wir berechnen goldene Stunde, blaue Stunde und den Azimut des Ereignisses (Sonnenuntergang oder -aufgang, umschaltbar).",
    "Spots werden geprüft: passt die erfasste Blickrichtung (inkl. Mehrfach-Richtungen und Bögen)? Gipfel und Türme zählen immer — 360°-Rundumblick.",
    "Glow-Prognose: hohe/mittlere Wolken um 30–70 % = Farbspiel, tiefe Wolken = grau. Daraus ein Score je Abend/Morgen — heute + 6 Folgetage.",
    "Spiegelungs-Check: liegt Wasser in Ereignis-Richtung (± 35°, ≤ 2,5 km), ist ein Spiegelungs-Foto möglich. Dazu je Spot eine Abfahrts-Empfehlung.",
  ],
  scoring: [
    "Glow-Score (Heuristik, transparent): Leinwand = hohe + 0,8 × mittlere Wolken, ideal ~45 % Deckung; tiefe Wolken ziehen stark ab; wolkenlos ≈ 35 (klar, aber selten spektakulär).",
    "Spot-Ranking: erfasste Blickrichtung zum Ereignis > 360°-Rundumblick > Wikipedia-Bekanntheit > Distanz.",
    "Abfahrts-Zeit = Ankunft zur ersten Foto-Phase, gerechnet mit ~40 km/h + 15 Min Puffer.",
  ],
  limits: [
    "Kein Geländehorizont: ob ein Berg die tiefstehende Sonne verdeckt, prüfen wir nicht (bräuchte ein Höhenmodell).",
    "Die Glow-Prognose ist eine Wetter-Heuristik — kein Versprechen; je näher der Termin, desto verlässlicher.",
    "Blickrichtungen stammen aus OSM-Tags und sind nur bei einem Teil der Aussichtspunkte erfasst.",
  ],
};

function scoreColorBg(s: number) {
  return s >= 70 ? "bg-green-100 text-green-800" : s >= 40 ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500";
}

// Abfahrts-Empfehlung: Ankunft zur ersten Foto-Phase, ~40 km/h + 15 Min Puffer
function leaveBy(arrive: string | null | undefined, distKm: number | null | undefined): string | null {
  if (!arrive || distKm == null) return null;
  const [h, m] = arrive.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const total = h * 60 + m - (Math.round((distKm / 40) * 60) + 15);
  if (total <= 0) return null;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function GoldenHour() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [mode, setMode] = useState("sunset");
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
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  const evLabel = result?.mode === "sunrise" ? "Sonnenaufgang" : "Sonnenuntergang";

  const pois = useMemo<RichPoi[]>(() => {
    if (!result) return [];
    const arrive = result.sun?.arrive_by;
    return result.spots.map((s) => {
      const lb = leaveBy(arrive, s.distance_km);
      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        emoji: s.dir_match ? (result.mode === "sunrise" ? "🌄" : "🌇") : s.panorama ? "🔭" : "📷",
        color: s.dir_match ? "#f59e0b" : s.panorama ? "#fb923c" : "#0ea5e9",
        category_label: `${s.cat}${s.elevation ? ` · ${s.elevation} m` : ""}`,
        distance_km: s.distance_km,
        description: s.description,
        ai_why: s.ai_why,
        image: s.image,
        wiki_url: s.wiki_url,
        website: s.website,
        wheelchair: s.wheelchair,
        badges: [
          ...(s.dir_match ? [`${result.mode === "sunrise" ? "🌄" : "🌇"} Blick zum ${evLabel}`] : []),
          ...(!s.dir_match && s.panorama ? ["🔄 360°-Rundumblick"] : []),
          ...(s.water_reflection ? ["🌊 Spiegelung möglich"] : []),
          ...(lb ? [`🚗 los bis ~${lb}`] : []),
        ],
      };
    });
  }, [result, evLabel]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Golden-Hour-Fotospots</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Wo lohnt sich heute das Foto wirklich?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Die besten Spots für Sonnenuntergang oder -aufgang — mit goldener &amp; blauer Stunde,
          einer <strong>Glow-Prognose</strong> aus den Wolken-Stockwerken, Spiegelungs-Check
          und der Empfehlung, wann du losfahren solltest.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Ort / Region</label>
          <AddressSearch placeholder="z. B. Füssen" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <OptionPills options={MODES} value={mode} onChange={setMode} ariaLabel="Ereignis" />
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Suche …" : "Fotospots finden"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Sonnenstand, Wolken-Prognose und Fotospots werden berechnet … (15–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <RichResults
          center={result.center}
          pois={pois}
          method={METHOD}
          mailSubject="Golden-Hour-Fotospots für unsere Region"
          routeMode="car"
        >
          {result.glow && (
            <AuditScore
              score={result.glow.today.score}
              title={`Glow-Prognose · ${evLabel} heute ${result.sun?.event_time ?? ""}`}
              subtitle={`Wolken zur ${evLabel}-Zeit: tief ${result.glow.today.low} % · mittel ${result.glow.today.mid} % · hoch ${result.glow.today.high} %`}
              labels={{ good: "Spektakel möglich", mid: "Solide Chance", bad: "Eher unspektakulär" }}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {(result.sun?.phases ?? []).map((p) => (
              <div key={p.label} className={`rounded-2xl p-4 text-center ring-1 ${p.label === "Goldene Stunde" ? "bg-amber-50 ring-amber-200" : "bg-indigo-50 ring-indigo-200"}`}>
                <p className={`text-xl font-bold ${p.label === "Goldene Stunde" ? "text-amber-600" : "text-indigo-600"}`}>
                  {p.from ?? "—"} – {p.to ?? "—"}
                </p>
                <p className={`text-sm ${p.label === "Goldene Stunde" ? "text-amber-800" : "text-indigo-800"}`}>{p.label}</p>
              </div>
            ))}
            {result.moon && (
              <div className="rounded-2xl bg-slate-50 p-4 text-center ring-1 ring-slate-200">
                <p className="text-xl font-bold text-slate-700">
                  {result.moon.pct >= 95 ? "🌕" : result.moon.pct >= 45 ? "🌗" : result.moon.pct >= 5 ? "🌒" : "🌑"} {result.moon.pct} %
                </p>
                <p className="text-sm text-slate-500">{result.moon.label}</p>
                {result.moon.full_hint && result.mode !== "sunrise" && (
                  <p className="mt-1 text-xs text-slate-500">geht ≈ zum Sonnenuntergang im Osten auf — Fotomotiv!</p>
                )}
              </div>
            )}
          </div>

          {result.glow && result.glow.week.length > 1 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <p className="mb-2 text-sm font-semibold text-brand">Beste {result.mode === "sunrise" ? "Morgen" : "Abende"} der Woche (Glow-Prognose)</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {result.glow.week.map((w, i) => (
                  <div key={w.date} className={`flex min-w-[68px] flex-col items-center rounded-xl px-2 py-2 ${scoreColorBg(w.score)} ${i === 0 ? "ring-2 ring-brand-accent" : ""}`}>
                    <span className="text-xs font-medium">{i === 0 ? "Heute" : w.day}</span>
                    <span className="text-lg font-bold">{w.score}</span>
                    <span className="text-[10px] opacity-70">{w.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </RichResults>
      )}
    </main>
  );
}
