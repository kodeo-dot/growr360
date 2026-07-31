"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import maplibregl, { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleUserRound, FileText, Filter, Grid2X2, Layers3, Leaf, LoaderCircle, LogOut,
  Map, MapPin, Menu, Plus, RotateCcw, Save, Search, Settings2, Sprout, Tractor,
  TrendingUp, Undo2, Users, X, Satellite, SlidersHorizontal, BarChart3
} from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://emwfdcekpxwzvnidwdls.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_waHR1lcMgPHyP32KlyBcEw_uAL6n6-g";

type View = "mapa" | "campos" | "registros" | "gestion" | "reportes" | "equipo" | "configuracion";
type Group = { id: string; name: string; description?: string | null };
type PermissionOverride = { permission: string; allowed: boolean };
type Membership = {
  group_id: string; role: string; status: string; groups: Group | Group[] | null;
  member_permission_overrides?: PermissionOverride[] | null;
};
type Profile = { id: string; first_name: string; last_name: string; username: string; email: string };
type Field = { id: string; group_id: string; name: string; total_area: number | string; arable_area: number | string; locality?: string | null; province?: string | null };
type Plot = {
  id: string; group_id: string; field_id: string; name: string; total_area: number | string;
  arable_area: number | string; geometry_json: GeoFeature | string | null; priority_color?: string | null;
  fields?: { name: string } | { name: string }[] | null; allow_member_edits?: boolean;
  cropName?: string | null; cropColor?: string | null;
};
type RecordRow = {
  id: string; record_type: string; record_date: string; worked_area?: number | string | null;
  field_id?: string | null; plot_id?: string | null; fields?: { name: string } | null;
  plots?: { name: string } | null; campaigns?: { id?: string; name: string } | null;
  campaign_id?: string | null; details?: Record<string, string | number | boolean | null> | null;
  sowing_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  spraying_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  fertilization_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  harvest_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  work_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  monitoring_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  expense_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
  other_records?: { data?: Record<string, unknown> }[] | { data?: Record<string, unknown> } | null;
};
type Crop = { id: string; name: string; group_id?: string | null };
type PlotCampaign = { plot_id: string; campaign_id: string; crop_id: string; campaigns?: { id: string; name: string; status?: string } | null; crops?: { id: string; name: string } | null };
type CropColor = { crop_id: string; color: string };
type Campaign = { id: string; name: string; start_date: string; end_date: string; status: string };
type ClientRow = { id: string; name: string; cuit?: string | null; phone?: string | null; email?: string | null };
type AppSettings = { appearance: string; area_unit: string; date_format: string; notifications_enabled: boolean };
type Member = { user_id: string; role: string; status: string; profiles?: Profile | null };
type GeoFeature = {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties?: Record<string, unknown>;
};
type MapPlot = Plot & { feature: GeoFeature; fieldName: string };
type SatelliteScene = { id: string; date: string; cloud: number; satellite: string };

const nav = [
  { id: "mapa" as View, label: "Mapa", icon: Map },
  { id: "campos" as View, label: "Campos", icon: Sprout },
  { id: "registros" as View, label: "Registros", icon: FileText },
  { id: "gestion" as View, label: "Gestión", icon: Grid2X2 },
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
  const [crops, setCrops] = useState<Crop[]>([]);
  const [assignments, setAssignments] = useState<PlotCampaign[]>([]);
  const [cropColors, setCropColors] = useState<CropColor[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ appearance: "system", area_unit: "ha", date_format: "dd-MM-yyyy", notifications_enabled: true });
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<{ plotId: string; type: string } | null>(null);

  const group = memberships.map(m => relation(m.groups)).find(g => g?.id === groupId) ?? null;
  const selectedPlot = plots.find(plot => plot.id === selectedPlotId) ?? null;
  const activeMembership = memberships.find(m => m.group_id === groupId);
  const canManageLots = useMemo(() => {
    if (!activeMembership) return false;
    if (activeMembership.role === "owner") return true;
    const override = activeMembership.member_permission_overrides?.find(item => item.permission === "manage_lots");
    if (override) return override.allowed;
    return activeMembership.role === "admin";
  }, [activeMembership]);
  const hasPermission = useCallback((permission: string) => {
    if (!activeMembership) return false;
    if (activeMembership.role === "owner") return true;
    const override = activeMembership.member_permission_overrides?.find(item => item.permission === permission);
    if (override) return override.allowed;
    if (activeMembership.role === "admin") return !["delete_group", "manage_subscription", "assign_admin_role", "transfer_ownership"].includes(permission);
    if (activeMembership.role === "agronomist") return ["view_records","create_records","create_monitoring","view_satellite","view_ndvi","export_reports"].includes(permission);
    if (activeMembership.role === "operator") return ["view_records","create_records"].includes(permission);
    return false;
  }, [activeMembership]);

  const loadGroupData = useCallback(async (targetGroup: string, quiet = false) => {
    if (quiet) setSyncing(true);
    setError("");
    const [fieldResult, plotResult, recordResult, memberResult, cropResult, assignmentResult, colorResult, settingsResult, campaignResult, clientResult] = await Promise.all([
      supabase.from("fields").select("id,group_id,name,total_area,arable_area,locality,province").eq("group_id", targetGroup).is("deleted_at", null).order("name"),
      supabase.from("plots").select("id,group_id,field_id,name,total_area,arable_area,geometry_json,priority_color,allow_member_edits,fields(name)").eq("group_id", targetGroup).is("deleted_at", null).order("name"),
      supabase.from("records").select("id,record_type,record_date,worked_area,field_id,plot_id,campaign_id,fields(name),plots(name),campaigns(id,name),sowing_records(data),spraying_records(data),fertilization_records(data),harvest_records(data),work_records(data),monitoring_records(data),expense_records(data),other_records(data)").eq("group_id", targetGroup).is("deleted_at", null).order("record_date", { ascending: false }).limit(500),
      supabase.from("group_members").select("user_id,role,status,profiles!group_members_user_id_fkey(id,first_name,last_name,username,email)").eq("group_id", targetGroup).eq("status", "active").order("created_at"),
      supabase.from("crops").select("id,name,group_id").or(`group_id.is.null,group_id.eq.${targetGroup}`).is("deleted_at", null).order("name"),
      supabase.from("plot_campaigns").select("plot_id,campaign_id,crop_id,campaigns(id,name,status),crops(id,name)").eq("group_id", targetGroup).is("deleted_at", null),
      supabase.from("group_crop_colors").select("crop_id,color").eq("group_id", targetGroup),
      supabase.from("app_settings").select("appearance,area_unit,date_format,notifications_enabled").eq("group_id", targetGroup).eq("user_id", session.user.id).maybeSingle()
      ,supabase.from("campaigns").select("id,name,start_date,end_date,status").eq("group_id", targetGroup).is("deleted_at", null).order("start_date", { ascending: false })
      ,supabase.from("clients").select("id,name,cuit,phone,email").eq("group_id", targetGroup).is("deleted_at", null).order("name")
    ]);
    const criticalError = fieldResult.error ?? plotResult.error ?? recordResult.error;
    if (criticalError) setError(criticalError.message);
    setFields((fieldResult.data ?? []) as Field[]);
    setPlots((plotResult.data ?? []) as unknown as Plot[]);
    setRecords((recordResult.data ?? []) as unknown as RecordRow[]);
    setMembers((memberResult.data ?? []) as unknown as Member[]);
    setCrops((cropResult.data ?? []) as Crop[]);
    setAssignments((assignmentResult.data ?? []) as unknown as PlotCampaign[]);
    setCropColors((colorResult.data ?? []) as CropColor[]);
    if (settingsResult.data) setSettings(settingsResult.data as AppSettings);
    setCampaigns((campaignResult.data ?? []) as Campaign[]);
    setClients((clientResult.data ?? []) as ClientRow[]);
    setSyncing(false);
  }, [session.user.id]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    const userId = session.user.id;
    const [profileResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("id,first_name,last_name,username,email").eq("id", userId).single(),
      supabase.from("group_members").select("group_id,role,status,groups(id,name,description),member_permission_overrides(permission,allowed)").eq("user_id", userId).eq("status", "active").order("created_at")
    ]);
    if (profileResult.data) setProfile(profileResult.data as Profile);
    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setLoading(false); return;
    }
    const rows = (membershipResult.data ?? []) as unknown as Membership[];
    setMemberships(rows);
    const stored = localStorage.getItem("growr360-web-group");
    const nextGroup = stored && rows.some(m => m.group_id === stored) ? stored : rows[0]?.group_id ?? "";
    setGroupId(nextGroup);
    if (nextGroup) {
      localStorage.setItem("growr360-web-group", nextGroup);
      await loadGroupData(nextGroup);
    } else {
      setFields([]); setPlots([]); setRecords([]); setMembers([]);
    }
    setLoading(false);
  }, [loadGroupData, session.user.id]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const switchGroup = (id: string) => {
    setGroupId(id);
    setSelectedPlotId(null);
    setFields([]); setPlots([]); setRecords([]); setMembers([]);
    localStorage.setItem("growr360-web-group", id);
    void loadGroupData(id, true);
  };
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
        <button className={view === "configuracion" ? "active" : ""} onClick={() => { setView("configuracion"); setSidebarOpen(false); }}><Settings2/>Configuración</button>
        <div className="user-mini"><div className="avatar">{initials(name)}</div><div><strong>{name}</strong><small>{roleName(activeMembership?.role)}</small></div><button title="Cerrar sesión" onClick={() => void supabase.auth.signOut()}><LogOut/></button></div>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button hamburger" onClick={() => setSidebarOpen(true)}><Menu/></button><div><h1>{view === "configuracion" ? "Configuración" : nav.find(n => n.id === view)?.label}</h1><p>{view === "mapa" ? group?.name ?? "Sin grupo activo" : subtitle(view)}</p></div></div>
        <div className="topbar-actions"><div className={`sync-pill ${syncing ? "is-syncing" : ""}`}><span/>{syncing ? "Actualizando…" : "Sincronizado"}</div><button className="icon-button" onClick={() => groupId && void loadGroupData(groupId, true)} title="Actualizar"><RotateCcw className={syncing ? "spin" : ""}/></button><button className="avatar-button">{initials(name)}</button></div>
      </header>
      {error && <div className="global-error">{error}<button onClick={() => setError("")}><X/></button></div>}
      {!groupId ? <EmptyWorkspace/> : <>
        {view === "mapa" && <RealMapView fields={fields} plots={plots} records={records} campaigns={campaigns} assignments={assignments} cropColors={cropColors} crops={crops} selectedPlot={selectedPlot} setSelectedPlot={plot => setSelectedPlotId(plot?.id ?? null)} groupId={groupId} userId={session.user.id} canManageLots={canManageLots} onCreateRecord={(plot,type) => { setPendingRecord({ plotId: plot.id, type }); setView("gestion"); }} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "campos" && <RealFieldsView fields={fields} plots={resolvePlotCrops(plots, records, assignments, cropColors, crops)} onOpenPlot={plot => { setSelectedPlotId(plot.id); setView("mapa"); }}/>} 
        {view === "registros" && <RealRecordsView records={records}/>}
        {view === "gestion" && <ManagementView groupId={groupId} userId={session.user.id} fields={fields} plots={plots} campaigns={campaigns} clients={clients} crops={crops} canFields={hasPermission("manage_fields")} canLots={hasPermission("manage_lots")} canCampaigns={hasPermission("manage_campaigns")} canRecords={hasPermission("create_records")} initialRecord={pendingRecord} onInitialRecordConsumed={() => setPendingRecord(null)} onMap={() => setView("mapa")} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "reportes" && <RealReportsView fields={fields} plots={resolvePlotCrops(plots, records, assignments, cropColors, crops)} records={records} crops={crops}/>}
        {view === "equipo" && <RealTeamView groupId={groupId} members={members} canManage={hasPermission("manage_members")} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "configuracion" && <RealSettingsView groupId={groupId} userId={session.user.id} settings={settings} onSaved={setSettings}/>}
      </>}
    </main>
  </div>;
}

