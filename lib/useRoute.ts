"use client";

import { useCallback, useState } from "react";
import type { Feature, LngLat } from "./types";

export type RouteMode = "foot" | "bike" | "car";
export type RouteState = {
  poiId: string;
  geometry: Feature;
  distance_km: number;
  duration_min: number;
  mode: RouteMode;
} | null;

// Holt eine Route (Origin -> Spot) vom /api/route-Proxy und hält den aktiven Spot.
// Erneuter Klick auf denselben Spot blendet die Route wieder aus (Toggle).
export function useRoute(origin: LngLat | null | undefined, mode: RouteMode = "foot") {
  const [route, setRoute] = useState<RouteState>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggle = useCallback(
    async (poi: { id: string; lat: number; lng: number }) => {
      if (route?.poiId === poi.id) {
        setRoute(null);
        return;
      }
      if (!origin) return;
      setLoadingId(poi.id);
      try {
        const url = `/api/route?from=${origin.lat},${origin.lng}&to=${poi.lat},${poi.lng}&mode=${mode}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (data?.ok && data.geometry) {
          setRoute({
            poiId: poi.id,
            geometry: data.geometry as Feature,
            distance_km: data.distance_km,
            duration_min: data.duration_min,
            mode,
          });
        }
      } catch {
        // stiller Fehler: keine Route, Deep-Links bleiben verfügbar
      } finally {
        setLoadingId(null);
      }
    },
    [origin, mode, route?.poiId]
  );

  const clear = useCallback(() => setRoute(null), []);
  return { route, loadingId, toggle, clear };
}
