import Link from "next/link";

const CLUSTERS = [
  {
    title: "Daten & Audit",
    tools: [
      { href: "/daten-check", emoji: "📊", title: "Destinations-Datencheck", text: "Wie gut ist deine Region in OpenStreetMap erfasst? Datenqualität-Score + Lücken." },
      { href: "/lade-luecken", emoji: "🔌", title: "Lade-Lücken-Radar", text: "Wo fehlt in deiner Region Ladeinfrastruktur für E-Autos?" },
    ],
  },
  {
    title: "Content & Marketing",
    tools: [
      { href: "/thementour", emoji: "🗺️", title: "Thementouren-Generator", text: "Automatisch geroutete Themen-Rundtour (Kultur, Genuss, Natur, Familie)." },
      { href: "/genuss-radar", emoji: "🧀", title: "Genuss-Radar", text: "Hofläden, Winzer, Brauereien & Wochenmärkte der Region." },
      { href: "/golden-hour", emoji: "🌅", title: "Golden-Hour-Fotospots", text: "Die besten Aussichtspunkte für den Sonnenuntergang — mit heutiger Uhrzeit." },
      { href: "/naturwunder", emoji: "🏞️", title: "Naturwunder-Finder", text: "Wasserfälle, Höhlen, Quellen und Felsen rund um deinen Ort." },
    ],
  },
  {
    title: "Gäste-Service",
    tools: [
      { href: "/schlechtwetter", emoji: "🌧️", title: "Schlechtwetter-Radar", text: "Was tun bei Regen? Indoor-Ziele + Live-Wetter." },
      { href: "/ruhe-finder", emoji: "🤫", title: "Ruhe-Finder", text: "Die ruhigsten Plätze abseits von Lärm — für Slow Travel." },
      { href: "/geheimtipp", emoji: "🧭", title: "Geheimtipp-Radar", text: "Statt überlaufener Hotspots — gleichwertige, unbekannte Alternativen." },
      { href: "/wildtier", emoji: "🦅", title: "Wildtier-Beobachtung", text: "Beobachtungshütten, Schutzgebiete & Feuchtgebiete." },
    ],
  },
  {
    title: "E-Mobilität für Gäste",
    tools: [
      { href: "/laden-erleben", emoji: "⚡", title: "Laden & Erleben", text: "Ladesäulen — und was du während des Ladens zu Fuß erreichst." },
      { href: "/eauto-ausflug", emoji: "🚗", title: "E-Auto-Tagesausflug", text: "Reichweiten-sichere Ausflugsziele mit Lademöglichkeit vor Ort." },
      { href: "/laden-wandern", emoji: "🥾", title: "Charge & Hike", text: "Laden am Wanderparkplatz — laden während du wanderst." },
    ],
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand-accent">
          DMO-Toolbox
        </p>
        <h1 className="mb-3 text-3xl font-bold text-brand sm:text-4xl">
          13 Tourismus-Tools auf OpenStreetMap-Basis
        </h1>
        <p className="mx-auto max-w-2xl text-slate-600">
          Für Destinationen und ihre Gäste: Datenqualität, Content, Erlebnisse und E-Mobilität —
          alles aus offenen Kartendaten.
        </p>
      </header>

      <div className="space-y-10">
        {CLUSTERS.map((c) => (
          <section key={c.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{c.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-accent"
                >
                  <div className="mb-2 text-2xl">{t.emoji}</div>
                  <h3 className="mb-1 font-bold text-brand">{t.title}</h3>
                  <p className="text-sm text-slate-600">{t.text}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
