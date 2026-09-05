import { planetInsightsToken, imageDimensions, satelliteEvalscript, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

type Thresholds = { low?: number; high?: number } | null;

function advancedEvalscript(index: string, thresholds?: Thresholds) {
  if (index === "SAVI") return `//VERSION=3
function setup(){return {input:["B04","B08","SCL","dataMask"],output:{bands:4}};}
function evaluatePixel(s){if(!s.dataMask||[1,3,8,9,10,11].includes(s.SCL))return [0,0,0,0];let v=1.5*(s.B08-s.B04)/(s.B08+s.B04+0.5);let c=colorBlend(v,[-0.1,0.1,0.3,0.5,0.7,0.9],[[0.35,0.22,0.10],[0.70,0.55,0.25],[0.88,0.78,0.25],[0.55,0.72,0.20],[0.18,0.55,0.18],[0.02,0.28,0.10]]);return [...c,1];}`;
  if (index === "EVI") return `//VERSION=3
function setup(){return {input:["B02","B04","B08","SCL","dataMask"],output:{bands:4}};}
function evaluatePixel(s){if(!s.dataMask||[1,3,8,9,10,11].includes(s.SCL))return [0,0,0,0];let d=s.B08+6*s.B04-7.5*s.B02+1;let v=d===0?0:2.5*(s.B08-s.B04)/d;let c=colorBlend(v,[-0.1,0.1,0.25,0.4,0.6,0.8],[[0.35,0.20,0.12],[0.72,0.50,0.20],[0.88,0.76,0.22],[0.55,0.72,0.18],[0.15,0.52,0.16],[0.01,0.26,0.08]]);return [...c,1];}`;
  if (index === "NDVI_CONTINUOUS") return `//VERSION=3
function setup(){return {input:["B04","B08","SCL","dataMask"],output:{bands:4}};}
function evaluatePixel(s){if(!s.dataMask||[1,3,8,9,10,11].includes(s.SCL))return [0,0,0,0];let d=s.B08+s.B04;let v=d===0?0:(s.B08-s.B04)/d;let c=colorBlend(v,[-0.2,0,0.2,0.4,0.6,0.8,1],[[0.50,0.28,0.13],[0.78,0.58,0.28],[0.90,0.80,0.31],[0.64,0.75,0.20],[0.31,0.62,0.15],[0.08,0.42,0.12],[0.01,0.23,0.08]]);return [...c,1];}`;
  if (index === "NDVI_3Z") {
    const low = Number.isFinite(Number(thresholds?.low)) ? Number(thresholds?.low) : 0.33;
    const high = Number.isFinite(Number(thresholds?.high)) ? Number(thresholds?.high) : 0.66;
    return `//VERSION=3
function setup(){return {input:["B04","B08","SCL","dataMask"],output:{bands:4}};}
function evaluatePixel(s){if(!s.dataMask||[1,3,8,9,10,11].includes(s.SCL))return [0,0,0,0];let d=s.B08+s.B04;let v=d===0?0:(s.B08-s.B04)/d;if(v<=${low})return [0.85,0.47,0.03,1];if(v<=${high})return [0.64,0.78,0.23,1];return [0.09,0.50,0.23,1];}`;
  }
  return satelliteEvalscript(index);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { geometry: Parameters<typeof unwrapGeometry>[0]; date: string; index?: string; thumbnail?: boolean; thresholds?: Thresholds };
    const geometry = unwrapGeometry(payload.geometry);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) throw new Error("La fecha satelital no es válida.");
    const token = await planetInsightsToken();
    const dimensions = imageDimensions(geometry, Boolean(payload.thumbnail));
    const response = await fetch("https://services.sentinel-hub.com/api/v1/process", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "image/png", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        input: { bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } }, data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: `${payload.date}T00:00:00Z`, to: `${payload.date}T23:59:59Z` }, mosaickingOrder: "leastCC" } }] },
        output: { ...dimensions, responses: [{ identifier: "default", format: { type: "image/png" } }] },
        evalscript: advancedEvalscript(payload.index ?? "NDVI", payload.thresholds)
      }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Planet Insights no pudo procesar esta fecha (${response.status}). ${(await response.text()).slice(0, 300)}`);
    return new Response(await response.arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar la imagen." }, { status: 500 });
  }
}
