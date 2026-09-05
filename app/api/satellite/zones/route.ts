import { NextResponse } from "next/server";
import { planetInsightsToken, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

const NDVI_STATS_EVALSCRIPT = `//VERSION=3
function setup(){return {input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"default",bands:[{id:"ndvi",sampleType:"FLOAT32"}]},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){
  const cloud=[1,3,8,9,10,11].includes(s.SCL);
  const valid=s.dataMask && !cloud;
  const den=s.B08+s.B04;
  const ndvi=den===0?0:(s.B08-s.B04)/den;
  return {default:[ndvi],dataMask:[valid?1:0]};
}`;

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
        input: { bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } }, data: [{ type: "sentinel-2-l2a", dataFilter: { mosaickingOrder: "leastCC" } }] },
        aggregation: { timeRange: { from: `${payload.date}T00:00:00Z`, to: `${payload.date}T23:59:59Z` }, aggregationInterval: { of: "P1D" }, evalscript: NDVI_STATS_EVALSCRIPT, resx: 10, resy: 10 },
        calculations: { default: { statistics: { ndvi: { percentiles: { k: [33.333, 66.667] } } } } }
      }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`No se pudieron calcular las zonas NDVI (${response.status}). ${(await response.text()).slice(0, 240)}`);
    const data = await response.json() as any;
    const band = data?.data?.[0]?.outputs?.default?.bands?.ndvi;
    const stats = band?.stats ?? {};
    const percentiles = stats.percentiles ?? {};
    const ordered = Object.entries(percentiles).map(([key,value]) => [Number(key),Number(value)] as const).filter(([,value]) => Number.isFinite(value)).sort((a,b)=>a[0]-b[0]);
    const low = ordered[0]?.[1];
    const high = ordered[1]?.[1];
    if (!Number.isFinite(low) || !Number.isFinite(high)) throw new Error("La imagen no tiene suficientes píxeles válidos para dividir el lote en 3 zonas.");
    return NextResponse.json({ low, high, min: Number(stats.min), max: Number(stats.max), method: "ndvi_quantiles_33_67" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron calcular las zonas NDVI." }, { status: 500 });
  }
}
