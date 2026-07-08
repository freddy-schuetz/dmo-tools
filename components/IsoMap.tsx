"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Feature, FeatureCollection } from "@/lib/types";

// Heller City-Basemap (CARTO Voyager, keyless) — Muster aus cool-city-guide.
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: "raster",
      tileSize: 256,
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
      ],
      attribution: "© OpenStreetMap-Mitwirkende © CARTO",
    },
  },
  layers: [{ id: "base", type: "raster", source: "base" }],
};

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

export type ZoneLayer = {
  id: string;
  data: FeatureCollection | Feature;
  color: string;
  fillOpacity?: number;
};

// Route-Linien (Thementour, Charge-&-Hike, Wegenetz): LineString/MultiLineString.
export type LineLayer = {
  id: string;
  data: FeatureCollection | Feature;
  color: string;
  width?: number;
  dashed?: boolean;
};

export type MapMarker = { lat: number; lng: number; color?: string; label?: string };

export interface IsoMapProps {
  center: [number, number]; // [lng, lat]
  zoom?: number;
  zones: ZoneLayer[];
  lines?: LineLayer[];
  pois?: FeatureCollection | null;
  poiColors?: Record<string, string>; // cat → Farbe
  markers?: MapMarker[];
  fitToZones?: boolean;
  heightClass?: string;
}

function toFC(d: FeatureCollection | Feature): FeatureCollection {
  return d.type === "FeatureCollection" ? d : { type: "FeatureCollection", features: [d] };
}

function collectBounds(layers: { data: FeatureCollection | Feature }[]): maplibregl.LngLatBounds | null {
  const b = new maplibregl.LngLatBounds();
  let any = false;
  const addPt = (pt: number[]) => {
    b.extend(pt as [number, number]);
    any = true;
  };
  for (const z of layers) {
    for (const f of toFC(z.data).features) {
      const g = f.geometry;
      if (g.type === "Polygon") (g.coordinates as number[][][]).forEach((r) => r.forEach(addPt));
      else if (g.type === "MultiPolygon") (g.coordinates as number[][][][]).forEach((p) => p[0]?.forEach(addPt));
      else if (g.type === "LineString") (g.coordinates as number[][]).forEach(addPt);
      else if (g.type === "MultiLineString") (g.coordinates as number[][][]).forEach((l) => l.forEach(addPt));
      else if (g.type === "Point") addPt(g.coordinates as number[]);
    }
  }
  return any ? b : null;
}

