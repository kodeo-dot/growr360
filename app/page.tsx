"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import maplibregl, { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleUserRound, FileText, Filter, Grid2X2, Layers3, Leaf, LoaderCircle, LogOut,
  Map, MapPin, Menu, Plus, RotateCcw, Save, Search, Settings2, Sprout, Tractor,
  TrendingUp, Undo2, Users, X
} from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://emwfdcekpxwzvnidwdls.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_waHR1lcMgPHyP32KlyBcEw_uAL6n6-g";

type View = "mapa" | "campos" | "registros" | "reportes" | "equipo";
type Group = { id: string; name: string; description?: string | null };
type Membership = { group_id: string; role: string; status: string; groups: Group | Group[] | null };
type Profile = { id: string; first_name: string; last_name: string; username: string; email: string };
type Field = { id: string; group_id: string; name: string; total_area: number | string; arable_area: number | string; locality?: string | null; province?: string | null };
type Plot = {
  id: string; group_id: string; field_id: string; name: string; total_area: number | string;
  arable_area: number | string; geometry_json: GeoFeature | string | null; priority_color?: string | null;
  fields?: { name: string } | { name: string }[] | null; allow_member_edits?: boolean;
};
type RecordRow = {
  id: string; record_type: string; record_date: string; worked_area?: number | string | null;
  field_id?: string | null; plot_id?: string | null; fields?: { name: string } | null;
  plots?: { name: string } | null; campaigns?: { name: string } | null;
};
type Member = { user_id: string; role: string; status: string; profiles?: Profile | null };
type GeoFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties?: Record<string, unknown>;
};
type MapPlot = Plot & { feature: GeoFeature; fieldName: string };

const nav = [
  { id: "mapa" as View, label: "Mapa", icon: Map },
  { id: "campos" as View, label: "Campos", icon: Sprout },
  { id: "registros" as View, label: "Registros", icon: FileText },
  { id: "reportes" as View, label: "Reportes", icon: TrendingUp },
  { id: "equipo" as View, label: "Equipo", icon: Users }
];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function geometry(value: Plot["geometry_json"]): GeoFeature | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed?.geometry?.type === "Polygon" ? parsed as GeoFeature : null;
  } catch {
    return null;
  }
}

function number(value: number | string | null | undefined) {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function GrowrWeb() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (loadingSession) return <LoadingScreen text="Preparando Growr360…"/>;
  if (!session) return <AuthScreen client={supabase}/>;
  return <AuthenticatedApp session={session}/>;
}

function AuthScreen({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
    setBusy(false);
  }

  return <div className="auth-page">
    <div className="auth-glow"/>
    <form className="auth-card" onSubmit={login}>
      <Brand/>
      <div className="auth-copy"><span>PLATAFORMA WEB</span><h1>Tu operación agrícola, en una sola vista.</h1><p>Ingresá con la misma cuenta que utilizás en la aplicación móvil.</p></div>
      <label>Correo electrónico<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@empresa.com"/></label>
      <label>Contraseña<input type="password" required minLength={6} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••"/></label>
      {message && <p className="form-error">{message}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <CircleUserRound/>}{busy ? "Ingresando…" : "Ingresar a Growr360"}</button>
      <small>Las altas de usuario y recuperación de acceso continúan disponibles desde la app móvil.</small>
    </form>
  </div>;
}

