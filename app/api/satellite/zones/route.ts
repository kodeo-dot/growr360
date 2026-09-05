import { NextResponse } from "next/server";
import { planetInsightsToken, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

const NDVI_STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}
function evaluatePixel(s) {
  const cloudOrInvalid = [0, 1, 3, 8, 9, 10, 11].includes(s.SCL);
  const valid = Boolean(s.dataMask) && !cloudOrInvalid;
  const den = s.B08 + s.B04;
  const ndvi = den === 0 ? 0 : (s.B08 - s.B04) / den;
  return { ndvi: [ndvi], dataMask: [valid ? 1 : 0] };
}`;

type Stats = {
  min?: number;
  max?: number;
  mean?: number;
  stDev?: number;
  sampleCount?: number;
  noDataCount?: number;
  percentiles?: Record<string, number>;
};

type Geometry = ReturnType<typeof unwrapGeometry>;

function nextUtcDay(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString();
}

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function percentileValues(stats: Stats) {
  return Object.entries(stats.percentiles ?? {})
    .map(([key, value]) => ({ percentile: Number(key), value: finite(value) }))
    .filter((entry): entry is { percentile: number; value: number } => Number.isFinite(entry.percentile) && entry.value !== null)
    .sort((a, b) => a.percentile - b.percentile);
}

function ringsOf(geometry: any): number[][][] {
  if (geometry?.type === "Polygon") return geometry.coordinates ?? [];
  if (geometry?.type === "MultiPolygon") return (geometry.coordinates ?? []).flat();
  return [];
}

// Fast local-area approximation, accurate enough for agricultural parcels.
function geometryAreaHa(geometry: Geometry) {
  const rings = ringsOf(geometry);
  if (!rings.length) return 0;
  const all = rings.flat();
  const lat0 = all.reduce((sum, point) => sum + Number(point?.[1] ?? 0), 0) / Math.max(1, all.length);
  const metersPerLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const metersPerLat = 110540;
  const ringArea = (ring: number[][]) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const ax = Number(a?.[0] ?? 0) * metersPerLon;
      const ay = Number(a?.[1] ?? 0) * metersPerLat;
      const bx = Number(b?.[0] ?? 0) * metersPerLon;
      const by = Number(b?.[1] ?? 0) * metersPerLat;
      sum += ax * by - bx * ay;
    }
    return Math.abs(sum) / 2;
  };
  // Treat first ring of each polygon as outer; holes are uncommon in farm lots.
  const squareMeters = ringArea(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
  return Math.max(0, squareMeters / 10000);
}

function zoneMaskEvalscript(cuts: number[]) {
  const outputs = cuts.map((_, index) => `{ id: "z${index + 1}", bands: 1, sampleType: "UINT8" }`).concat(`{ id: "z${cuts.length + 1}", bands: 1, sampleType: "UINT8" }`);
  const checks = cuts.map((cut, index) => `if(v<=${cut}) z=${index};`).join(" else ");
  const returns = Array.from({ length: cuts.length + 1 }, (_, index) => `z${index + 1}: [z===${index}?1:0]`).join(", ");
  return `//VERSION=3