export default function IsoMap({
  center,
  zoom = 13,
  zones,
  lines = [],
  pois,
  poiColors = {},
  markers = [],
  fitToZones = true,
  heightClass = "h-[420px]",
}: IsoMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const zoneIdsRef = useRef<string[]>([]);
  const lineIdsRef = useRef<string[]>([]);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // --- Map einmalig initialisieren -----------------------------------------
  useEffect(() => {
    if (mapRef.current || !elRef.current) return;
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLE,
      center,
      zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("pois", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "pois-circles",
        type: "circle",
        source: "pois",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 15, 7],
          // to-color castet den per-Feature "color"-String explizit zu einer Farbe.
          // Ohne to-color liefert ["get","color"] Typ "value" -> MapLibre faellt still
          // auf den Fallback zurueck (alle Punkte blau). applyPois setzt color immer.
          "circle-color": ["to-color", ["coalesce", ["get", "color"], "#0ea5e9"]],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          "circle-opacity": 0.9,
        },
      });
      map.on("click", "pois-circles", (ev) => {
        const f = ev.features?.[0];
        if (!f) return;
        const name = (f.properties?.name as string) ?? "";
        const sub = (f.properties?.sub as string) ?? "";
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 10 })
          .setLngLat(ev.lngLat)
          .setHTML(
            `<div style="font:13px system-ui"><strong>${name}</strong>${sub ? `<br/>${sub}` : ""}</div>`
          )
          .addTo(map);
      });
      map.on("mouseenter", "pois-circles", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "pois-circles", () => (map.getCanvas().style.cursor = ""));
      readyRef.current = true;
      // Initialdaten anwenden (Effekte unten laufen ggf. vor "load")
      applyZones();
      applyLines();
      applyPois();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
      zoneIdsRef.current = [];
      lineIdsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Zonen (Isochrone / goldene Zone) --------------------------------------
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const poisRef = useRef(pois);
  poisRef.current = pois;
  const poiColorsRef = useRef(poiColors);
  poiColorsRef.current = poiColors;

  function applyZones() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    // alte Zonen-Layer entfernen
    for (const id of zoneIdsRef.current) {
      if (map.getLayer(`zone-fill-${id}`)) map.removeLayer(`zone-fill-${id}`);
      if (map.getLayer(`zone-line-${id}`)) map.removeLayer(`zone-line-${id}`);
      if (map.getSource(`zone-${id}`)) map.removeSource(`zone-${id}`);
    }
    zoneIdsRef.current = [];
    for (const z of zonesRef.current) {
      map.addSource(`zone-${z.id}`, { type: "geojson", data: toFC(z.data) });
      map.addLayer(
        {
          id: `zone-fill-${z.id}`,
          type: "fill",
          source: `zone-${z.id}`,
          paint: { "fill-color": z.color, "fill-opacity": z.fillOpacity ?? 0.15 },
        },
        "pois-circles"
      );
      map.addLayer(
        {
          id: `zone-line-${z.id}`,
          type: "line",
          source: `zone-${z.id}`,
          paint: { "line-color": z.color, "line-width": 1.5, "line-opacity": 0.7 },
        },
        "pois-circles"
      );
      zoneIdsRef.current.push(z.id);
    }
    if (fitToZones) {
      const b = collectBounds([...zonesRef.current, ...linesRef.current]);
      if (b) map.fitBounds(b, { padding: 40, animate: true, maxZoom: 15 });
    }
  }

  function applyLines() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const id of lineIdsRef.current) {
      if (map.getLayer(`line-${id}`)) map.removeLayer(`line-${id}`);
      if (map.getSource(`linesrc-${id}`)) map.removeSource(`linesrc-${id}`);
    }
    lineIdsRef.current = [];
    for (const l of linesRef.current) {
      map.addSource(`linesrc-${l.id}`, { type: "geojson", data: toFC(l.data) });
      map.addLayer(
        {
          id: `line-${l.id}`,
          type: "line",
          source: `linesrc-${l.id}`,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": l.color,
            "line-width": l.width ?? 4,
            "line-opacity": 0.9,
            ...(l.dashed ? { "line-dasharray": [1.5, 1.2] } : {}),
          },
        },
        "pois-circles"
      );
      lineIdsRef.current.push(l.id);
    }
    if (fitToZones && zonesRef.current.length === 0 && linesRef.current.length > 0) {
      const b = collectBounds(linesRef.current);
      if (b) map.fitBounds(b, { padding: 40, animate: true, maxZoom: 15 });
    }
  }

  function applyPois() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource("pois") as maplibregl.GeoJSONSource | undefined;
    const data = poisRef.current ?? EMPTY;
    // Farbe je Punkt bestimmen: erst poiColors-Map (cat->Farbe, isochrone-Muster),
    // sonst die am Feature gesetzte Farbe (DMO-Seiten setzen properties.color direkt),
    // sonst Blau. WICHTIG: die feature-eigene Farbe NICHT ueberschreiben.
    const colored: FeatureCollection = {
      type: "FeatureCollection",
      features: data.features.map((f) => {
        const p = (f.properties ?? {}) as { cat?: string; color?: string };
        return {
          ...f,
          properties: {
            ...f.properties,
            color: poiColorsRef.current[p.cat ?? ""] ?? p.color ?? "#0ea5e9",
          },
        };
      }),
    };
    src?.setData(colored as GeoJSON.GeoJSON);
  }

  useEffect(applyZones, [zones, fitToZones]);
  useEffect(applyLines, [lines, fitToZones]);
  useEffect(applyPois, [pois, poiColors]);

  // --- Marker ----------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markerRefs.current) m.remove();
    markerRefs.current = markers.map((m) =>
      new maplibregl.Marker({ color: m.color ?? "#dc2626" }).setLngLat([m.lng, m.lat]).addTo(map)
    );
  }, [markers]);

  // --- Center nachführen (ohne Zonen/Linien) ---------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || zonesRef.current.length > 0 || linesRef.current.length > 0) return;
    map.flyTo({ center, zoom, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  return <div ref={elRef} className={`w-full rounded-2xl ${heightClass}`} />;
}
