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
import type { DatencheckResult, FeatureCollection, GeocodeHit } from "@/lib/types";

const METHOD: MethodContent = {
  intro:
    "Der Datencheck misst, wie vollständig die touristischen Betriebe deiner Region in OpenStreetMap (OSM) erfasst sind — der Datenbasis, die Komoot, Outdooractive, Apple Karten, Bing und zunehmend KI-Assistenten speist.",
  sources: [
    "OpenStreetMap (Overpass API) — alle besetzten Tourismus-POIs im gewählten Radius (Unterkünfte, Gastronomie, Sehenswürdigkeiten, historische Orte, Camping, Tourist-Infos)",
    "Wikimedia-Pageviews — echte Wikipedia-Aufrufe/Monat für die Top-Sehenswürdigkeiten („digitale Aushängeschilder\")",
    "Nominatim — Geokodierung der eingegebenen Region",
  ],
  steps: [
    "Wir laden alle Tourismus-Betriebe im Radius aus OpenStreetMap.",
    "Je Betrieb prüfen wir 6 gästerelevante Merkmale: Öffnungszeiten, Website, Telefon, Barrierefrei-Angabe, Foto und Adresse.",
    "Aus den Füllraten berechnen wir einen gewichteten Daten-Score von 0–100.",
    "Die größten Lücken bereiten wir als Quick Wins auf — und an 3 echten Beispielen zeigen wir, was die Lücke für Karten-Apps und KI-Assistenten konkret bedeutet (Text-Schablonen, keine KI).",
    "Optional: Vergleichsregion eingeben — der zweite Audit-Lauf nutzt exakt denselben Radius und dieselbe Methodik (faires Duell).",
    "Jeder lückenhafte Betrieb auf der Karte verlinkt direkt in den OpenStreetMap-Editor — aus dem Audit wird eine To-do-Liste.",
  ],
  scoring: [
    "Öffnungszeiten und Website zählen je 25 Punkte (für Gäste am wichtigsten), Telefon und Barrierefrei-Angabe je 15, Foto und Adresse je 10.",
    "Score ≥ 70 = sehr gut erfasst · 40–69 = ausbaufähig · < 40 = große Lücken.",
    "Auf der Karte: grün = mindestens 4 von 6 Angaben vorhanden, rot = lückenhaft.",
  ],
  limits: [
    "Bewertet wird die Daten­qualität in OSM, nicht die Qualität der Betriebe selbst — ein Haus kann exzellent sein und in OSM trotzdem fehlen.",
    "Nur öffentlich getaggte Betriebe erscheinen; sehr kleine oder neue fehlen evtl. ganz.",
    "OSM lebt von Freiwilligen — der Check ist eine Momentaufnahme und kein amtliches Register.",
  ],
};

// Merkmal-Filter für die To-do-Karte (auf map_samples[].properties.miss)
const MAP_FILTERS = [
  { key: null as string | null, label: "alle" },
  { key: "website", label: "ohne Website" },
  { key: "opening_hours", label: "ohne Öffnungszeiten" },
  { key: "wheelchair", label: "ohne Barrierefrei" },
  { key: "image", label: "ohne Foto" },
];
const ATTR_LABEL: Record<string, string> = {
  opening_hours: "Öffnungszeiten", website: "Website", phone: "Telefon",
  wheelchair: "Barrierefrei", image: "Foto", address: "Adresse",
};

