"use client";

import { useMemo, useState, type ReactNode } from "react";
import IsoMapDynamic from "./IsoMapDynamic";
import PoiCard from "./PoiCard";
import MethodBox, { type MethodContent } from "./MethodBox";
import AboutSection from "./AboutSection";
import type { HeatCells, LineLayer, RasterLayer, ZoneLayer } from "./IsoMap";
import { useRoute, type RouteMode } from "@/lib/useRoute";
import type { Feature, FeatureCollection, LngLat, RichPoi } from "@/lib/types";

function gmapsDir(p: RichPoi, origin?: LngLat) {
  const o = origin ? `&origin=${origin.lat},${origin.lng}` : "";
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${p.lat},${p.lng}`;
}
function komoot(p: RichPoi) {
  return `https://www.komoot.de/plan/@${p.lat},${p.lng},14z`;
}

// Gemeinsamer Ergebnis-Block der angereicherten Finder-Tools:
// Karte (mit Route-Linie + reichem Klick-Popup + Highlight) + PoiCard-Grid + Erklärungs-Box + About.
export default function RichResults({
  center,
  origin,
  pois,
  method,
  mailSubject,
  routeMode = "foot",
  markerColor = "#1e3a5f",
  mapHeight = "h-[440px]",
  extraFeatures = [],
  rasterLayers = [],
  zones = [],
  extraLines = [],
  heatCells = [],
  children,
}: {
  center: LngLat;
  origin?: LngLat;
  pois: RichPoi[];
  method: MethodContent;
  mailSubject: string;
  routeMode?: RouteMode;
  markerColor?: string;
  mapHeight?: string;
  extraFeatures?: Feature[];
  rasterLayers?: RasterLayer[];
  zones?: ZoneLayer[]; // z. B. Schutzgebiets-Flächen (Wildtier)
  extraLines?: LineLayer[]; // z. B. Stille-Spaziergang (Ruhe)
  heatCells?: HeatCells[]; // z. B. Ruhe-Heatmap
  children?: ReactNode;
}) {
  const routeOrigin = origin ?? center;
  const { route, toggle } = useRoute(routeOrigin, routeMode);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const poiFC = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [
        ...pois.map((p) => ({
          type: "Feature" as const,
          properties: {
            id: p.id,
            name: p.name,
            emoji: p.emoji ?? "",
            category_label: p.category_label ?? "",
            desc: p.description ?? p.ai_why ?? "",
            img: p.image ?? "",
            open_now: p.open_now ?? null,
            oh: p.opening_hours ?? "",
            meta_right: p.meta_right ?? (p.distance_km != null ? `${p.distance_km} km` : ""),
            website: p.website ?? "",
            gmaps: gmapsDir(p, routeOrigin),
            komoot: komoot(p),
            color: p.color ?? "#0ea5e9",
          },
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        })),
        ...extraFeatures,
      ],
    }),
    [pois, extraFeatures, routeOrigin]
  );

  const lines = [...(route ? [{ id: "route", data: route.geometry, color: "#1e3a5f", width: 5 }] : []), ...extraLines];
  const modeLabel = route?.mode === "bike" ? "Rad" : route?.mode === "car" ? "Auto" : "zu Fuß";

  return (
    <section className="space-y-6">
      {children}
      <div className="space-y-2">
        <IsoMapDynamic
          center={[center.lng, center.lat]}
          zones={zones}
          lines={lines}
          rasterLayers={rasterLayers}
          heatCells={heatCells}
          pois={poiFC}
          markers={[{ lat: center.lat, lng: center.lng, color: markerColor }]}
          heightClass={mapHeight}
          onSelect={setSelectedId}
          selectedId={selectedId}
        />
        {route && (
          <p className="text-center text-xs text-slate-500">
            Route: {route.distance_km} km · {route.duration_min} Min ({modeLabel}) — Spot erneut klicken blendet aus
          </p>
        )}
        <p className="text-center text-xs text-slate-400">💡 Tipp: Punkt auf der Karte anklicken für Foto, Infos &amp; Route.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {pois.map((p) => (
          <PoiCard
            key={p.id}
            poi={p}
            origin={routeOrigin}
            onRoute={(x) => toggle({ id: x.id, lat: x.lat, lng: x.lng })}
            routeActive={route?.poiId === p.id}
            highlighted={selectedId === p.id}
          />
        ))}
      </div>

      <MethodBox content={method} />
      <AboutSection mailSubject={mailSubject} />
    </section>
  );
}