function AuthenticatedApp({ session }: { session: Session }) {
  const [view, setView] = useState<View>("mapa");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [groupId, setGroupId] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);

  const group = memberships.map(m => relation(m.groups)).find(g => g?.id === groupId) ?? null;
  const selectedPlot = plots.find(plot => plot.id === selectedPlotId) ?? null;
  const activeMembership = memberships.find(m => m.group_id === groupId);

  const loadWorkspace = useCallback(async (requestedGroup?: string, quiet = false) => {
    if (!quiet) setLoading(true); else setSyncing(true);
    setError("");
    const userId = session.user.id;
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("id,first_name,last_name,username,email").eq("id", userId).single(),
      supabase.from("group_members").select("group_id,role,status,groups(id,name,description)").eq("user_id", userId).eq("status", "active").order("created_at")
    ]);
    if (profileResult.data) setProfile(profileResult.data as Profile);
    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setLoading(false); setSyncing(false); return;
    }
    const rows = (membershipResult.data ?? []) as unknown as Membership[];
    setMemberships(rows);
    const stored = localStorage.getItem("growr360-web-group");
    const nextGroup = requestedGroup && rows.some(m => m.group_id === requestedGroup)
      ? requestedGroup
      : stored && rows.some(m => m.group_id === stored) ? stored : rows[0]?.group_id ?? "";
    setGroupId(nextGroup);
    if (!nextGroup) {
      setFields([]); setPlots([]); setRecords([]); setMembers([]);
      setLoading(false); setSyncing(false); return;
    }
    localStorage.setItem("growr360-web-group", nextGroup);
    const [fieldResult, plotResult, recordResult, memberResult] = await Promise.all([
      supabase.from("fields").select("id,group_id,name,total_area,arable_area,locality,province").eq("group_id", nextGroup).is("deleted_at", null).order("name"),
      supabase.from("plots").select("id,group_id,field_id,name,total_area,arable_area,geometry_json,priority_color,allow_member_edits,fields(name)").eq("group_id", nextGroup).is("deleted_at", null).order("name"),
      supabase.from("records").select("id,record_type,record_date,worked_area,field_id,plot_id,fields(name),plots(name),campaigns(name)").eq("group_id", nextGroup).is("deleted_at", null).order("record_date", { ascending: false }).limit(100),
      supabase.from("group_members").select("user_id,role,status,profiles!group_members_user_id_fkey(id,first_name,last_name,username,email)").eq("group_id", nextGroup).eq("status", "active").order("created_at")
    ]);
    if (fieldResult.error || plotResult.error) setError(fieldResult.error?.message ?? plotResult.error?.message ?? "");
    setFields((fieldResult.data ?? []) as Field[]);
    setPlots((plotResult.data ?? []) as unknown as Plot[]);
    setRecords((recordResult.data ?? []) as unknown as RecordRow[]);
    setMembers((memberResult.data ?? []) as unknown as Member[]);
    setLoading(false); setSyncing(false);
  }, [session.user.id]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const switchGroup = (id: string) => void loadWorkspace(id);
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || session.user.email || "Usuario";

  if (loading) return <LoadingScreen text="Cargando tus campos y lotes…"/>;

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-top"><Brand/><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)}><X/></button></div>
      <nav>{nav.map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setSidebarOpen(false); }}><item.icon/><span>{item.label}</span>{item.id === "registros" && records.length > 0 && <em>{records.length}</em>}</button>)}</nav>
      <div className="workspace-card">
        <div className="workspace-icon"><Tractor/></div>
        <label><small>Espacio activo</small><select value={groupId} onChange={event => switchGroup(event.target.value)}>{memberships.map(m => { const item = relation(m.groups); return item ? <option value={m.group_id} key={m.group_id}>{item.name}</option> : null; })}</select></label>
        <ChevronDown/>
      </div>
      <div className="sidebar-footer">
        <button><Settings2/>Configuración</button>
        <div className="user-mini"><div className="avatar">{initials(name)}</div><div><strong>{name}</strong><small>{roleName(activeMembership?.role)}</small></div><button title="Cerrar sesión" onClick={() => void supabase.auth.signOut()}><LogOut/></button></div>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button hamburger" onClick={() => setSidebarOpen(true)}><Menu/></button><div><h1>{nav.find(n => n.id === view)?.label}</h1><p>{view === "mapa" ? group?.name ?? "Sin grupo activo" : subtitle(view)}</p></div></div>
        <div className="topbar-actions"><div className={`sync-pill ${syncing ? "is-syncing" : ""}`}><span/>{syncing ? "Actualizando…" : "Sincronizado"}</div><button className="icon-button" onClick={() => void loadWorkspace(groupId, true)} title="Actualizar"><RotateCcw className={syncing ? "spin" : ""}/></button><button className="avatar-button">{initials(name)}</button></div>
      </header>
      {error && <div className="global-error">{error}<button onClick={() => setError("")}><X/></button></div>}
      {!groupId ? <EmptyWorkspace/> : <>
        {view === "mapa" && <RealMapView fields={fields} plots={plots} selectedPlot={selectedPlot} setSelectedPlot={plot => setSelectedPlotId(plot?.id ?? null)} groupId={groupId} userId={session.user.id} onSaved={() => void loadWorkspace(groupId, true)}/>}
        {view === "campos" && <RealFieldsView fields={fields} plots={plots} onOpenPlot={plot => { setSelectedPlotId(plot.id); setView("mapa"); }}/>}
        {view === "registros" && <RealRecordsView records={records}/>}
        {view === "reportes" && <RealReportsView fields={fields} plots={plots} records={records}/>}
        {view === "equipo" && <RealTeamView members={members}/>}
      </>}
    </main>
  </div>;
}

