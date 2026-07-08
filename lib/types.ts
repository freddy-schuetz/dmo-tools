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

// Angereicherte Wildtier-Art (GBIF)
export type Species = { name_de: string; name_sci?: string | null; count: number };

// Gemeinsame v2-Anreicherungsfelder, die die Tool-Backends je Spot mitliefern.
export type EnrichFields = {
  id?: string;
  description?: string | null; // Wikipedia-Kurztext
  ai_why?: string | null; // KI-Einordnung
  image?: string | null; // freies Bild (Wikipedia/Commons)
  wiki_url?: string | null; // Quelle
  open_now?: boolean | null;
  opening_hours?: string | null;
  website?: string | null;
  phone?: string | null;
  wheelchair?: string | null;
  cuisine?: string | null;
  fee?: string | null;
};

// Gemeinsame reiche POI-Karte (v2-Anreicherung): alle Tools mappen ihre Ergebnisse hierauf.
export type RichPoi = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  cat?: string;
  category_label?: string;
  emoji?: string;
  color?: string; // Kartenpunkt-Farbe
  distance_km?: number | null;
  meta_right?: string | null; // z.B. "22 Min" (Fahrzeit) statt Distanz
  description?: string | null; // Wikipedia-Kurztext
  ai_why?: string | null; // KI-Einordnung "warum lohnenswert"
  image?: string | null; // freie Quelle (Wikipedia/Commons)
  wiki_url?: string | null; // Quelle/Attribution
  open_now?: boolean | null;
  opening_hours?: string | null;
  website?: string | null;
  phone?: string | null;
  wheelchair?: string | null;
  cuisine?: string | null;
  fee?: string | null;
  badges?: string[]; // Extra-Chips, z.B. ["Schnelllader"]
  species?: Species[]; // nur Wildtier
};

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
  summary: { cells: number; gap_pct: number; worst_dist_km: number; charger_count: number; step_km?: number };
};

// --- 3 Thementouren-Generator ----------------------------------------------
export type TourStop = EnrichFields & { name: string; lat: number; lng: number; cat: string; order: number; has_wiki?: boolean };
export type ThementourResult = {
  start: LngLat;
  start_label: string;
  theme: string;
  stops: TourStop[];
  route: { geometry: Feature; distance_km: number; duration_min: number };
  roundtrip: boolean;
};

// --- 4 Genuss-Radar ---------------------------------------------------------
export type Producer = EnrichFields & {
  id: string; name: string; type: string; lat: number; lng: number;
  distance_km: number; open_now: boolean | null; website: string | null;
};
export type GenussResult = { center: LngLat; producers: Producer[] };

// --- 5 Golden-Hour-Fotospot-Finder -----------------------------------------
export type PhotoSpot = EnrichFields & {
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
export type Wonder = EnrichFields & { id: string; name: string; type: string; lat: number; lng: number; distance_km: number; website: string | null };
export type NaturwunderResult = { center: LngLat; wonders: Wonder[] };

// --- 7 Schlechtwetter-Radar -------------------------------------------------
export type IndoorPoi = EnrichFields & { id: string; name: string; cat: string; lat: number; lng: number; distance_km: number; open_now: boolean | null; website: string | null };
export type SchlechtwetterResult = {
  center: LngLat;
  weather: {
    temp: number; precipitation: number; rain_soon: boolean;
    recommendation: "indoor" | "outdoor"; summary: string;
    hours?: { t: string; prob: number }[];
  };
  pois: IndoorPoi[];
};

// --- 8 Ruhe-Finder ----------------------------------------------------------
export type QuietSpot = { id: string; name: string; lat: number; lng: number; score: number; nearest_noise_km: number; type: string };
export type RuheResult = { center: LngLat; radius_km: number; quiet_spots: QuietSpot[] };

// --- 9 Geheimtipp-Radar -----------------------------------------------------
export type Hotspot = { name: string; lat: number; lng: number };
export type HiddenGem = EnrichFields & { id: string; name: string; lat: number; lng: number; gem_score: number; distance_from_hotspot_km: number; why: string };
export type GeheimtippResult = { center: LngLat; category: string; hotspots: Hotspot[]; hidden_gems: HiddenGem[] };

// --- 10 Wildtier-Beobachtungs-Radar ----------------------------------------
export type WildlifeSpot = EnrichFields & { id: string; name: string; type: string; lat: number; lng: number; distance_km: number; protected: boolean; species?: Species[] };
export type WildtierResult = { center: LngLat; radius_km: number; region_species: Species[]; spots: WildlifeSpot[] };

// --- 11 Laden-&-Erleben -----------------------------------------------------
export type NearbyPoi = {
  id?: string; name: string; cat: string; emoji?: string; lat?: number; lng?: number; dist_m: number;
  description?: string | null; image?: string | null; wiki_url?: string | null; website?: string | null;
};
export type ChargeStation = {
  id: string; name: string; operator: string | null; lat: number; lng: number;
  max_kw: number | null; fast: boolean; connectors: string[]; nearby: NearbyPoi[];
};
export type LadenErlebenResult = { center: LngLat; stations: ChargeStation[] };

// --- 12 E-Auto-Tagesausflug-Check ------------------------------------------
export type EautoTrip = EnrichFields & {
  id?: string; name: string; lat: number; lng: number; drive_min: number; distance_km: number;
  charger: { name: string; max_kw: number | null; dist_m: number };
};
export type EautoAusflugResult = { center: LngLat; range_km: number; trips: EautoTrip[] };

// --- 13 Charge-&-Hike -------------------------------------------------------
export type ChargeHikeSpot = {
  id: string; name: string; lat: number; lng: number; distance_km: number;
  max_kw: number | null; fast: boolean; parking: string | null; trail_hint: string | null;
  trail_lat?: number; trail_lng?: number;
};
export type LadenWandernResult = { center: LngLat; spots: ChargeHikeSpot[] };
