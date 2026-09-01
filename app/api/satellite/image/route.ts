import { copernicusToken, imageDimensions, satelliteEvalscript, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { geometry: Parameters<typeof unwrapGeometry>[0]; date: string; index?: string; thumbnail?: boolean };
    const geometry = unwrapGeometry(payload.geometry);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date ?? "")) throw new Error("La fecha satelital no es válida.");
    const token = await copernicusToken();
    const dimensions = imageDimensions(geometry, Boolean(payload.thumbnail));
    const response = await fetch("https://sh.dataspace.copernicus.eu/process/v1", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "image/png", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        input: { bounds: { geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } }, data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: `${payload.date}T00:00:00Z`, to: `${payload.date}T23:59:59Z` }, mosaickingOrder: "leastCC" } }] },
        output: { ...dimensions, responses: [{ identifier: "default", format: { type: "image/png" } }] },
        evalscript: satelliteEvalscript(payload.index ?? "NDVI")
      }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Copernicus no pudo procesar esta fecha (${response.status}). ${(await response.text()).slice(0, 300)}`);
    return new Response(await response.arrayBuffer(), { headers: { "content-type": "image/png", "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "No se pudo generar la imagen." }, { status: 500 });
  }
}
