// RainViewer — keyloser Regenradar. Liefert XYZ-Tile-URLs des jüngsten Radarbilds.
// Doku: api.rainviewer.com/public/weather-maps.json → host + radar.past[].path
export async function rainviewerTiles(): Promise<string[] | null> {
  try {
    const r = await fetch("https://api.rainviewer.com/public/weather-maps.json", { cache: "no-store" });
    const d = (await r.json()) as { host?: string; radar?: { past?: { path: string }[] } };
    const host = d.host;
    const past = d.radar?.past ?? [];
    const last = past.length ? past[past.length - 1].path : null;
    if (!host || !last) return null;
    // {host}{path}/{size}/{z}/{x}/{y}/{colorScheme}/{smooth_snow}.png — Schema 2 = Universal Blue
    return [`${host}${last}/256/{z}/{x}/{y}/2/1_1.png`];
  } catch {
    return null;
  }
}