export default function DatenCheck() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [hitB, setHitB] = useState<GeocodeHit | null>(null);
  const [bKey, setBKey] = useState(0);
  const [radius, setRadius] = useState(10);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [mapFilter, setMapFilter] = useState<string | null>(null);
  const { status, result, errorMessage } = usePolling<DatencheckResult>(token);
  const [email, setEmail] = useState("");
  const [reportState, setReportState] = useState<"idle" | "loading" | "sent" | "link" | "error">("idle");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hit) return setStartError("Bitte zuerst eine Region auswählen.");
    setStartError(null);
    setToken(null);
    setReportState("idle");
    setMapFilter(null);
    try {
      const res = await fetch("/api/daten-check/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: hit.label, lat: hit.lat, lng: hit.lng, radius_km: radius,
          ...(hitB ? { compare_address: hitB.label, compare_lat: hitB.lat, compare_lng: hitB.lng } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Der Check konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Der Check konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

  // To-do-Karte: Features nach fehlendem Merkmal filtern
  const shownSamples = useMemo<FeatureCollection | null>(() => {
    if (!result) return null;
    if (!mapFilter) return result.map_samples;
    return {
      type: "FeatureCollection",
      features: result.map_samples.features.filter((f) =>
        Array.isArray(f.properties?.miss) && (f.properties.miss as string[]).includes(mapFilter)
      ),
    };
  }, [result, mapFilter]);

  // Top-To-dos: lückenhafteste Betriebe mit Editor-Link
  const todos = useMemo(() => {
    if (!result) return [];
    return result.map_samples.features
      .map((f) => f.properties as { name?: string; miss?: string[]; edit_url?: string })
      .filter((p) => Array.isArray(p.miss) && p.miss.length > 0 && p.edit_url)
      .sort((a, b) => (b.miss?.length ?? 0) - (a.miss?.length ?? 0))
      .slice(0, 10);
  }, [result]);

  async function requestReport(withEmail: boolean) {
    if (!token) return;
    setReportState("loading");
    setPdfUrl(null);
    try {
      const res = await fetch("/api/daten-check/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: withEmail ? email : "" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return setReportState("error");
      setPdfUrl(data.pdf_url ?? null);
      setReportState(data.sent ? "sent" : "link");
    } catch {
      setReportState("error");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">
          Destinations-Datencheck
        </p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">
          Wie gut ist deine Region in OpenStreetMap erfasst?
        </h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          OpenStreetMap speist Komoot, Outdooractive, Apple Karten, Bing und zunehmend KI-Assistenten. Wir prüfen, wie
          vollständig die Tourismus-Betriebe deiner Region erfasst sind — und zeigen die größten Lücken.
        </p>
      </header>

      <form onSubmit={submit} className="mb-8 space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <label className="mb-1 block text-sm font-medium">Region / Ort</label>
          <AddressSearch placeholder="z. B. Monschau, Eifel" onSelect={setHit} />
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <label className="block text-sm font-medium text-slate-600">⚔️ Optional: Vergleichsregion (Regionen-Duell)</label>
            {hitB && (
              <button type="button" onClick={() => { setHitB(null); setBKey((k) => k + 1); }} className="text-xs text-slate-400 hover:text-bad">
                ✕ Vergleich entfernen
              </button>
            )}
          </div>
          <AddressSearch key={bKey} placeholder="z. B. Nachbardestination" onSelect={setHitB} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="mr-2 text-sm font-medium">Umkreis:</span>
            <OptionPills
              options={[{ value: 5, label: "5 km" }, { value: 10, label: "10 km" }, { value: 15, label: "15 km" }]}
              value={radius}
              onChange={setRadius}
              ariaLabel="Umkreis"
            />
          </div>
          <button
            type="submit"
            disabled={status === "running"}
            className="rounded-lg bg-brand px-5 py-2 font-semibold text-white transition hover:bg-brand/90 disabled:opacity-50"
          >
            {status === "running" ? "Analysiere …" : "Region prüfen"}
          </button>
        </div>
        {startError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">{startError}</p>}
      </form>

      {status === "running" && <RunningBox text="OpenStreetMap-Daten der Region werden ausgewertet … (10–40 Sekunden)" />}
      {(status === "error" || status === "timeout" || status === "not_found") && <ErrorBox message={errorMessage} />}

      {status === "done" && result && (
        <section className="space-y-6">
          <AuditScore
            score={result.score}
            title={`Daten-Score · ${result.address_resolved} (${result.radius_km} km)`}
            subtitle={`${result.poi_total} Tourismus-Betriebe analysiert`}
            labels={{ good: "Sehr gut erfasst", mid: "Ausbaufähig", bad: "Große Lücken" }}
          />

          {/* Regionen-Duell: zweiter Audit-Lauf mit gleichem Radius */}
          {result.compare && (
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand/30">
              <h2 className="mb-4 text-center text-lg font-bold text-brand">⚔️ Regionen-Duell</h2>
              <div className="mb-5 grid grid-cols-2 gap-4 text-center">
                {[
                  { name: result.address_resolved, score: result.score, pois: result.poi_total },
                  { name: result.compare.address, score: result.compare.score, pois: result.compare.poi_total },
                ].map((s, i, arr) => {
                  const other = arr[1 - i].score;
                  return (
                    <div key={i} className={`rounded-xl p-4 ring-1 ${s.score >= other ? "bg-amber-50 ring-amber-300" : "bg-slate-50 ring-slate-200"}`}>
                      <p className="mb-1 truncate text-xs font-medium text-slate-500" title={s.name}>{s.name}</p>
                      <p className={`text-3xl font-bold ${s.score >= 70 ? "text-ok" : s.score >= 40 ? "text-warn" : "text-bad"}`}>
                        {s.score}
                        <span className="text-base font-normal text-slate-400"> / 100</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{s.pois} Betriebe</p>
                      {s.score > other && <p className="mt-1 text-xs font-semibold text-amber-700">🏆 vorn</p>}
                    </div>
                  );
                })}
              </div>
              <ul className="space-y-2">
                {result.attributes.map((a) => {
                  const b = result.compare!.attributes.find((x) => x.key === a.key);
                  if (!b) return null;
                  return (
                    <li key={a.key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <span className={a.pct > b.pct ? "font-bold text-brand" : "text-slate-500"}>{a.pct} % {a.pct > b.pct && "🏆"}</span>
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:w-28">
                          <div className="ml-auto h-full rounded-full bg-brand-accent" style={{ width: `${a.pct}%` }} />
                        </div>
                      </div>
                      <span className="min-w-28 text-center text-xs font-medium text-slate-600">{a.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:w-28">
                          <div className="h-full rounded-full bg-slate-400" style={{ width: `${b.pct}%` }} />
                        </div>
                        <span className={b.pct > a.pct ? "font-bold text-brand" : "text-slate-500"}>{b.pct > a.pct && "🏆"} {b.pct} %</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-center text-xs text-slate-400">
                Gleicher Radius ({result.radius_km} km), gleiche Methodik — Karte und Details unten zeigen die erste Region.
              </p>
            </div>
          )}

          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-brand">Datenqualität je Merkmal</h2>
              <div className="flex flex-wrap gap-1.5">
                {result.categories.map((c) => (
                  <span key={c.key} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {c.label}: {c.count}
                  </span>
                ))}
              </div>
            </div>
            <ul className="space-y-3">
              {result.attributes.map((a) => (
                <li key={a.key}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium">{a.label}</span>
                    <span className="text-slate-500">{a.pct}% ({a.filled}/{a.total})</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${a.pct >= 60 ? "bg-ok" : a.pct >= 30 ? "bg-warn" : "bg-bad"}`}
                      style={{ width: `${a.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {result.quick_wins.length > 0 && (
            <div className="rounded-2xl bg-amber-50 p-6 ring-1 ring-amber-200">
              <h2 className="mb-2 text-lg font-bold text-amber-800">Schnelle Verbesserungen</h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-amber-900">
                {result.quick_wins.map((q, i) => (
                  <li key={i}>
                    <strong>{q.count}</strong> {q.issue}
                    {q.examples.length > 0 && <span className="text-amber-700"> (z. B. {q.examples.join(", ")})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* So sieht euch eine KI: konkrete Folge je Datenlücke an echten Beispielen */}
          {result.ai_view && result.ai_view.length > 0 && (
            <div className="rounded-2xl bg-slate-900 p-6 text-slate-100 ring-1 ring-slate-700">
              <h2 className="mb-1 text-lg font-bold">🤖 So sieht euch eine KI</h2>
              <p className="mb-4 text-sm text-slate-400">
                OpenStreetMap speist Komoot, Apple Karten und zunehmend KI-Assistenten. Drei echte Beispiele aus eurer Region:
              </p>
              <ul className="space-y-3">
                {result.ai_view.map((a, i) => (
                  <li key={i} className="rounded-xl bg-slate-800/70 p-4 ring-1 ring-slate-700">
                    <p className="text-sm font-semibold">
                      {a.name} <span className="font-normal text-slate-400">· {a.cat_label}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">Fehlt: {a.missing.join(", ")}</p>
                    <p className="mt-1.5 text-sm text-amber-300">→ {a.consequence}.</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-slate-500">
                Konsequenzen sind Text-Schablonen je Lücken-Typ (keine KI-Bewertung) — die Betriebe und Lücken sind echt.
              </p>
            </div>
          )}

          <Card className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
              <span className="text-sm font-medium text-slate-500">To-do-Karte:</span>
              {MAP_FILTERS.map((f) => (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => setMapFilter(f.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                    mapFilter === f.key ? "bg-brand text-white ring-brand" : "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              {mapFilter && shownSamples && (
                <span className="text-xs text-slate-400">{shownSamples.features.length} Betriebe</span>
              )}
            </div>
            <div className="mt-3">
              <IsoMapDynamic
                center={[result.center.lng, result.center.lat]}
                zones={[]}
                pois={shownSamples ?? result.map_samples}
                markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
                heightClass="h-[420px]"
              />
            </div>
            <p className="px-6 py-3 text-center text-xs text-slate-500">
              Grün = gut erfasst (≥ 4 von 6 Angaben) · Rot = lückenhaft · Klick aufs Popup: „In OSM ergänzen" öffnet den Editor am Betrieb
            </p>
          </Card>

          {/* Top-To-dos: die lückenhaftesten Betriebe direkt abarbeiten */}
          {todos.length > 0 && (
            <Card>
              <h2 className="mb-1 text-lg font-bold text-brand">📋 Top-10-To-dos</h2>
              <p className="mb-3 text-xs text-slate-500">
                Die lückenhaftesten Betriebe — jeder Link öffnet den OpenStreetMap-Editor direkt am Objekt (OSM-Konto nötig).
              </p>
              <ul className="divide-y divide-slate-100">
                {todos.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        fehlt: {(t.miss ?? []).map((m) => ATTR_LABEL[m] ?? m).join(", ")}
                      </p>
                    </div>
                    <a href={t.edit_url} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 rounded-lg border border-brand px-2.5 py-1 text-xs font-semibold text-brand hover:bg-slate-50">
                      In OSM ergänzen ↗
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Wikipedia-Schaufenster: digitale Aushängeschilder */}
          {result.wiki_showcase && (
            <Card>
              <h2 className="mb-1 text-lg font-bold text-brand">📖 Eure digitalen Aushängeschilder</h2>
              <p className="mb-3 text-xs text-slate-500">
                {result.wiki_showcase.article_count} von {result.wiki_showcase.sight_count} Sehenswürdigkeiten haben einen
                Wikipedia-Artikel — mit echten Aufrufzahlen (letzter voller Monat).
              </p>
              {result.wiki_showcase.with_article.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {result.wiki_showcase.with_article.map((w, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-2">
                      <a href={w.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-brand hover:text-brand-accent">
                        {w.name} ↗
                      </a>
                      <span className="shrink-0 text-slate-500">
                        {w.views_month != null ? `${w.views_month.toLocaleString("de-DE")} Aufrufe/Monat` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {result.wiki_showcase.missing.length > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  Ohne Wikipedia-Artikel (und damit ohne diese Sichtbarkeit): {result.wiki_showcase.missing.join(", ")}
                </p>
              )}
            </Card>
          )}

          <Card>
            <h2 className="mb-2 text-lg font-bold text-brand">Report als PDF</h2>
            <p className="mb-4 text-sm text-slate-600">Vollständige Auswertung als PDF — herunterladen oder per E-Mail.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.de (optional)"
                aria-label="E-Mail-Adresse für den PDF-Report"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 focus:border-brand-accent focus:outline-none"
              />
              <button type="button" onClick={() => requestReport(true)} disabled={reportState === "loading" || !email}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
                Per E-Mail senden
              </button>
              <button type="button" onClick={() => requestReport(false)} disabled={reportState === "loading"}
                className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-slate-50 disabled:opacity-50">
                Nur herunterladen
              </button>
            </div>
            {reportState === "loading" && <p className="mt-3 animate-pulse text-sm text-slate-500">PDF wird erstellt …</p>}
            {reportState === "sent" && <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-ok">Report verschickt — schau in dein Postfach.</p>}
            {reportState === "link" && pdfUrl && (
              <p className="mt-3 text-sm"><a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-accent underline">📄 PDF herunterladen</a> <span className="text-slate-500">(Link 1 Stunde gültig)</span></p>
            )}
            {reportState === "error" && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-bad">PDF konnte nicht erstellt werden.</p>}
          </Card>

          <MethodBox content={METHOD} />
          <AboutSection mailSubject="Destinations-Datencheck für unsere Region" />
        </section>
      )}
    </main>
  );
}
