import { planetInsightsToken, imageDimensions, satelliteEvalscript, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

type Thresholds = { low?: number; high?: number; cuts?: number[] } | null;

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

  if (index === "NDVI_CONTRASTED") {
    const cuts = Array.isArray(thresholds?.cuts) && thresholds!.cuts!.length >= 4 ? thresholds!.cuts!.slice(0,4).map(Number) : [0.2,0.4,0.6,0.8];
    return `//VERSION=3
function setup(){return {input:["B04","B08","SCL","dataMask"],output:{bands:4}};}
function mix3(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}
function smooth(a,b,x){let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);}
function evaluatePixel(s){
  if(!s.dataMask||[1,3,8,9,10,11].includes(s.SCL))return [0,0,0,0];
  let d=s.B08+s.B04;let v=d===0?0:(s.B08-s.B04)/d;
  let c1=[0.78,0.35,0.10],c2=[0.85,0.65,0.18],c3=[0.72,0.79,0.24],c4=[0.34,0.66,0.27],c5=[0.09,0.44,0.23];
  // Mismos colores del NDVI 5 zonas; sólo una transición mínima en cada corte.
  let softness=0.006;let c;
  if(v<${cuts[0]}-softness)c=c1;
  else if(v<${cuts[0]}+softness)c=mix3(c1,c2,smooth(${cuts[0]}-softness,${cuts[0]}+softness,v));
  else if(v<${cuts[1]}-softness)c=c2;
  else if(v<${cuts[1]}+softness)c=mix3(c2,c3,smooth(${cuts[1]}-softness,${cuts[1]}+softness,v));
  else if(v<${cuts[2]}-softness)c=c3;
  else if(v<${cuts[2]}+softness)c=mix3(c3,c4,smooth(${cuts[2]}-softness,${cuts[2]}+softness,v));
  else if(v<${cuts[3]}-softness)c=c4;
  else if(v<${cuts[3]}+softness)c=mix3(c4,c5,smooth(${cuts[3]}-softness,${cuts[3]}+softness,v));
  else c=c5;
  return [c[0],c[1],c[2],1];
}`;
  }

  if (index === "NDVI_5Z") {
    const cuts = Array.isArray(thresholds?.cuts) && thresholds!.cuts!.length >= 4 ? thresholds!.cuts!.slice(0,4).map(Number) : [0.2,0.4,0.6,0.8];
    return `//VERSION=3
function setup(){return {input:["B04","B08","SCL","dataMask"],output:{bands:4}};}
function evaluatePixel(s){if(!s.dataMask||[1,3,8,9,10,11].includes(s.SCL))return [0,0,0,0];let d=s.B08+s.B04;let v=d===0?0:(s.B08-s.B04)/d;if(v<=${cuts[0]})return [0.78,0.35,0.10,1];if(v<=${cuts[1]})return [0.85,0.65,0.18,1];if(v<=${cuts[2]})return [0.72,0.79,0.24,1];if(v<=${cuts[3]})return [0.34,0.66,0.27,1];return [0.09,0.44,0.23,1];}`;
  }
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
