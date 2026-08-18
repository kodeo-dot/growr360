import { NextResponse } from "next/server";
import { copernicusToken, unwrapGeometry } from "../../../../lib/copernicus";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const geometry = unwrapGeometry(payload.geometry);
    const token = await copernicusToken();
    const to = new Date();
    const from = new Date(to);
    from.setMonth(from.getMonth() - 6);
    const response = await fetch("https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ collections: ["sentinel-2-l2a"], intersects: geometry, datetime: `${from.toISOString()}/${to.toISOString()}`, limit: 200 }),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Copernicus no respondió correctamente (${response.status}).`);
    const data = await response.json() as { features?: Array<{ id: string; properties?: Record<string, unknown> }> };
    const byDay = new Map<string, { id: string; date: string; cloud: number; satellite: string }>();
    for (const item of data.features ?? []) {
      const date = String(item.properties?.datetime ?? "").slice(0, 10);
      const cloud = Number(item.properties?.["eo:cloud_cover"] ?? 100);
      if (!date || cloud >= 70) continue;
      const platform = String(item.properties?.platform ?? "Sentinel-2").replace(/sentinel-2a/i, "Sentinel-2A").replace(/sentinel-2b/i, "Sentinel-2B");
      const scene = { id: item.id, date, cloud, satellite: platform };
      if (!byDay.has(date) || (byDay.get(date)?.cloud ?? 101) > cloud) byDay.set(date, scene);
    }
    return NextResponse.json({ scenes: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron consultar las imágenes." }, { status: 500 });
  }
}