function RealMapView({ fields, plots, selectedPlot, setSelectedPlot, groupId, userId, onSaved }: {
  fields: Field[]; plots: Plot[]; selectedPlot: Plot | null; setSelectedPlot: (plot: Plot | null) => void;
  groupId: string; userId: string; onSaved: () => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [layer, setLayer] = useState<"cultivo" | "prioridad" | "sin-relleno">("cultivo");
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<number[][]>([]);
  const [draft, setDraft] = useState<GeoFeature | null>(null);
  const mapPlots = useMemo<MapPlot[]>(() => plots.map(plot => {
    const feature = geometry(plot.geometry_json);
    if (!feature) return null;
    return { ...plot, feature, fieldName: relation(plot.fields)?.name ?? fields.find(field => field.id === plot.field_id)?.name ?? "Campo" };
  }).filter(Boolean) as MapPlot[], [plots, fields]);

  const refreshSources = useCallback((map: MapLibreMap, drawPoints = points) => {
    const collection = {
      type: "FeatureCollection" as const,
      features: mapPlots.map(plot => ({
        ...plot.feature,
        properties: { id: plot.id, name: plot.name, color: plotColor(plot, layer) }
      }))
    };
    (map.getSource("plots") as GeoJSONSource | undefined)?.setData(collection);
    const drawFeature = drawPoints.length >= 2 ? {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: drawPoints.length >= 3 ? "Polygon" as const : "LineString" as const, coordinates: drawPoints.length >= 3 ? [[...drawPoints, drawPoints[0]]] : drawPoints } }]
    } : { type: "FeatureCollection" as const, features: [] };
    (map.getSource("drawing") as GeoJSONSource | undefined)?.setData(
      drawFeature as Parameters<GeoJSONSource["setData"]>[0]
    );
    (map.getSource("vertices") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: drawPoints.map((point, index) => ({ type: "Feature", properties: { index }, geometry: { type: "Point", coordinates: point } }))
    });
    if (map.getLayer("plot-fill")) map.setPaintProperty("plot-fill", "fill-opacity", layer === "sin-relleno" ? 0 : .48);
  }, [mapPlots, layer, points]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center: [-60.2, -34.8],
      zoom: 7,
      maxZoom: 18,
      style: { version: 8, sources: { satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Esri" } }, layers: [{ id: "satellite", type: "raster", source: "satellite" }] }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("plots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("drawing", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("vertices", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "plot-fill", type: "fill", source: "plots", paint: { "fill-color": ["get", "color"], "fill-opacity": .48 } });
      map.addLayer({ id: "plot-line", type: "line", source: "plots", paint: { "line-color": "#ffffff", "line-width": 1.7 } });
      map.addLayer({ id: "plot-label", type: "symbol", source: "plots", layout: { "text-field": ["get", "name"], "text-size": 13, "text-allow-overlap": false }, paint: { "text-color": "#ffffff", "text-halo-color": "#0b2018", "text-halo-width": 3 } });
      map.addLayer({ id: "draw-fill", type: "fill", source: "drawing", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#63dc42", "fill-opacity": .28 } });
      map.addLayer({ id: "draw-line", type: "line", source: "drawing", paint: { "line-color": "#a7ff79", "line-width": 3 } });
      map.addLayer({ id: "draw-points", type: "circle", source: "vertices", paint: { "circle-radius": 6, "circle-color": "#f8fff4", "circle-stroke-color": "#1e7b45", "circle-stroke-width": 3 } });
      refreshSources(map, []);
      if (mapPlots.length) fitPlots(map, mapPlots);
      map.on("click", "plot-fill", event => {
        if (drawing) return;
        const id = event.features?.[0]?.properties?.id;
        setSelectedPlot(plots.find(plot => plot.id === id) ?? null);
      });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // Initialization intentionally happens once. Dynamic data is refreshed below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mapRef.current?.loaded()) refreshSources(mapRef.current); }, [refreshSources]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const click = (event: maplibregl.MapMouseEvent) => {
      if (!drawing) return;
      setPoints(previous => [...previous, [event.lngLat.lng, event.lngLat.lat]]);
    };
    map.on("click", click);
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    return () => { map.off("click", click); if (map.getCanvas()) map.getCanvas().style.cursor = ""; };
  }, [drawing]);

  useEffect(() => { if (mapRef.current?.loaded()) refreshSources(mapRef.current, points); }, [points, refreshSources]);

  function startDrawing() {
    if (!fields.length) return;
    setSelectedPlot(null); setDraft(null); setPoints([]); setDrawing(true);
  }
  function cancelDrawing() { setDrawing(false); setPoints([]); setDraft(null); }
  function finishDrawing() {
    if (points.length < 3) return;
    const calculated = calculateGeometry(points);
    setDraft(calculated); setDrawing(false);
  }

  return <div className="map-workspace">
    <div ref={mapNode} className="map-canvas"/>
    <div className="map-search"><Search/><span>{mapPlots.length} lotes georreferenciados</span></div>
    {!drawing && !draft && <div className="map-toolbar">
      <button onClick={startDrawing} className="primary-map-action" disabled={!fields.length}><Plus/><span>Dibujar lote</span></button>
      <button onClick={() => mapRef.current && fitPlots(mapRef.current, mapPlots)}><MapPin/><span>Ver todos</span></button>
      <button onClick={onSaved}><RotateCcw/><span>Actualizar</span></button>
    </div>}
    <div className="layer-switcher"><div><Layers3/><span>Visualización</span></div>{(["cultivo", "prioridad", "sin-relleno"] as const).map(value => <button key={value} className={layer === value ? "active" : ""} onClick={() => setLayer(value)}>{value === "sin-relleno" ? "Sin relleno" : cap(value)}</button>)}</div>
    {drawing && <div className="drawing-panel"><span className="eyebrow">NUEVO TRAZADO</span><h3>Marcá los límites del lote</h3><p>Hacé clic sobre el mapa para agregar cada vértice. Necesitás al menos tres puntos.</p><strong>{points.length} punto{points.length === 1 ? "" : "s"}</strong><div><button onClick={() => setPoints(current => current.slice(0, -1))} disabled={!points.length}><Undo2/>Deshacer</button><button onClick={cancelDrawing}><X/>Cancelar</button><button className="finish" disabled={points.length < 3} onClick={finishDrawing}><Check/>Finalizar</button></div></div>}
    {draft && <PlotForm feature={draft} fields={fields} groupId={groupId} userId={userId} onCancel={cancelDrawing} onSaved={() => { cancelDrawing(); onSaved(); }}/>}
    {selectedPlot && !drawing && !draft && <RealPlotPanel plot={selectedPlot} fieldName={relation(selectedPlot.fields)?.name ?? fields.find(f => f.id === selectedPlot.field_id)?.name ?? "Campo"} onClose={() => setSelectedPlot(null)}/>}
    {!fields.length && <div className="map-empty-hint">Primero necesitás crear un campo desde la aplicación móvil para poder asociar el lote.</div>}
  </div>;
}