function RealMapView({ fields, plots, records, campaigns, assignments, cropColors, crops, selectedPlot, setSelectedPlot, groupId, userId, canManageLots, onCreateRecord, onSaved }: {
  fields: Field[]; plots: Plot[]; records: RecordRow[]; selectedPlot: Plot | null; setSelectedPlot: (plot: Plot | null) => void;
  campaigns: Campaign[]; assignments: PlotCampaign[]; cropColors: CropColor[]; crops: Crop[];
  onCreateRecord: (plot: Plot, type: string) => void;
  groupId: string; userId: string; canManageLots: boolean; onSaved: () => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [layer, setLayer] = useState<"cultivo" | "prioridad" | "sin-relleno">("cultivo");
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<number[][]>([]);
  const [draft, setDraft] = useState<GeoFeature | null>(null);
  const [satelliteOpen, setSatelliteOpen] = useState(false);
  const [satelliteScenes, setSatelliteScenes] = useState<SatelliteScene[]>([]);
  const [satelliteScene, setSatelliteScene] = useState<SatelliteScene | null>(null);
  const [satelliteIndex, setSatelliteIndex] = useState("NDVI");
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const [satelliteError, setSatelliteError] = useState("");
  const [satelliteOpacity, setSatelliteOpacity] = useState(.82);
  const [satellitePlotId, setSatellitePlotId] = useState("");
  const [satellitePreviews, setSatellitePreviews] = useState<Record<string, string>>({});
  const [detailRecord, setDetailRecord] = useState<RecordRow | null>(null);
  const [campaignFilterId, setCampaignFilterId] = useState("");
  const [monitoringDays, setMonitoringDays] = useState<number | null>(null);
  const [filterPanel, setFilterPanel] = useState<"campaign" | "monitoring" | null>(null);
  const recordsRef = useRef(records);
  useEffect(() => { recordsRef.current = records; }, [records]);
  const activeCampaignId = campaigns.find(campaign => campaign.status === "active")?.id;
  const preferredCampaignId = campaignFilterId || activeCampaignId;
  const visiblePlotIds = useMemo(() => {
    if (!campaignFilterId) return null;
    return new Set([
      ...assignments.filter(item => item.campaign_id === campaignFilterId).map(item => item.plot_id),
      ...records.filter(row => row.campaign_id === campaignFilterId && row.plot_id).map(row => row.plot_id as string)
    ]);
  }, [campaignFilterId, assignments, records]);
  const displayPlots = useMemo(() => resolvePlotCrops(
    visiblePlotIds ? plots.filter(plot => visiblePlotIds.has(plot.id)) : plots,
    records, assignments, cropColors, crops, preferredCampaignId
  ), [plots, records, assignments, cropColors, crops, preferredCampaignId, visiblePlotIds]);
  const monitoringRecords = useMemo(() => {
    if (!monitoringDays) return [];
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); cutoff.setDate(cutoff.getDate() - monitoringDays);
    return records.filter(row => {
      if (row.record_type !== "monitoring" || (campaignFilterId && row.campaign_id !== campaignFilterId)) return false;
      const data = recordData(row);
      const status = normalizeText(String(data.gps_status ?? ""));
      const latitude = number(data.gps_latitude as string | number | null);
      const longitude = number(data.gps_longitude as string | number | null);
      const date = new Date(`${row.record_date}T12:00:00`);
      return status === "dentro del lote" && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && (latitude !== 0 || longitude !== 0) && date >= cutoff;
    });
  }, [records, monitoringDays, campaignFilterId]);
  const mapPlots = useMemo<MapPlot[]>(() => displayPlots.map(plot => {
    const feature = geometry(plot.geometry_json);
    if (!feature) return null;
    return { ...plot, feature, fieldName: relation(plot.fields)?.name ?? fields.find(field => field.id === plot.field_id)?.name ?? "Campo" };
  }).filter(Boolean) as MapPlot[], [displayPlots, fields]);

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
    (map.getSource("monitorings") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: monitoringRecords.map(row => {
        const data = recordData(row);
        const priority = Math.max(1, Math.min(5, number(data.monitoring_priority as string | number) || 3));
        return { type: "Feature", properties: { id: row.id, color: monitoringPriorityColor(priority) }, geometry: { type: "Point", coordinates: [number(data.gps_longitude as string | number), number(data.gps_latitude as string | number)] } };
      })
    });
    if (map.getLayer("plot-fill")) map.setPaintProperty("plot-fill", "fill-opacity", layer === "sin-relleno" ? 0 : .48);
  }, [mapPlots, layer, points, monitoringRecords]);

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
      map.addSource("monitorings", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("sentinel-image", { type: "image", url: transparentPixel(), coordinates: [[-60.3,-34.7],[-60.2,-34.7],[-60.2,-34.8],[-60.3,-34.8]] });
      map.addLayer({ id: "sentinel-layer", type: "raster", source: "sentinel-image", paint: { "raster-opacity": .82 } });
      map.addLayer({ id: "plot-fill", type: "fill", source: "plots", paint: { "fill-color": ["get", "color"], "fill-opacity": .48 } });
      map.addLayer({ id: "plot-line", type: "line", source: "plots", paint: { "line-color": "#ffffff", "line-width": 1.7 } });
      map.addLayer({ id: "plot-label", type: "symbol", source: "plots", layout: { "text-field": ["get", "name"], "text-size": 13, "text-allow-overlap": false }, paint: { "text-color": "#ffffff", "text-halo-color": "#0b2018", "text-halo-width": 3 } });
      map.addLayer({ id: "monitoring-points", type: "circle", source: "monitorings", paint: { "circle-radius": 8, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
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
      map.on("click", "monitoring-points", event => {
        const id = event.features?.[0]?.properties?.id;
        setDetailRecord(recordsRef.current.find(row => row.id === id) ?? null);
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
    if (!fields.length || !canManageLots) return;
    setSelectedPlot(null); setDraft(null); setPoints([]); setDrawing(true);
  }
  function cancelDrawing() { setDrawing(false); setPoints([]); setDraft(null); }
  function finishDrawing() {
    if (points.length < 3) return;
    const calculated = calculateGeometry(points);
    setDraft(calculated); setDrawing(false);
  }
  async function loadSatelliteScenes(plotId: string) {
    const target = mapPlots.find(plot => plot.id === plotId);
    if (!target || !geometry(target.geometry_json)) { setSatelliteError("Seleccioná un lote trazado para consultar Sentinel-2."); setSatelliteOpen(true); return; }
    setSatellitePlotId(target.id); setSatelliteLoading(true); setSatelliteError(""); setSatelliteScenes([]); setSatellitePreviews({});
    try {
      const response = await fetch("/api/satellite/scenes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ geometry: geometry(target.geometry_json) }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudieron consultar las imágenes.");
      setSatelliteScenes(payload.scenes ?? []); setSatelliteScene(payload.scenes?.[0] ?? null);
      void loadSatellitePreviews(target, (payload.scenes ?? []).slice(0, 10), satelliteIndex);
    } catch (error) { setSatelliteError(error instanceof Error ? error.message : "No se pudo consultar Sentinel-2."); }
    setSatelliteLoading(false);
  }
  async function openSatellite() {
    const target = selectedPlot ?? mapPlots.find(plot => plot.id === satellitePlotId) ?? mapPlots[0];
    setSatelliteOpen(true);
    if (target) await loadSatelliteScenes(target.id); else setSatelliteError("No hay lotes trazados disponibles.");
  }
  async function loadSatellitePreviews(target: MapPlot, scenes: SatelliteScene[], index: string) {
    const feature = geometry(target.geometry_json); if (!feature) return;
    const entries = await Promise.all(scenes.map(async scene => {
      try { const response = await fetch("/api/satellite/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ geometry: feature, date: scene.date, index, thumbnail: true }) }); if (!response.ok) return [scene.id, ""] as const; return [scene.id, URL.createObjectURL(await response.blob())] as const; } catch { return [scene.id, ""] as const; }
    }));
    setSatellitePreviews(Object.fromEntries(entries));
  }
  async function showSatellite(scene = satelliteScene, index = satelliteIndex) {
    const target = mapPlots.find(plot => plot.id === satellitePlotId); const feature = target && geometry(target.geometry_json);
    if (!scene || !feature || !mapRef.current) return;
    setSatelliteLoading(true); setSatelliteError("");
    try {
      const response = await fetch("/api/satellite/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ geometry: feature, date: scene.date, index }) });
      if (!response.ok) { const payload = await response.json(); throw new Error(payload.error || "No se pudo procesar la imagen."); }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const bounds = featureBounds(feature);
      const source = mapRef.current.getSource("sentinel-image") as maplibregl.ImageSource | undefined;
      source?.updateImage({ url, coordinates: [[bounds.west,bounds.north],[bounds.east,bounds.north],[bounds.east,bounds.south],[bounds.west,bounds.south]] });
      mapRef.current.setPaintProperty("sentinel-layer", "raster-opacity", satelliteOpacity);
      setSatelliteScene(scene); fitPlots(mapRef.current, mapPlots.filter(plot => plot.id === target.id));
    } catch (error) { setSatelliteError(error instanceof Error ? error.message : "No se pudo mostrar la imagen."); }
    setSatelliteLoading(false);
  }

  return <div className="map-workspace">
    <div ref={mapNode} className="map-canvas"/>
    <div className="map-search"><Search/><span>{mapPlots.length} lotes georreferenciados{campaignFilterId ? " en la campaña" : ""}</span></div>
    {!drawing && !draft && <div className="map-toolbar">
      <button onClick={startDrawing} className="primary-map-action" disabled={!fields.length || !canManageLots} title={!canManageLots ? "Tu función no tiene permiso para administrar lotes" : ""}><Plus/><span>Dibujar lote</span></button>
      <button onClick={() => mapRef.current && fitPlots(mapRef.current, mapPlots)}><MapPin/><span>Ver todos</span></button>
      <button onClick={openSatellite} className={satelliteOpen ? "selected" : ""}><Satellite/><span>Sentinel-2</span></button>
      <button onClick={() => setFilterPanel(current => current === "campaign" ? null : "campaign")} className={campaignFilterId ? "selected" : ""}><Filter/><span>Campaña</span></button>
      <button onClick={() => setFilterPanel(current => current === "monitoring" ? null : "monitoring")} className={monitoringDays ? "selected" : ""}><Activity/><span>Monitoreos</span></button>
      <button onClick={onSaved}><RotateCcw/><span>Actualizar</span></button>
    </div>}
    {filterPanel === "campaign" && <div className="map-filter-panel campaign-filter-panel"><div><strong>Campaña del mapa</strong><button onClick={() => setFilterPanel(null)}><X/></button></div><select value={campaignFilterId} onChange={event => setCampaignFilterId(event.target.value)}><option value="">Todas las campañas</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}{campaign.status === "active" ? " · Activa" : ""}</option>)}</select><small>El filtro actualiza lotes, cultivos y monitoreos.</small></div>}
    {filterPanel === "monitoring" && <div className="map-filter-panel monitoring-filter-panel"><div><strong>Monitoreos en el mapa</strong><button onClick={() => setFilterPanel(null)}><X/></button></div><div className="monitoring-days"><button className={!monitoringDays ? "active" : ""} onClick={() => setMonitoringDays(null)}>Ocultar</button>{[3,7,15,30].map(days => <button key={days} className={monitoringDays === days ? "active" : ""} onClick={() => setMonitoringDays(days)}>{days} días</button>)}</div><small>Solo se muestran monitoreos tomados dentro del lote con GPS válido.</small></div>}
    <div className="layer-switcher"><div><Layers3/><span>Visualización</span></div>{(["cultivo", "prioridad", "sin-relleno"] as const).map(value => <button key={value} className={layer === value ? "active" : ""} onClick={() => setLayer(value)}>{value === "sin-relleno" ? "Sin relleno" : cap(value)}</button>)}</div>
    {drawing && <div className="drawing-panel"><span className="eyebrow">NUEVO TRAZADO</span><h3>Marcá los límites del lote</h3><p>Hacé clic sobre el mapa para agregar cada vértice. Necesitás al menos tres puntos.</p><strong>{points.length} punto{points.length === 1 ? "" : "s"}</strong><div><button onClick={() => setPoints(current => current.slice(0, -1))} disabled={!points.length}><Undo2/>Deshacer</button><button onClick={cancelDrawing}><X/>Cancelar</button><button className="finish" disabled={points.length < 3} onClick={finishDrawing}><Check/>Finalizar</button></div></div>}
    {draft && <PlotForm feature={draft} fields={fields} groupId={groupId} userId={userId} onCancel={cancelDrawing} onSaved={() => { cancelDrawing(); onSaved(); }}/>}
    {selectedPlot && !drawing && !draft && !satelliteOpen && <RealPlotPanel plot={displayPlots.find(plot => plot.id === selectedPlot.id) ?? selectedPlot} fieldName={relation(selectedPlot.fields)?.name ?? fields.find(f => f.id === selectedPlot.field_id)?.name ?? "Campo"} records={records.filter(row => row.plot_id === selectedPlot.id)} onRecord={setDetailRecord} onNewRecord={() => onCreateRecord(selectedPlot,"sowing")} onMonitoring={() => onCreateRecord(selectedPlot,"monitoring")} onSatellite={() => { setSatellitePlotId(selectedPlot.id); void openSatellite(); }} onClose={() => setSelectedPlot(null)}/>}
    {satelliteOpen && <aside className="satellite-panel real-satellite"><div className="sat-top"><div><span className="eyebrow">COPERNICUS · SENTINEL-2</span><strong>Imágenes satelitales</strong></div><button onClick={() => setSatelliteOpen(false)}><X/></button></div>
      <label className="sat-plot-picker">Lote<select value={satellitePlotId} onChange={e => void loadSatelliteScenes(e.target.value)}><option value="">Seleccionar lote…</option>{mapPlots.map(plot => <option key={plot.id} value={plot.id}>{plot.name} · {plot.fieldName}</option>)}</select></label>
      <div className="sat-selector">{["RGB","NDVI","NDVI_CONTRASTED","FALSE_COLOR","NDRE"].map(index => <button key={index} className={satelliteIndex === index ? "active" : ""} onClick={() => { setSatelliteIndex(index); const target = mapPlots.find(plot => plot.id === satellitePlotId); if (target) void loadSatellitePreviews(target, satelliteScenes.slice(0, 10), index); if (satelliteScene) void showSatellite(satelliteScene, index); }}>{satelliteIndexName(index)}</button>)}</div>
      {satelliteLoading && <div className="sat-loading"><LoaderCircle className="spin"/>Procesando imagen…</div>}{satelliteError && <p className="sat-error">{satelliteError}</p>}
      {!!satelliteScenes.length && <><div className="sat-opacity"><span>Opacidad <b>{Math.round(satelliteOpacity * 100)}%</b></span><input type="range" min=".1" max="1" step=".05" value={satelliteOpacity} onChange={e => { const value = Number(e.target.value); setSatelliteOpacity(value); if (mapRef.current?.getLayer("sentinel-layer")) mapRef.current.setPaintProperty("sentinel-layer", "raster-opacity", value); }}/></div><div className="history"><strong>Historial · {satelliteIndexName(satelliteIndex)}</strong><div className="dates">{satelliteScenes.slice(0, 12).map(scene => <button key={scene.id} className={satelliteScene?.id === scene.id ? "active" : ""} onClick={() => void showSatellite(scene)}>{satellitePreviews[scene.id] ? <img className="sentinel-preview-image" src={satellitePreviews[scene.id]} alt={`Vista ${scene.date}`}/> : <div className="sentinel-preview"><LoaderCircle className="spin"/></div>}<b>{formatDate(scene.date)}</b><small>{Math.round(scene.cloud)}% nubes · {scene.satellite}</small></button>)}</div></div></>}
    </aside>}
    {detailRecord && <RecordDetail record={detailRecord} onClose={() => setDetailRecord(null)}/>}
    {!fields.length && <div className="map-empty-hint">Primero necesitás crear un campo desde la aplicación móvil para poder asociar el lote.</div>}
    {fields.length > 0 && !canManageLots && <div className="map-permission-hint">Podés consultar el mapa, pero tu función no tiene el permiso “Administrar lotes”. Un dueño o administrador puede habilitarlo desde Miembros y grupo.</div>}
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

function RealPlotPanel({ plot, fieldName, records, onRecord, onNewRecord, onMonitoring, onSatellite, onClose }: { plot: Plot; fieldName: string; records: RecordRow[]; onRecord: (record: RecordRow) => void; onNewRecord: () => void; onMonitoring: () => void; onSatellite: () => void; onClose: () => void }) {
  const ordered = [...records].sort((a,b) => String(b.record_date).localeCompare(String(a.record_date)));
  const monitorings = ordered.filter(row => row.record_type === "monitoring").slice(0, 5);
  const activities = ordered.filter(row => row.record_type !== "monitoring").slice(0, 5);
  return <aside className="lot-panel operational-panel"><div className="panel-handle"/><div className="lot-head"><div><span className="eyebrow">LOTE</span><h2>{plot.name}</h2><p><MapPin/> {fieldName}</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="lot-metrics"><div><small>Superficie</small><strong>{number(plot.arable_area).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha</strong></div><div><small>Cultivo actual</small><strong><i style={{ background: plot.cropColor || "#77847e" }}/>{plot.cropName || "Sin cultivo"}</strong></div></div>
    <div className="quick-actions plot-actions"><button onClick={onSatellite}><Satellite/>Imágenes satelitales</button><button onClick={onNewRecord}><Plus/>Nuevo registro</button><button onClick={onMonitoring}><Activity/>Monitorear</button></div>
    <PlotActivitySection title="Últimos registros" icon={FileText} rows={activities} onOpen={onRecord}/>
    <PlotActivitySection title="Últimos monitoreos" icon={Activity} rows={monitorings} onOpen={onRecord}/>
  </aside>;
}

function PlotActivitySection({ title, icon: Icon, rows, onOpen }: { title: string; icon: typeof Activity; rows: RecordRow[]; onOpen: (record: RecordRow) => void }) {
  return <section><div className="section-title"><div><Icon/>{title}</div><span>{rows.length}</span></div>{rows.map(row => <button className="activity-row activity-button" key={row.id} onClick={() => onOpen(row)}><div className="activity-icon"><Leaf/></div><div><strong>{recordType(row.record_type)}{recordCrop(row) ? ` · ${recordCrop(row)}` : ""}</strong><small>{formatDate(row.record_date)} · {number(row.worked_area).toLocaleString("es-AR")} ha</small></div><ChevronRight/></button>)}{!rows.length && <p className="panel-empty">No hay información cargada.</p>}</section>;
}

function RecordDetail({ record, onClose }: { record: RecordRow; onClose: () => void }) {
  const details = recordData(record);
  return <div className="record-detail-backdrop"><article className="record-detail-sheet"><header><button className="icon-button" onClick={onClose}><ChevronLeft/></button><div><span className="eyebrow">{record.record_type === "monitoring" ? "MONITOREO" : "REGISTRO"}</span><h2>{recordType(record.record_type)}{recordCrop(record) ? ` · ${recordCrop(record)}` : ""}</h2><p>{relation(record.fields)?.name || "Campo"} · {relation(record.plots)?.name || "Sin lote"}</p></div><button className="icon-button" onClick={onClose}><X/></button></header><div className="detail-hero"><CalendarDays/><div><small>Fecha</small><strong>{formatDate(record.record_date)}</strong></div><div><small>Campaña</small><strong>{relation(record.campaigns)?.name || "Sin campaña"}</strong></div><div><small>Superficie</small><strong>{number(record.worked_area).toLocaleString("es-AR")} ha</strong></div></div><section><h3>Información registrada</h3><div className="detail-grid">{Object.entries(details).filter(([,value]) => value !== null && value !== "").map(([key,value]) => <div key={key}><small>{detailLabel(key)}</small><strong>{String(value)}</strong></div>)}{!Object.keys(details).length && <EmptyLine text="Este registro no tiene datos adicionales."/>}</div></section></article></div>;
}

function RealFieldsView({ fields, plots, onOpenPlot }: { fields: Field[]; plots: Plot[]; onOpenPlot: (plot: Plot) => void }) {
  const [openField, setOpenField] = useState<string | null>(fields[0]?.id ?? null);
  return <div className="page-content"><PageHead title="Campos" text="Abrí un campo para consultar sus lotes, superficie y cultivos."/>
    <div className="stats-grid"><Stat label="Campos activos" value={String(fields.length)} detail={`${sum(fields.map(f => number(f.arable_area))).toLocaleString("es-AR")} ha sembrables`} icon={MapPin}/><Stat label="Lotes" value={String(plots.length)} detail={`${plots.filter(p => geometry(p.geometry_json)).length} georreferenciados`} icon={Grid2X2}/><Stat label="Superficie en lotes" value={`${sum(plots.map(p => number(p.arable_area))).toLocaleString("es-AR")} ha`} detail="Datos sincronizados" icon={Sprout}/></div>
    <div className="field-stack">{fields.map(field => {
      const children = plots.filter(plot => plot.field_id === field.id);
      const expanded = openField === field.id;
      const area = sum(children.map(plot => number(plot.arable_area)));
      return <section className={`field-card ${expanded ? "expanded" : ""}`} key={field.id}>
        <button className="field-summary" onClick={() => setOpenField(expanded ? null : field.id)}>
          <div className="field-icon"><MapPin/></div><div><h3>{field.name}</h3><p>{[field.locality, field.province].filter(Boolean).join(" · ") || "Sin ubicación informada"}</p></div>
          <div className="field-metric"><strong>{area.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha</strong><small>{children.length} lote{children.length === 1 ? "" : "s"}</small></div><ChevronDown/>
        </button>
        {expanded && <div className="field-plots">{children.map(plot => <button className="field-plot-row" key={plot.id} onClick={() => onOpenPlot(plot)}>
          <i style={{ background: plot.cropColor || "#77847e" }}/><div><strong>{plot.name}</strong><small>{plot.cropName || "Sin cultivo asignado"}</small></div>
          <span>{number(plot.arable_area).toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha</span><em>{geometry(plot.geometry_json) ? "En mapa" : "Sin trazar"}</em><ChevronRight/>
        </button>)}{!children.length && <EmptyLine text="Este campo todavía no tiene lotes."/ >}</div>}
      </section>;
    })}{!fields.length && <div className="content-card"><EmptyLine text="Todavía no hay campos en este grupo."/></div>}</div>
  </div>;
}

function RealRecordsView({ records }: { records: RecordRow[] }) {
  const [query, setQuery] = useState("");
  const visible = records.filter(row => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return <div className="page-content"><PageHead title="Registros" text="Actividad real sincronizada con Android."/><div className="records-toolbar"><div className="inner-search"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por campo, lote o tipo…"/></div><button className="soft-button"><Filter/>Filtros</button></div><div className="record-list">{visible.map(row => <article className="record-card" key={row.id}><div className="record-type-icon"><Leaf/></div><div className="record-main"><span>{recordType(row.record_type)}</span><h3>{relation(row.fields)?.name ?? "Campo"} · {relation(row.plots)?.name ?? "Sin lote"}</h3><p>{number(row.worked_area).toLocaleString("es-AR")} ha</p></div><div className="record-meta"><strong>{formatDate(row.record_date)}</strong><small>{relation(row.campaigns)?.name ?? "Sin campaña"}</small></div><button className="icon-button"><ChevronRight/></button></article>)}{!visible.length && <EmptyLine text="No hay registros para mostrar."/>}</div></div>;
}

function RealReportsView({ fields, plots, records, crops }: { fields: Field[]; plots: Plot[]; records: RecordRow[]; crops: Crop[] }) {
  const [fieldId, setFieldId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [crop, setCrop] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [chartDimension, setChartDimension] = useState("crop");
  const [chartMetric, setChartMetric] = useState("worked_area");
  const filtered = records.filter(row => (!fieldId || row.field_id === fieldId) && (!plotId || row.plot_id === plotId) && (!type || row.record_type === type) && (!crop || recordCrop(row).toLowerCase() === crop.toLowerCase()));
  const filteredPlots = plots.filter(plot => (!fieldId || plot.field_id === fieldId) && (!plotId || plot.id === plotId) && (!crop || plot.cropName?.toLowerCase() === crop.toLowerCase()) && (!priority || normalizePriorityColor(plot.priority_color) === priority));
  const area = sum(filteredPlots.map(plot => number(plot.arable_area)));
  const worked = sum(filtered.map(row => number(row.worked_area)));
  const chartRows = Object.entries(filtered.reduce<Record<string,number>>((acc,row)=>{const label=chartDimension==="field"?(relation(row.fields)?.name||"Sin campo"):chartDimension==="plot"?(relation(row.plots)?.name||"Sin lote"):chartDimension==="campaign"?(relation(row.campaigns)?.name||"Sin campaña"):chartDimension==="type"?recordType(row.record_type):chartDimension==="month"?String(row.record_date).slice(0,7):(recordCrop(row)||"Sin cultivo");const value=chartMetric==="count"?1:chartMetric==="cost"?number(recordData(row).total_cost as string|number):number(row.worked_area);acc[label]=(acc[label]??0)+value;return acc;},{})).sort((a,b)=>b[1]-a[1]);
  const chartMax=Math.max(1,...chartRows.map(([,value])=>value));
  return <div className="page-content"><PageHead title="Reportes" text="El mismo análisis operativo de la app, con filtros combinables."/>
    <div className="report-filter premium-filter"><select value={fieldId} onChange={e => { setFieldId(e.target.value); setPlotId(""); }}><option value="">Todos los campos</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select><select value={plotId} onChange={e => setPlotId(e.target.value)}><option value="">Todos los lotes</option>{plots.filter(plot => !fieldId || plot.field_id === fieldId).map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select><select value={crop} onChange={e => setCrop(e.target.value)}><option value="">Todos los cultivos</option>{crops.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select><select value={type} onChange={e => setType(e.target.value)}><option value="">Todos los registros</option>{Array.from(new Set(records.map(row => row.record_type))).map(item => <option key={item} value={item}>{recordType(item)}</option>)}</select><button onClick={() => { setFieldId(""); setPlotId(""); setCrop(""); setType(""); }}><RotateCcw/>Limpiar</button></div>
    <div className="kpi-grid"><Kpi label="Superficie analizada" value={`${area.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha`}/><Kpi label="Superficie trabajada" value={`${worked.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha`}/><Kpi label="Lotes incluidos" value={String(filteredPlots.length)}/><Kpi label="Registros incluidos" value={String(filtered.length)}/></div>
    <div className="chart-card analytics-chart"><div className="chart-head"><div><h3>Gráfico operativo</h3><p>Elegí la dimensión y la métrica, igual que en Análisis de Android.</p></div><BarChart3/></div><div className="chart-controls"><label>Agrupar por<select value={chartDimension} onChange={event=>setChartDimension(event.target.value)}><option value="crop">Cultivo</option><option value="plot">Lote</option><option value="field">Campo</option><option value="campaign">Campaña</option><option value="type">Tipo de registro</option><option value="month">Mes</option></select></label><label>Métrica<select value={chartMetric} onChange={event=>setChartMetric(event.target.value)}><option value="worked_area">Superficie trabajada</option><option value="count">Cantidad de registros</option><option value="cost">Costo total</option></select></label></div><div className="analytics-bars">{chartRows.map(([label,value])=><div key={label}><strong>{label}</strong><i><b style={{width:`${value/chartMax*100}%`}}/></i><span>{value.toLocaleString("es-AR",{maximumFractionDigits:2})}{chartMetric==="worked_area"?" ha":""}</span></div>)}{!chartRows.length&&<EmptyLine text="No hay datos para graficar con estos filtros."/>}</div></div>
    <div className="content-card report-summary"><div className="priority-summary-head"><div><h3>Resumen de prioridades</h3><p>Filtrá los lotes por la prioridad asignada en el grupo.</p></div><div className="priority-filter"><button className={!priority ? "active" : ""} onClick={() => setPriority("")}>Todas</button><button className={priority === "#D32F2F" ? "active" : ""} onClick={() => setPriority("#D32F2F")}><i style={{background:"#D32F2F"}}/>Alta</button><button className={priority === "#FBC02D" ? "active" : ""} onClick={() => setPriority("#FBC02D")}><i style={{background:"#FBC02D"}}/>Media</button><button className={priority === "#388E3C" ? "active" : ""} onClick={() => setPriority("#388E3C")}><i style={{background:"#388E3C"}}/>Baja</button></div></div>{fields.filter(field => !fieldId || field.id === fieldId).map(field => <section key={field.id}><h4>{field.name}</h4>{filteredPlots.filter(plot => plot.field_id === field.id).map(plot => <div key={plot.id}><i style={{ background: plot.priority_color || "#77847e" }}/><span>{plot.name}</span><small>{plot.cropName || "Sin cultivo"}</small><strong>{number(plot.arable_area).toLocaleString("es-AR")} ha</strong></div>)}</section>)}</div>
  </div>;
}

function RealSettingsView({ groupId, userId, settings, onSaved }: { groupId: string; userId: string; settings: AppSettings; onSaved: (value: AppSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setDraft(settings), [settings]);
  async function save() {
    setSaving(true); setMessage("");
    const { error } = await supabase.from("app_settings").upsert({ group_id: groupId, user_id: userId, ...draft }, { onConflict: "group_id,user_id" });
    setSaving(false);
    if (error) setMessage(error.message); else { onSaved(draft); setMessage("Configuración guardada."); }
  }
  return <div className="page-content settings-page"><PageHead title="Configuración" text="Preferencias personales para este grupo."/><div className="settings-grid">
    <section className="content-card"><div className="settings-title"><Settings2/><div><h3>Apariencia y formato</h3><p>La configuración se sincroniza con tu cuenta.</p></div></div>
      <label>Tema<select value={draft.appearance} onChange={e => setDraft({ ...draft, appearance: e.target.value })}><option value="system">Usar tema del dispositivo</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
      <label>Unidad de superficie<select value={draft.area_unit} onChange={e => setDraft({ ...draft, area_unit: e.target.value })}><option value="ha">Hectáreas (ha)</option><option value="m2">Metros cuadrados (m²)</option></select></label>
      <label>Formato de fecha<select value={draft.date_format} onChange={e => setDraft({ ...draft, date_format: e.target.value })}><option value="dd-MM-yyyy">Día-mes-año</option><option value="dd/MM/yyyy">Día/mes/año</option><option value="yyyy-MM-dd">Año-mes-día</option></select></label>
      <label className="settings-check"><input type="checkbox" checked={draft.notifications_enabled} onChange={e => setDraft({ ...draft, notifications_enabled: e.target.checked })}/><span><strong>Notificaciones</strong><small>Recibir avisos operativos del grupo.</small></span></label>
      {message && <p className={message.includes("guardada") ? "save-success" : "form-error"}>{message}</p>}<button className="settings-save" disabled={saving} onClick={save}>{saving ? <LoaderCircle className="spin"/> : <Save/>}Guardar cambios</button>
    </section>
    <section className="content-card settings-help"><SlidersHorizontal/><h3>Configuración del grupo</h3><p>Los datos institucionales, miembros, roles y permisos se administran desde la sección Equipo. Las preferencias de esta pantalla solo afectan a tu cuenta.</p></section>
  </div></div>;
}

function ManagementView({ groupId, userId, fields, plots, campaigns, clients, crops, canFields, canLots, canCampaigns, canRecords, initialRecord, onInitialRecordConsumed, onMap, onSaved }: { groupId: string; userId: string; fields: Field[]; plots: Plot[]; campaigns: Campaign[]; clients: ClientRow[]; crops: Crop[]; canFields: boolean; canLots: boolean; canCampaigns: boolean; canRecords: boolean; initialRecord: {plotId:string;type:string}|null; onInitialRecordConsumed:()=>void; onMap: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<"field"|"campaign"|"client"|"record"|null>(null);
  const [data, setData] = useState<Record<string,string>>({}); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
  function open(value: typeof form, seed?: {plotId:string;type:string}){const selected=seed?plots.find(plot=>plot.id===seed.plotId):null;const initial:Record<string,string>=value === "record" ? { record_type:seed?.type??"sowing", record_date:new Date().toISOString().slice(0,10), campaign_id:campaigns.find(c=>c.status==="active")?.id ?? campaigns[0]?.id ?? "", plot_id:selected?.id??"",field_id:selected?.field_id??"",worked_area:String(selected?.arable_area??"") } : {};setForm(value);setData(initial);setMessage("");if(seed?.type==="monitoring"&&selected&&navigator.geolocation){navigator.geolocation.getCurrentPosition(position=>{const point:[number,number]=[position.coords.longitude,position.coords.latitude];const feature=geometry(selected.geometry_json);setData(current=>({...current,gps_latitude:String(point[1]),gps_longitude:String(point[0]),gps_accuracy_m:String(position.coords.accuracy),gps_captured_at:new Date(position.timestamp).toISOString(),gps_status:feature&&pointInsidePolygon(point,feature)?"Dentro del lote":"Fuera del lote"}));},()=>setData(current=>({...current,gps_status:"Ubicación no disponible"})),{enableHighAccuracy:true,timeout:12000});}}
  useEffect(()=>{if(initialRecord){open("record",initialRecord);onInitialRecordConsumed();}},[initialRecord]);
  async function save(event: FormEvent){event.preventDefault();setSaving(true);setMessage("");let error: {message:string}|null=null;
    if(form==="field")({error}=await supabase.from("fields").insert({id:crypto.randomUUID(),group_id:groupId,client_id:data.client_id||null,name:data.name?.trim(),location:data.location||null,locality:data.locality||null,province:data.province||null,total_area:number(data.total_area),arable_area:number(data.arable_area),created_by:userId}));
    if(form==="client")({error}=await supabase.from("clients").insert({id:crypto.randomUUID(),group_id:groupId,name:data.name?.trim(),cuit:data.cuit?.replace(/\D/g,"")||null,phone:data.phone||null,email:data.email||null,created_by:userId}));
    if(form==="campaign")({error}=await supabase.from("campaigns").insert({id:crypto.randomUUID(),group_id:groupId,name:data.name?.trim(),start_date:data.start_date,end_date:data.end_date,status:"planned",created_by:userId}));
    if(form==="record"){const selectedPlot=plots.find(p=>p.id===data.plot_id);const details=recordDetailsPayload(data);const storedType=["napa","soil_analysis"].includes(data.record_type)?"other":data.record_type;const result=await supabase.rpc("save_activity_record",{p_id:null,p_group_id:groupId,p_campaign_id:data.campaign_id,p_field_id:data.field_id||selectedPlot?.field_id||null,p_plot_id:data.plot_id||null,p_type:storedType,p_date:data.record_date,p_worked_area:data.record_type==="napa"?null:number(data.worked_area)||null,p_responsible_id:null,p_contractor:["monitoring","napa"].includes(data.record_type)?"":data.contractor||"",p_machinery:["monitoring","napa"].includes(data.record_type)?"":data.machinery||"",p_observations:data.record_type==="napa"?"":data.observations||"",p_allow_member_edits:data.record_type==="monitoring"?false:data.allow_member_edits==="true",p_data:details});error=result.error;}
    setSaving(false);if(error)setMessage(error.message);else{setForm(null);onSaved();}}
  const cards=[{key:"field" as const,title:"Nuevo campo",text:"Establecimiento, superficie y ubicación",icon:MapPin,enabled:canFields},{key:"lot" as const,title:"Nuevo lote",text:"Dibujalo y asignalo a un campo",icon:Grid2X2,enabled:canLots},{key:"campaign" as const,title:"Nueva campaña",text:"Ciclo productivo y fechas",icon:CalendarDays,enabled:canCampaigns},{key:"client" as const,title:"Nuevo cliente",text:"Titular o empresa vinculada",icon:Users,enabled:canFields},{key:"record" as const,title:"Nuevo registro",text:"Actividad agrícola o monitoreo",icon:FileText,enabled:canRecords}];
  return <div className="page-content"><PageHead title="Centro de gestión" text="Creá y administrá la operación sin salir de la web."/><div className="management-grid">{cards.map(item=><button key={item.key} disabled={!item.enabled} onClick={()=>item.key==="lot"?onMap():open(item.key)}><div><item.icon/></div><section><h3>{item.title}</h3><p>{item.text}</p></section><ChevronRight/></button>)}</div><div className="management-counts"><Kpi label="Campos" value={String(fields.length)}/><Kpi label="Lotes" value={String(plots.length)}/><Kpi label="Campañas" value={String(campaigns.length)}/><Kpi label="Clientes" value={String(clients.length)}/></div>
    {form&&<div className="record-detail-backdrop"><form className="entity-form" onSubmit={save}><header><div><span className="eyebrow">NUEVA ALTA</span><h2>{formTitle(form)}</h2></div><button type="button" className="icon-button" onClick={()=>setForm(null)}><X/></button></header>
      {(form==="field"||form==="client"||form==="campaign")&&<label>Nombre<input required value={data.name||""} onChange={e=>setData({...data,name:e.target.value})}/></label>}
      {form==="field"&&<><label>Cliente<select value={data.client_id||""} onChange={e=>setData({...data,client_id:e.target.value})}><option value="">Sin cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="form-pair"><label>Superficie total (ha)<input required inputMode="decimal" value={data.total_area||""} onChange={e=>setData({...data,total_area:e.target.value})}/></label><label>Superficie sembrable (ha)<input required inputMode="decimal" value={data.arable_area||""} onChange={e=>setData({...data,arable_area:e.target.value})}/></label></div><div className="form-pair"><label>Localidad<input value={data.locality||""} onChange={e=>setData({...data,locality:e.target.value})}/></label><label>Provincia<input value={data.province||""} onChange={e=>setData({...data,province:e.target.value})}/></label></div></>}
      {form==="client"&&<div className="form-pair"><label>CUIT<input value={data.cuit||""} onChange={e=>setData({...data,cuit:e.target.value})}/></label><label>Teléfono<input value={data.phone||""} onChange={e=>setData({...data,phone:e.target.value})}/></label><label>Correo<input type="email" value={data.email||""} onChange={e=>setData({...data,email:e.target.value})}/></label></div>}
      {form==="campaign"&&<div className="form-pair"><label>Fecha de inicio<input required type="date" value={data.start_date||""} onChange={e=>setData({...data,start_date:e.target.value})}/></label><label>Fecha de cierre<input required type="date" value={data.end_date||""} onChange={e=>setData({...data,end_date:e.target.value})}/></label></div>}
      {form==="record"&&<><div className="form-pair"><label>Tipo<select value={data.record_type||"sowing"} onChange={e=>setData({...data,record_type:e.target.value})}>{["sowing","spraying","fertilization","harvest","work","monitoring","napa","soil_analysis","other"].map(t=><option key={t} value={t}>{recordType(t)}</option>)}</select></label><label>Fecha<input required type="date" value={data.record_date||""} onChange={e=>setData({...data,record_date:e.target.value})}/></label></div><label>Campaña<select required value={data.campaign_id||""} onChange={e=>setData({...data,campaign_id:e.target.value})}>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="form-pair"><label>Campo<select value={data.field_id||""} onChange={e=>setData({...data,field_id:e.target.value,plot_id:""})}><option value="">Seleccionar</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Lote<select required value={data.plot_id||""} onChange={e=>{const plot=plots.find(p=>p.id===e.target.value);setData({...data,plot_id:e.target.value,field_id:plot?.field_id||data.field_id,worked_area:String(plot?.arable_area||"")})}}><option value="">Seleccionar</option>{plots.filter(p=>!data.field_id||p.field_id===data.field_id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>{data.record_type!=="napa"&&<div className="form-pair"><label>Superficie trabajada<input inputMode="decimal" value={data.worked_area||""} onChange={e=>setData({...data,worked_area:e.target.value})}/></label><label>Cultivo<select value={data.crop||""} onChange={e=>setData({...data,crop:e.target.value})}><option value="">Sin cultivo</option>{crops.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label></div>}<RecordSpecificFields data={data} setData={setData}/>{data.record_type!=="napa"&&<label>Observaciones<textarea value={data.observations||""} onChange={e=>setData({...data,observations:e.target.value})}/></label>}</>}
      {message&&<p className="form-error">{message}</p>}<div className="entity-actions"><button type="button" onClick={()=>setForm(null)}>Cancelar</button><button className="save" disabled={saving}>{saving?<LoaderCircle className="spin"/>:<Save/>}Guardar</button></div></form></div>}
  </div>;
}

const specificRecordFields: Record<string, Array<[string,string,string?]>> = {
  sowing: [["variety","Variedad"],["row_distance","Distancia entre surcos","number"],["seeding_density","Densidad de siembra (semillas/m²)","number"],["labor_cost_per_ha","Costo de labor por ha","number"],["input_name","Insumo / semilla"],["dose_per_ha","Dosis por ha","number"],["input_unit_price","Precio unitario","number"]],
  spraying: [["application_volume","Volumen de aplicación","number"],["target","Objetivo"],["weather","Condiciones climáticas"],["applicator","Aplicador"],["application_cost_per_ha","Costo de aplicación por ha","number"],["input_name","Producto / insumo"],["dose_per_ha","Dosis por ha","number"],["input_unit_price","Precio unitario","number"]],
  fertilization: [["method","Método de aplicación"],["labor_cost_per_ha","Costo de labor por ha","number"],["input_name","Fertilizante / insumo"],["dose_per_ha","Dosis por ha","number"],["input_unit_price","Precio unitario","number"]],
  work: [["work_type","Tipo de roturación"],["operator","Operador"],["price_per_ha","Precio por hectárea","number"]],
  harvest: [["harvested_area","Superficie cosechada","number"],["total_production","Producción total","number"],["unit","Unidad"],["humidity","Humedad","number"],["losses","Pérdidas","number"],["harvest_cost_per_ha","Costo de cosecha por ha","number"],["destination","Destino del grano"],["price","Precio","number"]],
  monitoring: [["phenological_state","Estado fenológico"],["monitoring_priority","Importancia (1 a 5)","number"],["weeds","Malezas"],["weed_levels","Infestación por maleza"],["insects","Insectos"],["insect_levels","Nivel por insecto"],["diseases","Enfermedades"],["disease_levels","Nivel por enfermedad"]],
  napa: [["water_table_depth","Profundidad de napa","number"]],
  soil_analysis: [["sample_depth","Profundidad de muestreo (cm)","number"],["sampling_method","Método de muestreo"],["laboratory","Laboratorio"],["ph","pH","number"],["organic_matter","Materia orgánica (%)","number"],["phosphorus","Fósforo (ppm)","number"],["nitrogen","Nitrógeno (ppm)","number"],["sulfur","Azufre (ppm)","number"],["zinc","Zinc (ppm)","number"],["no3","NO3 (ppm)","number"],["potassium","Potasio (ppm)","number"],["cec","CIC (meq/100g)","number"],["ec","CE (dS/m)","number"],["recommendations","Recomendaciones"]],
  other: [["title","Tipo de registro"],["description","Descripción"]]
};
function RecordSpecificFields({data,setData}:{data:Record<string,string>;setData:(value:Record<string,string>)=>void}){
  const fields=specificRecordFields[data.record_type]??[];
  return <><div className="specific-fields">{fields.map(([key,label,type])=><label key={key}>{label}<input type={type??"text"} inputMode={type==="number"?"decimal":undefined} min={key==="monitoring_priority"?1:undefined} max={key==="monitoring_priority"?5:undefined} value={data[key]??""} onChange={event=>setData({...data,[key]:event.target.value})}/></label>)}</div>{data.record_type==="monitoring"&&<div className={`gps-form-status ${data.gps_status==="Dentro del lote"?"inside":"outside"}`}><MapPin/><div><strong>{data.gps_status||"Obteniendo ubicación GPS…"}</strong><small>{data.gps_accuracy_m?`Precisión aproximada: ${Math.round(number(data.gps_accuracy_m))} m`:"El monitoreo se puede guardar aunque no haya señal."}</small></div></div>}</>;
}
function recordDetailsPayload(data:Record<string,string>){
  const baseKeys=new Set(["record_type","record_date","campaign_id","field_id","plot_id","worked_area","contractor","machinery","observations","allow_member_edits"]);
  const details=Object.fromEntries(Object.entries(data).filter(([key,value])=>!baseKeys.has(key)&&String(value).trim()!==""));
  if(data.record_type==="napa")details.record_kind="water_table";
  if(data.record_type==="soil_analysis"){
    details.record_kind="soil_analysis"; details.soil_sample_count="1";
    for(const [key] of specificRecordFields.soil_analysis){if(details[key]){details[`soil_sample_0_${key}`]=details[key];delete details[key];}}
  }
  if(data.record_type==="harvest"){
    const area=number(data.harvested_area),production=number(data.total_production),price=number(data.price);
    if(area>0&&production>=0)details.yield_per_ha=String(production/area);
    if(price>0&&production>=0)details.estimated_income=String(price*production);
  }
  if(["sowing","spraying","fertilization"].includes(data.record_type)&&data.input_name){details.inputs_json=JSON.stringify([{name:data.input_name,dose_per_ha:data.dose_per_ha||"",unit_price:data.input_unit_price||""}]);}
  return details;
}

function RealTeamView({ groupId, members, canManage, onSaved }: { groupId:string; members: Member[]; canManage:boolean; onSaved:()=>void }) {
  const [busy,setBusy]=useState("");const [message,setMessage]=useState("");async function role(userId:string,role:string){setBusy(userId);const {error}=await supabase.rpc("change_member_role",{p_group_id:groupId,p_user_id:userId,p_role:role});setBusy("");if(error)setMessage(error.message);else onSaved();}async function remove(userId:string){if(!confirm("¿Quitar este usuario del grupo?"))return;setBusy(userId);const {error}=await supabase.rpc("remove_group_member",{p_group_id:groupId,p_user_id:userId});setBusy("");if(error)setMessage(error.message);else onSaved();}
  return <div className="page-content"><PageHead title="Equipo" text="Miembros activos del grupo seleccionado."/>{message&&<p className="form-error">{message}</p>}<div className="team-grid">{members.map(member => { const profile = relation(member.profiles); const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || "Usuario"; return <article className="member-card" key={member.user_id}><div className="member-avatar">{initials(name)}</div><div><h3>{name}</h3><p>{roleName(member.role)}</p></div><span className="member-active"><i/>Activo</span><div className="access"><small>Cuenta</small><strong>{profile?.email ?? "Sin correo visible"}</strong></div>{canManage&&member.role!=="owner"&&<div className="member-admin"><select disabled={busy===member.user_id} value={member.role} onChange={e=>void role(member.user_id,e.target.value)}>{["admin","agronomist","operator","producer","member"].map(r=><option key={r} value={r}>{roleName(r)}</option>)}</select><button disabled={busy===member.user_id} onClick={()=>void remove(member.user_id)}>Quitar</button></div>}</article>; })}{!members.length && <EmptyLine text="No hay miembros visibles."/>}</div></div>;
}

function Brand() {
  return <div className="brand"><img className="brand-logo" src="/growr360-logo.png" alt="Growr360"/><div><strong>Growr<span>360</span></strong><small>Gestión agrícola</small></div></div>;
}
function LoadingScreen({ text }: { text: string }) { return <div className="loading-screen"><img className="splash-logo" src="/growr360-logo.png" alt="Growr360"/><LoaderCircle className="spin"/><strong>{text}</strong></div>; }
function EmptyWorkspace() { return <div className="empty-workspace"><Users/><h2>Tu cuenta todavía no tiene un grupo activo</h2><p>Creá un grupo o enviá una solicitud desde la aplicación móvil. Cuando te acepten, aparecerá acá automáticamente.</p></div>; }
function EmptyLine({ text }: { text: string }) { return <div className="empty-line">{text}</div>; }
function PageHead({ title, text }: { title: string; text: string }) { return <div className="page-head"><div><h2>{title}</h2><p>{text}</p></div></div>; }
function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof MapPin }) { return <div className="stat-card"><div><Icon/></div><section><small>{label}</small><strong>{value}</strong><p>{detail}</p></section></div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <div className="kpi"><small>{label}</small><strong>{value}</strong><span className="positive">Datos reales</span></div>; }
function subtitle(view: View) { return ({ campos: "Estructura territorial y productiva", registros: "Actividad sincronizada del equipo", gestion: "Altas y operación del grupo", reportes: "Indicadores del grupo activo", equipo: "Miembros y roles", configuracion: "Preferencias personales", mapa: "" } as Record<View, string>)[view]; }
function formTitle(value:string){return({field:"Crear campo",campaign:"Crear campaña",client:"Crear cliente",record:"Crear registro"}as Record<string,string>)[value]??"Nueva alta";}
function cap(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "G"; }
function roleName(role?: string) { return ({ owner: "Propietario", admin: "Administrador", agronomist: "Ingeniero / Agrónomo", operator: "Operador", monitor: "Monitoreador", producer: "Productor", member: "Miembro" } as Record<string, string>)[role ?? ""] ?? cap(role ?? "Miembro"); }
function recordType(type: string) { return ({ sowing: "Siembra", spraying: "Pulverización", fertilization: "Fertilización", harvest: "Cosecha", work: "Roturación", monitoring: "Monitoreo", napa: "Napa", soil_analysis: "Análisis de suelo", expense: "Gasto", other: "Otros" } as Record<string, string>)[type] ?? cap(type); }
function formatDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).format(date); }
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function plotColor(plot: Plot, layer: string) { if (layer === "prioridad") return plot.priority_color || "#718078"; return plot.cropColor || "#77847e"; }
function recordCrop(row: RecordRow) {
  const details = recordData(row);
  return String(details.crop ?? details.cultivo ?? details.crop_name ?? "");
}
function recordData(row: RecordRow) {
  const relationNames = ["sowing_records", "spraying_records", "fertilization_records", "harvest_records", "work_records", "monitoring_records", "expense_records", "other_records"] as const;
  const embedded = relationNames.map(name => relation(row[name])?.data).find(Boolean) ?? {};
  return { ...embedded, ...(row.details ?? {}) } as Record<string, unknown>;
}
function detailLabel(key: string) { return key.replace(/^gps_/, "GPS ").replaceAll("_", " ").replace(/\b\w/g, value => value.toUpperCase()); }
function defaultCropColor(name: string) {
  const palette = ["#8E24AA", "#7CB342", "#F4511E", "#FDD835", "#FB8C00", "#1E88E5", "#31E048", "#43A047", "#00897B", "#D32F2F", "#F9A825", "#6D4C41", "#3949AB", "#00ACC1"];
  let hash = 0; for (const char of name.toLowerCase()) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
function normalizeText(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es"); }
function monitoringPriorityColor(level: number) { return (["#2E7D32", "#7CB342", "#FBC02D", "#F57C00", "#D32F2F"])[Math.max(1, Math.min(5, level)) - 1]; }
function normalizePriorityColor(value?: string | null) { const color = String(value ?? "").toUpperCase(); return ({ RED: "#D32F2F", YELLOW: "#FBC02D", GREEN: "#388E3C" } as Record<string,string>)[color] ?? color; }
function normalizeCropName(value: string) { return normalizeText(value); }
function resolvePlotCrops(plots: Plot[], records: RecordRow[], assignments: PlotCampaign[], colors: CropColor[], crops: Crop[], preferredCampaignId?: string) {
  return plots.map(plot => {
    const plotRecords = records.filter(row => row.plot_id === plot.id && recordCrop(row));
    const campaignRecords = preferredCampaignId ? plotRecords.filter(row => row.campaign_id === preferredCampaignId) : plotRecords;
    const newest = campaignRecords.sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)))[0];
    const preferredAssignment = assignments.find(item => item.plot_id === plot.id && item.campaign_id === preferredCampaignId);
    const activeAssignment = preferredAssignment ?? assignments.find(item => item.plot_id === plot.id && relation(item.campaigns)?.status === "active") ?? assignments.find(item => item.plot_id === plot.id);
    const name = newest ? recordCrop(newest) : relation(activeAssignment?.crops)?.name ?? null;
    const matchingAssignment = assignments.find(item => item.plot_id === plot.id && (!preferredCampaignId || item.campaign_id === preferredCampaignId) && name && normalizeCropName(relation(item.crops)?.name ?? "") === normalizeCropName(name));
    const catalogMatch = crops.filter(crop => name && normalizeCropName(crop.name) === normalizeCropName(name)).sort((a, b) => Number(Boolean(b.group_id)) - Number(Boolean(a.group_id)))[0];
    const cropId = matchingAssignment?.crop_id ?? catalogMatch?.id ?? activeAssignment?.crop_id;
    return { ...plot, cropName: name, cropColor: (cropId && colors.find(item => item.crop_id === cropId)?.color) || (name ? defaultCropColor(name) : "#77847e") };
  });
}
function transparentPixel() { return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5WQAAAABJRU5ErkJggg=="; }
function featureBounds(feature: GeoFeature) {
  const points = feature.geometry.coordinates[0] ?? [];
  return { west: Math.min(...points.map(p => p[0])), east: Math.max(...points.map(p => p[0])), south: Math.min(...points.map(p => p[1])), north: Math.max(...points.map(p => p[1])) };
}
function satelliteIndexName(value: string) { return ({ RGB: "RGB natural", NDVI: "NDVI", NDVI_CONTRASTED: "NDVI contrastado", FALSE_COLOR: "Falso color", NDRE: "NDRE" } as Record<string, string>)[value] ?? value; }
function fitPlots(map: MapLibreMap, plots: MapPlot[]) {
  const coordinates = plots.flatMap(plot => plot.feature.geometry.coordinates[0] ?? []);
  if (!coordinates.length) return;
  const bounds = coordinates.reduce((box, point) => box.extend(point as [number, number]), new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));
  map.fitBounds(bounds as LngLatBoundsLike, { padding: 90, maxZoom: 15, duration: 700 });
}
function pointInsidePolygon(point:[number,number],feature:GeoFeature){const ring=feature.geometry.coordinates[0]??[];let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i], [xj,yj]=ring[j];const intersects=((yi>point[1])!==(yj>point[1]))&&(point[0]<(xj-xi)*(point[1]-yi)/((yj-yi)||Number.EPSILON)+xi);if(intersects)inside=!inside;}return inside;}
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
