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
    "Immer mehr Gäste reisen mit dem E-Auto an. Der Radar zeigt, wie flächendeckend deine Region mit Ladeinfrastruktur versorgt ist — und wo „Lade-Wüsten“ die Anreise erschweren.",
  sources: [
    "OpenStreetMap (Overpass API) — alle Ladestationen (amenity=charging_station) im gewählten Radius",
    "Nominatim — Geokodierung der Region",
  ],
  steps: [
    "Wir laden alle Ladestationen der Region aus OpenStreetMap.",
    "Die Region wird in ein Raster aus 2–3 km-Zellen zerlegt.",
    "Für jede Zelle berechnen wir die Luftlinien-Distanz zur nächstgelegenen Ladesäule.",
    "Zellen, die weiter als 5 km entfernt sind, markieren wir als Lade-Lücke (rot).",
  ],
  scoring: [
    "Die E-Auto-Readiness ist der Anteil der Fläche innerhalb von 5 km zu einer Ladesäule (100 − Lücken-Anteil).",
    "≥ 70 = gut versorgt · 40–69 = teils Lücken · < 40 = viele Lade-Wüsten.",
    "Auf der Karte: rot = Lücke (> 5 km), grün = versorgt, blau = Ladestation.",
  ],
  limits: [
    "Grundlage ist die Luftlinie, nicht die tatsächliche Fahrstrecke — im Gebirge sind reale Wege länger.",
    "Ladeleistung und Verfügbarkeit fließen nicht ein; eine gemeldete Säule kann langsam oder defekt sein.",
    "Nur in OSM erfasste Stationen zählen — brandneue Standorte fehlen evtl. noch.",
  ],
};

export default function LadeLuecken() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(15);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<LadeLueckenResult>(token);

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

  // Ladesäulen als ⚡-Punkte
  const pois = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    return {
      type: "FeatureCollection",
      features: result.chargers.features.map((f) => ({
        ...f,
        properties: { ...f.properties, color: "#1e3a5f", emoji: "⚡", name: (f.properties as { name?: string })?.name ?? "Ladestation", category_label: "Ladestation" },
      })),
    };
  }, [result]);

  const readiness = result ? Math.max(0, 100 - result.summary.gap_pct) : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">Lade-Lücken-Radar</p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">Wo fehlt E-Auto-Ladeinfrastruktur?</h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Immer mehr Gäste reisen mit dem E-Auto an. Wir rastern deine Region und zeigen die
          „Lade-Wüsten" — Bereiche, die weiter als 5 km von der nächsten Ladesäule entfernt sind.
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
              <p className="mt-1 text-center text-xs text-slate-400">Grüne Fläche = gut versorgt · rote Fläche = Lade-Wüste · ⚡ Ladestation · blaue Nadel: Zentrum</p>
            </div>
          </Card>

          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Lade-Lücken-Radar für unsere Region" />
        </section>
      )}
    </main>
  );
}