function PlotForm({ feature, fields, groupId, userId, onCancel, onSaved }: {
  feature: GeoFeature; fields: Field[]; groupId: string; userId: string; onCancel: () => void; onSaved: () => void;
}) {
  const initialArea = Number(feature.properties?.area_ha ?? 0);
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "");
  const [name, setName] = useState("");
  const [area, setArea] = useState(initialArea.toFixed(2));
  const [allowEdits, setAllowEdits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const numericArea = number(area);
    if (!name.trim() || !fieldId || numericArea <= 0) { setMessage("Completá el nombre, campo y superficie."); return; }
    setSaving(true); setMessage("");
    const { error } = await supabase.from("plots").insert({
      id: crypto.randomUUID(), group_id: groupId, field_id: fieldId, name: name.trim(),
      total_area: numericArea, arable_area: numericArea, geometry_json: feature,
      allow_member_edits: allowEdits, created_by: userId
    });
    setSaving(false);
    if (error) setMessage(error.message); else onSaved();
  }

  return <form className="plot-form-panel" onSubmit={save}>
    <div><span className="eyebrow">DATOS DEL NUEVO LOTE</span><button type="button" onClick={onCancel}><X/></button></div>
    <h2>{initialArea.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha calculadas</h2>
    <label>Nombre del lote<input value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Lote Norte" autoFocus/></label>
    <label>Campo<select value={fieldId} onChange={event => setFieldId(event.target.value)}>{fields.map(field => <option value={field.id} key={field.id}>{field.name}</option>)}</select></label>
    <label>Superficie sembrable (ha)<input inputMode="decimal" value={area} onChange={event => setArea(event.target.value)}/></label>
    <label className="check-row"><input type="checkbox" checked={allowEdits} onChange={event => setAllowEdits(event.target.checked)}/><span>Permitir que otros miembros editen este lote</span></label>
    {message && <p className="form-error">{message}</p>}
    <div className="plot-form-actions"><button type="button" onClick={onCancel}>Cancelar</button><button className="save" disabled={saving}>{saving ? <LoaderCircle className="spin"/> : <Save/>}{saving ? "Guardando…" : "Guardar lote"}</button></div>
  </form>;
}

