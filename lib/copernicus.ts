type GeoJsonGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: unknown;
};

type FeatureInput = { geometry?: GeoJsonGeometry } | GeoJsonGeometry;

let cachedToken: { value: string; expiresAt: number } | null = null;

function credentials() {
  const clientId = process.env.COPERNICUS_CLIENT_ID ?? process.env.SENTINEL_HUB_CLIENT_ID;
  const clientSecret = process.env.COPERNICUS_CLIENT_SECRET ?? process.env.SENTINEL_HUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Copernicus todavía no está configurado en el servidor.");
  return { clientId, clientSecret };
}

export function unwrapGeometry(input: FeatureInput): GeoJsonGeometry {
  const candidate = ("geometry" in input && input.geometry ? input.geometry : input) as GeoJsonGeometry;
  if (candidate.type !== "Polygon" && candidate.type !== "MultiPolygon") throw new Error("El lote no posee un polígono válido.");
  return candidate;
}

export async function copernicusToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { clientId, clientSecret } = credentials();
  const response = await fetch("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`No se pudo autenticar con Copernicus (${response.status}).`);
  const payload = await response.json() as { access_token?: string; expires_in?: number };
  if (!payload.access_token) throw new Error("Copernicus no devolvió un token válido.");
  cachedToken = { value: payload.access_token, expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 600) * 1000 };
  return cachedToken.value;
}

export function satelliteEvalscript(index: string) {
  if (index === "RGB") return `//VERSION=3
function setup(){return{input:["B02","B03","B04","dataMask"],output:{bands:4}}}
function evaluatePixel(s){return[2.5*s.B04,2.5*s.B03,2.5*s.B02,s.dataMask]}`;
  if (index === "FALSE_COLOR") return `//VERSION=3
function setup(){return{input:["B03","B04","B08","dataMask"],output:{bands:4}}}
function evaluatePixel(s){return[2.5*s.B08,2.5*s.B04,2.5*s.B03,s.dataMask]}`;
  const expression = index === "NDRE" ? "(s.B08-s.B05)/(s.B08+s.B05)" : "(s.B08-s.B04)/(s.B08+s.B04)";
  const color = index === "NDVI_CONTRASTED"
    ? "let v=Math.max(0,Math.min(1,(x-.15)/.55));return v<.25?[.72+1.12*v,.03+.52*v,.12,s.dataMask]:v<.5?[1,.16+2.9*(v-.25),.04,s.dataMask]:v<.75?[1-3.15*(v-.5),.93+.2*(v-.5),.03,s.dataMask]:[.08,.98-1.4*(v-.75),.25+.92*(v-.75),s.dataMask];"
    : "let v=Math.max(0,Math.min(1,x));return v<.5?[.8+.4*v,2*v,.05,s.dataMask]:[1.8-1.6*v,1,.05,s.dataMask];";
  return `//VERSION=3
function setup(){return{input:["B04","B05","B08","SCL","dataMask"],output:{bands:4}}}
function evaluatePixel(s){if([0,1,3,8,9,10,11].includes(s.SCL))return[0,0,0,0];let x=${expression};${color}}`;
}

export function imageDimensions(geometry: GeoJsonGeometry, thumbnail: boolean) {
  const rings = geometry.type === "Polygon" ? geometry.coordinates as number[][][] : (geometry.coordinates as number[][][][]).flat();
  const points = rings.flat();
  if (!points.length) throw new Error("El lote no posee coordenadas para consultar.");
  const west = Math.min(...points.map(point => point[0]));
  const east = Math.max(...points.map(point => point[0]));
  const south = Math.min(...points.map(point => point[1]));
  const north = Math.max(...points.map(point => point[1]));
  const width = thumbnail ? 240 : 900;
  const rawHeight = Math.round(width * Math.abs(north - south) / Math.max(.0001, Math.abs(east - west)));
  return { width, height: Math.max(thumbnail ? 120 : 360, Math.min(thumbnail ? 240 : 1200, rawHeight)) };
}
