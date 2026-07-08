"use client";

import { useState } from "react";
import AddressSearch from "@/components/AddressSearch";
import IsoMapDynamic from "@/components/IsoMapDynamic";
import ScoreGauge from "@/components/ScoreGauge";
import OptionPills from "@/components/OptionPills";
import { ErrorBox, RunningBox } from "@/components/StatusBox";
import { usePolling } from "@/lib/usePolling";
import type { DatencheckResult, GeocodeHit } from "@/lib/types";

export default function DatenCheck() {
  const [hit, setHit] = useState<GeocodeHit | null>(null);
  const [radius, setRadius] = useState(10);
  const [token, setToken] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
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
    try {
      const res = await fetch("/api/daten-check/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: hit.label, lat: hit.lat, lng: hit.lng, radius_km: radius }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) return setStartError("Der Check konnte nicht gestartet werden.");
      setToken(data.token);
    } catch {
      setStartError("Der Check konnte nicht gestartet werden. Bitte später erneut versuchen.");
    }
  }

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
          <div className="grid gap-4 sm:grid-cols-2">
            <ScoreGauge value={result.score} title={`Daten-Score · ${result.address_resolved} (${result.radius_km} km)`} />
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="mb-2 text-sm font-medium text-slate-500">Analysiert</p>
              <p className="text-2xl font-bold text-brand">{result.poi_total} Betriebe</p>
              <p className="mt-1 text-xs text-slate-500">
                {result.categories.map((c) => `${c.label}: ${c.count}`).join(" · ")}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-4 text-lg font-bold text-brand">Datenqualität je Merkmal</h2>
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
          </div>

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

          <IsoMapDynamic
            center={[result.center.lng, result.center.lat]}
            zones={[]}
            pois={result.map_samples}
            markers={[{ lat: result.center.lat, lng: result.center.lng, color: "#1e3a5f" }]}
            heightClass="h-[420px]"
          />
          <p className="-mt-4 text-center text-xs text-slate-500">
            Grün = gut erfasst (≥ 4 von 6 Angaben) · Rot = lückenhaft · anklickbar
          </p>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
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
          </div>
        </section>
      )}
    </main>
  );
}