function setup(){return {input:[{bands:["B04","B08","SCL","dataMask"]}],output:[${outputs.join(",")},{id:"dataMask",bands:1,sampleType:"UINT8"}]};}
function evaluatePixel(s){const invalid=[0,1,3,8,9,10,11].includes(s.SCL)||!s.dataMask;let d=s.B08+s.B04;let v=d===0?0:(s.B08-s.B04)/d;let z=${cuts.length};${checks};return {${returns},dataMask:[invalid?0:1]};}`;
}

async function requestStats(token: string, geometry: Geometry, date: string, percentiles: number[]) {
  const response = await fetch("https://services.sentinel-hub.com/api/v1/statistics", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      input: {
        bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
        data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: `${date}T00:00:00Z`, to: nextUtcDay(date) }, mosaickingOrder: "leastCC" } }]
      },
      aggregation: {
        timeRange: { from: `${date}T00:00:00Z`, to: nextUtcDay(date) },
        aggregationInterval: { of: "P1D" },
        evalscript: NDVI_STATS_EVALSCRIPT,
        resx: 0.00009,
        resy: 0.00009
      },
      calculations: { ndvi: { statistics: { B0: { percentiles: { k: percentiles } } } } }
    }),
    cache: "no-store"
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`No se pudieron calcular las zonas NDVI (${response.status}). ${raw.slice(0, 260)}`);
  try { return JSON.parse(raw); } catch { throw new Error("El servicio satelital devolvió una respuesta inválida al calcular las zonas."); }
}

async function requestZoneShares(token: string, geometry: Geometry, date: string, cuts: number[]) {
  const calculations = Object.fromEntries(Array.from({ length: cuts.length + 1 }, (_, i) => [`z${i + 1}`, { statistics: { B0: {} } }]));
  const response = await fetch("https://services.sentinel-hub.com/api/v1/statistics", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      input: {
        bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
        data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: `${date}T00:00:00Z`, to: nextUtcDay(date) }, mosaickingOrder: "leastCC" } }]
      },
      aggregation: {
        timeRange: { from: `${date}T00:00:00Z`, to: nextUtcDay(date) },
        aggregationInterval: { of: "P1D" },
        evalscript: zoneMaskEvalscript(cuts),
        resx: 0.00009,
        resy: 0.00009
      },
      calculations
    }),
    cache: "no-store"
  });
  const raw = await response.text();
  if (!response.ok) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { geometry: Parameters<typeof unwrapGeometry>[0]; date: string; zoneCount?: 3 | 5 };
    const geometry = unwrapGeometry(payload.geometry);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) throw new Error("La fecha satelital no es válida.");
    const zoneCount = payload.zoneCount === 5 ? 5 : 3;
    const requestedPercentiles = zoneCount === 5 ? [20, 40, 60, 80] : [33, 67];

    const token = await planetInsightsToken();
    const data = await requestStats(token, geometry, payload.date, requestedPercentiles);
    const interval = (data?.data ?? []).find((entry: any) => entry?.outputs?.ndvi?.bands?.B0?.stats) ?? data?.data?.[0];
    if (interval?.error) {
      const detail = String(interval.error?.message ?? interval.error?.type ?? "Error desconocido");
      throw new Error(`No se pudieron analizar los píxeles NDVI de esta fecha. ${detail.slice(0, 220)}`);
    }

    const stats = (interval?.outputs?.ndvi?.bands?.B0?.stats ?? {}) as Stats;
    const sampleCount = finite(stats.sampleCount) ?? 0;
    const noDataCount = finite(stats.noDataCount) ?? 0;
    // sampleCount covers the whole request bounding box. noDataCount also includes
    // pixels outside the parcel geometry, so sampleCount - noDataCount is the
    // number of valid NDVI pixels but sampleCount is NOT the right denominator
    // for parcel coverage. Sentinel Hub exposes geometryPixelCount specifically
    // for the number of raster pixels intersecting the requested geometry.
    const geometryPixelCount = finite(data?.geometryPixelCount) ?? 0;
    const validPixels = Math.max(0, sampleCount - noDataCount);
    const percentileRows = percentileValues(stats);
    const min = finite(stats.min);
    const max = finite(stats.max);

    if (validPixels < zoneCount) {
      throw new Error(`Esta escena tiene muy pocos píxeles despejados dentro del lote (${validPixels}). Probá otra fecha con menos nubes.`);
    }

    let cuts = requestedPercentiles.map(target => percentileRows.find(item => Math.abs(item.percentile - target) <= 2)?.value ?? null);
    if (cuts.some(value => value === null) && min !== null && max !== null && max > min) {
      const span = max - min;
      cuts = Array.from({ length: zoneCount - 1 }, (_, i) => min + span * ((i + 1) / zoneCount));
    }
    if (cuts.some(value => value === null)) throw new Error(`No se pudieron obtener los cortes necesarios para dividir el lote en ${zoneCount} zonas.`);
    const numericCuts = cuts.map(Number);
    if (numericCuts.some((value, index) => index > 0 && value <= numericCuts[index - 1])) {
      throw new Error(`No hubo suficiente variación de NDVI dentro del lote para formar ${zoneCount} zonas distintas en esta fecha.`);
    }

    const plotAreaHa = geometryAreaHa(geometry);
    // Coverage must be relative to pixels that actually intersect the lot.
    // Using sampleCount here underestimates irregular/diagonal lots because it
    // includes the empty corners of their bounding box as no-data.
    const coverageDenominator = geometryPixelCount > 0 ? geometryPixelCount : validPixels;
    const clearFraction = coverageDenominator > 0 ? Math.min(1, Math.max(0, validPixels / coverageDenominator)) : 1;
    const clearAreaHa = plotAreaHa * clearFraction;
    const zoneStatsData = await requestZoneShares(token, geometry, payload.date, numericCuts);
    const zoneInterval = (zoneStatsData?.data ?? []).find((entry: any) => entry?.outputs) ?? zoneStatsData?.data?.[0];
    let shares = Array.from({ length: zoneCount }, () => 1 / zoneCount);
    if (zoneInterval?.outputs) {
      const rawShares = Array.from({ length: zoneCount }, (_, i) => finite(zoneInterval?.outputs?.[`z${i + 1}`]?.bands?.B0?.stats?.mean) ?? 0);
      const totalShare = rawShares.reduce((sum, value) => sum + value, 0);
      if (totalShare > 0) shares = rawShares.map(value => value / totalShare);
    }

    const colors = zoneCount === 5 ? ["#c65a1e", "#d9a62e", "#b8c93e", "#65a844", "#16713b"] : ["#d97706", "#a3c63a", "#16803a"];
    const labels = zoneCount === 5 ? ["Muy baja", "Baja", "Media", "Alta", "Muy alta"] : ["Baja", "Media", "Alta"];
    const zones = shares.map((share, index) => ({
      index: index + 1,
      label: labels[index],
      min: index === 0 ? min : numericCuts[index - 1],
      max: index === zoneCount - 1 ? max : numericCuts[index],
      areaHa: clearAreaHa * share,
      share: share * 100,
      color: colors[index]
    }));

    return NextResponse.json({
      zoneCount,
      cuts: numericCuts,
      low: numericCuts[0],
      high: numericCuts[numericCuts.length - 1],
      min,
      max,
      validPixels,
      geometryPixelCount,
      plotAreaHa,
      clearAreaHa,
      clearCoverage: plotAreaHa > 0 ? (clearAreaHa / plotAreaHa) * 100 : 100,
      zones,
      method: percentileRows.length >= requestedPercentiles.length ? `ndvi_quantiles_${requestedPercentiles.join("_")}` : "ndvi_equal_range_fallback"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron calcular las zonas NDVI." }, { status: 500 });
  }
}
