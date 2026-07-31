import { mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDirectory = join(process.cwd(), "dist");
const serverDirectory = join(outputDirectory, "server");
const metadataDirectory = join(outputDirectory, ".openai");
const assetsDirectory = join(outputDirectory, "assets");

await mkdir(serverDirectory, { recursive: true });
await mkdir(metadataDirectory, { recursive: true });
await mkdir(assetsDirectory, { recursive: true });

for (const entry of await readdir(outputDirectory)) {
  if (entry === "assets" || entry === "server" || entry === ".openai") continue;
  await rename(join(outputDirectory, entry), join(assetsDirectory, entry));
}

await writeFile(
  join(serverDirectory, "index.js"),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/satellite/scenes" && request.method === "POST") {
      try {
        const { geometry } = await request.json();
        const token = await sentinelToken(env);
        const to = new Date();
        const from = new Date(to); from.setMonth(from.getMonth() - 6);
        const response = await fetch("https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search", {
          method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token },
          body: JSON.stringify({ collections: ["sentinel-2-l2a"], intersects: geometry.geometry, datetime: from.toISOString() + "/" + to.toISOString(), limit: 100 })
        });
        if (!response.ok) throw new Error("Copernicus no respondió correctamente.");
        const data = await response.json();
        const days = new Map();
        for (const item of data.features || []) {
          const date = String(item.properties?.datetime || "").slice(0, 10);
          const cloud = Number(item.properties?.["eo:cloud_cover"] ?? 100);
          if (!date || cloud > 70) continue;
          const scene = { id: item.id, date, cloud, satellite: String(item.properties?.platform || "Sentinel-2").replace("sentinel", "Sentinel") };
          if (!days.has(date) || days.get(date).cloud > cloud) days.set(date, scene);
        }
        const scenes = [...days.values()].sort((a,b) => b.date.localeCompare(a.date));
        return Response.json({ scenes });
      } catch (error) { return Response.json({ error: error.message || "No se pudieron consultar las imágenes." }, { status: 500 }); }
    }
    if (url.pathname === "/api/satellite/image" && request.method === "POST") {
      try {
        const { geometry, date, index, thumbnail } = await request.json();
        const token = await sentinelToken(env);
        const points = geometry.geometry.coordinates[0];
        const west = Math.min(...points.map(p => p[0])), east = Math.max(...points.map(p => p[0]));
        const south = Math.min(...points.map(p => p[1])), north = Math.max(...points.map(p => p[1]));
        const evalscript = satelliteEvalscript(index);
        const body = {
          input: { bounds: { geometry: geometry.geometry, properties: { crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84" } }, data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: date + "T00:00:00Z", to: date + "T23:59:59Z" }, mosaickingOrder: "leastCC" } }] },
          output: { width: thumbnail ? 220 : 768, height: thumbnail ? 140 : Math.max(320, Math.round(768 * Math.abs(north-south) / Math.max(.0001, Math.abs(east-west)))), responses: [{ identifier: "default", format: { type: "image/png" } }] },
          evalscript
        };
        const response = await fetch("https://services.sentinel-hub.com/api/v1/process", { method: "POST", headers: { "content-type": "application/json", accept: "image/png", authorization: "Bearer " + token }, body: JSON.stringify(body) });
        if (!response.ok) throw new Error("No se pudo procesar esta fecha de Sentinel-2.");
        return new Response(response.body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
      } catch (error) { return Response.json({ error: error.message || "No se pudo generar la imagen." }, { status: 500 }); }
    }
    if (url.pathname === "/") {
      url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || url.pathname.includes(".")) return response;

    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  }
};

async function sentinelToken(env) {
  if (!env.SENTINEL_HUB_CLIENT_ID || !env.SENTINEL_HUB_CLIENT_SECRET) throw new Error("El servicio Sentinel-2 todavía no está configurado en la web.");
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: env.SENTINEL_HUB_CLIENT_ID, client_secret: env.SENTINEL_HUB_CLIENT_SECRET });
  const response = await fetch("https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
  if (!response.ok) throw new Error("No se pudo autenticar con Copernicus.");
  return (await response.json()).access_token;
}

function satelliteEvalscript(index) {
  const expression = index === "NDRE" ? "(s.B08-s.B05)/(s.B08+s.B05)" : "(s.B08-s.B04)/(s.B08+s.B04)";
  const color = index === "NDVI_CONTRASTED"
    ? "let v=Math.max(0,Math.min(1,(x-.15)/.55)); return v<.5?[1,v*2,.05,s.dataMask]:[2-2*v,1,.05,s.dataMask];"
    : "let v=Math.max(0,Math.min(1,x)); return v<.5?[.8+.4*v,2*v,.05,s.dataMask]:[1.8-1.6*v,1,.05,s.dataMask];";
  if (index === "RGB") return \`//VERSION=3
function setup(){return{input:["B02","B03","B04","dataMask"],output:{bands:4}}}
function evaluatePixel(s){return[2.5*s.B04,2.5*s.B03,2.5*s.B02,s.dataMask]}\`;
  if (index === "FALSE_COLOR") return \`//VERSION=3
function setup(){return{input:["B03","B04","B08","dataMask"],output:{bands:4}}}
function evaluatePixel(s){return[2.5*s.B08,2.5*s.B04,2.5*s.B03,s.dataMask]}\`;
  return \`//VERSION=3
function setup(){return{input:["B04","B05","B08","SCL","dataMask"],output:{bands:4}}}
function evaluatePixel(s){if([3,8,9,10,11].includes(s.SCL))return[0,0,0,0];let x=\${expression};\${color}}\`;
}
`,
  "utf8"
);

await writeFile(
  join(metadataDirectory, "hosting.json"),
  JSON.stringify(
    {
      project_id: "appgprj_6a6bba2d6660819196271b906b720cc9"
    },
    null,
    2
  ),
  "utf8"
);
