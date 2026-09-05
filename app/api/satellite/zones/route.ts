import { NextResponse } from "next/server";
import { planetInsightsToken, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

// Statistical API requires every output to be declared explicitly. Keeping NDVI
// as its own output also makes the response shape deterministic:
// outputs.ndvi.bands.B0.stats.
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

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { geometry: Parameters<typeof unwrapGeometry>[0]; date: string };
    const geometry = unwrapGeometry(payload.geometry);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) throw new Error("La fecha satelital no es válida.");

    const token = await planetInsightsToken();
    const response = await fetch("https://services.sentinel-hub.com/api/v1/statistics", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        input: {
          bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } },
          data: [{
            type: "sentinel-2-l2a",
            dataFilter: {
              timeRange: { from: `${payload.date}T00:00:00Z`, to: nextUtcDay(payload.date) },
              mosaickingOrder: "leastCC"
            }
          }]
        },
        aggregation: {
          timeRange: { from: `${payload.date}T00:00:00Z`, to: nextUtcDay(payload.date) },
          aggregationInterval: { of: "P1D" },
          evalscript: NDVI_STATS_EVALSCRIPT,
          resx: 10,
          resy: 10
        },
        calculations: {
          ndvi: { statistics: { B0: { percentiles: { k: [33, 67] } } } }
        }
      }),
      cache: "no-store"
    });

    const raw = await response.text();
    if (!response.ok) throw new Error(`No se pudieron calcular las zonas NDVI (${response.status}). ${raw.slice(0, 260)}`);

    let data: any;
    try { data = JSON.parse(raw); }
    catch { throw new Error("El servicio satelital devolvió una respuesta inválida al calcular las zonas."); }

    // Sentinel Hub can return HTTP 200 while an interval itself contains an error.
    const interval = (data?.data ?? []).find((entry: any) => entry?.outputs?.ndvi?.bands?.B0?.stats) ?? data?.data?.[0];
    if (interval?.error) {
      const detail = String(interval.error?.message ?? interval.error?.type ?? "Error desconocido");
      throw new Error(`No se pudieron analizar los píxeles NDVI de esta fecha. ${detail.slice(0, 220)}`);
    }

    const stats = (interval?.outputs?.ndvi?.bands?.B0?.stats ?? {}) as Stats;
    const sampleCount = finite(stats.sampleCount) ?? 0;
    const noDataCount = finite(stats.noDataCount) ?? 0;
    const validPixels = Math.max(0, sampleCount - noDataCount);
    const percentiles = percentileValues(stats);

    let low = percentiles.find(item => item.percentile >= 32 && item.percentile <= 34)?.value ?? percentiles[0]?.value ?? null;
    let high = percentiles.find(item => item.percentile >= 66 && item.percentile <= 68)?.value ?? percentiles[1]?.value ?? null;
    const min = finite(stats.min);
    const max = finite(stats.max);

    // Defensive fallback: older/proxy Stats responses can omit requested percentiles
    // while still returning valid min/max statistics. In that case we can still render
    // three deterministic NDVI environments instead of failing the whole feature.
    if ((low === null || high === null) && min !== null && max !== null && max > min && validPixels >= 3) {
      const span = max - min;
      low = min + span / 3;
      high = min + (span * 2) / 3;
    }

    if (low === null || high === null || !(high > low)) {
      if (validPixels < 3) {
        throw new Error(`Esta escena tiene muy pocos píxeles despejados dentro del lote (${validPixels}). Probá otra fecha con menos nubes.`);
      }
      throw new Error("No hubo suficiente variación de NDVI dentro del lote para formar 3 zonas distintas en esta fecha.");
    }

    return NextResponse.json({
      low,
      high,
      min,
      max,
      validPixels,
      geometryPixels: finite(data?.geometryPixelCount),
      method: percentiles.length >= 2 ? "ndvi_quantiles_33_67" : "ndvi_equal_range_fallback"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron calcular las zonas NDVI." }, { status: 500 });
  }
}
