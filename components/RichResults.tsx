"use client";

import { useMemo, type ReactNode } from "react";
import IsoMapDynamic from "./IsoMapDynamic";
import PoiCard from "./PoiCard";
import MethodBox, { type MethodContent } from "./MethodBox";
import AboutSection from "./AboutSection";
import { useRoute, type RouteMode } from "@/lib/useRoute";
import type { Feature, FeatureCollection, LngLat, RichPoi } from "@/lib/types";

// Gemeinsamer Ergebnis-Block der angereicherten Finder-Tools:
// Karte (mit optionaler Route-Linie) + PoiCard-Grid + Erklärungs-Box + „Wer steckt dahinter".
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
  extraFeatures?: Feature[]; // zusätzliche Kartenpunkte (z. B. Hotspots)
  children?: ReactNode; // tool-spezifische Blöcke oberhalb des Karten-Grids
}) {
  const routeOrigin = origin ?? center;
  const { route, toggle } = useRoute(routeOrigin, routeMode);

  const poiFC = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [
        ...pois.map((p) => ({
          type: "Feature" as const,
          properties: {
            name: `${p.emoji ? p.emoji + " " : ""}${p.name}`,
            sub: p.category_label ?? "",
            color: p.color ?? "#0ea5e9",
          },
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        })),
        ...extraFeatures,
      ],
    }),
    [pois, extraFeatures]
  );

  const lines = route ? [{ id: "route", data: route.geometry, color: "#1e3a5f", width: 5 }] : [];
  const modeLabel = route?.mode === "bike" ? "Rad" : route?.mode === "car" ? "Auto" : "zu Fuß";

  return (
    <section className="space-y-6">
      {children}
      <div className="space-y-2">
        <IsoMapDynamic
          center={[center.lng, center.lat]}
          zones={[]}
          lines={lines}
          pois={poiFC}
          markers={[{ lat: center.lat, lng: center.lng, color: markerColor }]}
          heightClass={mapHeight}
        />
        {route && (
          <p className="text-center text-xs text-slate-500">
            Route: {route.distance_km} km · {route.duration_min} Min ({modeLabel}) — Spot erneut klicken blendet aus
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {pois.map((p) => (
          <PoiCard
            key={p.id}
            poi={p}
            origin={routeOrigin}
            onRoute={(x) => toggle({ id: x.id, lat: x.lat, lng: x.lng })}
            routeActive={route?.poiId === p.id}
          />
        ))}
      </div>

      <MethodBox content={method} />
      <AboutSection mailSubject={mailSubject} />
    </section>
  );
}
