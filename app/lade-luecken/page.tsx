"use client";

import { useMemo, useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import AuditScore from "@/components/AuditScore";
import Card from "@/components/Card";
import MethodBox, { type MethodContent } from "@/components/MethodBox";
import AboutSection from "@/components/AboutSection";
import OptionPills from "@/components/OptionPills";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { FeatureCollection, GeocodeHit, LadeLueckenResult } from "@/lib/types";

const METHOD: MethodContent = {
  intro:
    "Der Radar beantwortet zwei Fragen: WO fehlt Ladeinfrastruktur (räumliche Abdeckung, Heat-Fläche) — und REICHEN die Ladepunkte mengenmäßig, heute und im E-Auto-Szenario (Kapazitäts-Check)?",
  sources: [
    "Bundesnetzagentur — amtliches Ladesäulenregister (Ladepunkte + Nennleistung kW je Standort; Stand wird im Ergebnis angezeigt). Fallback: OpenStreetMap",
    "OpenStreetMap — Einwohner (place-Nodes mit population-Tag) und Beherbergungsbetriebe für die Nachfrage-Schätzung",
    "KBA-Motorisierungsgrad — ~580 Pkw je 1.000 Einwohner (Bundesschnitt)",
    "EU-AFIR (Verordnung 2023/1804) — Benchmark ~1,3 kW öffentliche Ladeleistung je E-Auto",
  ],
  steps: [
    "Wir laden alle öffentlichen Ladestationen der Region aus dem BNetzA-Register (inkl. Ladepunkten und kW).",
    "Abdeckung: Die Region wird in 2–3-km-Zellen gerastert; je Zelle die Distanz zur nächsten Station → Heat-Fläche, Zellen > 5 km = Lade-Lücke.",
    "Kapazität: Wir summieren das Angebot (Ladepunkte, kW) und schätzen die Nachfrage — Einwohner × 0,58 Pkw plus Gäste-Pkw aus Unterkunfts-Betten (× 0,25).",
    "Szenario: Du wählst den E-Auto-Anteil (heute ≈ 5 % bis 50 %) — benötigte Ladeleistung = E-Pkw × 1,3 kW (AFIR) gegen die verfügbare Leistung.",
  ],
  scoring: [
    "Abdeckungs-Score = Anteil der Fläche innerhalb von 5 km zu einer Ladesäule (100 − Lücken-Anteil).",
    "Kapazitäts-Score = verfügbare kW ÷ benötigte kW im gewählten Szenario × 100 (100 = AFIR-Benchmark erfüllt, gedeckelt bei 100).",
  ],
  limits: [
    "Einwohner stammen aus OSM-population-Tags — Orte am Rand zählen ganz oder gar nicht; die Schätzung ist grob.",
    "Gäste-Pkw sind eine Heuristik aus OSM-Unterkünften (Betten × Auslastung) — Destatis-Übernachtungen haben keine frei abrufbare API je Gemeinde.",
    "Private und Hotel-Wallboxen fehlen im öffentlichen Register — für Destinationen eine echte Datenlücke.",
    "AFIR gilt als nationale Flottenvorgabe — wir nutzen sie hier als lokalen Vergleichsmaßstab.",
    "Abdeckung basiert auf Luftlinie; Auslastung/Defekte einzelner Säulen sind nicht erfasst.",
  ],
};

const SHARE_OPTIONS = [
  { value: 5, label: "Heute (≈5 %)" },
  { value: 15, label: "15 %" },
  { value: 30, label: "30 %" },
  { value: 50, label: "50 %" },
];

export default function LadeLuecken() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(15);
  const [eShare, setEShare] = useState(30);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<LadeLueckenResult>(token);

  // Kapazitäts-Szenario: Rohzahlen kommen vom Backend, das Umschalten rechnet live hier.
  const cap = result?.capacity;
  const scenario = useMemo(() => {
    if (!cap || cap.resident_cars + cap.tourist_cars <= 0) return null;
    const cars = cap.resident_cars + cap.tourist_cars;
    const bev = Math.round((cars * eShare) / 100);
    const neededKw = Math.round(bev * cap.afir_kw_per_bev);
    const ratio = neededKw > 0 ? cap.supply_kw / neededKw : Infinity;
    return { cars, bev, neededKw, ratio, score: Math.min(100, Math.round(ratio * 100)) };
  }, [cap, eShare]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst eine Region auswählen.");
    setStartError(null);
    setToken(null);
    try {
      const res = await fetch("/api/lade-luecken/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, radius_km: radius }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Die Analyse konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Die Analyse konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  // Eingefärbte Heat-Fläche: je Rasterzelle ein Quadrat, Farbe interpoliert über die Distanz
  // zur nächsten Säule (grün nah → gelb → rot weit weg).
  const heatCells = useMemo(() => {
    if (!result) return [];
    const step = result.summary.step_km ?? 2;
    const hLat = step / 2 / 111;
    const features = result.grid.map((c) => {
      const hLng = step / 2 / (111 * Math.cos((c.lat * Math.PI) / 180));
      return {
        type: "Feature" as const,
        properties: { dist_km: Math.min(c.dist_km, 10) },
        geometry: {
          type: "Polygon" as const,
          coordinates: [[
            [c.lng - hLng, c.lat - hLat],
            [c.lng + hLng, c.lat - hLat],
            [c.lng + hLng, c.lat + hLat],
            [c.lng - hLng, c.lat + hLat],
            [c.lng - hLng, c.lat - hLat],
          ]],
        },
      };
    });
    return [{
      id: "coverage",
      data: { type: "FeatureCollection" as const, features },
      property: "dist_km",
      // 0 km grün · 5 km gelb (Grenze) · 10 km+ rot
      stops: [[0, "#16a34a"], [3, "#84cc16"], [5, "#eab308"], [7, "#f97316"], [10, "#dc2626"]] as [number, string][],
      opacity: 0.55,
    }];
  }, [result]);

  // Ladesäulen als ⚡-Punkte (Backend liefert Popup-Infos: kW, Ladepunkte, Quelle; grün = Schnelllader)
  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.chargers.features.map((f) => {
        const p = (f.properties ?? {}) as { name?: string; color?: string };
        return {
          ...f,
          properties: { ...f.properties, color: p.color ?? "#1e3a5f", emoji: "⚡", name: p.name ?? "Ladestation" },
        };
      }),
    };
  }, [result]);

  const readiness = result ? Math.max(0, 100 - result.summary.gap_pct) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Lade-Lücken-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Wo fehlt Ladeinfrastruktur — und reicht sie?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Zwei Antworten in einem Check: die <strong>Lade-Wüsten</strong> deiner Region (Heat-Fläche,
          Bereiche &gt; 5 km zur nächsten Säule) und der <strong>Kapazitäts-Check</strong> auf Basis des
          amtlichen BNetzA-Registers — reichen die Ladepunkte heute und bei 30 % E-Auto-Anteil?
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Region / Ort</label>
          <AddressSearch placeholder="z. B. Vulkaneifel" onSelect={setHit} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Umkreis:</span>
            <OptionPills
              options={[{ value: 15, label: "15 km" }, { value: 25, label: "25 km" }]}
              value={radius}
              onChange={setRadius}
              ariaLabel="Umkreis"
            />
          </div>
          <button type="submit" disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50">
            {status === "running" ? "Analysiere …" : "Region analysieren"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="Ladeinfrastruktur wird gerastert … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-6">
          <AuditScore
            score={readiness}
            title={`E-Auto-Readiness · ${result.address_resolved} (${result.radius_km} km)`}
            subtitle={`${result.summary.charger_count} Ladestationen · größte Lücke ${result.summary.worst_dist_km} km`}
            labels={{ good: "Gut versorgt", mid: "Teils Lücken", bad: "Viele Lade-Wüsten" }}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="text-center">
              <p className="text-3xl font-bold text-brand">{result.summary.charger_count}</p>
              <p className="text-sm text-slate-500">Ladestationen</p>
            </Card>
            <Card className="text-center">
              <p className={`text-3xl font-bold ${result.summary.gap_pct > 25 ? "text-bad" : result.summary.gap_pct > 10 ? "text-warn" : "text-ok"}`}>
                {result.summary.gap_pct}%
              </p>
              <p className="text-sm text-slate-500">der Fläche &gt; 5 km entfernt</p>
            </Card>
            <Card className="text-center">
              <p className="text-3xl font-bold text-brand">{result.summary.worst_dist_km} km</p>
              <p className="text-sm text-slate-500">größte Lücke</p>
            </Card>
          </div>

          <Card className="!p-0 overflow-hidden">
            <IsoMapDynamic
              center={[result.center.lng, result.center.lat]}
              zones={[]}
              heatCells={heatCells}
              pois={pois}
              markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#0ea5e9" }]}
              heightClass="h-[480px]"
            />
            <div className="px-6 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Distanz zur nächsten Säule:</span>
                <span>0 km</span>
                <div className="h-2 flex-1 rounded" style={{ background: "linear-gradient(90deg,#16a34a,#84cc16,#eab308,#f97316,#dc2626)" }} />
                <span>10 km+</span>
              </div>
              <p className="mt-1 text-center text-xs text-slate-400">Grüne Fläche = gut versorgt · rote Fläche = Lade-Wüste · ⚡ Ladestation (grün = Schnelllader, anklickbar) · blaue Nadel: Zentrum</p>
            </div>
          </Card>

          {/* --- Kapazitäts-Check: Angebot vs. Nachfrage im E-Auto-Szenario --- */}
          {cap && (
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-brand">Kapazitäts-Check: Reichen die Ladepunkte?</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">E-Auto-Anteil:</span>
                  <OptionPills options={SHARE_OPTIONS} value={eShare} onChange={setEShare} ariaLabel="E-Auto-Anteil" />
                </div>
              </div>

              {scenario ? (
                <>
                  <AuditScore
                    score={scenario.score}
                    title={`Kapazität bei ${eShare} % E-Auto-Anteil`}
                    subtitle={`${cap.supply_kw.toLocaleString("de-DE")} kW verfügbar · ${scenario.neededKw.toLocaleString("de-DE")} kW benötigt (AFIR: 1,3 kW je E-Auto)`}
                    labels={{ good: "Ausreichend dimensioniert", mid: "Wird knapp", bad: "Ausbaubedarf" }}
                  />
                  <div className="mt-4 grid gap-4 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <p className="text-2xl font-bold text-brand">{cap.charge_points.toLocaleString("de-DE")}</p>
                      <p className="text-xs text-slate-500">Ladepunkte{cap.fast_points > 0 ? ` (${cap.fast_points.toLocaleString("de-DE")} schnell)` : ""}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <p className="text-2xl font-bold text-brand">{cap.supply_kw.toLocaleString("de-DE")} kW</p>
                      <p className="text-xs text-slate-500">installierte Ladeleistung</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <p className="text-2xl font-bold text-brand">{scenario.cars.toLocaleString("de-DE")}</p>
                      <p className="text-xs text-slate-500">Pkw geschätzt ({cap.resident_cars.toLocaleString("de-DE")} Einwohner + {cap.tourist_cars.toLocaleString("de-DE")} Gäste)</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4 text-center">
                      <p className={`text-2xl font-bold ${scenario.score >= 70 ? "text-ok" : scenario.score >= 40 ? "text-warn" : "text-bad"}`}>
                        {scenario.bev.toLocaleString("de-DE")}
                      </p>
                      <p className="text-xs text-slate-500">E-Autos im Szenario ({eShare} %)</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    Quelle Ladeangebot: {cap.source === "BNetzA" ? `Bundesnetzagentur-Ladesäulenregister${cap.stand ? ` (Stand ${cap.stand})` : ""}` : "OpenStreetMap (BNetzA nicht erreichbar)"} ·
                    Nachfrage geschätzt aus {cap.resident_pop.toLocaleString("de-DE")} Einwohnern
                    {cap.places.length > 0 ? ` (u. a. ${cap.places.slice(0, 3).map((p) => p.name).join(", ")})` : ""} und {cap.tourist_beds.toLocaleString("de-DE")} Gästebetten
                    ({cap.acc_count.toLocaleString("de-DE")} Unterkünfte) — Details in der Methodik-Box.
                  </p>
                </>
              ) : (
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
                  Für diese Region konnten keine Einwohner-/Unterkunftsdaten geschätzt werden — der Kapazitäts-Check ist hier nicht möglich.
                  Angebot: {cap.charge_points.toLocaleString("de-DE")} Ladepunkte mit {cap.supply_kw.toLocaleString("de-DE")} kW.
                </p>
              )}
            </Card>
          )}

          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Lade-Lücken-Radar für unsere Region" />
        </section>
      )}
    </main>
  );
}
