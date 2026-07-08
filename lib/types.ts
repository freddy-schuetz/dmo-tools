// Gemeinsame API-Kontrakte Frontend ↔ n8n (DMO-Tools). Basis: Standard-GeoJSON.

import type {
  Feature as GJFeature,
  FeatureCollection as GJFeatureCollection,
  Geometry,
} from "geojson";

export type LngLat = { lat: number; lng: number };
export type Feature<P extends Record<string, unknown> = Record<string, unknown>> = GJFeature<Geometry, P>;
export type FeatureCollection<P extends Record<string, unknown> = Record<string, unknown>> = GJFeatureCollection<Geometry, P>;

export type CheckStatus = "running" | "done" | "error" | "not_found";
export type StatusResponse<R> = {
  status: CheckStatus;
  tool?: string;
  result?: R;
  error_message?: string;
};

export type GeocodeHit = { label: string; lat: number; lng: number };

// --- 1 Destinations-Datencheck ---------------------------------------------
export type AttrStat = { key: string; label: string; filled: number; total: number; pct: number };
export type QuickWin = { issue: string; count: number; examples: string[] };
export type DatencheckResult = {
  address_resolved: string;
  center: LngLat;
  radius_km: number;
  poi_total: number;
  categories: { key: string; label: string; count: number }[];
  attributes: AttrStat[];
  score: number;
  quick_wins: QuickWin[];
  map_samples: FeatureCollection;
};

// --- 2 Lade-Lücken-Radar ----------------------------------------------------
export type GapCell = { lat: number; lng: number; dist_km: number; gap: boolean };
export type LadeLueckenResult = {
  address_resolved: string;
  center: LngLat;
  radius_km: number;
  grid: GapCell[];
  chargers: FeatureCollection;
  summary: { cells: number; gap_pct: number; worst_dist_km: number; charger_count: number };
};

// --- 3 Thementouren-Generator ----------------------------------------------
export type TourStop = { name: string; lat: number; lng: number; cat: string; order: number; has_wiki?: boolean };
export type ThementourResult = {
  start: LngLat;
  start_label: string;
  theme: string;
  stops: TourStop[];
  route: { geometry: Feature; distance_km: number; duration_min: number };
  roundtrip: boolean;
};

// --- 4 Genuss-Radar ---------------------------------------------------------
export type Producer = {
  id: string; name: string; type: string; lat: number; lng: number;
  distance_km: number; open_now: boolean | null; website: string | null;
};
export type GenussResult = { center: LngLat; producers: Producer[] };

// --- 5 Golden-Hour-Fotospot-Finder -----------------------------------------
export type PhotoSpot = {
  id: string; name: string; cat: string; lat: number; lng: number;
  distance_km: number; faces_sunset: boolean; elevation: number | null;
};
export type GoldenHourResult = {
  center: LngLat;
  date: string;
  sunset_time: string;
  sunrise_time: string;
  sunset_azimuth: number;
  cloud_cover_pct: number | null;
  spots: PhotoSpot[];
};

// --- 6 Naturwunder-Finder ---------------------------------------------------
export type Wonder = { id: string; name: string; type: string; lat: number; lng: number; distance_km: number; website: string | null };
export type NaturwunderResult = { center: LngLat; wonders: Wonder[] };

// --- 7 Schlechtwetter-Radar -------------------------------------------------
export type IndoorPoi = { id: string; name: string; cat: string; lat: number; lng: number; distance_km: number; open_now: boolean | null; website: string | null };
export type SchlechtwetterResult = {
  center: LngLat;
  weather: { temp: number; precipitation: number; rain_soon: boolean; recommendation: "indoor" | "outdoor"; summary: string };
  pois: IndoorPoi[];
};

// --- 8 Ruhe-Finder ----------------------------------------------------------
export type QuietSpot = { name: string; lat: number; lng: number; score: number; nearest_noise_km: number; type: string };
export type RuheResult = { center: LngLat; radius_km: number; quiet_spots: QuietSpot[] };

// --- 9 Geheimtipp-Radar -----------------------------------------------------
export type Hotspot = { name: string; lat: number; lng: number };
export type HiddenGem = { name: string; lat: number; lng: number; gem_score: number; distance_from_hotspot_km: number; why: string };
export type GeheimtippResult = { center: LngLat; category: string; hotspots: Hotspot[]; hidden_gems: HiddenGem[] };

// --- 10 Wildtier-Beobachtungs-Radar ----------------------------------------
export type WildlifeSpot = { id: string; name: string; type: string; lat: number; lng: number; distance_km: number; protected: boolean };
export type WildtierResult = { center: LngLat; radius_km: number; spots: WildlifeSpot[] };

// --- 11 Laden-&-Erleben -----------------------------------------------------
export type NearbyPoi = { name: string; cat: string; dist_m: number };
export type ChargeStation = {
  id: string; name: string; operator: string | null; lat: number; lng: number;
  max_kw: number | null; fast: boolean; connectors: string[]; nearby: NearbyPoi[];
};
export type LadenErlebenResult = { center: LngLat; stations: ChargeStation[] };

// --- 12 E-Auto-Tagesausflug-Check ------------------------------------------
export type EautoTrip = {
  name: string; lat: number; lng: number; drive_min: number; distance_km: number;
  charger: { name: string; max_kw: number | null; dist_m: number };
};
export type EautoAusflugResult = { center: LngLat; range_km: number; trips: EautoTrip[] };

// --- 13 Charge-&-Hike -------------------------------------------------------
export type ChargeHikeSpot = {
  id: string; name: string; lat: number; lng: number; distance_km: number;
  max_kw: number | null; fast: boolean; parking: string | null; trail_hint: string | null;
};
export type LadenWandernResult = { center: LngLat; spots: ChargeHikeSpot[] };