function RealPlotPanel({ plot, fieldName, onClose }: { plot: Plot; fieldName: string; onClose: () => void }) {
  return <aside className="lot-panel"><div className="panel-handle"/><div className="lot-head"><div><span className="eyebrow">LOTE REAL</span><h2>{plot.name}</h2><p><MapPin/> {fieldName}</p></div><button className="icon-button" onClick={onClose}><X/></button></div><div className="lot-metrics"><div><small>Superficie</small><strong>{number(plot.arable_area).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha</strong></div><div><small>Edición compartida</small><strong>{plot.allow_member_edits ? "Permitida" : "Restringida"}</strong></div></div><div className="real-data-badge"><Check/>Sincronizado con la app móvil</div></aside>;
}

function RealFieldsView({ fields, plots, onOpenPlot }: { fields: Field[]; plots: Plot[]; onOpenPlot: (plot: Plot) => void }) {
  return <div className="page-content"><PageHead title="Campos y lotes" text="Información real del grupo activo."/><div className="stats-grid"><Stat label="Campos activos" value={String(fields.length)} detail={`${sum(fields.map(f => number(f.arable_area))).toLocaleString("es-AR")} ha sembrables`} icon={MapPin}/><Stat label="Lotes" value={String(plots.length)} detail={`${plots.filter(p => geometry(p.geometry_json)).length} georreferenciados`} icon={Grid2X2}/><Stat label="Superficie en lotes" value={`${sum(plots.map(p => number(p.arable_area))).toLocaleString("es-AR")} ha`} detail="Datos sincronizados" icon={Sprout}/></div><div className="content-card"><div className="card-toolbar"><div><h3>Todos los lotes</h3><p>Seleccioná uno para ubicarlo en el mapa.</p></div></div><div className="lot-table"><div className="table-head"><span>Lote</span><span>Campo</span><span>Superficie</span><span>Mapa</span><span/><span/></div>{plots.map(plot => <button className="table-row" key={plot.id} onClick={() => onOpenPlot(plot)}><span><i style={{ background: plot.priority_color || "#4fbf62" }}/><b>{plot.name}</b></span><span>{relation(plot.fields)?.name ?? fields.find(f => f.id === plot.field_id)?.name ?? "—"}</span><span>{number(plot.arable_area).toLocaleString("es-AR")} ha</span><span>{geometry(plot.geometry_json) ? "Trazado" : "Sin trazar"}</span><span/><ChevronRight/></button>)}{!plots.length && <EmptyLine text="Todavía no hay lotes en este grupo."/>}</div></div></div>;
}

function RealRecordsView({ records }: { records: RecordRow[] }) {
  const [query, setQuery] = useState("");
  const visible = records.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return <div className="page-content"><PageHead title="Registros" text="Actividad real sincronizada con Android."/><div className="records-toolbar"><div className="inner-search"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por campo, lote o tipo…"/></div><button className="soft-button"><Filter/>Filtros</button></div><div className="record-list">{visible.map(row => <article className="record-card" key={row.id}><div className="record-type-icon"><Leaf/></div><div className="record-main"><span>{recordType(row.record_type)}</span><h3>{relation(row.fields)?.name ?? "Campo"} · {relation(row.plots)?.name ?? "Sin lote"}</h3><p>{number(row.worked_area).toLocaleString("es-AR")} ha</p></div><div className="record-meta"><strong>{formatDate(row.record_date)}</strong><small>{relation(row.campaigns)?.name ?? "Sin campaña"}</small></div><button className="icon-button"><ChevronRight/></button></article>)}{!visible.length && <EmptyLine text="No hay registros para mostrar."/>}</div></div>;
}

function RealReportsView({ fields, plots, records }: { fields: Field[]; plots: Plot[]; records: RecordRow[] }) {
  const total = sum(plots.map(p => number(p.arable_area)));
  const georeferenced = plots.filter(p => geometry(p.geometry_json)).length;
  return <div className="page-content"><PageHead title="Reportes" text="Resumen calculado con la información real disponible."/><div className="kpi-grid"><Kpi label="Superficie en lotes" value={`${total.toLocaleString("es-AR")} ha`}/><Kpi label="Campos activos" value={String(fields.length)}/><Kpi label="Lotes georreferenciados" value={`${georeferenced} / ${plots.length}`}/><Kpi label="Registros cargados" value={String(records.length)}/></div><div className="content-card report-real"><h3>Distribución por campo</h3>{fields.map(field => { const area = sum(plots.filter(p => p.field_id === field.id).map(p => number(p.arable_area))); return <div className="report-field" key={field.id}><span>{field.name}</span><i><b style={{ width: `${total ? Math.max(3, area / total * 100) : 0}%` }}/></i><strong>{area.toLocaleString("es-AR")} ha</strong></div>; })}</div></div>;
}

function RealTeamView({ members }: { members: Member[] }) {
  return <div className="page-content"><PageHead title="Equipo" text="Miembros activos del grupo seleccionado."/><div className="team-grid">{members.map(member => { const profile = relation(member.profiles); const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || "Usuario"; return <article className="member-card" key={member.user_id}><div className="member-avatar">{initials(name)}</div><div><h3>{name}</h3><p>{roleName(member.role)}</p></div><span className="member-active"><i/>Activo</span><div className="access"><small>Cuenta</small><strong>{profile?.email ?? "Sin correo visible"}</strong></div></article>; })}{!members.length && <EmptyLine text="No hay miembros visibles."/>}</div></div>;
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><span>G</span><Leaf size={16}/></div><div><strong>Growr<span>360</span></strong><small>Gestión agrícola</small></div></div>;
}
function LoadingScreen({ text }: { text: string }) { return <div className="loading-screen"><div className="brand-mark"><span>G</span><Leaf/></div><LoaderCircle className="spin"/><strong>{text}</strong></div>; }
function EmptyWorkspace() { return <div className="empty-workspace"><Users/><h2>Tu cuenta todavía no tiene un grupo activo</h2><p>Creá un grupo o enviá una solicitud desde la aplicación móvil. Cuando te acepten, aparecerá acá automáticamente.</p></div>; }
function EmptyLine({ text }: { text: string }) { return <div className="empty-line">{text}</div>; }
function PageHead({ title, text }: { title: string; text: string }) { return <div className="page-head"><div><h2>{title}</h2><p>{text}</p></div></div>; }
function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof MapPin }) { return <div className="stat-card"><div><Icon/></div><section><small>{label}</small><strong>{value}</strong><p>{detail}</p></section></div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <div className="kpi"><small>{label}</small><strong>{value}</strong><span className="positive">Datos reales</span></div>; }
function subtitle(view: View) { return ({ campos: "Estructura territorial y productiva", registros: "Actividad sincronizada del equipo", reportes: "Indicadores del grupo activo", equipo: "Miembros y roles", mapa: "" } as Record<View, string>)[view]; }
function cap(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "G"; }
function roleName(role?: string) { return ({ owner: "Propietario", admin: "Administrador", agronomist: "Ingeniero / Agrónomo", operator: "Operador", monitor: "Monitoreador", producer: "Productor", member: "Miembro" } as Record<string, string>)[role ?? ""] ?? cap(role ?? "Miembro"); }
function recordType(type: string) { return ({ sowing: "Siembra", spraying: "Pulverización", fertilization: "Fertilización", harvest: "Cosecha", work: "Roturación", monitoring: "Monitoreo", expense: "Gasto", other: "Otro" } as Record<string, string>)[type] ?? cap(type); }
function formatDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(date); }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function plotColor(plot: Plot, layer: string) { if (layer === "prioridad") return plot.priority_color || "#718078"; return "#43a85d"; }
function fitPlots(map: MapLibreMap, plots: MapPlot[]) {
  const coordinates = plots.flatMap(plot => plot.feature.geometry.coordinates[0] ?? []);
  if (!coordinates.length) return;
  const bounds = coordinates.reduce((box, point) => box.extend(point as [number, number]), new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));
  map.fitBounds(bounds as LngLatBoundsLike, { padding: 90, maxZoom: 15, duration: 700 });
}
function calculateGeometry(points: number[][]): GeoFeature {
  const lat = points.reduce((total, point) => total + point[1], 0) / points.length;
  const lon = points.reduce((total, point) => total + point[0], 0) / points.length;
  const radius = 6371008.8;
  const projected = points.map(point => [radius * (point[0] - lon) * Math.PI / 180 * Math.cos(lat * Math.PI / 180), radius * (point[1] - lat) * Math.PI / 180]);
  let twiceArea = 0; let perimeter = 0;
  for (let index = 0; index < points.length; index++) {
    const next = (index + 1) % points.length;
    twiceArea += projected[index][0] * projected[next][1] - projected[next][0] * projected[index][1];
    const dx = projected[index][0] - projected[next][0]; const dy = projected[index][1] - projected[next][1];
    perimeter += Math.hypot(dx, dy);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [[...points, points[0]]] }, properties: { area_ha: Math.abs(twiceArea) / 2 / 10000, perimeter_m: perimeter, center_latitude: lat, center_longitude: lon, reference: "Trazado desde Growr360 Web" } };
}
