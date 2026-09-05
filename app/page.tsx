"use client";

import "./landing-v3.css";
import "./operations-refinement.css";
import "./visual-refresh.css";
import "./landing-redesign.css";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import maplibregl, { GeoJSONSource, LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import JSZip from "jszip";
import {
  Activity, Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  CircleUserRound, FileText, Filter, Grid2X2, Layers3, Leaf, LoaderCircle, LogOut,
  Map, MapPin, Menu, Plus, RotateCcw, Save, Search, Settings2, Sprout, Tractor,
  TrendingUp, Undo2, Users, X, Satellite, SlidersHorizontal, BarChart3,
  Compass, LocateFixed, PieChart, LineChart, Waves, ContactRound, MoreHorizontal, Phone, CreditCard, Home
  , ArrowRight, BriefcaseBusiness, CloudSun, Eye, EyeOff, LockKeyhole, ShieldCheck, ImageIcon, UploadCloud,
  Copy, Link2, Mail, Smartphone, UserPlus, Paperclip, Download, Maximize2, FileUp, History, GripVertical, ArrowUp, ArrowDown
} from "lucide-react";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://emwfdcekpxwzvnidwdls.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_waHR1lcMgPHyP32KlyBcEw_uAL6n6-g";

type View = "mapa" | "campos" | "contratistas" | "registros" | "monitoreos" | "napas" | "campanas" | "ordenes" | "reportes" | "equipo" | "solicitudes" | "invitaciones" | "mas" | "configuracion" | "grupo" | "planes";
type Group = { id: string; name: string; description?: string | null; cuit?: string | null; image_path?: string | null };
type GroupDiscovery = {
  group_id: string; name: string; description?: string | null; cuit?: string | null;
  image_path?: string | null; creator_name?: string | null; creator_username?: string | null;
  created_at?: string | null; is_member: boolean; has_pending_request: boolean;
};
type GroupJoinRequest = {
  id: string; group_id: string; status: string; requested_role?: string | null;
  created_at: string; groups?: Group | Group[] | null;
};
type PendingGroupRequest = {
  id: string; user_id: string; name: string; username?: string | null; email: string;
  phone?: string | null; requested_role?: string | null; created_at: string;
};
type InvitationPreview = { group_id:string;group_name:string;email:string;role:string;expires_at:string;is_valid:boolean };
type GroupInvitation = { id:string;email:string;role:string;expires_at:string;created_at:string;status:string };
type PermissionOverride = { permission: string; allowed: boolean };
type Membership = {
  group_id: string; role: string; status: string; groups: Group | Group[] | null;
  member_permission_overrides?: PermissionOverride[] | null;
};
type Profile = { id: string; first_name: string; last_name: string; username: string; email: string; phone?: string | null; avatar_path?: string | null };
type Field = { id: string; group_id: string; name: string; total_area: number | string; arable_area: number | string; locality?: string | null; province?: string | null };
type Plot = {
  id: string; group_id: string; field_id: string; name: string; total_area: number | string;
  arable_area: number | string; geometry_json: GeoFeature | string | null; priority_color?: string | null;
  fields?: { name: string } | { name: string }[] | null; allow_member_edits?: boolean;
  cropName?: string | null; cropColor?: string | null;
};
type RecordRow = {
  id: string; record_type: string; record_date: string; worked_area?: number | string | null;
  contractor?: string | null; machinery_text?: string | null; observations?: string | null; created_at?: string | null;
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
type Contractor = { id:string;group_id:string;name:string;phone?:string|null;document?:string|null;address?:string|null;notes?:string|null };
type RecordAttachment = { id:string; record_id:string; file_name:string; storage_path:string; mime_type?:string|null; size_bytes?:number|null };
type ResolvedAttachment = RecordAttachment & { url:string };
type Supply = { id:string; name:string; category:string; unit:string; unit_price:number|string; currency:string };
type PlotLabelField = "plot_name"|"field_name"|"campaign"|"sowing_variety"|"sowing_date"|"last_crop"|"area"|"yield_per_ha";
type AppSettings = { appearance: string; area_unit: string; date_format: string; notifications_enabled: boolean; plot_label_fields?: PlotLabelField[] | null };
const DEFAULT_PLOT_LABEL_FIELDS: PlotLabelField[] = ["plot_name"];
const PLOT_LABEL_OPTIONS: Array<{id:PlotLabelField;label:string;hint:string}> = [
  {id:"plot_name",label:"Nombre del lote",hint:"Ej. Lote 2"},
  {id:"field_name",label:"Nombre del campo",hint:"Ej. El Ñato"},
  {id:"campaign",label:"Campaña",hint:"La campaña más reciente del lote"},
  {id:"sowing_variety",label:"Variedad de siembra",hint:"Solo toma la variedad registrada en una siembra"},
  {id:"sowing_date",label:"Fecha de siembra",hint:"Fecha del último registro de siembra"},
  {id:"last_crop",label:"Último cultivo",hint:"Último cultivo registrado o monitoreado"},
  {id:"area",label:"Superficie",hint:"Superficie sembrable del lote"},
  {id:"yield_per_ha",label:"Rendimiento / ha",hint:"Último rendimiento de cosecha disponible"}
];
type SubscriptionPlan = { code:"free"|"pro"|"business";name:string;max_hectares:number|null;max_fields:number|null;max_lots:number|null;max_users:number|null;max_kml_imports:number|null;features:string[];monthly_price_usd:number;annual_price_usd:number;included_hectares:number|null;extra_hectare_price_year_usd:number };
type GroupSubscription = { id:string;group_id:string;plan:"free"|"pro"|"business";status:"active"|"trialing"|"expired"|"cancelled";started_at:string;expires_at?:string|null };
// Single source of truth for the group's effective plan: public.group_subscriptions, scoped by group_id.
// A subscription only grants its plan while it is active/trialing and not expired; otherwise the group is treated as free.
// This must be the ONLY function in the app that decides which plan applies — never read plan info from
// user_subscriptions or from any profile-level subscription field.
function resolveActivePlan(subscription: GroupSubscription | null): "free"|"pro"|"business" {
  if (!subscription) return "free";
  const statusOk = subscription.status === "active" || subscription.status === "trialing";
  const notExpired = !subscription.expires_at || new Date(subscription.expires_at) > new Date();
  return statusOk && notExpired ? subscription.plan : "free";
}
type GroupSubscriptionUsage = { group_id:string;kml_imports:number;updated_at:string };
type WorkOrderType="sowing"|"spraying"|"fertilization"|"harvest"|"work"|"soil_analysis"|"other";
type WorkOrder = {id:string;group_id:string;campaign_id:string;field_id?:string|null;plot_id?:string|null;order_type:WorkOrderType;status:"draft"|"pending"|"in_progress"|"completed"|"cancelled";priority:"low"|"normal"|"high"|"urgent";title:string;instructions?:string|null;notes?:string|null;scheduled_date?:string|null;scheduled_end_date?:string|null;planned_area?:number|null;assigned_to?:string|null;contractor_id?:string|null;planned_data?:Record<string,unknown>;actual_data?:Record<string,unknown>;resulting_record_id?:string|null;created_by:string;completed_at?:string|null;created_at?:string|null;allow_member_edits?:boolean;fields?:{name:string}|null;plots?:{name:string}|null;campaigns?:{name:string}|null;profiles?:Profile|null;contractors?:{name:string}|null;work_order_products?:WorkOrderProduct[];work_order_plots?:WorkOrderPlot[]};
type WorkOrderProduct={id:string;input_id?:string|null;product_name:string;dose?:number|null;dose_unit?:string|null;planned_quantity?:number|null;actual_quantity?:number|null;notes?:string|null};
type WorkOrderPlot={id:string;work_order_id:string;group_id:string;field_id:string;plot_id:string;planned_area?:number|null;plots?:{name:string}|null};
type MemberResourceAccess = { field_id?: string | null; lot_id?: string | null };
type Member = { user_id: string; role: string; status: string; profiles?: Profile | null; member_permission_overrides?: PermissionOverride[] | null; member_resource_access?: MemberResourceAccess[] | null };
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
  { id: "monitoreos" as View, label: "Monitoreos", icon: Eye },
  { id: "napas" as View, label: "Napas", icon: Waves },
  { id: "campanas" as View, label: "Campañas", icon: CalendarDays },
  { id: "ordenes" as View, label: "Órdenes de trabajo", icon: BriefcaseBusiness },
  { id: "reportes" as View, label: "Reportes", icon: TrendingUp },
  { id: "equipo" as View, label: "Equipo", icon: Users },
  { id: "mas" as View, label: "Más", icon: Grid2X2 },
  { id: "configuracion" as View, label: "Configuración", icon: Settings2 },
  { id: "grupo" as View, label: "Configuración del grupo", icon: ShieldCheck },
  { id: "solicitudes" as View, label: "Solicitudes", icon: UserPlus },
  { id: "invitaciones" as View, label: "Invitaciones", icon: Link2 },
  { id: "planes" as View, label: "Planes", icon: CreditCard }
];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

async function ensureActiveSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Tu sesión venció. Volvé a ingresar para continuar.");
  const expiresAt = (data.session.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt - Date.now() < 120_000) {
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) throw new Error("Tu sesión venció. Volvé a ingresar para continuar.");
  }
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function ProfileAvatar({profile,name,className="member-avatar"}:{profile?:Profile|null;name:string;className?:string}){
  const [url,setUrl]=useState("");
  useEffect(()=>{let active=true;setUrl("");if(!profile?.avatar_path)return;supabase.storage.from("avatars").createSignedUrl(profile.avatar_path,3600).then(({data})=>{if(active)setUrl(data?.signedUrl??"")});return()=>{active=false}},[profile?.avatar_path]);
  return <div className={`${className} profile-avatar`}>{url?<img src={url} alt={`Foto de ${name}`}/>:initials(name)}</div>
}

function geometry(value: Plot["geometry_json"]): GeoFeature | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (parsed?.geometry?.type !== "Polygon") return null;
    const ring = (parsed.geometry.coordinates?.[0] ?? []).map((point: number[]) => normalizeMapCoordinate(point));
    if (ring.length < 3 || ring.some((point: number[]) => !validMapCoordinate(point))) return null;
    return { ...parsed, geometry: { ...parsed.geometry, coordinates: [ring] } } as GeoFeature;
  } catch {
    return null;
  }
}

function normalizeMapCoordinate(point:number[]){
  const [first,second]=point;
  const looksSwappedForArgentina=first>=-56&&first<=-20&&second>=-75&&second<=-50;
  return looksSwappedForArgentina?[second,first]:[first,second];
}
function kmlFeatures(text:string):GeoFeature[]{
  const document=new DOMParser().parseFromString(text,"application/xml");
  if(document.querySelector("parsererror"))throw new Error("El archivo KML no tiene un formato válido.");
  return Array.from(document.querySelectorAll("Placemark")).flatMap((placemark,index)=>{
    const coordinates=placemark.querySelector("Polygon coordinates")?.textContent?.trim();
    if(!coordinates)return [];
    const ring=coordinates.split(/\s+/).map(value=>value.split(",").slice(0,2).map(Number)).filter(point=>validMapCoordinate(point));
    if(ring.length>1&&ring[0][0]===ring.at(-1)?.[0]&&ring[0][1]===ring.at(-1)?.[1])ring.pop();
    if(ring.length<3)return [];
    const calculated=calculateGeometry(ring);
    return [{...calculated,properties:{...calculated.properties,imported_name:placemark.querySelector("name")?.textContent?.trim()||`Lote ${index+1}`}}];
  });
}

function plotsKml(plots:MapPlot[]){
  const placemarks=plots.map(plot=>{const ring=plot.feature.geometry.coordinates[0];const closed=[...ring,ring[0]].map(point=>`${point[0]},${point[1]},0`).join(" ");return `<Placemark><name>${escapeXml(plot.name)}</name><description>${escapeXml(plot.fieldName)}</description><Polygon><outerBoundaryIs><LinearRing><coordinates>${closed}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`}).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Lotes Growr360</name>${placemarks}</Document></kml>`;
}
function escapeXml(value:string){return value.replace(/[<>&"']/g,char=>({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;"}[char]??char));}
function validMapCoordinate(point:number[]){return point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;}

function number(value: number | string | null | undefined) {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function GrowrWeb() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [inviteToken, setInviteToken] = useState("");
  const [inviteResolved, setInviteResolved] = useState(false);
  const [resolvingInvite, setResolvingInvite] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    const queryToken = new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
    const storedToken = localStorage.getItem("growr360-invite")?.trim() ?? "";
    const token = queryToken || storedToken;
    if (token) localStorage.setItem("growr360-invite", token);
    setInviteToken(token);
    setInviteResolved(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !inviteToken) return;
    let active = true;
    setResolvingInvite(true); setInviteError("");
    supabase.rpc("accept_group_invitation", { p_token: inviteToken }).then(({ data, error }) => {
      if (!active) return;
      setResolvingInvite(false);
      if (error) { setInviteError(error.message); return; }
      const joinedGroupId = typeof data === "string" ? data : "";
      if (joinedGroupId) localStorage.setItem("growr360-web-group", joinedGroupId);
      localStorage.removeItem("growr360-invite");
      setInviteToken("");
      window.history.replaceState({}, "", window.location.pathname);
    });
    return () => { active = false; };
  }, [session, inviteToken]);

  if (!inviteResolved || loadingSession || resolvingInvite) return <LoadingScreen text={resolvingInvite ? "Sumándote al grupo…" : "Preparando Growr360…"}/>;
  if (inviteError && session) return <div className="invite-error-page"><Brand/><ShieldCheck/><h1>No pudimos aceptar la invitación</h1><p>{inviteError}</p><div><button onClick={() => { localStorage.removeItem("growr360-invite"); setInviteToken(""); setInviteError(""); }}>Continuar con mi cuenta</button><button onClick={() => void supabase.auth.signOut()}>Usar otra cuenta</button></div></div>;
  if (!session) return <AuthScreen client={supabase} inviteToken={inviteToken}/>;
  return <AuthenticatedApp session={session}/>;
}

function AuthScreen({ client, inviteToken = "" }: { client: SupabaseClient; inviteToken?:string }) {
  const [screen, setScreen] = useState<"landing" | "login" | "register" | "terms" | "privacy" | "faq">(inviteToken ? "register" : "landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [accountType, setAccountType] = useState<"owner" | "employee">("owner");
  const [defaultRole, setDefaultRole] = useState("agronomist");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(Boolean(inviteToken));

  useEffect(() => {
    if (!inviteToken) return;
    client.rpc("get_group_invitation", { p_token: inviteToken }).then(({ data, error }) => {
      const row = (data?.[0] ?? null) as InvitationPreview | null;
      setInvitationLoading(false);
      if (error || !row || !row.is_valid) { setMessage(error?.message ?? "La invitación venció o ya fue utilizada."); return; }
      setInvitation(row); setEmail(row.email); setDefaultRole(row.role); setAccountType("employee"); setScreen("register");
    });
  }, [client, inviteToken]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
    setBusy(false);
  }

  async function register(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !email.trim()) return setMessage("Completá todos los datos personales.");
    if (!/^[A-Za-z0-9._-]{3,30}$/.test(username.trim())) return setMessage("El usuario debe tener entre 3 y 30 caracteres y no incluir espacios.");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return setMessage("La contraseña debe tener 8 caracteres, mayúscula, minúscula y número.");
    if (password !== confirmation) return setMessage("Las contraseñas no coinciden.");
    if (!acceptedTerms) return setMessage("Aceptá los términos y la política de privacidad para continuar.");
    setBusy(true);
    const selectedRole = invitation ? invitation.role : (accountType === "owner" ? "producer" : defaultRole);
    const profileFirst=firstName.trim();
    const profileLast=lastName.trim();
    const profileUsername=username.trim().toLowerCase();
    const { data, error } = await client.auth.signUp({
      email: email.trim(), password,
      options: { data: { first_name: profileFirst, last_name: profileLast, username: profileUsername, default_role: selectedRole, account_type: invitation ? "employee" : accountType } }
    });
    setBusy(false);
    if (error) return setMessage(error.message.includes("already registered") ? "Ese correo ya tiene una cuenta." : error.message);
    if (!data.session) { setMessage("Cuenta creada. Ya podés ingresar con tus datos."); setScreen("login"); }
  }

  if (screen === "landing") return <PublicLanding onLogin={() => setScreen("login")} onRegister={() => setScreen("register")} onLegal={setScreen}/>;
  if (screen === "terms" || screen === "privacy" || screen === "faq") return <LegalInformationPage page={screen} onBack={() => setScreen("landing")} onLogin={() => setScreen("login")}/>;

  return <div className="auth-page auth-page-v2">
    <div className="auth-glow"/>
    <button className="auth-back" type="button" onClick={() => { setMessage(""); setScreen("landing"); }}><ChevronLeft/> Volver al inicio</button>
    <div className="auth-layout">
    <aside className="auth-showcase"><Brand/><span className="public-kicker"><Leaf/> Gestión agrícola inteligente</span><h2>Volvé al campo.<br/>Nosotros ordenamos los datos.</h2><p>Tu operación completa, accesible desde cualquier dispositivo y siempre sincronizada con la app.</p><div className="auth-mini-map"><div className="auth-mini-lot one">Lote 1</div><div className="auth-mini-lot two">Lote 2</div><div className="auth-map-status"><span/><strong>Equipo conectado</strong><small>Información actualizada</small></div></div><div className="auth-benefits"><span><ShieldCheck/>Acceso seguro</span><span><CloudSun/>Disponible online y offline</span></div></aside>
    {screen === "login" ? <form className="auth-card auth-card-v2" onSubmit={login}>
      <Brand/>
      <div className="auth-mode-tabs"><button type="button" className="active">Ingresar</button><button type="button" onClick={() => { setMessage(""); setScreen("register"); }}>Crear cuenta</button></div>
      <div className="auth-copy"><span>BIENVENIDO DE NUEVO</span><h1>Ingresá a Growr360</h1><p>Continuá trabajando con la misma cuenta de la aplicación móvil.</p></div>
      <label>Correo electrónico<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@empresa.com"/></label>
      <label>Contraseña<div className="password-input"><input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="••••••••"/><button type="button" aria-label="Mostrar contraseña" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
      {message && <p className={message.startsWith("Cuenta creada") ? "form-success" : "form-error"}>{message}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <CircleUserRound/>}{busy ? "Ingresando…" : "Ingresar a Growr360"}</button>
      <p className="auth-switch">¿Todavía no tenés cuenta? <button type="button" onClick={() => { setMessage(""); setScreen("register"); }}>Crear cuenta</button></p>
    </form> : <form className="auth-card auth-card-v2 register-card" onSubmit={register}>
      <Brand/>
      <div className="auth-mode-tabs"><button type="button" onClick={() => { setMessage(""); setScreen("login"); }}>Ingresar</button><button type="button" className="active">Crear cuenta</button></div>
      <div className="auth-copy"><span>{invitation ? "INVITACIÓN AL EQUIPO" : "NUEVA CUENTA"}</span><h1>{invitation ? `Sumate a ${invitation.group_name}.` : "Empezá a gestionar mejor."}</h1><p>{invitation ? `Tu acceso ya está preparado como ${roleName(invitation.role)}. Solo completá tus datos y creá una contraseña.` : "Estos datos serán los mismos que verán tus compañeros en la app."}</p></div>
      {invitationLoading && <div className="invite-auth-banner"><LoaderCircle className="spin"/><span>Validando invitación…</span></div>}
      {invitation && <div className="invite-auth-banner"><Mail/><span><strong>{invitation.email}</strong><small>{invitation.group_name} · {roleName(invitation.role)}</small></span><Check/></div>}
      {invitation && inviteToken && <div className="invite-app-choice"><a className="open-in-app" href={`growr360://invite?invite=${encodeURIComponent(inviteToken)}`}><Smartphone/><span><strong>Abrir en la app Growr360</strong><small>Recomendado si ya la tenés instalada</small></span><ArrowRight/></a><div><span/>o continuá desde la web<span/></div></div>}
      {!invitation && <div className="account-type-grid">
        <button type="button" className={accountType === "owner" ? "selected" : ""} onClick={() => setAccountType("owner")}><BriefcaseBusiness/><span><strong>Dueño de empresa</strong><small>Quiero crear o dirigir un grupo.</small></span></button>
        <button type="button" className={accountType === "employee" ? "selected" : ""} onClick={() => setAccountType("employee")}><Tractor/><span><strong>Empleado o colaborador</strong><small>Trabajo dentro de uno o más grupos.</small></span></button>
      </div>}
      <div className="register-grid">
        <label>Nombre<input required value={firstName} onChange={event => setFirstName(event.target.value)} placeholder="Martín"/></label>
        <label>Apellido<input required value={lastName} onChange={event => setLastName(event.target.value)} placeholder="González"/></label>
        <label>Nombre de usuario<input required value={username} onChange={event => setUsername(event.target.value)} placeholder="martin.gonzalez"/></label>
        <label>Correo electrónico<input type="email" required readOnly={Boolean(invitation)} value={email} onChange={event => setEmail(event.target.value)} placeholder="nombre@empresa.com"/></label>
        {!invitation && accountType === "employee" && <label className="wide">Función principal<select value={defaultRole} onChange={event => setDefaultRole(event.target.value)}><option value="agronomist">Ingeniero / Agrónomo</option><option value="operator">Operario</option><option value="producer">Productor / Cliente</option></select></label>}
        <label>Contraseña<div className="password-input"><input type={showPassword ? "text" : "password"} required value={password} onChange={event => setPassword(event.target.value)} placeholder="8 caracteres o más"/><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>
        <label>Repetir contraseña<input type={showPassword ? "text" : "password"} required value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Repetí la contraseña"/></label>
      </div>
      <label className="terms-check"><input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)}/><span>Acepto los <a href="/terminos" target="_blank">términos y condiciones</a> y la <a href="/privacidad" target="_blank">política de privacidad</a>.</span></label>
      {!invitation && accountType === "owner" && <div className="owner-note"><Sprout/><span><strong>Después del registro</strong> te recomendaremos crear tu grupo, aunque también podrás unirte a uno existente.</span></div>}
      {message && <p className="form-error">{message}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <ArrowRight/>}{busy ? "Creando cuenta…" : "Crear mi cuenta"}</button>
      <p className="auth-switch">¿Ya tenés cuenta? <button type="button" onClick={() => { setMessage(""); setScreen("login"); }}>Ingresar</button></p>
    </form>}
    </div>
  </div>;
}

function PublicLanding({ onLogin, onRegister, onLegal }: { onLogin: () => void; onRegister: () => void; onLegal: (page:"terms"|"privacy"|"faq") => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    document.body.classList.add("public-site-open");
    return () => document.body.classList.remove("public-site-open");
  }, []);
  useEffect(() => {
    document.body.classList.toggle("gr-menu-open", menuOpen);
    return () => { document.body.classList.remove("gr-menu-open"); };
  }, [menuOpen]);
  const modules = [
    { label: "Territorio", text: "Mapa, campos, lotes y campañas en contexto.", icon: Map },
    { label: "Trabajo diario", text: "Registros y monitoreos simples, aun desde el lote.", icon: FileText },
    { label: "Decisiones", text: "Reportes claros e imágenes Planet Insights para actuar a tiempo.", icon: BarChart3 },
    { label: "Equipo", text: "Personas, permisos y responsabilidades sin cruces.", icon: Users },
  ];
  const navLinks = [
    { href: "#producto", label: "Plataforma" },
    { href: "#funciones", label: "Funciones" },
    { href: "#soluciones", label: "Soluciones" },
    { href: "#nosotros", label: "Quiénes somos" },
  ];
  const closeMenu = () => setMenuOpen(false);
  return (
    <div className="gr-landing">
      <header className="gr-nav">
        <div className="gr-nav-inner">
          <div className="gr-nav-brand"><Brand/></div>
          <nav className="gr-nav-links">
            {navLinks.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
          </nav>
          <div className="gr-nav-actions">
            <button className="gr-btn gr-btn-ghost" onClick={onLogin}>Ingresar</button>
            <button className="gr-btn gr-btn-solid" onClick={onRegister}>Crear cuenta</button>
          </div>
          <button className="gr-nav-toggle" type="button" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
            {menuOpen ? <X/> : <Menu/>}
          </button>
        </div>
        <div className={`gr-nav-mobile${menuOpen ? " is-open" : ""}`}>
          <div className="gr-nav-mobile-inner">
            <nav>{navLinks.map(link => <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>)}</nav>
            <div className="gr-nav-mobile-actions">
              <button className="gr-btn gr-btn-outline" onClick={() => { closeMenu(); onLogin(); }}>Ingresar</button>
              <button className="gr-btn gr-btn-solid" onClick={() => { closeMenu(); onRegister(); }}>Crear cuenta</button>
            </div>
          </div>
        </div>
      </header>

      <main className="gr-main">
        <section className="gr-hero">
          <div className="gr-hero-copy">
            <span className="gr-eyebrow">GESTIÓN AGRÍCOLA, SIN VUELTAS</span>
            <h1>El campo habla.<br/>Growr lo ordena.</h1>
            <p>Una vista compartida para saber qué pasó, qué está pasando y qué necesita atención en cada lote.</p>
            <div className="gr-hero-actions">
              <button className="gr-btn gr-btn-solid gr-btn-lg" onClick={onRegister}>Empezar ahora <ArrowRight/></button>
              <button className="gr-btn gr-btn-outline gr-btn-lg" onClick={onLogin}>Ya tengo cuenta</button>
            </div>
            <ul className="gr-hero-points">
              <li><Check/>Web y app sincronizadas</li>
              <li><Check/>Pensado para trabajar en el campo</li>
            </ul>
          </div>
          <div className="gr-hero-media">
            <img src="/landing/juan-manuel-field.png" alt="Juan Manuel Iglesias utilizando Growr360 en un lote"/>
            <div className="gr-hero-tag"><strong>Datos de campo</strong><span>convertidos en decisiones</span></div>
          </div>
        </section>

        <section id="producto" className="gr-modules">
          <div className="gr-section-head">
            <span className="gr-eyebrow">UN SISTEMA, CUATRO MOMENTOS</span>
            <h2>De mirar el lote a decidir qué hacer.</h2>
            <p>Growr conecta la geografía, el trabajo, el análisis y las personas sin duplicar información.</p>
          </div>
          <div className="gr-module-grid">
            {modules.map(({ label, text, icon: Icon }, index) => (
              <article key={label} className="gr-module-card">
                <div className={`gr-module-icon gr-module-icon-${index}`}><Icon/></div>
                <strong>{label}</strong>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="funciones" className="gr-stories">
          <article className="gr-story">
            <div className="gr-story-copy">
              <span className="gr-eyebrow">01 · MAPA PRODUCTIVO</span>
              <h2>Primero, entender dónde.</h2>
              <p>Campañas, cultivos, prioridades y monitoreos viven sobre el mismo mapa. Buscá un lote, enfocá la zona y actuá sin atravesar menús.</p>
              <ul>
                <li><Check/>Capas y filtros por campaña</li>
                <li><Check/>Monitoreos geolocalizados</li>
                <li><Check/>Imágenes e índices NDVI con Planet Insights</li>
              </ul>
            </div>
            <ProductScreenshot src="/landing/growr-map-current.png" alt="Mapa productivo actual de Growr360" label="Vista territorial"/>
          </article>
          <article className="gr-story gr-story-reverse">
            <ProductScreenshot src="/landing/growr-reports-current.png" alt="Reporte actual de avance de siembra de Growr360" label="Avance diario"/>
            <div className="gr-story-copy">
              <span className="gr-eyebrow">02 · REPORTES OPERATIVOS</span>
              <h2>Después, entender por qué.</h2>
              <p>Cada gráfico conserva el vínculo con los registros que lo explican. Podés pasar del total al trabajo concreto sin perderte en tablas interminables.</p>
              <ul>
                <li><Check/>Superficie acumulada día por día</li>
                <li><Check/>Costos, rendimiento y contratistas</li>
                <li><Check/>Detalle agrupado por actividad</li>
              </ul>
            </div>
          </article>
        </section>

        <section id="soluciones" className="gr-values">
          <div className="gr-section-head gr-section-head-light">
            <span className="gr-eyebrow">HECHO PARA EL TRABAJO REAL</span>
            <h2>Menos tiempo buscando datos.<br/>Más tiempo tomando decisiones.</h2>
          </div>
          <div className="gr-value-grid">
            <article><History/><strong>Trabajo ágil</strong><p>Flujos simples para cargar información mientras la labor sucede.</p></article>
            <article><Users/><strong>Equipo coordinado</strong><p>Roles, permisos y varios grupos sin mezclar responsabilidades.</p></article>
            <article><CloudSun/><strong>Dentro y fuera del campo</strong><p>La misma información disponible en web y aplicación móvil.</p></article>
            <article><ShieldCheck/><strong>Trazabilidad completa</strong><p>Historial, fotos y responsables asociados a cada registro.</p></article>
          </div>
        </section>

        <section id="nosotros" className="gr-about">
          <div className="gr-about-media">
            <img src="/landing/juan-manuel-field.png" alt="Juan Manuel Iglesias trabajando con Growr360 en el campo"/>
            <span><MapPin/>Chivilcoy · Buenos Aires</span>
          </div>
          <div className="gr-about-copy">
            <span className="gr-eyebrow">QUIÉNES SOMOS</span>
            <h2>Una herramienta creada desde el campo.</h2>
            <p>Growr360 nace en Chivilcoy para resolver una necesidad concreta: que la información agrícola sea fácil de cargar, compartir y entender, incluso cuando el trabajo ocurre lejos de una oficina.</p>
            <blockquote>“La tecnología tiene valor cuando simplifica una decisión real.”</blockquote>
            <div className="gr-founders">
              <article><img src="/team/juan-manuel-iglesias.jpg" alt="Juan Manuel Iglesias"/><div><strong>Juan Manuel Iglesias</strong><span>Ingeniero Agrónomo · Campo y producción</span></div></article>
              <article><img src="/team/benicio-iglesias-plante-v2.jpg" alt="Benicio Iglesias Plante"/><div><strong>Benicio Iglesias Plante</strong><span>Producto y desarrollo tecnológico</span></div></article>
            </div>
          </div>
        </section>

        <section className="gr-legal-links">
          <div className="gr-section-head">
            <span className="gr-eyebrow">INFORMACIÓN CLARA</span>
            <h2>Tu operación, tus datos.</h2>
            <p>Todo lo que cargás en Growr360 sigue siendo tuyo y podés solicitar una copia completa de tu información.</p>
          </div>
          <div className="gr-legal-grid">
            <a href="/terminos"><FileText/><span><strong>Términos y condiciones</strong><small>Cómo funciona la plataforma.</small></span><ChevronRight/></a>
            <a href="/privacidad"><ShieldCheck/><span><strong>Privacidad y datos</strong><small>Qué protegemos y cómo.</small></span><ChevronRight/></a>
            <a href="/faq"><CircleUserRound/><span><strong>Preguntas frecuentes</strong><small>Respuestas sobre uso y respaldo.</small></span><ChevronRight/></a>
          </div>
        </section>

        <section className="gr-final">
          <div>
            <span className="gr-eyebrow">EMPEZÁ CON TU OPERACIÓN</span>
            <h2>El campo no se detiene.<br/>Tu información tampoco.</h2>
            <p>Creá tu cuenta y organizá el trabajo de tu equipo en un solo lugar.</p>
          </div>
          <button className="gr-btn gr-btn-solid gr-btn-lg" onClick={onRegister}>Crear cuenta <ArrowRight/></button>
        </section>
      </main>

      <footer className="gr-footer">
        <div className="gr-footer-grid">
          <div className="gr-footer-brand">
            <Brand/>
            <p>Gestión agrícola inteligente para equipos que necesitan trabajar con información clara, dentro y fuera del campo.</p>
            <span><MapPin/>Chivilcoy, Buenos Aires · Argentina</span>
            <a href="tel:+5492346458558"><Phone/>+54 9 2346 458558</a>
            <a href="mailto:info@growr.com"><Mail/>info@growr.com</a>
          </div>
          <div className="gr-footer-links">
            <strong>Growr360</strong>
            <a href="#producto">Plataforma</a>
            <a href="#funciones">Funciones</a>
            <a href="#nosotros">Quiénes somos</a>
          </div>
          <div className="gr-footer-links">
            <strong>Información</strong>
            <a href="/terminos">Términos y condiciones</a>
            <a href="/privacidad">Privacidad</a>
            <a href="/faq">Preguntas frecuentes</a>
          </div>
          <div className="gr-footer-downloads">
            <strong>Growr360 en todos tus dispositivos</strong>
            <p>Trabajá desde la computadora o llevá la gestión al campo.</p>
            <div>
              <button className="gr-store-badge" aria-label="Google Play próximamente"><img src="/google-play-badge.png" alt="Disponible en Google Play"/><small>PRÓXIMAMENTE</small></button>
              <button className="gr-web-badge" onClick={onLogin}><Map/><span><small>ACCESO DESDE</small><strong>Aplicación web</strong></span></button>
            </div>
          </div>
        </div>
        <div className="gr-footer-bottom">
          <span>© 2026 Growr360. Todos los derechos reservados.</span>
          <span>Hecho en Chivilcoy para el campo argentino.</span>
        </div>
      </footer>
    </div>
  );
}

function LegalInformationPage({page,onBack,onLogin}:{page:"terms"|"privacy"|"faq";onBack:()=>void;onLogin:()=>void}){
  const content={
    terms:{kicker:"TÉRMINOS Y CONDICIONES",title:"Reglas claras para trabajar mejor.",sections:[["Uso de Growr360","Growr360 organiza información agrícola, operativa y geográfica de cada grupo. Es una herramienta de apoyo: las decisiones técnicas, productivas y económicas deben ser revisadas por la persona responsable."],["Cuenta y responsabilidades","Cada usuario debe mantener sus datos de acceso protegidos y cargar información veraz. Los permisos se administran por rol y por grupo para proteger el trabajo del equipo."],["Disponibilidad","Trabajamos para que la información esté disponible en web y aplicación. Las mejoras o tareas de mantenimiento se comunican cuando puedan afectar el servicio."]]},
    privacy:{kicker:"PRIVACIDAD Y DATOS",title:"Tus datos son tuyos.",sections:[["Propiedad de la información","Los datos personales, productivos, geográficos, fotos y archivos que cargás pertenecen a vos o a tu organización. Growr360 no comercializa los datos privados de sus usuarios."],["Uso y protección","Usamos los datos solo para brindar las funciones de la plataforma, sincronizar tus dispositivos y mostrar la información a quienes tengan permiso dentro del grupo."],["Respaldo y salida","Podés solicitar un respaldo completo de la información cargada por tu organización: campos, lotes, campañas, registros, monitoreos, fotos y archivos. Así conservás una copia aun si dejás de usar Growr360."]]},
    faq:{kicker:"PREGUNTAS FRECUENTES",title:"Respuestas simples, sin letra chica.",sections:[["¿Quién es dueño de los datos?","El usuario y su organización. Growr360 los procesa únicamente para prestar el servicio."],["¿Puedo llevarme mi información?","Sí. Hay un respaldo completo disponible para solicitar desde la plataforma, con datos operativos y archivos asociados."],["¿Quién puede ver el grupo?","Solo los miembros activos del grupo y según los permisos que tenga cada rol."],["¿Qué pasa con la ubicación?","Las coordenadas se usan cuando una función las necesita, por ejemplo al monitorear o dibujar un lote."],["¿Cómo contacto a Growr360?","Podés llamarnos o escribirnos al +54 9 2346 458558."]]}
  }[page];
  return <div className="public-site public-site-v3 legal-page"><header className="public-header public-header-v3"><div className="public-header-main"><div className="landing-logo-tab"><Brand/></div><div/><div className="public-auth-actions"><button className="public-login" onClick={onBack}>Volver</button><button className="public-cta" onClick={onLogin}>Ingresar</button></div></div></header><main><article className="legal-page-content"><span>{content.kicker}</span><h1>{content.title}</h1><p>Información simple y accesible para que sepas cómo trabajamos con tu operación.</p><div>{content.sections.map(([title,text])=><section key={title}><h2>{title}</h2><p>{text}</p></section>)}</div></article></main></div>;
}

function ProductScreenshot({src,alt,label}:{src:string;alt:string;label:string}){return <figure className="product-browser"><div><img src={src} alt={alt}/></div><figcaption><span/><strong>{label}</strong><small>Growr360 Web</small></figcaption></figure>}
function ClockIcon(){return <History/>}

function AuthenticatedApp({ session }: { session: Session }) {
  const [view, setView] = useState<View>("mapa");
  useEffect(()=>{if(typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("view")==="ordenes")setView("ordenes");},[]);
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
  const [contractors,setContractors]=useState<Contractor[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ appearance: "system", area_unit: "ha", date_format: "dd-MM-yyyy", notifications_enabled: true, plot_label_fields: DEFAULT_PLOT_LABEL_FIELDS });
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<{ plotId: string; type: string } | null>(null);
  const [pendingForm, setPendingForm] = useState<"field"|"campaign"|"client"|"contractor"|"record"|null>(null);
  const [groupBrowserOpen, setGroupBrowserOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState<"gestion" | "actividad" | "mas" | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<GroupSubscription | null>(null);
  const [subscriptionUsage, setSubscriptionUsage] = useState<GroupSubscriptionUsage | null>(null);
  const [subscriptionError, setSubscriptionError] = useState("");
  const [planWelcomeOpen, setPlanWelcomeOpen] = useState(false);
  // The one place the whole app derives the group's effective plan from public.group_subscriptions.
  // Every feature-gate and every plan display must read this instead of `subscription.plan` directly.
  const activePlan = useMemo(() => resolveActivePlan(subscription), [subscription]);
  const currentPlan = useMemo(() => plans.find(plan => plan.code === activePlan) ?? null, [plans, activePlan]);
  const planHectareLimit = currentPlan?.included_hectares ?? currentPlan?.max_hectares ?? null;
  const planHectaresUsed = useMemo(() => sum(plots.map(plot => number(plot.arable_area || plot.total_area))), [plots]);
  const planFieldLimitReached = currentPlan?.max_fields != null && fields.length >= currentPlan.max_fields;
  const planLotLimitReached = currentPlan?.max_lots != null && plots.length >= currentPlan.max_lots;
  const planHectareLimitReached = planHectareLimit != null && planHectaresUsed >= planHectareLimit;
  const planBlockReason = useCallback((kind:"field"|"lot", extraArea=0) => {
    if (!currentPlan) return "";
    if (kind === "field" && currentPlan.max_fields != null && fields.length >= currentPlan.max_fields) return `Tu plan ${currentPlan.name} permite hasta ${currentPlan.max_fields} campos. Lo que ya tenés cargado se conserva.`;
    if (kind === "lot" && currentPlan.max_lots != null && plots.length >= currentPlan.max_lots) return `Tu plan ${currentPlan.name} permite hasta ${currentPlan.max_lots} lotes. Lo que ya tenés cargado se conserva.`;
    if (kind === "lot" && planHectareLimit != null && planHectaresUsed + Math.max(0, extraArea) > planHectareLimit) return `Este lote superaría el límite de ${planHectareLimit.toLocaleString("es-AR")} ha de tu plan ${currentPlan.name}. Tus datos actuales no se modifican.`;
    return "";
  }, [currentPlan, fields.length, plots.length, planHectareLimit, planHectaresUsed]);
  const [workOrders,setWorkOrders]=useState<WorkOrder[]>([]);

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
    if (activeMembership.role === "agronomist") return ["view_records","create_records","edit_own_records","delete_own_records","create_monitoring","view_satellite","view_ndvi","export_reports"].includes(permission);
    if (activeMembership.role === "operator") return ["view_records","create_records","edit_own_records"].includes(permission);
    return false;
  }, [activeMembership]);

  const loadGroupData = useCallback(async (targetGroup: string, quiet = false) => {
    if (quiet) setSyncing(true);
    setError("");
    const [fieldResult, plotResult, recordResult, memberResult, cropResult, assignmentResult, colorResult, settingsResult, campaignResult, clientResult, supplyResult,contractorResult,subscriptionResult,usageResult,workOrderResult] = await Promise.all([
      supabase.from("fields").select("id,group_id,name,total_area,arable_area,locality,province").eq("group_id", targetGroup).is("deleted_at", null).order("name"),
      supabase.from("plots").select("id,group_id,field_id,name,total_area,arable_area,geometry_json,priority_color,allow_member_edits,fields(name)").eq("group_id", targetGroup).is("deleted_at", null).order("name"),
      supabase.from("records").select("id,record_type,record_date,worked_area,contractor,machinery_text,observations,created_at,field_id,plot_id,campaign_id,fields(name),plots(name),campaigns(id,name),sowing_records(data),spraying_records(data),fertilization_records(data),harvest_records(data),work_records(data),monitoring_records(data),expense_records(data),other_records(data)").eq("group_id", targetGroup).is("deleted_at", null).order("record_date", { ascending: false }).limit(500),
      supabase.from("group_members").select("user_id,role,status,profiles!group_members_user_id_fkey(id,first_name,last_name,username,email,phone,avatar_path),member_permission_overrides(permission,allowed),member_resource_access(field_id,lot_id)").eq("group_id", targetGroup).eq("status", "active").order("created_at"),
      supabase.from("crops").select("id,name,group_id").or(`group_id.is.null,group_id.eq.${targetGroup}`).is("deleted_at", null).order("name"),
      supabase.from("plot_campaigns").select("plot_id,campaign_id,crop_id,campaigns(id,name,status),crops(id,name)").eq("group_id", targetGroup).is("deleted_at", null),
      supabase.from("group_crop_colors").select("crop_id,color").eq("group_id", targetGroup),
      supabase.from("app_settings").select("appearance,area_unit,date_format,notifications_enabled,plot_label_fields").eq("group_id", targetGroup).eq("user_id", session.user.id).maybeSingle()
      ,supabase.from("campaigns").select("id,name,start_date,end_date,status").eq("group_id", targetGroup).is("deleted_at", null).order("start_date", { ascending: false })
      ,supabase.from("clients").select("id,name,cuit,phone,email").eq("group_id", targetGroup).is("deleted_at", null).order("name")
      ,supabase.from("inputs").select("id,name,category,unit,unit_price,currency").eq("group_id", targetGroup).is("deleted_at", null).order("name")
      ,supabase.from("contractors").select("id,group_id,name,phone,document,address,notes").eq("group_id",targetGroup).is("deleted_at",null).order("name")
      ,supabase.from("group_subscriptions").select("id,group_id,plan,status,started_at,expires_at").eq("group_id",targetGroup).order("started_at",{ascending:false}).limit(1)
      ,supabase.from("group_subscription_usage").select("group_id,kml_imports,updated_at").eq("group_id",targetGroup).maybeSingle()
      ,supabase.from("work_orders").select("id,group_id,campaign_id,field_id,plot_id,order_type,status,priority,title,instructions,notes,scheduled_date,scheduled_end_date,planned_area,assigned_to,contractor_id,planned_data,actual_data,resulting_record_id,created_by,completed_at,created_at,allow_member_edits").eq("group_id",targetGroup).is("deleted_at",null).order("created_at",{ascending:false})
    ]);
    const criticalError = fieldResult.error ?? plotResult.error ?? recordResult.error;
    if (criticalError) setError(criticalError.message);
    if (subscriptionResult.error) {
      // Never silently downgrade a group to "free" because of a failed fetch (e.g. RLS misconfiguration).
      // Surface it distinctly so a real plan mismatch is never mistaken for "the group has no subscription".
      console.error("group_subscriptions fetch failed:", subscriptionResult.error.message);
      setSubscriptionError(subscriptionResult.error.message);
    } else {
      setSubscriptionError("");
    }
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
    setSupplies((supplyResult.data ?? []) as Supply[]);
    setContractors((contractorResult.data??[]) as Contractor[]);
    // group_subscriptions is the single source of truth for the group's plan, keyed by group_id.
    // Ordered/limited above (instead of .maybeSingle()) so a stray duplicate row can never turn into a
    // silent fetch error that gets misread as "no subscription" -> "free".
    const subscriptionRows = (subscriptionResult.data as GroupSubscription[] | null) ?? [];
    setSubscription(subscriptionRows[0] ?? null);
    setSubscriptionUsage((usageResult.data as GroupSubscriptionUsage|null)??null);
    const [productResult,workOrderPlotResult]=workOrderResult.error?[{data:[],error:null as any},{data:[],error:null as any}]:await Promise.all([supabase.from("work_order_products").select("id,work_order_id,input_id,product_name,dose,dose_unit,planned_quantity,actual_quantity,notes").eq("group_id",targetGroup),supabase.from("work_order_plots").select("id,work_order_id,group_id,field_id,plot_id,planned_area").eq("group_id",targetGroup)]);
    // If this fails (e.g. a Supabase RLS policy blocks reading work_order_products even though
    // inserting into it is allowed), productRows silently became [] below and insumos would look
    // "missing" from every order with no error ever surfacing anywhere. Log it loudly instead.
    if (productResult.error) console.error("work_order_products fetch failed:", productResult.error.message);
    if (workOrderPlotResult.error) console.error("work_order_plots fetch failed (run OT_MULTI_LOT_RECORDS.sql):", workOrderPlotResult.error.message);
    const fieldRows=(fieldResult.data??[]) as Field[];
    const plotRows=(plotResult.data??[]) as Plot[];
    const campaignRows=(campaignResult.data??[]) as Campaign[];
    const memberRows=(memberResult.data??[]) as unknown as Member[];
    const contractorRows=(contractorResult.data??[]) as Contractor[];
    const productRows=(productResult.data??[]) as ({work_order_id:string}&WorkOrderProduct)[];
    const workOrderPlotRows=(workOrderPlotResult.data??[]) as WorkOrderPlot[];
    const hydratedOrders=((workOrderResult.data??[]) as unknown as WorkOrder[]).map(order=>({
      ...order,
      fields:fieldRows.find(field=>field.id===order.field_id)??null,
      plots:plotRows.find(plot=>plot.id===order.plot_id)??null,
      campaigns:campaignRows.find(campaign=>campaign.id===order.campaign_id)??null,
      profiles:memberRows.find(member=>member.user_id===order.assigned_to)?.profiles??null,
      contractors:contractorRows.find(contractor=>contractor.id===order.contractor_id)??null,
      work_order_products:productRows.filter(product=>product.work_order_id===order.id),
      work_order_plots:workOrderPlotRows.filter(row=>row.work_order_id===order.id).map(row=>({...row,plots:plotRows.find(plot=>plot.id===row.plot_id)??null}))
    }));
    setWorkOrders(hydratedOrders);
    setSyncing(false);
  }, [session.user.id]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    const userId = session.user.id;
    const [profileResult, membershipResult, plansResult] = await Promise.all([
      supabase.from("profiles").select("id,first_name,last_name,username,email,phone,avatar_path").eq("id", userId).single(),
      supabase.from("group_members").select("group_id,role,status,groups(id,name,description,cuit,image_path),member_permission_overrides(permission,allowed)").eq("user_id", userId).eq("status", "active").order("created_at"),
      supabase.from("subscription_plans").select("code,name,max_hectares,max_fields,max_lots,max_users,max_kml_imports,features,monthly_price_usd,annual_price_usd,included_hectares,extra_hectare_price_year_usd")
    ]);
    if (profileResult.data) setProfile(profileResult.data as Profile);
    setPlans((plansResult.data ?? []) as SubscriptionPlan[]);
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
      setFields([]); setPlots([]); setRecords([]); setMembers([]);setWorkOrders([]);
      setSubscription(null);setSubscriptionUsage(null);
    }
    setLoading(false);
  }, [loadGroupData, session.user.id]);

  useEffect(() => { void loadWorkspace(); }, [loadWorkspace]);

  const switchGroup = (id: string) => {
    setGroupId(id);
    setSelectedPlotId(null);
    setFields([]); setPlots([]); setRecords([]); setMembers([]);setWorkOrders([]);
    localStorage.setItem("growr360-web-group", id);
    void loadGroupData(id, true);
  };
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.username || session.user.email || "Usuario";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = settings.appearance === "system" ? (media.matches ? "dark" : "light") : settings.appearance;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.appearance]);

  useEffect(() => {
    if (!groupId || loading || activePlan === "free") return;
    const key = `growr360-plan-welcome:${groupId}:${activePlan}`;
    if (!localStorage.getItem(key)) setPlanWelcomeOpen(true);
  }, [groupId, activePlan, loading]);
  function closePlanWelcome(){ if(groupId){localStorage.setItem(`growr360-plan-welcome:${groupId}:${activePlan}`,"1");} setPlanWelcomeOpen(false); }

  if (loading) return <LoadingScreen text="Cargando tus campos y lotes…"/>;

  const openView = (nextView: View) => { setView(nextView); setSidebarOpen(false); setGroupBrowserOpen(false); };
  const sidebarItem = (id: View, label: string, Icon: typeof Map, badge?: number) => <button key={id} className={`nav-subitem ${view === id ? "active" : ""}`} onClick={() => openView(id)}><Icon/><span>{label}</span>{badge ? <em>{badge}</em> : null}</button>;
  const groupAdmin = activeMembership?.role === "owner" || activeMembership?.role === "admin";

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="sidebar-top"><Brand/><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)}><X/></button></div>
      <nav className="sidebar-navigation">
        <button className={`nav-direct ${view === "mapa" ? "active" : ""}`} onClick={() => openView("mapa")}><Map/><span>Mapa</span></button>
        <section className={`nav-group ${navExpanded === "gestion" ? "expanded" : ""}`}>
          <button className="nav-group-trigger" onClick={() => setNavExpanded(value => value === "gestion" ? null : "gestion")}><BriefcaseBusiness/><span>Gestión</span><ChevronDown/></button>
          {navExpanded === "gestion" && <div className="nav-submenu">{sidebarItem("campos", "Campos", Sprout)}{sidebarItem("campanas", "Campañas", CalendarDays)}{sidebarItem("contratistas", "Contratistas", ContactRound)}{sidebarItem("equipo", "Equipo", Users)}{sidebarItem("reportes", "Reportes", TrendingUp)}</div>}
        </section>
        <section className={`nav-group ${navExpanded === "actividad" ? "expanded" : ""}`}>
          <button className="nav-group-trigger" onClick={() => setNavExpanded(value => value === "actividad" ? null : "actividad")}><Activity/><span>Actividad</span><ChevronDown/></button>
          {navExpanded === "actividad" && <div className="nav-submenu">{sidebarItem("registros", "Registros", FileText, records.filter(row => !["monitoring", "napa"].includes(effectiveRecordType(row))).length)}{sidebarItem("monitoreos", "Monitoreos", Eye, records.filter(row => effectiveRecordType(row) === "monitoring").length)}{sidebarItem("napas", "Napas", Waves)}{sidebarItem("ordenes", "Órdenes de trabajo", BriefcaseBusiness, workOrders.filter(item=>["pending","in_progress"].includes(item.status)).length)}</div>}
        </section>
        <section className={`nav-group ${navExpanded === "mas" ? "expanded" : ""}`}>
          <button className="nav-group-trigger" onClick={() => setNavExpanded(value => value === "mas" ? null : "mas")}><Grid2X2/><span>Más</span><ChevronDown/></button>
          {navExpanded === "mas" && <div className="nav-submenu">{sidebarItem("mas", "Más herramientas", Grid2X2)}{sidebarItem("configuracion", "Configuración", Settings2)}{sidebarItem("equipo", "Equipo y permisos", Users)}{sidebarItem("planes", "Planes", CreditCard)}{groupAdmin && sidebarItem("solicitudes", "Solicitudes", UserPlus)}{groupAdmin && sidebarItem("invitaciones", "Invitaciones", Link2)}{groupAdmin && sidebarItem("grupo", "Configuración del grupo", ShieldCheck)}<button className="nav-subitem" onClick={() => { setGroupBrowserOpen(true); setSidebarOpen(false); }}><Search/><span>Buscar o sumar grupo</span><Plus/></button></div>}
        </section>
      </nav>
      <div className="sidebar-footer">
        <label className="sidebar-group-picker"><Tractor/><span><small>Grupo</small><select value={groupId} onChange={event => switchGroup(event.target.value)}>{memberships.map(m => { const item = relation(m.groups); return item ? <option value={m.group_id} key={m.group_id}>{item.name}</option> : null; })}</select></span><ChevronDown/></label>
        <div className="user-mini"><ProfileAvatar profile={profile} name={name} className="avatar"/><div><strong>{name}</strong><small>{roleName(activeMembership?.role)}</small></div><button title="Cerrar sesión" onClick={() => void supabase.auth.signOut()}><LogOut/></button></div>
      </div>
    </aside>
    <main>
      <header className="topbar">
        <div className="topbar-left"><button className="icon-button hamburger" onClick={() => setSidebarOpen(true)}><Menu/></button><div><h1>{groupBrowserOpen ? "Grupos" : nav.find(n => n.id === view)?.label}</h1><p>{groupBrowserOpen ? "Buscar o crear un espacio de trabajo" : view === "mapa" ? group?.name ?? "Sin grupo activo" : view === "grupo" ? group?.name ?? "Grupo" : subtitle(view)}</p></div></div>
        <div className="topbar-actions"><div className={`sync-pill ${syncing ? "is-syncing" : ""}`}><span/>{syncing ? "Actualizando…" : "Sincronizado"}</div><button className="icon-button" onClick={() => groupId && void loadGroupData(groupId, true)} title="Actualizar"><RotateCcw className={syncing ? "spin" : ""}/></button><ProfileAvatar profile={profile} name={name} className="avatar-button"/></div>
      </header>
      {error && <div className="global-error">{error}<button onClick={() => setError("")}><X/></button></div>}
      {groupId && activePlan === "free" && view !== "planes" && <button className="free-plan-nudge" onClick={()=>openView("planes")}><span><TrendingUp/></span><div><strong>¿Necesitás gestionar más hectáreas?</strong><small>Conocé Growr360 Pro y ampliá la capacidad de tu grupo.</small></div><ChevronRight/></button>}
      {groupBrowserOpen && <GroupBrowser memberships={memberships} onClose={() => setGroupBrowserOpen(false)} onMembershipChanged={() => void loadWorkspace()}/>} 
      {!groupId ? <EmptyWorkspace onGroups={() => setGroupBrowserOpen(true)}/> : <>
        {view === "mapa" && <RealMapView fields={fields} plots={plots} records={records} campaigns={campaigns} assignments={assignments} cropColors={cropColors} crops={crops} settings={settings} onSettingsChange={setSettings} selectedPlot={selectedPlot} setSelectedPlot={plot => setSelectedPlotId(plot?.id ?? null)} groupId={groupId} userId={session.user.id} canManageLots={canManageLots} planLotBlocked={planLotLimitReached||planHectareLimitReached} planBlockReason={planBlockReason} planHectaresUsed={planHectaresUsed} planHectareLimit={planHectareLimit} onCreateRecord={(plot,type) => { setPendingRecord({ plotId: plot.id, type }); setPendingForm("record"); setView("registros"); }} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "campos" && <RealFieldsView fields={fields} plots={resolvePlotCrops(plots, records, assignments, cropColors, crops)} canCreate={hasPermission("manage_fields") && !planFieldLimitReached} onCreate={() => { const reason=planBlockReason("field"); if(reason){setError(reason);return;} setPendingForm("field"); }} onOpenPlot={plot => { setSelectedPlotId(plot.id); setView("mapa"); }}/>} 
        {view === "contratistas" && <ContractorsView contractors={contractors} canManage={hasPermission("create_records")} onCreateContractor={()=>setPendingForm("contractor")}/>}
        {view === "registros" && <RealRecordsView mode="records" records={records} canCreate={hasPermission("create_records")} onCreate={() => setPendingForm("record")}/>} 
        {view === "monitoreos" && <RealRecordsView mode="monitoring" records={records} canCreate={hasPermission("create_monitoring")} onCreate={() => { setPendingRecord({plotId:"",type:"monitoring"}); setPendingForm("record"); }}/>} 
        {view === "napas" && <NapaView records={records} canCreate={hasPermission("create_records")} onCreate={() => { setPendingRecord({plotId:"",type:"napa"}); setPendingForm("record"); }}/>} 
        {view === "campanas" && <CampaignsView campaigns={campaigns} records={records} canCreate={hasPermission("manage_campaigns")} onCreate={() => setPendingForm("campaign")}/>} 
        {view === "ordenes" && <WorkOrdersView groupId={groupId} userId={session.user.id} orders={workOrders} records={records} fields={fields} plots={plots} campaigns={campaigns} members={members} contractors={contractors} supplies={supplies} plan={activePlan} canCreate={hasPermission("create_records")} canEditAny={hasPermission("edit_any_records")} canEditOwn={hasPermission("edit_own_records")} onSaved={()=>void loadGroupData(groupId,true)}/>} 
        {view === "reportes" && <RealReportsView fields={fields} plots={resolvePlotCrops(plots, records, assignments, cropColors, crops)} records={records} crops={crops} campaigns={campaigns}/>}
        {view === "equipo" && <RealTeamView section="members" groupId={groupId} members={members} fields={fields} plots={plots} currentRole={activeMembership?.role ?? "producer"} canManage={hasPermission("manage_members") || activeMembership?.role === "admin"} memberLimit={currentPlan?.max_users??null} onSection={setView} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "solicitudes" && <RealTeamView section="requests" groupId={groupId} members={members} fields={fields} plots={plots} currentRole={activeMembership?.role ?? "producer"} canManage={hasPermission("manage_members") || activeMembership?.role === "admin"} memberLimit={currentPlan?.max_users??null} onSection={setView} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "invitaciones" && <RealTeamView section="invitations" groupId={groupId} members={members} fields={fields} plots={plots} currentRole={activeMembership?.role ?? "producer"} canManage={hasPermission("manage_members") || activeMembership?.role === "admin"} memberLimit={currentPlan?.max_users??null} onSection={setView} onSaved={() => void loadGroupData(groupId, true)}/>}
        {view === "mas" && <MoreView canManageGroup={activeMembership?.role === "owner" || activeMembership?.role === "admin"} onOpenTeam={()=>setView("equipo")} onOpenSettings={()=>setView("configuracion")} onOpenGroupSettings={()=>setView("grupo")} onOpenPlans={()=>setView("planes")}/>}
        {view === "planes" && <PlansView plans={plans} subscription={subscription} activePlan={activePlan} subscriptionError={subscriptionError} plots={plots} campaigns={campaigns} assignments={assignments} members={members} groupName={group?.name??"Grupo activo"}/>}
        {view === "configuracion" && <RealSettingsView mode="personal" groupId={groupId} userId={session.user.id} settings={settings} group={group} canManageGroup={activeMembership?.role === "owner" || activeMembership?.role === "admin"} onSaved={setSettings} onGroupSaved={() => void loadWorkspace()}/>} 
        {view === "grupo" && <RealSettingsView mode="group" groupId={groupId} userId={session.user.id} settings={settings} group={group} canManageGroup={activeMembership?.role === "owner" || activeMembership?.role === "admin"} onSaved={setSettings} onGroupSaved={() => void loadWorkspace()}/>} 
        {planWelcomeOpen && activePlan !== "free" && <div className="plan-welcome-backdrop"><section className={`plan-welcome-card ${activePlan}`}><button className="icon-button" onClick={closePlanWelcome}><X/></button><span className="plan-welcome-icon">{activePlan==="business"?<BriefcaseBusiness/>:<TrendingUp/>}</span><small>PLAN ACTIVADO</small><h2>Bienvenido a Growr360 {activePlan==="business"?"Business":"Pro"}</h2><p>{activePlan==="business"?"Tu grupo ya tiene acceso a la experiencia empresarial, mayor capacidad de gestión y herramientas avanzadas para operar a escala.":"Tu grupo ya puede trabajar con más capacidad, analítica avanzada y herramientas profesionales para centralizar la operación."}</p><div><Check/><span>El plan se aplica a todo el grupo sin borrar ni modificar la información existente.</span></div><button className="primary-action" onClick={closePlanWelcome}>Empezar a usarlo</button></section></div>}
        {pendingForm && <ManagementView groupId={groupId} userId={session.user.id} fields={fields} plots={plots} campaigns={campaigns} clients={clients} contractors={contractors} crops={crops} supplies={supplies} canFields={hasPermission("manage_fields")} canLots={hasPermission("manage_lots")} canCampaigns={hasPermission("manage_campaigns")} canRecords={hasPermission("create_records")} planBlockReason={planBlockReason} initialForm={pendingForm} initialRecord={pendingRecord} onInitialRecordConsumed={() => setPendingRecord(null)} onClose={() => setPendingForm(null)} onMap={() => { setPendingForm(null); setView("mapa"); }} onSaved={() => { setPendingForm(null); void loadGroupData(groupId, true); }}/>} 
      </>}
    </main>
  </div>;
}

function RealMapView({ fields, plots, records, campaigns, assignments, cropColors, crops, settings, onSettingsChange, selectedPlot, setSelectedPlot, groupId, userId, canManageLots, planLotBlocked, planBlockReason, planHectaresUsed, planHectareLimit, onCreateRecord, onSaved }: {
  fields: Field[]; plots: Plot[]; records: RecordRow[]; selectedPlot: Plot | null; setSelectedPlot: (plot: Plot | null) => void;
  campaigns: Campaign[]; assignments: PlotCampaign[]; cropColors: CropColor[]; crops: Crop[]; settings: AppSettings; onSettingsChange:(value:AppSettings)=>void;
  onCreateRecord: (plot: Plot, type: string) => void;
  groupId: string; userId: string; canManageLots: boolean; planLotBlocked:boolean; planBlockReason:(kind:"field"|"lot",extraArea?:number)=>string; planHectaresUsed:number; planHectareLimit:number|null; onSaved: () => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [layer, setLayer] = useState<"cultivo" | "prioridad" | "sin-relleno">("cultivo");
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<number[][]>([]);
  const draggedVertexRef = useRef<number | null>(null);
  const suppressMapClickRef = useRef(false);
  const [draft, setDraft] = useState<GeoFeature | null>(null);
  const [importQueue,setImportQueue]=useState<GeoFeature[]>([]);
  const [recentOpen,setRecentOpen]=useState(false);
  const kmzInput=useRef<HTMLInputElement>(null);
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
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [labelPanelOpen, setLabelPanelOpen] = useState(false);
  const [baseMap, setBaseMap] = useState<"satellite" | "streets">("satellite");
  const [mapQuery, setMapQuery] = useState("");
  const [plotLabelSaving,setPlotLabelSaving]=useState(false);
  const [draggedPlotLabel,setDraggedPlotLabel]=useState<PlotLabelField|null>(null);
  const plotLabelFields = (settings.plot_label_fields?.length ? settings.plot_label_fields : DEFAULT_PLOT_LABEL_FIELDS) as PlotLabelField[];
  const plotLabelEditorFields = useMemo<PlotLabelField[]>(() => [
    ...plotLabelFields,
    ...PLOT_LABEL_OPTIONS.map(option => option.id).filter(id => !plotLabelFields.includes(id))
  ], [plotLabelFields.join("|")]);
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
    if (monitoringDays === null) return [];
    const cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); if (monitoringDays > 0) cutoff.setDate(cutoff.getDate() - monitoringDays);
    const monitoringCampaignId = campaignFilterId || activeCampaignId;
    return records.filter(row => {
      if (row.record_type !== "monitoring" || (monitoringCampaignId && row.campaign_id !== monitoringCampaignId)) return false;
      const data = recordData(row);
      const status = normalizeText(String(data.gps_status ?? ""));
      const latitude = number(data.gps_latitude as string | number | null);
      const longitude = number(data.gps_longitude as string | number | null);
      const date = new Date(`${row.record_date}T12:00:00`);
      return status === "dentro del lote" && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && (latitude !== 0 || longitude !== 0) && (monitoringDays < 0 || date >= cutoff);
    });
  }, [records, monitoringDays, campaignFilterId, activeCampaignId]);
  const mapPlots = useMemo<MapPlot[]>(() => displayPlots.map(plot => {
    const feature = geometry(plot.geometry_json);
    if (!feature) return null;
    return { ...plot, feature, fieldName: relation(plot.fields)?.name ?? fields.find(field => field.id === plot.field_id)?.name ?? "Campo" };
  }).filter(Boolean) as MapPlot[], [displayPlots, fields]);
  const mapPlotLabels = useMemo(() => new globalThis.Map(mapPlots.map(plot => [plot.id, buildPlotMapLabel(plot, records, assignments, campaigns, preferredCampaignId, plotLabelFields)])), [mapPlots, records, assignments, campaigns, preferredCampaignId, plotLabelFields.join("|")]);
  async function persistPlotLabels(next:PlotLabelField[]){
    const clean=next.length?next:DEFAULT_PLOT_LABEL_FIELDS;
    const nextSettings={...settings,plot_label_fields:clean};
    onSettingsChange(nextSettings);setPlotLabelSaving(true);
    const {error}=await supabase.from("app_settings").upsert({group_id:groupId,user_id:userId,appearance:settings.appearance,area_unit:settings.area_unit,date_format:settings.date_format,notifications_enabled:settings.notifications_enabled,plot_label_fields:clean},{onConflict:"group_id,user_id"});
    setPlotLabelSaving(false);
    if(error)console.error("No se pudieron guardar las etiquetas del mapa:",error.message);
  }
  async function updatePlotLabels(field:PlotLabelField,checked:boolean){
    const next=checked?Array.from(new Set([...plotLabelFields,field])):plotLabelFields.filter(item=>item!==field);
    await persistPlotLabels(next);
  }
  async function movePlotLabel(field:PlotLabelField,direction:-1|1){
    const index=plotLabelFields.indexOf(field);
    const target=index+direction;
    if(index<0||target<0||target>=plotLabelFields.length)return;
    const next=[...plotLabelFields];
    [next[index],next[target]]=[next[target],next[index]];
    await persistPlotLabels(next);
  }
  async function dropPlotLabel(target:PlotLabelField){
    const source=draggedPlotLabel;
    setDraggedPlotLabel(null);
    if(!source||source===target)return;
    const next=[...plotLabelFields];
    const from=next.indexOf(source),to=next.indexOf(target);
    if(from<0||to<0)return;
    next.splice(from,1);next.splice(to,0,source);
    await persistPlotLabels(next);
  }
  const mapSearchResults = useMemo(() => {
    const query = normalizeText(mapQuery.trim());
    if (!query) return [];
    return mapPlots.filter(plot => normalizeText(`${plot.name} ${plot.fieldName}`).includes(query)).slice(0, 8);
  }, [mapPlots, mapQuery]);

  const focusPlot = useCallback((plot: MapPlot) => {
    const map = mapRef.current;
    if (!map) return;
    fitPlots(map, [plot]);
    setSelectedPlot(plots.find(item => item.id === plot.id) ?? plot);
  }, [plots, setSelectedPlot]);

  const refreshSources = useCallback((map: MapLibreMap, drawPoints = points) => {
    const collection = {
      type: "FeatureCollection" as const,
      features: mapPlots.map(plot => ({
        ...plot.feature,
        properties: { id: plot.id, name: plot.name, label: mapPlotLabels.get(plot.id) || plot.name, color: plotColor(plot, layer) }
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
    (map.getSource("midpoints") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: drawPoints.length < 2 ? [] : drawPoints.map((point, index) => {
        const nextIndex = index + 1 < drawPoints.length ? index + 1 : (drawPoints.length >= 3 ? 0 : -1);
        if (nextIndex < 0) return null;
        const next = drawPoints[nextIndex];
        return { type: "Feature", properties: { insertAfter: index }, geometry: { type: "Point", coordinates: [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] } };
      }).filter(Boolean)
    } as Parameters<GeoJSONSource["setData"]>[0]);
    (map.getSource("monitorings") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: monitoringRecords.map(row => {
        const data = recordData(row);
        const priority = Math.max(1, Math.min(5, number(data.monitoring_priority as string | number) || 3));
        return { type: "Feature", properties: { id: row.id, color: monitoringPriorityColor(priority) }, geometry: { type: "Point", coordinates: [number(data.gps_longitude as string | number), number(data.gps_latitude as string | number)] } };
      })
    });
    if (map.getLayer("plot-fill")) map.setPaintProperty("plot-fill", "fill-opacity", layer === "sin-relleno" ? 0 : .48);
  }, [mapPlots, mapPlotLabels, layer, points, monitoringRecords]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center: [-60.2, -34.8],
      zoom: 7,
      maxZoom: 18,
      style: { version: 8, sources: {
        streets: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "OpenStreetMap" },
        satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Esri" }
      }, layers: [
        { id: "streets", type: "raster", source: "streets", layout: { visibility: "none" } },
        { id: "satellite", type: "raster", source: "satellite" }
      ] }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("plots", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("drawing", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("vertices", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("midpoints", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("monitorings", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("sentinel-image", { type: "image", url: transparentPixel(), coordinates: [[-60.3,-34.7],[-60.2,-34.7],[-60.2,-34.8],[-60.3,-34.8]] });
      map.addLayer({ id: "plot-fill", type: "fill", source: "plots", paint: { "fill-color": ["get", "color"], "fill-opacity": .48 } });
      map.addLayer({ id: "sentinel-layer", type: "raster", source: "sentinel-image", paint: { "raster-opacity": .82, "raster-fade-duration": 0 } });
      map.addLayer({ id: "plot-line", type: "line", source: "plots", paint: { "line-color": "#ffffff", "line-width": 1.7 } });
      map.addLayer({ id: "plot-label", type: "symbol", source: "plots", layout: { "text-field": ["get", "label"], "text-size": 12.5, "text-line-height": 1.18, "text-max-width": 16, "text-allow-overlap": false }, paint: { "text-color": "#ffffff", "text-halo-color": "#0b2018", "text-halo-width": 3 } });
      map.addLayer({ id: "monitoring-points", type: "circle", source: "monitorings", paint: { "circle-radius": 8, "circle-color": ["get", "color"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5 } });
      map.addLayer({ id: "draw-fill", type: "fill", source: "drawing", filter: ["==", "$type", "Polygon"], paint: { "fill-color": "#63dc42", "fill-opacity": .28 } });
      map.addLayer({ id: "draw-line", type: "line", source: "drawing", paint: { "line-color": "#a7ff79", "line-width": 3 } });
      map.addLayer({ id: "draw-midpoints", type: "circle", source: "midpoints", paint: { "circle-radius": 6, "circle-color": "#8bea68", "circle-opacity": .9, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
      map.addLayer({ id: "draw-points", type: "circle", source: "vertices", paint: { "circle-radius": 9, "circle-color": "#f8fff4", "circle-stroke-color": "#1e7b45", "circle-stroke-width": 3.5 } });
      refreshSources(map, []);
      const initiallySelected = selectedPlot ? mapPlots.find(plot => plot.id === selectedPlot.id) : null;
      if (initiallySelected) fitPlots(map, [initiallySelected]);
      else if (mapPlots.length) fitPlots(map, mapPlots);
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

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getSource("drawing")) refreshSources(map);
  }, [refreshSources]);

  useEffect(() => {
    if (!selectedPlot || !mapRef.current?.loaded()) return;
    const target = mapPlots.find(plot => plot.id === selectedPlot.id);
    if (target) fitPlots(mapRef.current, [target]);
  }, [selectedPlot?.id, mapPlots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyBaseMapVisibility = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer("satellite")) map.setLayoutProperty("satellite", "visibility", baseMap === "satellite" ? "visible" : "none");
      if (map.getLayer("streets")) map.setLayoutProperty("streets", "visibility", baseMap === "streets" ? "visible" : "none");
    };
    if (map.isStyleLoaded()) applyBaseMapVisibility();
    else map.once("style.load", applyBaseMapVisibility);
    return () => { map.off("style.load", applyBaseMapVisibility); };
  }, [baseMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const placePoint = (event: maplibregl.MapMouseEvent) => {
      if (!drawing || suppressMapClickRef.current) return;
      const handleLayers = ["draw-points", "draw-midpoints"].filter(id => Boolean(map.getLayer(id)));
      const handles = handleLayers.length ? map.queryRenderedFeatures(event.point, { layers: handleLayers }) : [];
      if (handles.length) return;
      setPoints(previous => [...previous, [event.lngLat.lng, event.lngLat.lat]]);
    };
    const midpointClick = (event: maplibregl.MapLayerMouseEvent) => {
      if (!drawing) return;
      event.preventDefault();
      event.originalEvent.stopPropagation();
      suppressMapClickRef.current = true;
      const insertAfter = Number(event.features?.[0]?.properties?.insertAfter);
      if (!Number.isInteger(insertAfter)) return;
      setPoints(previous => {
        const next = [...previous];
        next.splice(insertAfter + 1, 0, [event.lngLat.lng, event.lngLat.lat]);
        return next;
      });
      window.setTimeout(() => { suppressMapClickRef.current = false; }, 0);
    };
    const vertexDown = (event: maplibregl.MapLayerMouseEvent) => {
      if (!drawing) return;
      event.preventDefault();
      event.originalEvent.stopPropagation();
      const index = Number(event.features?.[0]?.properties?.index);
      if (!Number.isInteger(index)) return;
      draggedVertexRef.current = index;
      suppressMapClickRef.current = true;
      map.dragPan.disable();
      map.getCanvas().style.cursor = "grabbing";
    };
    const dragVertex = (event: maplibregl.MapMouseEvent) => {
      const index = draggedVertexRef.current;
      if (index === null) return;
      setPoints(previous => previous.map((point, pointIndex) => pointIndex === index ? [event.lngLat.lng, event.lngLat.lat] : point));
    };
    const endVertexDrag = () => {
      if (draggedVertexRef.current === null) return;
      draggedVertexRef.current = null;
      if (!drawing) map.dragPan.enable();
      map.getCanvas().style.cursor = drawing ? "crosshair" : "";
      window.setTimeout(() => { suppressMapClickRef.current = false; }, 0);
    };
    const handleEnter = () => { if (draggedVertexRef.current === null) map.getCanvas().style.cursor = "grab"; };
    const handleLeave = () => { if (draggedVertexRef.current === null) map.getCanvas().style.cursor = drawing ? "crosshair" : ""; };
    if (drawing) map.dragPan.disable();
    map.on("mouseup", placePoint);
    map.on("click", "draw-midpoints", midpointClick);
    map.on("mousedown", "draw-points", vertexDown);
    map.on("mousemove", dragVertex);
    map.on("mouseup", endVertexDrag);
    map.on("mouseenter", "draw-points", handleEnter);
    map.on("mouseenter", "draw-midpoints", handleEnter);
    map.on("mouseleave", "draw-points", handleLeave);
    map.on("mouseleave", "draw-midpoints", handleLeave);
    map.getCanvas().style.cursor = drawing ? "crosshair" : "";
    return () => {
      map.off("mouseup", placePoint);
      map.off("click", "draw-midpoints", midpointClick);
      map.off("mousedown", "draw-points", vertexDown);
      map.off("mousemove", dragVertex);
      map.off("mouseup", endVertexDrag);
      map.off("mouseenter", "draw-points", handleEnter);
      map.off("mouseenter", "draw-midpoints", handleEnter);
      map.off("mouseleave", "draw-points", handleLeave);
      map.off("mouseleave", "draw-midpoints", handleLeave);
      draggedVertexRef.current = null;
      if (!map.dragPan.isEnabled()) map.dragPan.enable();
      if (map.getCanvas()) map.getCanvas().style.cursor = "";
    };
  }, [drawing]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.getSource("drawing")) refreshSources(map, points);
  }, [points, refreshSources]);

  function startDrawing() {
    if (!fields.length || !canManageLots) return;
    if (planLotBlocked) { setSatelliteError(planBlockReason("lot")); return; }
    setSelectedPlot(null); setDraft(null); setPoints([]); setDrawing(true);
  }
  function cancelDrawing() { setDrawing(false); setPoints([]); setDraft(null); }
  function finishDrawing() {
    if (points.length < 3) return;
    const calculated = calculateGeometry(points);
    setDraft(calculated); setDrawing(false);
  }
  async function importKmz(file:File){
    setSatelliteError("");
    if(planLotBlocked){setSatelliteError(planBlockReason("lot"));if(kmzInput.current)kmzInput.current.value="";return;}
    try{
      let kml="";
      if(file.name.toLowerCase().endsWith(".kmz")){
        const zip=await JSZip.loadAsync(file);
        const entry=Object.values(zip.files).find(item=>item.name.toLowerCase().endsWith(".kml"));
        if(!entry)throw new Error("El KMZ no contiene ningún archivo KML.");
        kml=await entry.async("text");
      }else kml=await file.text();
      const features=kmlFeatures(kml);
      if(!features.length)throw new Error("No encontramos polígonos de lotes en el archivo.");
      const importedArea=sum(features.map(feature=>number(feature.properties?.area_ha)));
      if(planHectareLimit!=null&&planHectaresUsed+importedArea>planHectareLimit)throw new Error(`La importación sumaría ${importedArea.toLocaleString("es-AR",{maximumFractionDigits:2})} ha y superaría el límite de ${planHectareLimit.toLocaleString("es-AR")} ha de tu plan. No se importó ningún lote.`);
      const claim=await supabase.rpc("claim_kml_import",{p_group_id:groupId});
      if(claim.error)throw new Error(claim.error.message);
      setSelectedPlot(null);setImportQueue(features.slice(1));setDraft(features[0]);setDrawing(false);
    }catch(reason){setSatelliteError(reason instanceof Error?reason.message:"No se pudo importar el archivo.");}
    if(kmzInput.current)kmzInput.current.value="";
  }
  async function exportKmz(){
    const targets=selectedPlot?mapPlots.filter(plot=>plot.id===selectedPlot.id):mapPlots;
    if(!targets.length){setSatelliteError("No hay lotes trazados para exportar.");return;}
    const zip=new JSZip();zip.file("lotes-growr360.kml",plotsKml(targets));
    const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE"});
    const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=selectedPlot?`${selectedPlot.name}.kmz`:"lotes-growr360.kmz";anchor.click();URL.revokeObjectURL(url);
  }
  function advanceImported(){const [next,...rest]=importQueue;setImportQueue(rest);setDraft(next??null);if(!next)onSaved();}
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
    setFilterPanel(null); setLayerPanelOpen(false); setRecentOpen(false); setSelectedPlot(null);
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

  function locateUser() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      position => mapRef.current?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 16, essential: true }),
      () => setSatelliteError("No pudimos obtener tu ubicación. Revisá el permiso del navegador."),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  function toggleMapFilter(kind: "campaign" | "monitoring") {
    const opening = filterPanel !== kind;
    setFilterPanel(opening ? kind : null);
    if (opening) { setLayerPanelOpen(false); setSatelliteOpen(false); setRecentOpen(false); setSelectedPlot(null); }
  }

  function toggleMapLayers() {
    const opening = !layerPanelOpen;
    setLayerPanelOpen(opening);
    if (opening) { setFilterPanel(null); setSatelliteOpen(false); setRecentOpen(false); setSelectedPlot(null); setLabelPanelOpen(false); }
  }

  function toggleMapLabels() {
    const opening = !labelPanelOpen;
    setLabelPanelOpen(opening);
    if (opening) { setFilterPanel(null); setLayerPanelOpen(false); setSatelliteOpen(false); setRecentOpen(false); setSelectedPlot(null); }
  }

  function openRecentRecords() {
    setFilterPanel(null); setLayerPanelOpen(false); setLabelPanelOpen(false); setSatelliteOpen(false); setSelectedPlot(null); setRecentOpen(true);
  }

  return <div className="map-workspace">
    <div ref={mapNode} className={`map-canvas ${drawing ? "is-drawing" : ""}`}/>
    <div className="map-search-wrap">
      <div className="map-search"><Search/><input value={mapQuery} onChange={event => setMapQuery(event.target.value)} placeholder="Buscar lote o campo…" aria-label="Buscar lote o campo"/>{mapQuery && <button onClick={() => setMapQuery("")} aria-label="Limpiar búsqueda"><X/></button>}</div>
      {mapQuery && <div className="map-search-results">{mapSearchResults.map(plot => <button key={plot.id} onClick={() => { focusPlot(plot); setMapQuery(""); }}><MapPin/><span><strong>{plot.name}</strong><small>{plot.fieldName} · {number(plot.arable_area).toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha</small></span><ChevronRight/></button>)}{!mapSearchResults.length && <p>No encontramos lotes o campos con ese nombre.</p>}</div>}
    </div>
    <button className="map-compass" title="Orientar el norte hacia arriba" aria-label="Orientar el norte hacia arriba" onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 500 })}><Compass/></button>
    {!drawing && !draft && <div className="map-toolbar">
      <button onClick={startDrawing} className="primary-map-action" disabled={!fields.length || !canManageLots || planLotBlocked} title={!canManageLots ? "Tu función no tiene permiso para administrar lotes" : planLotBlocked ? planBlockReason("lot") : "Dibujar nuevo lote"}><Plus/><span>Dibujar lote</span></button>
      <button onClick={locateUser} title="Centrar en mi ubicación"><LocateFixed/><span>Mi ubicación</span></button>
      <button onClick={() => setBaseMap(current => current === "satellite" ? "streets" : "satellite")} className={baseMap === "streets" ? "selected" : ""} title="Cambiar mapa base"><Map/><span>Mapa base</span></button>
      <button onClick={() => toggleMapFilter("campaign")} className={filterPanel === "campaign" || campaignFilterId ? "selected" : ""} title="Filtrar por campaña"><Filter/><span>Campaña</span></button>
      <button onClick={toggleMapLayers} className={layerPanelOpen ? "selected" : ""} title="Capas y colores"><Layers3/><span>Capas</span></button>
      <button onClick={toggleMapLabels} className={labelPanelOpen ? "selected" : ""} title="Configurar etiquetas visibles sobre los lotes"><Settings2/><span>Etiquetas</span></button>
      <button onClick={() => satelliteOpen ? setSatelliteOpen(false) : void openSatellite()} className={satelliteOpen ? "selected" : ""} title="Imágenes satelitales de Planet Insights"><Satellite/><span>Planet</span></button>
      <button onClick={() => toggleMapFilter("monitoring")} className={filterPanel === "monitoring" || monitoringDays ? "selected" : ""} title="Monitoreos geolocalizados"><Activity/><span>Monitoreos</span></button>
    </div>}
    {!drawing && !draft && <div className="map-bottom-tools"><button onClick={() => mapRef.current && fitPlots(mapRef.current, mapPlots)} title="Ver todos los lotes"><MapPin/></button><button onClick={openRecentRecords} title="Últimos registros"><History/></button><button onClick={()=>kmzInput.current?.click()} disabled={!canManageLots||planLotBlocked} title="Importar KML o KMZ"><FileUp/></button><button onClick={()=>void exportKmz()} title={selectedPlot?"Exportar lote en KMZ":"Exportar todos los lotes en KMZ"}><Download/></button><button onClick={onSaved} title="Actualizar datos"><RotateCcw/></button><input ref={kmzInput} hidden type="file" accept=".kml,.kmz,application/vnd.google-earth.kml+xml,application/vnd.google-earth.kmz" onChange={event=>event.target.files?.[0]&&void importKmz(event.target.files[0])}/></div>}
    {filterPanel === "campaign" && <div className="map-filter-panel campaign-filter-panel"><div><strong>Campaña del mapa</strong><button onClick={() => setFilterPanel(null)}><X/></button></div><select value={campaignFilterId} onChange={event => setCampaignFilterId(event.target.value)}><option value="">Todas las campañas</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}{campaign.status === "active" ? " · Activa" : ""}</option>)}</select><small>El filtro actualiza lotes, cultivos y monitoreos.</small></div>}
    {filterPanel === "monitoring" && <div className="map-filter-panel monitoring-filter-panel"><div><strong>Monitoreos en el mapa</strong><button onClick={() => setFilterPanel(null)}><X/></button></div><div className="monitoring-days">{[7,15,30,-1].map(days => <button key={days} className={monitoringDays === days ? "active" : ""} onClick={() => setMonitoringDays(days)}>{days < 0 ? "Todos" : `${days} días`}</button>)}</div><button className="monitoring-hide" onClick={() => setMonitoringDays(null)}><EyeOff/>Ocultar monitoreos</button><small>“Todos” incluye la campaña activa completa. Solo aparecen monitoreos con GPS válido.</small></div>}
    {layerPanelOpen && <div className="layer-switcher premium-layer-switcher compact-layer-switcher"><div className="layer-switcher-title"><div><Layers3/><span>Visualización</span></div><button className="layer-close" onClick={()=>setLayerPanelOpen(false)} aria-label="Cerrar"><X/></button></div><div className="layer-style-options">{(["cultivo", "prioridad", "sin-relleno"] as const).map(value => <button key={value} className={layer === value ? "active" : ""} onClick={() => setLayer(value)}>{value === "sin-relleno" ? "Sin relleno" : cap(value)}</button>)}</div></div>}
    {labelPanelOpen && <div className="map-label-panel"><header><div><Settings2/><span><strong>Etiquetas del mapa</strong><small>Activá, desactivá y ordená todo desde una sola lista.</small></span></div><div>{plotLabelSaving&&<LoaderCircle className="spin"/>}<button onClick={()=>setLabelPanelOpen(false)} aria-label="Cerrar"><X/></button></div></header><div className="map-label-unified"><div className="map-label-order-title"><span>Contenido del lote</span><small>Arrastrá las activas para reordenar</small></div>{plotLabelEditorFields.map(field=>{const option=PLOT_LABEL_OPTIONS.find(item=>item.id===field)!;const active=plotLabelFields.includes(field);const index=plotLabelFields.indexOf(field);return <div key={field} className={`map-label-unified-row${active?" active":" inactive"}${draggedPlotLabel===field?" dragging":""}`} draggable={active} onDragStart={()=>active&&setDraggedPlotLabel(field)} onDragEnd={()=>setDraggedPlotLabel(null)} onDragOver={event=>{if(active)event.preventDefault()}} onDrop={()=>active&&void dropPlotLabel(field)}><span className={`map-label-grip${active?"":" disabled"}`} title={active?"Arrastrar para reordenar":"Activá la etiqueta para poder ordenarla"}><GripVertical/></span><label className="map-label-toggle"><input type="checkbox" checked={active} disabled={plotLabelSaving} onChange={event=>void updatePlotLabels(field,event.target.checked)}/><span aria-hidden="true"/></label><span className="map-label-order-copy"><strong>{option.label}</strong><small>{active?(index===0?"Se muestra primero":`Posición ${index+1}`):option.hint}</small></span><span className="map-label-order-actions"><button type="button" onClick={()=>void movePlotLabel(field,-1)} disabled={!active||index===0||plotLabelSaving} aria-label={`Subir ${option.label}`}><ArrowUp/></button><button type="button" onClick={()=>void movePlotLabel(field,1)} disabled={!active||index===plotLabelFields.length-1||plotLabelSaving} aria-label={`Bajar ${option.label}`}><ArrowDown/></button></span></div>})}</div></div>}
    {drawing && <div className="drawing-panel"><span className="eyebrow">NUEVO TRAZADO</span><h3>Marcá los límites del lote</h3><p>Hacé clic sobre el mapa para agregar cada vértice. Necesitás al menos tres puntos.</p><strong>{points.length} punto{points.length === 1 ? "" : "s"}</strong><div><button onClick={() => setPoints(current => current.slice(0, -1))} disabled={!points.length}><Undo2/>Deshacer</button><button onClick={cancelDrawing}><X/>Cancelar</button><button className="finish" disabled={points.length < 3} onClick={finishDrawing}><Check/>Finalizar</button></div></div>}
    {draft && <PlotForm key={`${draft.properties?.imported_name??"drawn"}-${draft.geometry.coordinates[0][0]?.join(",")}`} feature={draft} fields={fields} groupId={groupId} userId={userId} planBlockReason={planBlockReason} onCancel={()=>{if(importQueue.length)advanceImported();else cancelDrawing();}} onSaved={()=>{if(importQueue.length)advanceImported();else{cancelDrawing();onSaved();}}}/>} 
    {selectedPlot && !drawing && !draft && !satelliteOpen && <RealPlotPanel plot={displayPlots.find(plot => plot.id === selectedPlot.id) ?? selectedPlot} fieldName={relation(selectedPlot.fields)?.name ?? fields.find(f => f.id === selectedPlot.field_id)?.name ?? "Campo"} records={records.filter(row => row.plot_id === selectedPlot.id)} onRecord={setDetailRecord} onNewRecord={() => onCreateRecord(selectedPlot,"")} onMonitoring={() => onCreateRecord(selectedPlot,"monitoring")} onSatellite={() => { setSatellitePlotId(selectedPlot.id); void openSatellite(); }} onClose={() => setSelectedPlot(null)}/>}
    {satelliteOpen && <aside className="satellite-panel real-satellite"><div className="sat-top"><div><span className="eyebrow">PLANET INSIGHTS · SENTINEL-2</span><strong>Imágenes satelitales</strong></div><button onClick={() => setSatelliteOpen(false)}><X/></button></div>
      <label className="sat-plot-picker">Lote<select value={satellitePlotId} onChange={e => void loadSatelliteScenes(e.target.value)}><option value="">Seleccionar lote…</option>{mapPlots.map(plot => <option key={plot.id} value={plot.id}>{plot.name} · {plot.fieldName}</option>)}</select></label>
      <div className="sat-selector">{["RGB","NDVI","NDVI_CONTRASTED","FALSE_COLOR","NDRE"].map(index => <button key={index} className={satelliteIndex === index ? "active" : ""} onClick={() => { setSatelliteIndex(index); const target = mapPlots.find(plot => plot.id === satellitePlotId); if (target) void loadSatellitePreviews(target, satelliteScenes.slice(0, 10), index); if (satelliteScene) void showSatellite(satelliteScene, index); }}>{satelliteIndexName(index)}</button>)}</div>
      {satelliteLoading && <div className="sat-loading"><LoaderCircle className="spin"/>Procesando imagen…</div>}{satelliteError && <p className="sat-error">{satelliteError}</p>}
      {!!satelliteScenes.length && <><div className="sat-opacity"><span>Opacidad <b>{Math.round(satelliteOpacity * 100)}%</b></span><input type="range" min=".1" max="1" step=".05" value={satelliteOpacity} onChange={e => { const value = Number(e.target.value); setSatelliteOpacity(value); if (mapRef.current?.getLayer("sentinel-layer")) mapRef.current.setPaintProperty("sentinel-layer", "raster-opacity", value); }}/></div><div className="history"><strong>Historial · {satelliteIndexName(satelliteIndex)}</strong><div className="dates">{satelliteScenes.slice(0, 12).map(scene => <button key={scene.id} className={satelliteScene?.id === scene.id ? "active" : ""} onClick={() => void showSatellite(scene)}>{satellitePreviews[scene.id] ? <img className="sentinel-preview-image" src={satellitePreviews[scene.id]} alt={`Vista ${scene.date}`}/> : <div className="sentinel-preview"><LoaderCircle className="spin"/></div>}<b>{formatDate(scene.date)}</b><small>{Math.round(scene.cloud)}% nubes · {scene.satellite}</small></button>)}</div></div></>}
    </aside>}
    {recentOpen&&!drawing&&!draft&&<aside className="lot-panel operational-panel recent-map-panel"><div className="panel-handle"/><div className="lot-head"><div><span className="eyebrow">ACTIVIDAD DEL EQUIPO</span><h2>Últimos registros</h2><h3>Más recientes primero</h3></div><button className="icon-button" onClick={()=>setRecentOpen(false)}><X/></button></div><PlotActivitySection title="Actividad reciente" icon={History} rows={[...records].filter(row=>row.record_type!=="monitoring").sort((a,b)=>String(b.record_date).localeCompare(String(a.record_date))).slice(0,6)} onOpen={setDetailRecord}/></aside>}
    {detailRecord && <RecordDetail record={detailRecord} onClose={() => setDetailRecord(null)}/>}
    {!fields.length && <div className="map-empty-hint">Primero necesitás crear un campo desde la aplicación móvil para poder asociar el lote.</div>}
    {fields.length > 0 && !canManageLots && <div className="map-permission-hint">Podés consultar el mapa, pero tu función no tiene el permiso “Administrar lotes”. Un dueño o administrador puede habilitarlo desde Miembros y grupo.</div>}
  </div>;
}

function PlotForm({ feature, fields, groupId, userId, planBlockReason, onCancel, onSaved }: {
  feature: GeoFeature; fields: Field[]; groupId: string; userId: string; planBlockReason:(kind:"field"|"lot",extraArea?:number)=>string; onCancel: () => void; onSaved: () => void;
}) {
  const initialArea = Number(feature.properties?.area_ha ?? 0);
  const [fieldId, setFieldId] = useState(fields[0]?.id ?? "");
  const [name, setName] = useState(String(feature.properties?.imported_name ?? ""));
  const [area, setArea] = useState(initialArea.toFixed(2));
  const [allowEdits, setAllowEdits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    const numericArea = number(area);
    if (!name.trim() || !fieldId || numericArea <= 0) { setMessage("Completá el nombre, campo y superficie."); return; }
    const planReason=planBlockReason("lot",numericArea); if(planReason){setMessage(planReason);return;}
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
  const monitorings = ordered.filter(row => effectiveRecordType(row) === "monitoring").slice(0, 5);
  const activities = ordered.filter(row => effectiveRecordType(row) !== "monitoring").slice(0, 5);
  const summary=plotOperationalSummary(plot,ordered);
  return <aside className="lot-panel operational-panel plot-summary-panel"><div className="panel-handle"/><header className="plot-summary-head"><div className="plot-summary-title"><span className="plot-summary-kicker">{fieldName}</span><h2>{plot.name}</h2><div className="plot-summary-crop"><i style={{background:plot.cropColor||"#77847e"}}/><span>{summary.lastCrop||plot.cropName||"Sin cultivo registrado"}</span></div></div><button className="icon-button" onClick={onClose} aria-label="Cerrar lote"><X/></button></header>
    <section className="plot-summary-overview"><div className="plot-summary-primary"><small>SUPERFICIE</small><strong>{number(plot.arable_area).toLocaleString("es-AR",{maximumFractionDigits:2})}<span> ha</span></strong></div><div className="plot-summary-primary"><small>CAMPAÑA</small><strong>{summary.campaign||"—"}</strong></div><div className="plot-summary-primary"><small>ÚLTIMA ACTIVIDAD</small><strong>{summary.lastActivity?formatDate(summary.lastActivity.record_date):"—"}</strong><span>{summary.lastActivity?recordType(effectiveRecordType(summary.lastActivity)):"Sin actividad"}</span></div></section>
    <section className="plot-summary-details"><div className="plot-summary-section-title"><span>Resumen productivo</span><small>Información tomada del historial del lote</small></div><div className="plot-summary-grid"><PlotSummaryItem icon={Sprout} label="Último cultivo" value={summary.lastCrop||plot.cropName||"Sin informar"}/><PlotSummaryItem icon={CalendarDays} label="Fecha de siembra" value={summary.sowingDate?formatDate(summary.sowingDate):"Sin siembra registrada"}/><PlotSummaryItem icon={Leaf} label="Variedad de siembra" value={summary.sowingVariety||"Sin informar"}/><PlotSummaryItem icon={TrendingUp} label="Rendimiento / ha" value={summary.yieldPerHa||"Sin cosecha registrada"}/></div></section>
    <div className="quick-actions plot-actions plot-summary-actions"><button onClick={onSatellite}><Satellite/><span>Satélite</span></button><button onClick={onNewRecord}><Plus/><span>Nuevo registro</span></button><button onClick={onMonitoring}><Activity/><span>Monitorear</span></button></div>
    <div className="plot-summary-history"><PlotActivitySection title="Últimos registros" icon={FileText} rows={activities} onOpen={onRecord}/><PlotActivitySection title="Últimos monitoreos" icon={Activity} rows={monitorings} onOpen={onRecord}/></div>
  </aside>;
}

function PlotSummaryItem({icon:Icon,label,value}:{icon:typeof Activity;label:string;value:string}){return <div className="plot-summary-item"><span><Icon/></span><div><small>{label}</small><strong>{value}</strong></div></div>;}

function PlotActivitySection({ title, icon: Icon, rows, onOpen }: { title: string; icon: typeof Activity; rows: RecordRow[]; onOpen: (record: RecordRow) => void }) {
  return <section><div className="section-title"><div><Icon/>{title}</div><span>{rows.length}</span></div>{rows.map(row => <button className="activity-row activity-button" key={row.id} onClick={() => onOpen(row)}><div className="activity-icon"><Leaf/></div><div><strong>{recordType(row.record_type)}{recordCrop(row) ? ` · ${recordCrop(row)}` : ""}</strong><small>{relation(row.campaigns)?.name || "Sin campaña"} · {formatDate(row.record_date)}{effectiveRecordType(row)!=="monitoring" ? ` · ${number(row.worked_area).toLocaleString("es-AR")} ha` : ""}</small></div><ChevronRight/></button>)}{!rows.length && <p className="panel-empty">No hay información cargada.</p>}</section>;
}

function RecordDetail({ record, onClose }: { record: RecordRow; onClose: () => void }) {
  const details = recordData(record);
  const actualType=effectiveRecordType(record);
  const observations=String(details.observations??record.observations??"").trim();
  const entries=visibleDetails(details).filter(([key])=>key!=="observations"&&!/^input_\d+_/.test(key)&&key!=="input_count"&&!['crop_source_record_id','crop_source'].includes(key));
  const inputs=recordInputDetails(details,number(record.worked_area));
  const costs=entries.filter(([key])=>/(cost|price|income|margin|inputs_total)/.test(key));
  const gps=entries.filter(([key])=>key.startsWith("gps_"));
  const monitoring=entries.filter(([key])=>/(weed|insect|disease|monitoring_priority|phenological|plant_count)/.test(key));
  const samples=entries.filter(([key])=>key.startsWith("soil_sample_"));
  const excluded=new Set([...costs,...gps,...monitoring,...samples].map(([key])=>key));
  const technical=entries.filter(([key])=>!excluded.has(key));
  const crop=recordCrop(record);
  const fieldName=relation(record.fields)?.name || "Campo sin informar";
  const plotName=relation(record.plots)?.name || "Lote sin informar";
  const campaignName=relation(record.campaigns)?.name || "Sin campaña";
  const area=number(record.worked_area);
  return <div className="record-detail-backdrop"><article className={`record-detail-sheet record-detail-v3 record-detail-v4 ${actualType==="monitoring"?"monitoring-detail-v3":""}`}>
    <header className="record-detail-v3-head">
      <button className="record-detail-back" onClick={onClose}><ChevronLeft/>Volver</button>
      <div className="record-detail-identity">
        <span className={`record-detail-type type-${actualType}`}><RecordTypeIcon type={actualType}/>{recordType(actualType)}</span>
        <h2>{fieldName} <span>·</span> {plotName}</h2>
        <p><CalendarDays/>{formatDate(record.record_date)}<span>•</span>{campaignName}</p>
      </div>
      <div className="record-detail-crop-hero"><small>{actualType==="monitoring"?"CULTIVO OBSERVADO":"CULTIVO"}</small><strong>{crop||"Sin cultivo informado"}</strong></div>
    </header>

    <section className="record-detail-facts">
      <RecordFact icon={CalendarDays} label="Fecha" value={formatDate(record.record_date)}/>
      <RecordFact icon={MapPin} label="Ubicación" value={`${fieldName} · ${plotName}`}/>
      <RecordFact icon={Sprout} label="Campaña" value={campaignName}/>
      {actualType!=="napa"&&<RecordFact icon={Grid2X2} label="Superficie" value={area>0?`${area.toLocaleString("es-AR",{maximumFractionDigits:2})} ha`:"No informada"}/>} 
    </section>

    {(record.contractor||record.machinery_text)&&<section className="record-detail-execution"><div className="record-detail-section-heading"><Tractor/><div><span>EJECUCIÓN</span><h3>Quién y con qué se realizó</h3></div></div><div className="record-detail-data-grid">{record.contractor&&<DataTile label="Contratista / responsable" value={record.contractor}/>} {record.machinery_text&&<DataTile label="Maquinaria" value={record.machinery_text}/>}</div></section>}

    {actualType==="monitoring"&&<MonitoringHealthBlock details={details} entries={monitoring}/>} 

    {inputs.length>0&&<section className="record-detail-section record-detail-inputs-v3"><div className="record-detail-section-heading"><Leaf/><div><span>INSUMOS</span><h3>Productos y dosis aplicadas</h3></div></div><div className="record-inputs-v3-list">{inputs.map(input=>{const rateUnit=input.unit.includes("/")?input.unit:`${input.unit||"u"}/ha`;const perHa=/\/ha$/i.test(rateUnit);const totalUnit=rateUnit.replace(/\/ha$/i,"");return <article key={input.index}><div className="input-product"><small>INSUMO</small><strong>{input.name||`Insumo ${input.index+1}`}</strong></div><div className="input-dose"><small>DOSIS</small><strong>{input.dose.toLocaleString("es-AR",{maximumFractionDigits:3})}</strong><span>{rateUnit}</span></div><div className="input-total"><small>TOTAL</small><strong>{perHa?input.quantity.toLocaleString("es-AR",{maximumFractionDigits:2}):"—"}</strong><span>{perHa?totalUnit:"Según base tratada"}</span></div></article>})}</div></section>}

    {technical.length>0&&<RecordDetailPanel title="Datos de la labor" eyebrow="DATOS TÉCNICOS" icon={SlidersHorizontal} entries={technical}/>} 
    {samples.length>0&&<RecordDetailPanel title="Resultados de muestras" eyebrow="MUESTRAS DE SUELO" icon={MapPin} entries={samples}/>} 
    {costs.length>0&&<RecordDetailPanel title="Costos y valores" eyebrow="ECONOMÍA" icon={CreditCard} entries={costs} emphasis/>} 
    {gps.length>0&&<RecordDetailPanel title="Ubicación registrada" eyebrow="GPS" icon={LocateFixed} entries={gps}/>} 
    {observations&&<section className="record-detail-section record-observations-v3"><div className="record-detail-section-heading"><FileText/><div><span>OBSERVACIONES</span><h3>Notas del registro</h3></div></div><p>{observations}</p></section>} 
    {!inputs.length&&!monitoring.length&&!technical.length&&!samples.length&&!costs.length&&!gps.length&&!observations&&<section className="record-detail-section"><EmptyLine text="Este registro no tiene datos adicionales."/></section>}
    <section className="record-detail-section record-attachments-v3"><RecordAttachments recordId={record.id}/></section>
  </article></div>;
}

function RecordFact({icon:Icon,label,value}:{icon:typeof Activity;label:string;value:string}){
  return <div className="record-fact"><span><Icon/></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function DataTile({label,value}:{label:string;value:React.ReactNode}){
  return <div className="record-data-tile"><small>{label}</small><strong>{value}</strong></div>;
}

function RecordDetailPanel({title,eyebrow,icon:Icon,entries,emphasis=false}:{title:string;eyebrow:string;icon:typeof Activity;entries:[string,unknown][];emphasis?:boolean}){
  return <section className={`record-detail-section record-detail-panel-v3 ${emphasis?"emphasis":""}`}><div className="record-detail-section-heading"><Icon/><div><span>{eyebrow}</span><h3>{title}</h3></div><b>{entries.length}</b></div><div className="record-detail-data-grid">{entries.map(([key,value])=><DataTile key={key} label={detailLabel(key)} value={formatDetailValue(key,value)}/>)}</div></section>;
}

function MonitoringHealthBlock({details,entries}:{details:Record<string,unknown>;entries:[string,unknown][]}){
  const priority=entries.find(([key])=>key==="monitoring_priority")?.[1]??details.monitoring_priority??3;
  const categories=[
    {title:"Malezas",selected:"weeds",levels:"weed_levels",icon:Leaf},
    {title:"Insectos",selected:"insects",levels:"insect_levels",icon:Activity},
    {title:"Enfermedades",selected:"diseases",levels:"disease_levels",icon:ShieldCheck}
  ];
  const populated=categories.map(category=>({...category,signals:monitoringSignals(details,category.selected,category.levels,number(String(priority))||3)})).filter(category=>category.signals.length);
  return <section className="monitoring-health-block"><div className="detail-section-title"><Activity/><div><h3>Estado sanitario</h3><p>Semáforo de malezas, insectos y enfermedades</p></div></div><div className="monitoring-health-overview"><ImportanceDetail value={priority}/><span>El color permite detectar rápidamente qué requiere atención.</span></div>{populated.length?<div className="monitoring-health-categories">{populated.map(({title,icon:Icon,signals})=><article key={title}><header><Icon/><div><strong>{title}</strong><small>{signals.length} hallazgo{signals.length===1?"":"s"}</small></div></header><div>{signals.map(signal=><span key={signal.name} style={{"--severity":severityColor(signal.level)} as React.CSSProperties}><i/><b>{translatedDetailText(signal.name)}</b><em>{severityName(signal.level)}</em><strong>{signal.level}</strong></span>)}</div></article>)}</div>:<div className="monitoring-health-empty"><Check/><span><strong>Sin adversidades informadas</strong><small>El monitoreo no contiene malezas, insectos o enfermedades seleccionadas.</small></span></div>}</section>
}

function monitoringSignals(details:Record<string,unknown>,selectedKey:string,levelsKey:string,fallback:number){
  const levels=parseSeverityValue(details[levelsKey]);
  const selected=String(details[selectedKey]??"").split(/[,|]/).map(value=>value.trim()).filter(Boolean);
  const names=Array.from(new Set([...Object.keys(levels),...selected]));
  return names.map(name=>({name,level:Math.max(1,Math.min(5,levels[name]??fallback))})).sort((a,b)=>b.level-a.level||a.name.localeCompare(b.name,"es"));
}

function parseSeverityValue(value:unknown){
  const result:Record<string,number>={};
  if(value&&typeof value==="object"&&!Array.isArray(value)){Object.entries(value as Record<string,unknown>).forEach(([name,raw])=>{const level=Math.round(number(String(raw)));if(name&&level>=1&&level<=5)result[name]=level});return result}
  String(value??"").split("|").forEach(item=>{const colon=item.lastIndexOf(":");const equals=item.lastIndexOf("=");const separator=Math.max(colon,equals);if(separator<1)return;const name=item.slice(0,separator).trim();const level=Math.round(number(item.slice(separator+1)));if(name&&level>=1&&level<=5)result[name]=level});
  return result;
}

function severityName(level:number){return ["Leve","Bajo","Medio","Alto","Crítico"][Math.max(1,Math.min(5,level))-1]}

function recordInputDetails(details:Record<string,unknown>,workedArea:number){
  const grouped=new globalThis.Map<number,{index:number;name:string;dose:number;price:number;unit:string}>();
  Object.entries(details).forEach(([key,value])=>{const match=key.match(/^input_(\d+)_(name|dose|price|unit)$/);if(!match)return;const index=Number(match[1]);const current=grouped.get(index)??{index,name:"",dose:0,price:0,unit:""};if(match[2]==="name")current.name=String(value??"");else if(match[2]==="unit")current.unit=String(value??"");else if(match[2]==="dose")current.dose=number(value as string|number);else current.price=number(value as string|number);grouped.set(index,current)});
  return Array.from(grouped.values()).sort((a,b)=>a.index-b.index).map(input=>({...input,quantity:workedArea*input.dose,subtotal:workedArea*input.dose*input.price}));
}

function ObservationBlock({value,compact=false}:{value:string;compact?:boolean}){
  return <section className={`observation-block ${compact?"compact":""}`}><div><FileText/><span><small>OBSERVACIONES</small><strong>Notas del registro</strong></span></div><p>{value}</p></section>;
}

function RecordAttachments({recordId}:{recordId:string}){
  const[files,setFiles]=useState<ResolvedAttachment[]>([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[selectedIndex,setSelectedIndex]=useState<number|null>(null);
  useEffect(()=>{let cancelled=false;(async()=>{setLoading(true);setError("");try{
    await ensureActiveSession();
    const result=await supabase.from("attachments").select("id,record_id,file_name,storage_path,mime_type,size_bytes").eq("record_id",recordId).is("deleted_at",null).order("created_at",{ascending:true});
    if(result.error)throw result.error;
    const resolved=(await Promise.all(((result.data??[]) as RecordAttachment[]).map(async file=>{const signed=await supabase.storage.from("record-attachments").createSignedUrl(file.storage_path,60*60);return signed.data?.signedUrl?{...file,url:signed.data.signedUrl}:null;}))).filter((file):file is ResolvedAttachment=>Boolean(file));
    if(!cancelled)setFiles(resolved);
  }catch(reason){if(!cancelled)setError(spanishError(reason));}finally{if(!cancelled)setLoading(false);}})();return()=>{cancelled=true};},[recordId]);
  if(loading)return <section className="record-attachments"><div className="attachment-title"><Paperclip/><div><h3>Fotos y archivos</h3><p>Cargando adjuntos…</p></div><LoaderCircle className="spin"/></div></section>;
  if(!files.length&&!error)return null;
  const images=files.filter(file=>file.mime_type?.startsWith("image/"));
  const selected=selectedIndex===null?null:images[selectedIndex]??null;
  const move=(direction:number)=>setSelectedIndex(current=>current===null?null:(current+direction+images.length)%images.length);
  return <section className="record-attachments"><div className="attachment-title"><Paperclip/><div><h3>Fotos y archivos</h3><p>{files.length} adjunto{files.length===1?"":"s"} en este registro</p></div></div>{error&&<p className="form-error">{error}</p>}<div className="attachment-grid">{files.map(file=>file.mime_type?.startsWith("image/")?<button type="button" key={file.id} className="attachment-image" onClick={()=>setSelectedIndex(images.findIndex(image=>image.id===file.id))}><img src={file.url} alt={file.file_name}/><span><Maximize2/>{file.file_name}</span></button>:<a key={file.id} className="attachment-file" href={file.url} target="_blank" rel="noreferrer"><FileText/><span><strong>{file.file_name}</strong><small>{attachmentSize(file.size_bytes)}</small></span><Download/></a>)}</div>{selected&&<div className="photo-viewer" role="dialog" aria-modal="true" aria-label={`Vista de ${selected.file_name}`} onClick={()=>setSelectedIndex(null)}><button type="button" className="photo-viewer-close" onClick={()=>setSelectedIndex(null)} aria-label="Cerrar"><X/></button>{images.length>1&&<button type="button" className="photo-viewer-nav previous" onClick={event=>{event.stopPropagation();move(-1)}} aria-label="Foto anterior"><ChevronLeft/></button>}<div className="photo-viewer-frame" onClick={event=>event.stopPropagation()}><img src={selected.url} alt={selected.file_name}/></div>{images.length>1&&<button type="button" className="photo-viewer-nav next" onClick={event=>{event.stopPropagation();move(1)}} aria-label="Foto siguiente"><ChevronRight/></button>}<div className="photo-viewer-meta" onClick={event=>event.stopPropagation()}><strong title={selected.file_name}>{selected.file_name}</strong>{images.length>1&&<span>{(selectedIndex??0)+1} de {images.length}</span>}<a href={selected.url} target="_blank" rel="noreferrer"><Download/>Abrir original</a></div></div>}</section>;
}

function RealFieldsView({ fields, plots, onOpenPlot, canCreate, onCreate }: { fields: Field[]; plots: Plot[]; onOpenPlot: (plot: Plot) => void; canCreate:boolean; onCreate:()=>void }) {
  const [openField, setOpenField] = useState<string | null>(null);
  const selectedField=fields.find(field=>field.id===openField);
  if(selectedField){const children=plots.filter(plot=>plot.field_id===selectedField.id);return <div className="page-content field-detail-page"><button className="page-back-button" onClick={()=>setOpenField(null)}><ChevronLeft/>Volver a campos</button><PageHead title={selectedField.name} text={[selectedField.locality,selectedField.province].filter(Boolean).join(" · ")||"Sin ubicación informada"}/><div className="field-full-info"><div><small>Superficie total</small><strong>{number(selectedField.total_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></div><div><small>Superficie sembrable</small><strong>{number(selectedField.arable_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></div><div><small>Lotes</small><strong>{children.length}</strong></div></div><section className="content-card field-detail-lots"><h3>Lotes del campo</h3>{children.map(plot=><button className="field-plot-row" key={plot.id} onClick={()=>onOpenPlot(plot)}><i style={{background:plot.cropColor||"#77847e"}}/><div><strong>{plot.name}</strong><small>{plot.cropName||"Sin cultivo asignado"}</small></div><span>{number(plot.arable_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</span><em>{geometry(plot.geometry_json)?"En mapa":"Sin trazar"}</em><ChevronRight/></button>)}{!children.length&&<EmptyLine text="Este campo todavía no tiene lotes."/>}</section></div>}
  return <div className="page-content"><PageHead title="Campos" text="Abrí un campo para consultar sus lotes, superficie y cultivos." action={canCreate?<button className="primary-action" onClick={onCreate}><Plus/>Crear campo</button>:undefined}/>
    <div className="stats-grid"><Stat label="Campos activos" value={String(fields.length)} detail={`${sum(fields.map(f => number(f.arable_area))).toLocaleString("es-AR")} ha sembrables`} icon={MapPin}/><Stat label="Lotes" value={String(plots.length)} detail={`${plots.filter(p => geometry(p.geometry_json)).length} georreferenciados`} icon={Grid2X2}/><Stat label="Superficie en lotes" value={`${sum(plots.map(p => number(p.arable_area))).toLocaleString("es-AR")} ha`} detail="Datos sincronizados" icon={Sprout}/></div>
    <div className="field-stack">{fields.map(field => {
      const children = plots.filter(plot => plot.field_id === field.id);
      const area = sum(children.map(plot => number(plot.arable_area)));
      return <section className="field-card" key={field.id}>
        <button className="field-summary" onClick={() => setOpenField(field.id)}>
          <div className="field-icon"><MapPin/></div><div><h3>{field.name}</h3><p>{[field.locality, field.province].filter(Boolean).join(" · ") || "Sin ubicación informada"}</p></div>
          <div className="field-metric"><strong>{area.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha</strong><small>{children.length} lote{children.length === 1 ? "" : "s"}</small></div><ChevronRight/>
        </button>
      </section>;
    })}{!fields.length && <div className="content-card"><EmptyLine text="Todavía no hay campos en este grupo."/></div>}</div>
  </div>;
}

function RealRecordsView({ records, canCreate, onCreate, mode = "records" }: { records: RecordRow[]; canCreate:boolean; onCreate:()=>void; mode?:"records"|"monitoring" }) {
  const [query, setQuery] = useState("");
  const [selected,setSelected]=useState<RecordRow|null>(null);
  const visible = records.filter(row => (mode === "monitoring" ? effectiveRecordType(row) === "monitoring" : !["napa", "monitoring"].includes(effectiveRecordType(row))) && JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  const monitoring = mode === "monitoring";
  return <div className="page-content"><PageHead title={monitoring ? "Monitoreos" : "Registros"} text={monitoring ? "Seguimiento del estado de los cultivos, plagas, malezas y enfermedades." : "Siembras, aplicaciones, cosechas, labores y análisis del grupo."} action={canCreate?<button className="primary-action" onClick={onCreate}><Plus/>{monitoring ? "Nuevo monitoreo" : "Nuevo registro"}</button>:undefined}/><div className="records-toolbar"><div className="inner-search"><Search/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={monitoring ? "Buscar monitoreo por campo o lote…" : "Buscar por campo, lote o tipo…"}/></div><button className="soft-button"><Filter/>Filtros</button></div><div className="record-list">{visible.map(row => <button type="button" className="record-card interactive-card" key={row.id} onClick={()=>setSelected(row)}><div className="record-type-icon">{monitoring ? <Eye/> : <RecordTypeIcon type={effectiveRecordType(row)}/>}</div><div className="record-main"><span>{recordType(effectiveRecordType(row))}</span><h3>{relation(row.fields)?.name ?? "Campo"} · {relation(row.plots)?.name ?? "Sin lote"}</h3><div className="record-context"><small>{formatDate(row.record_date)}</small><i/><small>{relation(row.campaigns)?.name ?? "Sin campaña"}</small>{row.worked_area!=null&&<><i/><small>{number(row.worked_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</small></>}</div></div><RecordListSummary row={row}/><ChevronRight className="record-open-icon"/></button>)}{!visible.length && <EmptyLine text={monitoring ? "No hay monitoreos para mostrar." : "No hay registros para mostrar."}/>}</div>{selected&&<RecordDetail record={selected} onClose={()=>setSelected(null)}/>}</div>;
}

function RecordListSummary({row}:{row:RecordRow}){
  const type=effectiveRecordType(row);
  const details=recordData(row);
  if(type==="harvest"){
    const total=number((details.total_production??details.production) as string|number);
    const area=number((details.harvested_area??row.worked_area) as string|number);
    const yieldPerHa=number(details.yield_per_ha as string|number)||(area>0?total/area:0);
    const unit=String(details.unit||"kg");
    return <div className="record-list-summary harvest-summary"><span><small>Producción</small><strong>{total.toLocaleString("es-AR",{maximumFractionDigits:0})} {unit}</strong></span><span><small>Rendimiento</small><strong>{yieldPerHa.toLocaleString("es-AR",{maximumFractionDigits:0})} {unit}/ha</strong></span></div>;
  }
  if(["sowing","spraying","fertilization"].includes(type)){
    const inputs=recordInputDetails(details,number(row.worked_area)).filter(input=>input.name);
    if(!inputs.length)return <div className="record-list-summary muted-summary">Sin insumos informados</div>;
    return <div className="record-list-summary input-summary">{inputs.slice(0,3).map(input=><span key={`${input.index}-${input.name}`}><strong>{input.name}</strong><small>{input.dose.toLocaleString("es-AR",{maximumFractionDigits:2})} {input.unit||"u"}/ha</small></span>)}{inputs.length>3&&<em>+{inputs.length-3} más</em>}</div>;
  }
  return <div className="record-list-summary muted-summary">{recordCrop(row)||String(details.work_type||details.title||"")}</div>;
}

function NapaView({records,canCreate,onCreate}:{records:RecordRow[];canCreate:boolean;onCreate:()=>void}){
  const [selected,setSelected]=useState<RecordRow|null>(null);
  const [openField,setOpenField]=useState("");
  const [openPlot,setOpenPlot]=useState("");
  const rows=records.filter(row=>effectiveRecordType(row)==="napa").sort((a,b)=>b.record_date.localeCompare(a.record_date));
  const fieldGroups=Array.from(new globalThis.Map<string,{id:string;name:string}>(rows.map(row=>[row.field_id||relation(row.fields)?.name||"field",{id:row.field_id||relation(row.fields)?.name||"field",name:relation(row.fields)?.name||"Campo"}] as const)).values());
  return <div className="page-content"><PageHead title="Napas" text="Entrá por campo y lote para consultar el historial de mediciones." action={canCreate?<button className="primary-action" onClick={onCreate}><Plus/>Nueva medición</button>:undefined}/><div className="napa-tree">{fieldGroups.map(field=>{const fieldRows=rows.filter(row=>(row.field_id||relation(row.fields)?.name||"field")===field.id);const expanded=openField===field.id;const plotGroups=Array.from(new globalThis.Map<string,{id:string;name:string}>(fieldRows.map(row=>[row.plot_id||relation(row.plots)?.name||"plot",{id:row.plot_id||relation(row.plots)?.name||"plot",name:relation(row.plots)?.name||"Sin lote"}] as const)).values());return <section className={`napa-field ${expanded?"expanded":""}`} key={field.id}><button className="napa-field-head" onClick={()=>{setOpenField(expanded?"":field.id);setOpenPlot("")}}><div><MapPin/><span><small>CAMPO</small><strong>{field.name}</strong></span></div><em>{fieldRows.length} medición{fieldRows.length===1?"":"es"}</em><ChevronDown/></button>{expanded&&<div className="napa-plots">{plotGroups.map(plot=>{const plotRows=fieldRows.filter(row=>(row.plot_id||relation(row.plots)?.name||"plot")===plot.id);const plotOpen=openPlot===plot.id;return <section key={plot.id}><button className="napa-plot-head" onClick={()=>setOpenPlot(plotOpen?"":plot.id)}><div><Waves/><span><small>LOTE</small><strong>{plot.name}</strong></span></div><span>{plotRows.length} registro{plotRows.length===1?"":"s"}</span><ChevronDown/></button>{plotOpen&&<div className="napa-measurements">{plotRows.map(row=><button key={row.id} onClick={()=>setSelected(row)}><div><strong>{formatNapaDepth(recordData(row).water_table_depth)}</strong><small>{relation(row.campaigns)?.name||"Sin campaña"}</small></div><time>{formatDate(row.record_date)}</time><ChevronRight/></button>)}</div>}</section>})}</div>}</section>})}{!rows.length&&<EmptyLine text="Todavía no hay mediciones de napa."/>}</div>{selected&&<RecordDetail record={selected} onClose={()=>setSelected(null)}/>}</div>;
}

function CampaignsView({ campaigns, records, canCreate, onCreate }: { campaigns:Campaign[];records:RecordRow[]; canCreate:boolean; onCreate:()=>void }) {
  const [selected,setSelected]=useState<Campaign|null>(null);
  return <div className="page-content"><div className="page-head"><div><h2>Campañas</h2><p>Ciclos productivos del grupo activo.</p></div>{canCreate&&<button className="primary-action" onClick={onCreate}><Plus/>Nueva campaña</button>}</div><div className="campaign-grid">{campaigns.map(campaign=><article role="button" tabIndex={0} className="campaign-card interactive-card" key={campaign.id} onClick={()=>setSelected(campaign)}><div><CalendarDays/></div><section><span className={`campaign-status ${campaign.status}`}>{campaign.status === "active" ? "Activa" : campaign.status === "planned" ? "Planificada" : "Finalizada"}</span><h3>{campaign.name}</h3><p>{formatDate(campaign.start_date)} · {formatDate(campaign.end_date)}</p></section><ChevronRight/></article>)}{!campaigns.length&&<EmptyLine text="Todavía no hay campañas creadas."/>}</div>{selected&&<CampaignDetail campaign={selected} records={records.filter(row=>row.campaign_id===selected.id)} onClose={()=>setSelected(null)}/>}</div>;
}

function CampaignDetail({campaign,records,onClose}:{campaign:Campaign;records:RecordRow[];onClose:()=>void}){const types=Array.from(new Set(records.map(effectiveRecordType)));return <div className="record-detail-backdrop"><article className="record-detail-sheet compact-detail"><header><button className="page-back-button" onClick={onClose}><ChevronLeft/>Volver</button><div><span className="eyebrow">CAMPAÑA</span><h2>{campaign.name}</h2><p>{campaign.status==="active"?"Activa":campaign.status==="planned"?"Planificada":"Finalizada"}</p></div></header><div className="detail-hero"><CalendarDays/><div><small>Inicio</small><strong>{formatDate(campaign.start_date)}</strong></div><div><small>Fin</small><strong>{formatDate(campaign.end_date)}</strong></div><div><small>Registros</small><strong>{records.length}</strong></div></div><section><h3>Actividad de la campaña</h3><div className="detail-grid">{types.map(type=><div key={type}><small>{recordType(type)}</small><strong>{records.filter(row=>effectiveRecordType(row)===type).length}</strong></div>)}{!types.length&&<EmptyLine text="Esta campaña todavía no tiene actividad."/>}</div></section></article></div>}

const REPORT_CATALOG = [
  { id:"planting_progress", title:"Avance de siembra", text:"Superficie acumulada día por día, en hectáreas y porcentaje del total sembrable.", icon:TrendingUp, metric:"planted_area", dimension:"crop", chart:"line" },
  { id:"operations", title:"Trabajos y superficie", text:"Siembra, pulverización, fertilización, cosecha y labores.", icon:Tractor, metric:"worked_area", dimension:"type", chart:"bar" },
  { id:"production", title:"Producción y rendimiento", text:"Producción total, superficie cosechada y rendimiento por cultivo.", icon:Sprout, metric:"production", dimension:"crop", chart:"bar" },
  { id:"economy", title:"Costos e insumos", text:"Costos totales, por hectárea, labores e insumos utilizados.", icon:TrendingUp, metric:"cost", dimension:"type", chart:"bar" },
  { id:"contractors", title:"Contratistas", text:"Trabajos y superficie ejecutada por cada contratista.", icon:BriefcaseBusiness, metric:"worked_area", dimension:"contractor", chart:"bar" },
  { id:"water", title:"Evolución de napas", text:"Profundidad registrada y evolución cronológica por mes.", icon:Waves, metric:"water_table", dimension:"month", chart:"line" }
] as const;

function RealReportsView({ fields, plots, records, crops, campaigns }: { fields: Field[]; plots: Plot[]; records: RecordRow[]; crops: Crop[]; campaigns: Campaign[] }) {
  const [fieldId, setFieldId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [crop, setCrop] = useState("");
  const [type, setType] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [contractor, setContractor] = useState("");
  const [priority, setPriority] = useState("");
  const [chartType, setChartType] = useState<"bar"|"line"|"pie">("bar");
  const [chartDimension, setChartDimension] = useState("crop");
  const [chartMetric, setChartMetric] = useState("worked_area");
  const [chartSelection,setChartSelection]=useState("");
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [selectedReport,setSelectedReport]=useState("");
  const contractors = Array.from(new Set(records.map(row => row.contractor?.trim()).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,"es"));
  const filtered = records.filter(row => !["monitoring","soil_analysis"].includes(effectiveRecordType(row)) && (!fieldId || row.field_id === fieldId) && (!plotId || row.plot_id === plotId) && (!campaignId || row.campaign_id === campaignId) && (!type || effectiveRecordType(row) === type) && (!contractor || normalizeText(row.contractor ?? "") === normalizeText(contractor)) && (!crop || recordCrop(row).toLowerCase() === crop.toLowerCase()));
  const filteredPlots = plots.filter(plot => (!fieldId || plot.field_id === fieldId) && (!plotId || plot.id === plotId) && (!crop || plot.cropName?.toLowerCase() === crop.toLowerCase()) && (!priority || normalizePriorityColor(plot.priority_color) === priority));
  const area = sum(filteredPlots.map(plot => number(plot.arable_area)));
  const worked = sum(filtered.map(row => number(row.worked_area)));
  const chartRows = buildChartRows(filtered, chartDimension, chartMetric);
  const activeFilterCount=[fieldId,plotId,campaignId,crop,type,contractor].filter(Boolean).length;
  const clearFilters=()=>{setFieldId("");setPlotId("");setCampaignId("");setCrop("");setType("");setContractor("");};
  const openReport=(id:string)=>{const report=REPORT_CATALOG.find(item=>item.id===id);if(!report)return;setSelectedReport(id);setChartMetric(report.metric);setChartDimension(report.dimension);setChartType(report.chart);setChartSelection("");setFiltersOpen(false)};
  if(!selectedReport)return <div className="page-content reports-home"><PageHead title="Reportes" text="Elegí qué querés analizar. Después vas a poder aplicar filtros y abrir el origen de cada dato."/><div className="report-catalog">{REPORT_CATALOG.map(({id,title,text,icon:Icon})=><button key={id} onClick={()=>openReport(id)}><span><Icon/></span><div><h3>{title}</h3><p>{text}</p></div><ChevronRight/></button>)}</div></div>;
  const reportTitle=REPORT_CATALOG.find(item=>item.id===selectedReport)?.title??"Reporte";
  if(selectedReport==="planting_progress")return <PlantingProgressReport records={records} plots={plots} crops={crops} campaigns={campaigns} onBack={()=>setSelectedReport("")}/>;
  return <div className="page-content"><PageHead title={reportTitle} text="Combiná filtros, elegí el gráfico y tocá cualquier dato para ver su origen." action={<button className="soft-button report-back" onClick={()=>{setSelectedReport("");setChartSelection("")}}><ChevronLeft/>Todos los reportes</button>}/>
    <section className="report-filter-panel">
      <div className="report-filter-heading"><div><span className="report-filter-icon"><Filter/></span><div><h3>Filtros del informe</h3><p>{activeFilterCount?`${activeFilterCount} filtro${activeFilterCount===1?"":"s"} aplicado${activeFilterCount===1?"":"s"}`:"Mostrando toda la información disponible"}</p></div></div><div>{activeFilterCount>0&&<button className="filter-clear-compact" onClick={clearFilters}><RotateCcw/>Limpiar</button>}<button className="filter-toggle" onClick={()=>setFiltersOpen(value=>!value)}>{filtersOpen?"Ocultar":"Filtrar"}<ChevronDown className={filtersOpen?"rotated":""}/></button></div></div>
      {activeFilterCount>0&&<div className="active-filter-chips">{fieldId&&<span>Campo: {fields.find(item=>item.id===fieldId)?.name}</span>}{plotId&&<span>Lote: {plots.find(item=>item.id===plotId)?.name}</span>}{campaignId&&<span>Campaña: {relation(records.find(item=>item.campaign_id===campaignId)?.campaigns)?.name}</span>}{crop&&<span>Cultivo: {crop}</span>}{type&&<span>Tipo: {recordType(type)}</span>}{contractor&&<span>Contratista: {contractor}</span>}</div>}
      {filtersOpen&&<div className="report-filter premium-filter"><label><span>Campo</span><select value={fieldId} onChange={e => { setFieldId(e.target.value); setPlotId(""); }}><option value="">Todos los campos</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label><label><span>Lote</span><select value={plotId} onChange={e => setPlotId(e.target.value)}><option value="">Todos los lotes</option>{plots.filter(plot => !fieldId || plot.field_id === fieldId).map(plot => <option key={plot.id} value={plot.id}>{plot.name}</option>)}</select></label><label><span>Campaña</span><select value={campaignId} onChange={e => setCampaignId(e.target.value)}><option value="">Todas las campañas</option>{Array.from(new globalThis.Map(records.map(row=>[row.campaign_id,relation(row.campaigns)?.name])).entries()).filter(([id])=>id).map(([id,name])=><option key={id!} value={id!}>{name}</option>)}</select></label><label><span>Cultivo</span><select value={crop} onChange={e => setCrop(e.target.value)}><option value="">Todos los cultivos</option>{crops.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label><span>Tipo de registro</span><select value={type} onChange={e => setType(e.target.value)}><option value="">Todos los registros</option>{Array.from(new Set(records.map(effectiveRecordType))).filter(item=>!["monitoring","soil_analysis"].includes(item)).map(item => <option key={item} value={item}>{recordType(item)}</option>)}</select></label><label><span>Contratista</span><select value={contractor} onChange={e => setContractor(e.target.value)}><option value="">Todos los contratistas</option>{contractors.map(item=><option key={item} value={item}>{item}</option>)}</select></label></div>}
    </section>
    <div className="kpi-grid"><Kpi label="Superficie analizada" value={`${area.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha`}/><Kpi label="Superficie trabajada" value={`${worked.toLocaleString("es-AR", { maximumFractionDigits: 2 })} ha`}/><Kpi label="Lotes incluidos" value={String(filteredPlots.length)}/><Kpi label="Registros incluidos" value={String(filtered.length)}/></div>
    <div className="chart-card analytics-chart"><div className="chart-head"><div><h3>Constructor de gráficos</h3><p>Tocá cualquier dato para ver los registros que lo componen.</p></div><div className="chart-type-tabs"><button className={chartType==="bar"?"active":""} onClick={()=>setChartType("bar")}><BarChart3/>Barras</button><button className={chartType==="line"?"active":""} onClick={()=>setChartType("line")}><LineChart/>Líneas</button><button className={chartType==="pie"?"active":""} onClick={()=>setChartType("pie")}><PieChart/>Torta</button></div></div><div className="chart-controls"><label>Agrupar por<select value={chartDimension} onChange={event=>{setChartDimension(event.target.value);setChartSelection("")}}><option value="crop">Cultivo</option><option value="plot">Lote</option><option value="field">Campo</option><option value="campaign">Campaña</option><option value="contractor">Contratista</option><option value="type">Tipo de registro</option><option value="month">Mes</option></select></label><label>Métrica<select value={chartMetric} onChange={event=>{setChartMetric(event.target.value);setChartSelection("")}}>{REPORT_METRICS.map(metric=><option value={metric.id} key={metric.id}>{metric.label}</option>)}</select></label></div><ReportChart type={chartType} rows={chartRows} metric={chartMetric} selected={chartSelection} onSelect={setChartSelection}/>{chartSelection&&<ChartDrilldown label={chartSelection} rows={filtered.filter(row=>chartLabel(row,chartDimension)===chartSelection&&(chartMetric!=="water_table"||effectiveRecordType(row)==="napa"))} metric={chartMetric} onClose={()=>setChartSelection("")}/>}</div>
    {contractor && <ContractorSummary contractor={contractor} records={filtered}/>} 
    <div className="content-card report-summary"><div className="priority-summary-head"><div><h3>Resumen de prioridades</h3><p>Filtrá los lotes por la prioridad asignada en el grupo.</p></div><div className="priority-filter"><button className={!priority ? "active" : ""} onClick={() => setPriority("")}>Todas</button><button className={priority === "#D32F2F" ? "active" : ""} onClick={() => setPriority("#D32F2F")}><i style={{background:"#D32F2F"}}/>Alta</button><button className={priority === "#FBC02D" ? "active" : ""} onClick={() => setPriority("#FBC02D")}><i style={{background:"#FBC02D"}}/>Media</button><button className={priority === "#388E3C" ? "active" : ""} onClick={() => setPriority("#388E3C")}><i style={{background:"#388E3C"}}/>Baja</button></div></div>{fields.filter(field => !fieldId || field.id === fieldId).map(field => <section key={field.id}><h4>{field.name}</h4>{filteredPlots.filter(plot => plot.field_id === field.id).map(plot => <div key={plot.id}><i style={{ background: plot.priority_color || "#77847e" }}/><span>{plot.name}</span><small>{plot.cropName || "Sin cultivo"}</small><strong>{number(plot.arable_area).toLocaleString("es-AR")} ha</strong></div>)}</section>)}</div>
  </div>;
}

type PlantingProgressPoint={date:string;daily:number;accumulated:number;percent:number};
function PlantingProgressReport({records,plots,crops,campaigns,onBack}:{records:RecordRow[];plots:Plot[];crops:Crop[];campaigns:Campaign[];onBack:()=>void}){
  const campaignOptions=useMemo(()=>{
    const fromRecords=records.map(row=>({id:row.campaign_id||relation(row.campaigns)?.id||"",name:relation(row.campaigns)?.name||""})).filter(item=>item.id&&item.name);
    return Array.from(new globalThis.Map([...campaigns.map(item=>[item.id,{id:item.id,name:item.name}] as const),...fromRecords.map(item=>[item.id,item] as const)]).values());
  },[campaigns,records]);
  const[campaignId,setCampaignId]=useState("");
  const[crop,setCrop]=useState("");
  const cropOptions=useMemo(()=>{
    if(!campaignId)return[];
    const catalogNames=new globalThis.Map(crops.map(item=>[normalizeText(item.name),item.name]));
    const campaignCrops=new globalThis.Map<string,string>();
    records.filter(row=>(row.campaign_id||relation(row.campaigns)?.id)===campaignId&&effectiveRecordType(row)==="sowing").forEach(row=>{
      const recordedName=recordCrop(row).trim();
      if(!recordedName)return;
      const normalized=normalizeText(recordedName);
      campaignCrops.set(normalized,catalogNames.get(normalized)??recordedName);
    });
    return Array.from(campaignCrops.values()).sort((a,b)=>a.localeCompare(b,"es"));
  },[campaignId,crops,records]);
  useEffect(()=>{if(!campaignId&&campaignOptions.length)setCampaignId(campaignOptions[0].id)},[campaignId,campaignOptions]);
  useEffect(()=>{
    const selectedIsAvailable=cropOptions.some(item=>normalizeText(item)===normalizeText(crop));
    if(!selectedIsAvailable)setCrop(cropOptions[0]??"");
  },[crop,cropOptions]);
  const report=useMemo(()=>buildPlantingProgress(records,plots,campaignId,crop),[records,plots,campaignId,crop]);
  const current=report.points.at(-1)?.accumulated??0;
  const percentage=report.total>0?Math.min(100,current/report.total*100):0;
  return <div className="page-content planting-progress-page"><PageHead title="Avance de siembra" text="Evolución acumulada diaria, sin duplicar la superficie de un lote por tener varios registros." action={<button className="soft-button report-back" onClick={onBack}><ChevronLeft/>Todos los reportes</button>}/>
    <section className="planting-selector-card"><div><span><Sprout/></span><div><h3>Elegí qué querés seguir</h3><p>El total se calcula una sola vez por lote, usando su superficie sembrable.</p></div></div><div className="planting-selectors"><label><span>Campaña</span><select value={campaignId} onChange={event=>setCampaignId(event.target.value)}>{campaignOptions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Cultivo</span><select value={crop} disabled={!cropOptions.length} onChange={event=>setCrop(event.target.value)}>{cropOptions.length?cropOptions.map(item=><option key={item} value={item}>{item}</option>):<option value="">Sin cultivos con siembras</option>}</select></label></div></section>
    <div className="planting-kpis"><article><small>Sembrado acumulado</small><strong>{current.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong><span>al último día registrado</span></article><article><small>Superficie sembrable total</small><strong>{report.total.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong><span>{report.plotCount} lote{report.plotCount===1?"":"s"}, sin duplicados</span></article><article className="planting-percent"><small>Avance</small><strong>{percentage.toLocaleString("es-AR",{maximumFractionDigits:1})}%</strong><span>{current.toLocaleString("es-AR",{maximumFractionDigits:2})} de {report.total.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</span></article></div>
    <section className="chart-card planting-chart-card"><div className="chart-head"><div><h3>Superficie acumulada día por día</h3><p>{crop||"Cultivo"} · {campaignOptions.find(item=>item.id===campaignId)?.name||"Campaña"}</p></div><span className="planting-chart-unit">ha / % del total</span></div><PlantingProgressChart points={report.points} total={report.total}/></section>
    <section className="content-card planting-daily"><div className="detail-section-title"><CalendarDays/><div><h3>Detalle diario</h3><p>Cada fecha conserva la resolución diaria aunque ese día no haya nuevas hectáreas.</p></div></div>{report.points.length?<div className="planting-daily-grid">{report.points.map(point=><article key={point.date}><time>{formatShortDay(point.date)}</time><span className={point.daily>0?"has-progress":""}>{point.daily>0?`+${point.daily.toLocaleString("es-AR",{maximumFractionDigits:2})} ha`:"Sin nuevas ha"}</span><strong>{point.accumulated.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong><small>{point.percent.toLocaleString("es-AR",{maximumFractionDigits:1})}%</small></article>)}</div>:<EmptyLine text="No hay siembras cargadas para esta campaña y cultivo."/>}</section>
  </div>
}

function buildPlantingProgress(records:RecordRow[],plots:Plot[],campaignId:string,crop:string){
  if(!campaignId||!crop)return{total:0,plotCount:0,points:[] as PlantingProgressPoint[]};
  const normalizedCrop=normalizeText(crop);
  const campaignRecords=records.filter(row=>(row.campaign_id||relation(row.campaigns)?.id)===campaignId&&row.plot_id);
  const cropSowings=campaignRecords.filter(row=>effectiveRecordType(row)==="sowing"&&normalizeText(recordCrop(row))===normalizedCrop);
  const eligiblePlotIds=new Set(cropSowings.map(row=>row.plot_id!));
  const eligiblePlots=plots.filter(plot=>eligiblePlotIds.has(plot.id));
  const plotAreas=new globalThis.Map(eligiblePlots.map(plot=>[plot.id,Math.max(0,number(plot.arable_area)||number(plot.total_area))]));
  const total=sum(Array.from(plotAreas.values()));
  const remaining=new globalThis.Map(plotAreas);
  const daily=new globalThis.Map<string,number>();
  cropSowings.filter(row=>plotAreas.has(row.plot_id!)).sort((a,b)=>recordSortKey(a).localeCompare(recordSortKey(b))).forEach(row=>{
    const available=remaining.get(row.plot_id!)??0;if(available<=0)return;
    const requested=number(row.worked_area)>0?number(row.worked_area):available;
    const contribution=Math.min(available,requested);remaining.set(row.plot_id!,available-contribution);
    const date=String(row.record_date).slice(0,10);daily.set(date,(daily.get(date)??0)+contribution);
  });
  const dates=Array.from(daily.keys()).sort();if(!dates.length)return{total,plotCount:eligiblePlots.length,points:[] as PlantingProgressPoint[]};
  const start=parseLocalDay(dates[0]),end=parseLocalDay(dates.at(-1)!);let accumulated=0;const points:PlantingProgressPoint[]=[];
  for(let cursor=new Date(start);cursor<=end;cursor.setDate(cursor.getDate()+1)){const date=localDayKey(cursor);const increment=daily.get(date)??0;accumulated=Math.min(total,accumulated+increment);points.push({date,daily:increment,accumulated,percent:total>0?accumulated/total*100:0})}
  return{total,plotCount:eligiblePlots.length,points};
}
function recordSortKey(row:RecordRow){return `${String(row.record_date).slice(0,10)}T${row.created_at||""}`}
function parseLocalDay(value:string){const[year,month,day]=value.split("-").map(Number);return new Date(year,month-1,day)}
function localDayKey(value:Date){return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`}
function formatShortDay(value:string){return new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short"}).format(parseLocalDay(value))}
function PlantingProgressChart({points,total}:{points:PlantingProgressPoint[];total:number}){
  if(!points.length)return <EmptyLine text="Todavía no hay superficie de siembra para graficar."/>;
  const width=960,height=330,left=58,right=26,top=28,bottom=52,maximum=Math.max(total,...points.map(point=>point.accumulated),1);const usableWidth=width-left-right,usableHeight=height-top-bottom;
  const x=(index:number)=>left+(points.length===1?.5:index/(points.length-1))*usableWidth;const y=(value:number)=>top+(maximum-value)/maximum*usableHeight;
  const line=points.map((point,index)=>`${x(index)},${y(point.accumulated)}`).join(" ");const area=`${left},${height-bottom} ${line} ${x(points.length-1)},${height-bottom}`;const labelStep=Math.max(1,Math.ceil(points.length/7));
  return <div className="planting-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Avance diario acumulado de siembra"><defs><linearGradient id="plantingArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#55ba70" stopOpacity=".38"/><stop offset="1" stopColor="#55ba70" stopOpacity=".03"/></linearGradient></defs>{[0,.25,.5,.75,1].map(step=>{const value=maximum*step;return <g key={step}><line x1={left} y1={y(value)} x2={width-right} y2={y(value)} className="planting-grid-line"/><text x={left-9} y={y(value)+4} className="planting-axis-value">{value.toLocaleString("es-AR",{maximumFractionDigits:0})}</text></g>})}<polygon points={area} fill="url(#plantingArea)"/><polyline points={line} className="planting-line"/>{points.map((point,index)=><g key={point.date}><circle cx={x(index)} cy={y(point.accumulated)} r={point.daily>0?5:2.5} className={point.daily>0?"planting-point active":"planting-point"}><title>{formatShortDay(point.date)}: {point.accumulated.toLocaleString("es-AR",{maximumFractionDigits:2})} ha ({point.percent.toLocaleString("es-AR",{maximumFractionDigits:1})}%)</title></circle>{(index%labelStep===0||index===points.length-1)&&<text x={x(index)} y={height-22} className="planting-axis-date">{formatShortDay(point.date)}</text>}</g>)}</svg></div>
}

const REPORT_METRICS = [
  {id:"worked_area",label:"Superficie trabajada"},{id:"planted_area",label:"Superficie sembrada"},{id:"harvested_area",label:"Superficie cosechada"},
  {id:"production",label:"Producción total"},{id:"yield",label:"Rendimiento por hectárea"},{id:"water_table",label:"Profundidad de napa"},
  {id:"cost",label:"Costo total"},{id:"cost_per_ha",label:"Costo por hectárea"},{id:"input_cost",label:"Costo de insumos"},
  {id:"labor_cost",label:"Costo de labores"},{id:"count",label:"Cantidad de registros"},{id:"applications",label:"Cantidad de aplicaciones"},
  {id:"income",label:"Ingresos estimados"},{id:"gross_margin",label:"Margen bruto estimado"}
];
const CHART_COLORS=["#137A4B","#77C943","#F2B134","#D9544D","#7656A8","#2F80C1","#19A69A","#E178A7","#8B6F47"];
function chartLabel(row:RecordRow,dimension:string){return dimension==="field"?(relation(row.fields)?.name||"Sin campo"):dimension==="plot"?(relation(row.plots)?.name||"Sin lote"):dimension==="campaign"?(relation(row.campaigns)?.name||"Sin campaña"):dimension==="contractor"?(row.contractor?.trim()||"Sin contratista"):dimension==="type"?recordType(effectiveRecordType(row)):dimension==="month"?String(row.record_date).slice(0,7):(recordCrop(row)||"Sin cultivo");}
function chartValue(row:RecordRow,metric:string){const data=recordData(row);const area=number(row.worked_area);const totalCost=number(data.total_cost as string|number);const production=number((data.total_production??data.production) as string|number);const harvested=number(data.harvested_area as string|number);switch(metric){case"count":return 1;case"applications":return ["spraying","fertilization"].includes(row.record_type)?1:0;case"planted_area":return row.record_type==="sowing"?area:0;case"harvested_area":return harvested;case"production":return production;case"yield":return number(data.yield_per_ha as string|number)||(harvested>0?production/harvested:0);case"water_table":return number(data.water_table_depth as string|number);case"cost":return totalCost;case"cost_per_ha":return area>0?totalCost/area:0;case"input_cost":return number(data.inputs_total as string|number);case"labor_cost":return number(data.labor_cost as string|number)+number(data.application_cost as string|number)+number(data.harvest_cost as string|number);case"income":return number(data.estimated_income as string|number);case"gross_margin":return number(data.estimated_income as string|number)-totalCost;default:return area;}}
function aggregateMetric(rows:RecordRow[],metric:string){if(metric==="yield"){let weighted=0,area=0;rows.forEach(row=>{const data=recordData(row);const surface=number((data.harvested_area??row.worked_area) as string|number);if(surface>0){weighted+=chartValue(row,"yield")*surface;area+=surface}});return area>0?weighted/area:0}if(metric==="water_table")return rows.length?sum(rows.map(row=>chartValue(row,metric)))/rows.length:0;return sum(rows.map(row=>chartValue(row,metric)))}
function buildChartRows(rows:RecordRow[],dimension:string,metric:string){const grouped=new globalThis.Map<string,RecordRow[]>();rows.forEach(row=>{if(metric==="water_table"&&effectiveRecordType(row)!=="napa")return;const label=chartLabel(row,dimension);grouped.set(label,[...(grouped.get(label)??[]),row])});const result=Array.from(grouped,([label,value])=>[label,aggregateMetric(value,metric)] as [string,number]);return dimension==="month"?result.sort((a,b)=>a[0].localeCompare(b[0])):result.sort((a,b)=>b[1]-a[1]);}
function metricSuffix(metric:string){if(["worked_area","planted_area","harvested_area"].includes(metric))return" ha";if(metric==="yield")return" kg/ha";if(metric==="water_table")return" cm";return"";}
function ReportChart({type,rows,metric,selected,onSelect}:{type:"bar"|"line"|"pie";rows:[string,number][];metric:string;selected:string;onSelect:(label:string)=>void}){
  if(!rows.length)return <EmptyLine text="No hay datos para graficar con estos filtros."/>;
  const values=rows.map(([,value])=>value);const domainMin=Math.min(0,...values);const domainMax=Math.max(0,...values);const range=Math.max(1,domainMax-domainMin);const zeroPercent=(0-domainMin)/range*100;const suffix=metricSuffix(metric);const format=(value:number)=>`${value.toLocaleString("es-AR",{maximumFractionDigits:2})}${suffix}`;
  if(type==="pie"){const positive=rows.map(row=>[row[0],Math.max(0,row[1])] as [string,number]);const total=sum(positive.map(row=>row[1]));if(total<=0)return <EmptyLine text="El gráfico de torta necesita valores mayores a cero."/>;let cursor=0;const stops=positive.map((row,index)=>{const start=cursor;cursor+=row[1]/total*100;return `${CHART_COLORS[index%CHART_COLORS.length]} ${start}% ${cursor}%`;});return <div className="pie-chart-wrap"><div className="report-donut" style={{background:`conic-gradient(${stops.join(",")})`}}><div><strong>{format(total)}</strong><small>Total</small></div></div><div className="report-legend">{positive.map(([label,value],index)=><button className={selected===label?"selected":""} key={label} onClick={()=>onSelect(label)}><i style={{background:CHART_COLORS[index%CHART_COLORS.length]}}/><span>{label}</span><strong>{format(value)}</strong></button>)}</div></div>}
  if(type==="line"){const width=760,height=260,pad=40;const plotHeight=height-pad*2;const y=(value:number)=>pad+(domainMax-value)/range*plotHeight;const zeroY=y(0);const points=rows.map(([,value],index)=>`${pad+(rows.length===1?.5:index/(rows.length-1))*(width-pad*2)},${y(value)}`).join(" ");return <div className="line-chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de líneas"><line className="chart-zero-line" x1={pad} y1={zeroY} x2={width-pad} y2={zeroY}/><line x1={pad} y1={pad} x2={pad} y2={height-pad}/>{domainMax>0&&<text className="chart-scale-label" x={pad-7} y={pad+4}>{format(domainMax)}</text>}<text className="chart-scale-label" x={pad-7} y={zeroY+4}>0</text>{domainMin<0&&<text className="chart-scale-label" x={pad-7} y={height-pad}>{format(domainMin)}</text>}<polyline points={points}/>{points.split(" ").map((point,index)=>{const[x,yPoint]=point.split(",");return <circle className={selected===rows[index][0]?"selected":""} onClick={()=>onSelect(rows[index][0])} key={rows[index][0]} cx={x} cy={yPoint} r="6"><title>{rows[index][0]}: {format(rows[index][1])}</title></circle>})}</svg><div className="line-labels">{rows.map(([label,value])=><button className={selected===label?"selected":""} onClick={()=>onSelect(label)} key={label}><b>{label}</b><small>{format(value)}</small></button>)}</div></div>}
  return <div className={`analytics-bars ${domainMin<0?"has-negative":""}`}>{rows.map(([label,value],index)=>{const valuePercent=(value-domainMin)/range*100;const left=Math.min(zeroPercent,valuePercent);const width=Math.abs(valuePercent-zeroPercent);return <button className={selected===label?"selected":""} onClick={()=>onSelect(label)} key={label}><strong>{label}</strong><i><em style={{left:`${zeroPercent}%`}}/><b className={value<0?"negative":"positive"} style={{left:`${left}%`,width:`${Math.max(width,.8)}%`,background:CHART_COLORS[index%CHART_COLORS.length]}}/></i><span>{format(value)}</span></button>})}</div>;
}

function ChartDrilldown({label,rows,metric,onClose}:{label:string;rows:RecordRow[];metric:string;onClose:()=>void}){
  const suffix=metricSuffix(metric);
  const [selectedId,setSelectedId]=useState("");
  const [openType,setOpenType]=useState("");
  const groups=Array.from(rows.reduce((map,row)=>{const type=effectiveRecordType(row);map.set(type,[...(map.get(type)??[]),row]);return map},new globalThis.Map<string,RecordRow[]>()).entries())
    .sort((a,b)=>recordType(a[0]).localeCompare(recordType(b[0]),"es"));
  const total=aggregateMetric(rows,metric);
  const fields=new Set(rows.map(row=>relation(row.fields)?.name).filter(Boolean)).size;
  const plots=new Set(rows.map(row=>relation(row.plots)?.name).filter(Boolean)).size;
  return <section className="chart-drilldown"><header><div><span className="eyebrow">TRAZABILIDAD DEL INDICADOR</span><h4>{label}</h4><p>Empezá por una actividad y abrí solamente el registro que necesitás revisar.</p></div><button className="icon-button" onClick={onClose}><X/></button></header><div className="drilldown-summary"><div><small>Resultado</small><strong>{total.toLocaleString("es-AR",{maximumFractionDigits:2})}{suffix}</strong></div><div><small>Actividades</small><strong>{groups.length}</strong></div><div><small>Registros</small><strong>{rows.length}</strong></div><div><small>Alcance</small><strong>{fields} campo{fields===1?"":"s"} · {plots} lote{plots===1?"":"s"}</strong></div></div><div className="drilldown-type-groups">{groups.map(([type,typeRows])=>{const expanded=openType===type;const subtotal=aggregateMetric(typeRows,metric);return <section className={`drilldown-type ${expanded?"expanded":""}`} key={type}><button className="drilldown-type-head" onClick={()=>{setOpenType(expanded?"":type);setSelectedId("")}}><span className="drilldown-type-icon"><RecordTypeIcon type={type}/></span><div><strong>{recordType(type)}</strong><small>{typeRows.length} registro{typeRows.length===1?"":"s"} · tocar para desplegar</small></div><b>{subtotal.toLocaleString("es-AR",{maximumFractionDigits:2})}{suffix}</b><ChevronDown/></button>{expanded&&<div className="drilldown-type-records">{[...typeRows].sort((a,b)=>b.record_date.localeCompare(a.record_date)).map(row=><div className={`drilldown-entry ${selectedId===row.id?"expanded":""}`} key={row.id}><button className="drilldown-record" onClick={()=>setSelectedId(current=>current===row.id?"":row.id)} aria-expanded={selectedId===row.id}><div><strong>{relation(row.fields)?.name||"Campo"} · {relation(row.plots)?.name||"Sin lote"}</strong><small>{relation(row.campaigns)?.name||"Sin campaña"}</small></div><time>{formatDate(row.record_date)}</time><b>{chartValue(row,metric).toLocaleString("es-AR",{maximumFractionDigits:2})}{suffix}</b><ChevronDown/></button>{selectedId===row.id&&<InlineRecordDetail record={row}/>}</div>)}</div>}</section>})}</div></section>
}

function InlineRecordDetail({record}:{record:RecordRow}){
  const data=recordData(record);
  const observations=String(data.observations??"").trim();
  const entries=visibleDetails(data).filter(([key])=>key!=="observations");
  const inputs=recordInputDetails(data,number(record.worked_area));
  const inputKeys=new Set(entries.filter(([key])=>/^input_\d+_/.test(key)||key==="input_count").map(([key])=>key));
  const costs=entries.filter(([key])=>!/^input_\d+_/.test(key)&&/(cost|price|income|margin)/.test(key));
  const gps=entries.filter(([key])=>key.startsWith("gps_"));
  const monitoring=entries.filter(([key])=>/(weed|insect|disease|monitoring_priority|phenological|plant_count)/.test(key));
  const technical=entries.filter(([key])=>!inputKeys.has(key)&&!costs.some(([item])=>item===key)&&!gps.some(([item])=>item===key)&&!monitoring.some(([item])=>item===key));
  return <div className="inline-record-detail">
    <div className="inline-detail-summary"><div><small>Campaña</small><strong>{relation(record.campaigns)?.name||"Sin campaña"}</strong></div><div><small>Fecha</small><strong>{formatDate(record.record_date)}</strong></div><div><small>Superficie</small><strong>{number(record.worked_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></div>{record.contractor&&<div><small>Contratista</small><strong>{record.contractor}</strong></div>}{record.machinery_text&&<div><small>Maquinaria</small><strong>{record.machinery_text}</strong></div>}</div>
    <div className="inline-detail-groups">
      {inputs.length>0&&<div className="inline-inputs"><header><Leaf/><span><strong>Insumos aplicados</strong><small>{inputs.length} producto{inputs.length===1?"":"s"}</small></span></header><div>{inputs.map(input=>{const rateUnit=input.unit.includes("/")?input.unit:`${input.unit||"u"}/ha`;const canTotal=/\/ha$/i.test(rateUnit);const totalUnit=rateUnit.replace(/\/ha$/i,"");return <article key={input.index}><strong>{input.name||`Insumo ${input.index+1}`}</strong><span>{input.dose.toLocaleString("es-AR",{maximumFractionDigits:3})} {rateUnit}</span><small>{canTotal?`${input.quantity.toLocaleString("es-AR",{maximumFractionDigits:2})} ${totalUnit} · `:""}costo {input.subtotal.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</small></article>})}</div></div>}
      {effectiveRecordType(record)==="monitoring"&&<MonitoringHealthBlock details={data} entries={monitoring}/>} 
      {costs.length>0&&<InlineDetailGroup title="Costos" entries={costs} open/>}
      {technical.length>0&&<InlineDetailGroup title="Datos técnicos" entries={technical}/>}
      {gps.length>0&&<InlineDetailGroup title="Ubicación GPS" entries={gps}/>}
    </div>
    {observations&&<ObservationBlock value={observations} compact/>}
    <RecordAttachments recordId={record.id}/>
  </div>
}

function InlineDetailGroup({title,entries,open=false}:{title:string;entries:[string,unknown][];open?:boolean}){
  return <details className="inline-detail-group" open={open}><summary><span>{title}<small>{entries.length} dato{entries.length===1?"":"s"}</small></span><ChevronDown/></summary><div className="inline-detail-parameters">{entries.map(([key,value])=><div key={key}><small>{detailLabel(key)}</small><strong>{formatDetailValue(key,value)}</strong></div>)}</div></details>
}

function ContractorSummary({contractor,records}:{contractor:string;records:RecordRow[]}){
  const types=Array.from(new Set(records.map(effectiveRecordType))).map(type=>({type,count:records.filter(row=>effectiveRecordType(row)===type).length,area:sum(records.filter(row=>effectiveRecordType(row)===type).map(row=>number(row.worked_area)))}));
  const totalArea=sum(records.map(row=>number(row.worked_area)));const totalCost=sum(records.map(row=>number(recordData(row).total_cost as string|number)));
  return <section className="content-card contractor-summary"><div className="contractor-summary-head"><div><span className="eyebrow">RESUMEN DEL CONTRATISTA</span><h3>{contractor}</h3><p>Trabajos incluidos según los filtros activos.</p></div><Tractor/></div><div className="contractor-kpis"><div><small>Trabajos</small><strong>{records.length}</strong></div><div><small>Superficie acumulada</small><strong>{totalArea.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></div><div><small>Costo registrado</small><strong>{totalCost.toLocaleString("es-AR",{maximumFractionDigits:2})}</strong></div></div><div className="contractor-types">{types.map(item=><div key={item.type}><span>{recordType(item.type)}</span><small>{item.count} trabajo{item.count===1?"":"s"}</small><strong>{item.area.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></div>)}</div></section>;
}

function WorkOrdersView({groupId,userId,orders,records,fields,plots,campaigns,members,contractors,supplies,plan,canCreate,canEditAny,canEditOwn,onSaved}:{groupId:string;userId:string;orders:WorkOrder[];records:RecordRow[];fields:Field[];plots:Plot[];campaigns:Campaign[];members:Member[];contractors:Contractor[];supplies:Supply[];plan:string;canCreate:boolean;canEditAny:boolean;canEditOwn:boolean;onSaved:()=>void}){
 const doseUnits=["kg/ha","lt/ha","cc/ha","gr/ha","ton/ha","cc/100kg"];
 const normalizeDoseUnit=(value?:string|null)=>{const raw=String(value??"").trim().toLowerCase();const aliases:Record<string,string>={kg:"kg/ha","kg/ha":"kg/ha",l:"lt/ha",lt:"lt/ha","l/ha":"lt/ha","lt/ha":"lt/ha",cc:"cc/ha","cc/ha":"cc/ha",g:"gr/ha",gr:"gr/ha","g/ha":"gr/ha","gr/ha":"gr/ha",ton:"ton/ha","t/ha":"ton/ha","ton/ha":"ton/ha","cc/100kg":"cc/100kg"};return aliases[raw]??(doseUnits.includes(raw)?raw:"")};
 const [status,setStatus]=useState("active");const [query,setQuery]=useState("");const [selected,setSelected]=useState<WorkOrder|null>(null);const [mode,setMode]=useState<"view"|"form"|"complete"|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [formStep,setFormStep]=useState(0);
 const blank=()=>({title:"",order_type:"sowing" as WorkOrderType,status:"pending",priority:"normal",scheduled_date:"",scheduled_end_date:"",campaign_id:campaigns.find(c=>c.status==="active")?.id??campaigns[0]?.id??"",field_id:"",plot_ids:[] as string[],plot_areas:{} as Record<string,string>,assigned_to:"",contractor_id:"",instructions:"",notes:"",allow_member_edits:false,products:[] as {input_id:string;product_name:string;dose:string;dose_unit:string;planned_quantity:string}[]});
 const [draft,setDraft]=useState(blank);const [actualDate,setActualDate]=useState(new Date().toISOString().slice(0,10));
 const selectedPlots=draft.plot_ids.map(id=>plots.find(plot=>plot.id===id)).filter(Boolean) as Plot[];
 const totalPlannedArea=selectedPlots.reduce((sum,plot)=>sum+number(draft.plot_areas[plot.id]??plot.arable_area),0);
 const filtered=[...orders].sort((a,b)=>String(b.created_at??"").localeCompare(String(a.created_at??""))).filter(item=>{const active=["pending","in_progress"].includes(item.status);if(status==="active"&&!active)return false;if(status!=="all"&&status!=="active"&&item.status!==status)return false;const lotNames=(item.work_order_plots??[]).map(row=>row.plots?.name??"").join(" ");return `${item.title} ${item.fields?.name??""} ${item.plots?.name??""} ${lotNames}`.toLowerCase().includes(query.toLowerCase())});
 useEffect(()=>{if(typeof window==="undefined"||!orders.length)return;const id=new URLSearchParams(window.location.search).get("ot");if(!id)return;const item=orders.find(order=>order.id===id);if(item){setSelected(item);setMode("view")}},[orders]);
 const today=new Date().toISOString().slice(0,10);
 const stats={pending:orders.filter(o=>o.status==="pending").length,inProgress:orders.filter(o=>o.status==="in_progress").length,overdue:orders.filter(o=>["pending","in_progress"].includes(o.status)&&Boolean(o.scheduled_date)&&String(o.scheduled_date).slice(0,10)<today).length,done:orders.filter(o=>o.status==="completed").length};
 const mayEdit=(item:WorkOrder)=>canEditAny||item.created_by===userId||(Boolean(item.allow_member_edits)&&canEditOwn);
 const orderLots=(item:WorkOrder)=>item.work_order_plots?.length?item.work_order_plots:(item.plot_id?[{id:`legacy-${item.id}`,work_order_id:item.id,group_id:item.group_id,field_id:item.field_id??"",plot_id:item.plot_id,planned_area:item.planned_area??null,plots:item.plots??null} as WorkOrderPlot]:[]);
 const plannedTotal=(dose:unknown,area:unknown,unit?:string|null)=>{if(String(unit??"").toLowerCase()==="cc/100kg")return null;const d=number(dose as string|number),a=number(area as string|number);return d>0&&a>0?d*a:null};
 const totalUnit=(unit?:string|null)=>{const raw=String(unit??"");return raw.endsWith("/ha")?raw.replace(/\/ha$/i,""):raw==="cc/100kg"?"":"u"};
 const doseText=(product:WorkOrderProduct)=>product.dose?`${number(product.dose).toLocaleString("es-AR",{maximumFractionDigits:3})} ${product.dose_unit??""}`:"—";
 function openCreate(){setSelected(null);setDraft(blank());setMessage("");setFormStep(0);setMode("form")}
 function openEdit(item:WorkOrder){const lots=orderLots(item);const ids=lots.map(row=>row.plot_id);const areas=Object.fromEntries(lots.map(row=>[row.plot_id,String(row.planned_area??plots.find(p=>p.id===row.plot_id)?.arable_area??"")]));setSelected(item);setDraft({title:item.title,order_type:item.order_type,status:item.status,priority:item.priority,scheduled_date:String(item.scheduled_date??"").slice(0,10),scheduled_end_date:String(item.scheduled_end_date??"").slice(0,10),campaign_id:item.campaign_id,field_id:item.field_id??lots[0]?.field_id??"",plot_ids:ids,plot_areas:areas,assigned_to:item.assigned_to??"",contractor_id:item.contractor_id??"",instructions:item.instructions??"",notes:item.notes??"",allow_member_edits:Boolean(item.allow_member_edits),products:(item.work_order_products??[]).map(p=>({input_id:p.input_id??"",product_name:p.product_name,dose:p.dose==null?"":String(p.dose),dose_unit:normalizeDoseUnit(p.dose_unit),planned_quantity:p.planned_quantity==null?"":String(p.planned_quantity)}))});setFormStep(0);setMode("form")}
 function changeField(fieldId:string){setDraft(current=>({...current,field_id:fieldId,plot_ids:[],plot_areas:{}}))}
 function togglePlot(plotId:string){setDraft(current=>{const plot=plots.find(p=>p.id===plotId);if(!plot||plot.field_id!==current.field_id)return current;const exists=current.plot_ids.includes(plotId);const plot_ids=exists?current.plot_ids.filter(id=>id!==plotId):[...current.plot_ids,plotId];const plot_areas={...current.plot_areas};if(exists)delete plot_areas[plotId];else plot_areas[plotId]=String(plot.arable_area??"");return{...current,plot_ids,plot_areas}})}
 async function save(event:FormEvent){event.preventDefault();setMessage("");if(formStep<4){setFormStep(step=>Math.min(4,step+1));return}if(!draft.title.trim()){setMessage("Escribí un título para la orden.");setFormStep(0);return}if(!draft.campaign_id){setMessage("Seleccioná una campaña.");setFormStep(1);return}if(!draft.field_id){setMessage("Seleccioná un campo.");setFormStep(1);return}if(!draft.plot_ids.length){setMessage("Seleccioná al menos un lote.");setFormStep(1);return}if(draft.scheduled_date&&draft.scheduled_end_date&&draft.scheduled_end_date<draft.scheduled_date){setMessage("La fecha hasta no puede ser anterior a la fecha desde.");setFormStep(2);return}setBusy(true);try{const firstPlot=draft.plot_ids[0]??null;const payload={group_id:groupId,campaign_id:draft.campaign_id,field_id:draft.field_id,plot_id:firstPlot,order_type:draft.order_type,status:draft.status,priority:draft.priority,title:draft.title.trim(),instructions:draft.instructions.trim()||null,notes:draft.notes.trim()||null,scheduled_date:draft.scheduled_date||null,scheduled_end_date:draft.scheduled_end_date||null,planned_area:totalPlannedArea||null,assigned_to:draft.assigned_to||null,contractor_id:draft.contractor_id||null,allow_member_edits:Boolean(draft.allow_member_edits),created_by:selected?.created_by??userId,updated_at:new Date().toISOString()};const result=selected?await supabase.from("work_orders").update(payload).eq("id",selected.id).select("id").single():await supabase.from("work_orders").insert(payload).select("id").single();if(result.error)throw result.error;const id=result.data?.id;if(!id)throw new Error("La orden no devolvió un identificador. Volvé a intentar.");if(selected){const [removedProducts,removedPlots]=await Promise.all([supabase.from("work_order_products").delete().eq("work_order_id",id),supabase.from("work_order_plots").delete().eq("work_order_id",id)]);if(removedProducts.error)throw removedProducts.error;if(removedPlots.error)throw removedPlots.error}const lotRows=draft.plot_ids.map(plotId=>({group_id:groupId,work_order_id:id,field_id:draft.field_id,plot_id:plotId,planned_area:number(draft.plot_areas[plotId])||null}));const lotResult=await supabase.from("work_order_plots").insert(lotRows);if(lotResult.error)throw lotResult.error;const products=draft.products.filter(p=>p.product_name.trim());if(products.length){const productResult=await supabase.from("work_order_products").insert(products.map(p=>({group_id:groupId,work_order_id:id,input_id:p.input_id||null,product_name:p.product_name.trim(),dose:p.dose?Number(p.dose):null,dose_unit:p.dose_unit||null,planned_quantity:plannedTotal(p.dose,totalPlannedArea,p.dose_unit)})));if(productResult.error)throw productResult.error}setMode(null);setSelected(null);await Promise.resolve(onSaved())}catch(error){setMessage(spanishError(error))}finally{setBusy(false)}}
 async function changeStatus(item:WorkOrder,next:string){setBusy(true);setMessage("");const result=await supabase.from("work_orders").update({status:next,updated_at:new Date().toISOString()}).eq("id",item.id).select("id").single();setBusy(false);if(result.error)setMessage(spanishError(result.error));else{setSelected({...item,status:next as WorkOrder["status"]});onSaved()}}
 function latestCropForPlot(plotId:string){const candidates=records.filter(row=>row.plot_id===plotId&&recordCrop(row).trim()).sort((a,b)=>{const byDate=String(b.record_date||"").localeCompare(String(a.record_date||""));return byDate||String(b.created_at||"").localeCompare(String(a.created_at||""))});const source=candidates[0];return source?{crop:recordCrop(source).trim(),sourceRecordId:source.id}:null}
 function recordProductDetails(item:WorkOrder,lotArea:number,plotId:string){const inherited=latestCropForPlot(plotId);const details:Record<string,unknown>={...(item.planned_data??{}),source_work_order_id:item.id,work_order_title:item.title,record_kind:item.order_type==="soil_analysis"?"soil_analysis":item.order_type,input_count:String(item.work_order_products?.length??0)};if(inherited?.crop){details.crop=inherited.crop;details.crop_source_record_id=inherited.sourceRecordId;details.crop_source="latest_plot_activity"}(item.work_order_products??[]).forEach((product,index)=>{details[`input_${index}_id`]=product.input_id??"";details[`input_${index}_name`]=product.product_name;details[`input_${index}_dose`]=product.dose??"";details[`input_${index}_price`]="0";details[`input_${index}_unit`]=product.dose_unit??""});details.inputs_total="0";details.total_cost="0";details.work_order_lot_area=lotArea;return details}
 async function complete(event:FormEvent){event.preventDefault();if(!selected)return;setBusy(true);setMessage("");try{const lots=orderLots(selected);if(!lots.length)throw new Error("La orden no tiene lotes asociados.");const storedType=selected.order_type==="soil_analysis"?"other":selected.order_type;const recordIds:string[]=[];for(const lot of lots){const existing=await supabase.from("records").select("id").eq("source_work_order_id",selected.id).eq("plot_id",lot.plot_id).is("deleted_at",null).maybeSingle();if(existing.error)throw existing.error;if(existing.data?.id){recordIds.push(existing.data.id);continue}const area=number(lot.planned_area)||number(plots.find(p=>p.id===lot.plot_id)?.arable_area)||0;const saved=await supabase.rpc("save_activity_record",{p_id:null,p_group_id:groupId,p_campaign_id:selected.campaign_id,p_field_id:lot.field_id||selected.field_id||null,p_plot_id:lot.plot_id,p_type:storedType,p_date:actualDate,p_worked_area:area||null,p_responsible_id:selected.assigned_to??userId,p_contractor:selected.contractors?.name??"",p_machinery:"",p_observations:selected.notes||selected.instructions||"",p_allow_member_edits:true,p_data:recordProductDetails(selected,area,lot.plot_id)});if(saved.error)throw saved.error;const recordId=typeof saved.data==="string"?saved.data:(saved.data as {id?:string}|null)?.id;if(!recordId)throw new Error("No se pudo identificar uno de los registros generados.");recordIds.push(recordId);const linked=await supabase.from("records").update({source_work_order_id:selected.id}).eq("id",recordId);if(linked.error)throw linked.error}const updated=await supabase.from("work_orders").update({status:"completed",resulting_record_id:recordIds[0]??null,completed_by:userId,completed_at:new Date().toISOString(),actual_data:{actual_date:actualDate,generated_record_ids:recordIds,records_created:recordIds.length},updated_at:new Date().toISOString()}).eq("id",selected.id).select("id").single();if(updated.error)throw updated.error;setMode(null);setSelected(null);onSaved()}catch(error){setMessage(spanishError(error))}finally{setBusy(false)}}
 async function share(item:WorkOrder){const url=`${window.location.origin}${window.location.pathname}?view=ordenes&ot=${encodeURIComponent(item.id)}`;const text=`Orden de trabajo · ${item.title}`;if(navigator.share)await navigator.share({title:item.title,text,url});else{await navigator.clipboard.writeText(url);setMessage("Enlace directo copiado.")}}
 function printWorkOrder(){const source=document.querySelector(".work-order-sheet") as HTMLElement|null;if(!source)return;document.querySelectorAll(".work-order-print-host").forEach(node=>node.remove());const host=document.createElement("div");host.className="work-order-print-host";const clone=source.cloneNode(true) as HTMLElement;clone.querySelectorAll(".work-order-actions,.icon-button,.form-error").forEach(node=>node.remove());host.appendChild(clone);document.body.appendChild(host);const cleanup=()=>{host.remove();window.removeEventListener("afterprint",cleanup)};window.addEventListener("afterprint",cleanup,{once:true});requestAnimationFrame(()=>window.print())}
 const typeLabel=(v:string)=>({sowing:"Siembra",spraying:"Pulverización",fertilization:"Fertilización",harvest:"Cosecha",work:"Roturación / labor",soil_analysis:"Análisis de suelo",other:"Otro"}[v]??v);const statusLabel=(v:string)=>({draft:"Borrador",pending:"Pendiente",in_progress:"En curso",completed:"Completada",cancelled:"Cancelada"}[v]??v);
 const selectedField=fields.find(f=>f.id===draft.field_id);const availablePlots=plots.filter(p=>p.field_id===draft.field_id);const formTitle=["Trabajo","Campo y lotes","Fecha y responsables","Insumos","Revisión"][formStep];
 return <div className="page-content work-orders-page"><PageHead title="Órdenes de trabajo" text="Planificá, asigná y convertí la ejecución en registros formales por lote."/><div className="work-order-kpis"><article><span>Pendientes</span><strong>{stats.pending}</strong></article><article><span>En curso</span><strong>{stats.inProgress}</strong></article><article className={stats.overdue?"alert":""}><span>Vencidas</span><strong>{stats.overdue}</strong></article><article><span>Completadas</span><strong>{stats.done}</strong></article></div><section className="content-card work-order-directory"><header><div className="work-order-search"><Search/><input placeholder="Buscar por orden, campo o lote" value={query} onChange={e=>setQuery(e.target.value)}/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="active">Activas</option><option value="pending">Pendientes</option><option value="in_progress">En curso</option><option value="completed">Completadas</option><option value="cancelled">Canceladas</option><option value="all">Todas</option></select>{canCreate&&<button className="primary-action" onClick={openCreate}><Plus/>Nueva orden</button>}</header><div className="work-order-list">{filtered.map(item=>{const lots=orderLots(item);return <button key={item.id} onClick={()=>{setSelected(item);setMode("view");setMessage("")}}><i className={`priority-${item.priority}`}/><div><span>{typeLabel(item.order_type)}{item.scheduled_date?` · ${formatDate(item.scheduled_date)}`:""}</span><strong>{item.title}</strong><small>{[item.fields?.name,lots.length?`${lots.length} lote${lots.length===1?"":"s"}`:item.plots?.name,item.planned_area?`${number(item.planned_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha`:""].filter(Boolean).join(" · ")}</small></div><em>{statusLabel(item.status)}</em><ChevronRight/></button>})}{!filtered.length&&<EmptyLine text="No hay órdenes con estos filtros."/>}</div></section>
 {mode&&<div className="record-detail-backdrop"><article className={`record-detail-sheet work-order-sheet${selected?` status-${selected.status}`:""}`}><div className="print-only-brand-header"><img src="/icon.svg" alt=""/><span>Growr360</span></div><header><div><span className="eyebrow">ORDEN DE TRABAJO</span><h2>{mode==="form"?(selected?"Editar orden":"Nueva orden"):selected?.title}</h2></div><button className="icon-button" onClick={()=>{setMode(null);setSelected(null)}}><X/></button></header>
 {mode==="form"?<form className="work-order-form work-order-wizard" onSubmit={save}>{message&&<p className="form-error work-order-error">{message}</p>}<div className="record-wizard"><WizardHead step={formStep+1} total={5} title={formTitle}/>
  {formStep===0&&<section className="wizard-card"><span>PASO 1</span><h3>¿Qué trabajo hay que hacer?</h3><label>Título<input required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Ej. Aplicar fungicida en Lote Norte"/></label><div className="form-pair"><label>Tipo<select value={draft.order_type} onChange={e=>setDraft({...draft,order_type:e.target.value as WorkOrderType})}><option value="sowing">Siembra</option><option value="spraying">Pulverización</option><option value="fertilization">Fertilización</option><option value="harvest">Cosecha</option><option value="work">Roturación / labor</option><option value="soil_analysis">Análisis de suelo</option><option value="other">Otro</option></select></label><label>Prioridad<select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label></div><WizardNext enabled={Boolean(draft.title.trim())} next={()=>setFormStep(1)}/></section>}
  {formStep===1&&<section className="wizard-card"><span>PASO 2</span><h3>Campo y lotes</h3><p className="wizard-note">Podés incluir varios lotes en una misma orden, siempre que pertenezcan al mismo campo.</p><label>Campaña<select required value={draft.campaign_id} onChange={e=>setDraft({...draft,campaign_id:e.target.value})}><option value="">Seleccionar campaña…</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}{c.status==="active"?" · Activa":""}</option>)}</select></label><label>Campo<select value={draft.field_id} onChange={e=>changeField(e.target.value)}><option value="">Seleccionar campo…</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>{draft.field_id&&<div className="work-order-lot-picker"><div className="work-order-lot-picker-head"><strong>Lotes del campo</strong><small>{draft.plot_ids.length} seleccionado{draft.plot_ids.length===1?"":"s"}</small></div>{availablePlots.map(plot=>{const checked=draft.plot_ids.includes(plot.id);return <article className={checked?"selected":""} key={plot.id}><label><input type="checkbox" checked={checked} onChange={()=>togglePlot(plot.id)}/><span><strong>{plot.name}</strong><small>Sembrable: {number(plot.arable_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</small></span></label>{checked&&<label className="lot-area">Superficie OT<input type="number" min="0" step="0.01" value={draft.plot_areas[plot.id]??""} onChange={e=>setDraft(current=>({...current,plot_areas:{...current.plot_areas,[plot.id]:e.target.value}}))}/><span>ha</span></label>}</article>})}{!availablePlots.length&&<EmptyLine text="Este campo no tiene lotes cargados."/>}</div>}<div className="work-order-area-summary"><small>SUPERFICIE TOTAL DE LA ORDEN</small><strong>{totalPlannedArea.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></div><WizardNavigation back={()=>setFormStep(0)} next={()=>{if(!draft.field_id||!draft.plot_ids.length){setMessage("Seleccioná un campo y al menos un lote.");return}setMessage("");setFormStep(2)}}/></section>}
  {formStep===2&&<section className="wizard-card"><span>PASO 3</span><h3>Fecha y responsables</h3><p className="wizard-note">La fecha prevista es opcional. Podés indicar solo “desde”, un rango completo o dejar ambas fechas vacías.</p><div className="form-pair"><label>Prevista desde<input type="date" value={draft.scheduled_date} onChange={e=>setDraft({...draft,scheduled_date:e.target.value,scheduled_end_date:e.target.value?draft.scheduled_end_date:""})}/></label><label>Hasta<input type="date" min={draft.scheduled_date||undefined} disabled={!draft.scheduled_date} value={draft.scheduled_end_date} onChange={e=>setDraft({...draft,scheduled_end_date:e.target.value})}/></label></div><div className="form-pair"><label>Responsable<select value={draft.assigned_to} onChange={e=>setDraft({...draft,assigned_to:e.target.value})}><option value="">Sin asignar</option>{members.map(m=><option key={m.user_id} value={m.user_id}>{[m.profiles?.first_name,m.profiles?.last_name].filter(Boolean).join(" ")||m.profiles?.username}</option>)}</select></label><label>Contratista<select value={draft.contractor_id} onChange={e=>setDraft({...draft,contractor_id:e.target.value})}><option value="">Sin contratista</option>{contractors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><label>Instrucciones<textarea value={draft.instructions} onChange={e=>setDraft({...draft,instructions:e.target.value})} placeholder="Opcional · qué debe hacerse y cómo"/></label><WizardNavigation back={()=>setFormStep(1)} next={()=>setFormStep(3)}/></section>}
  {formStep===3&&<section className="wizard-card work-order-products-step"><span>PASO 4</span><h3>Insumos planificados</h3><p className="wizard-note">La dosis se guarda con su unidad exacta. El total solo se calcula automáticamente para unidades por hectárea.</p><section className="work-order-products"><header><div><strong>Productos</strong><small>Superficie base: {totalPlannedArea.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</small></div><button type="button" onClick={()=>setDraft({...draft,products:[...draft.products,{input_id:"",product_name:"",dose:"",dose_unit:"kg/ha",planned_quantity:""}]})}><Plus/>Agregar</button></header>{draft.products.map((p,index)=>{const total=plannedTotal(p.dose,totalPlannedArea,p.dose_unit);return <article className="work-order-product-editor" key={index}><header><strong>Producto {index+1}</strong><button type="button" aria-label="Quitar producto" onClick={()=>setDraft({...draft,products:draft.products.filter((_,i)=>i!==index)})}><X/></button></header><div className="work-order-product-fields"><label>Seleccionar insumo<select value={p.input_id} onChange={e=>{const supply=supplies.find(s=>s.id===e.target.value);const next=[...draft.products];next[index]={...p,input_id:e.target.value,product_name:supply?.name??p.product_name,dose_unit:normalizeDoseUnit(supply?.unit)||p.dose_unit||"kg/ha"};setDraft({...draft,products:next})}}><option value="">Producto manual</option>{supplies.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Producto<input placeholder="Nombre" value={p.product_name} onChange={e=>{const next=[...draft.products];next[index]={...p,product_name:e.target.value};setDraft({...draft,products:next})}}/></label><div className="form-pair"><label>Dosis<input type="number" min="0" step="0.001" placeholder="0" value={p.dose} onChange={e=>{const next=[...draft.products];next[index]={...p,dose:e.target.value};setDraft({...draft,products:next})}}/></label><label>Unidad<select value={p.dose_unit} onChange={e=>{const next=[...draft.products];next[index]={...p,dose_unit:e.target.value};setDraft({...draft,products:next})}}><option value="">Seleccionar…</option>{doseUnits.map(unit=><option key={unit} value={unit}>{unit}</option>)}</select></label></div><div className="work-order-product-total"><small>TOTAL PLANIFICADO</small><strong>{total!==null?`${total.toLocaleString("es-AR",{maximumFractionDigits:3})} ${totalUnit(p.dose_unit)}`:p.dose_unit==="cc/100kg"?"Depende de los kg tratados":"—"}</strong></div></div></article>})}{!draft.products.length&&<button type="button" className="work-order-add-first-product" onClick={()=>setDraft({...draft,products:[{input_id:"",product_name:"",dose:"",dose_unit:"kg/ha",planned_quantity:""}]})}><Plus/>Agregar primer producto</button>}</section><WizardNavigation back={()=>setFormStep(2)} next={()=>setFormStep(4)}/></section>}
  {formStep===4&&<section className="wizard-card"><span>PASO 5</span><h3>Revisá la orden</h3><div className="record-review"><strong>{draft.title||"Orden sin título"}</strong><small>{typeLabel(draft.order_type)}{selectedField?` · ${selectedField.name}`:""}</small><small>{draft.plot_ids.length} lote{draft.plot_ids.length===1?"":"s"} · {totalPlannedArea.toLocaleString("es-AR",{maximumFractionDigits:2})} ha</small><small>{selectedPlots.map(plot=>plot.name).join(" · ")}</small>{draft.scheduled_date&&<small>{formatDate(draft.scheduled_date)}{draft.scheduled_end_date?` → ${formatDate(draft.scheduled_end_date)}`:""}</small>}{draft.products.filter(p=>p.product_name.trim()).length>0&&<small>{draft.products.filter(p=>p.product_name.trim()).length} producto{draft.products.filter(p=>p.product_name.trim()).length===1?"":"s"}</small>}</div><label className="work-order-member-edits wizard-check"><input type="checkbox" checked={Boolean(draft.allow_member_edits)} onChange={e=>setDraft({...draft,allow_member_edits:e.target.checked})}/><span><strong>Permitir edición por el equipo</strong><small>Otros miembros con permiso de edición podrán modificar, iniciar o cancelar esta orden.</small></span></label><button type="button" className="wizard-back-only" onClick={()=>setFormStep(3)}>Volver a editar</button></section>}
 </div><footer className="work-order-wizard-footer"><button type="button" className="secondary-action" onClick={()=>{setMode(null);setSelected(null)}}>Cancelar</button>{formStep===4&&<button className="primary-action" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Save/>}Guardar orden</button>}</footer></form>
 :mode==="complete"?<form className="work-order-complete" onSubmit={complete}><div className="completion-summary"><Check/><div><strong>Finalizar orden y generar registros</strong><p>Se crearán <b>{orderLots(selected!).length} registro{orderLots(selected!).length===1?"":"s"}</b>, uno por cada lote, con los mismos insumos y dosis de esta orden.</p></div></div><div className="planned-actual"><article><small>PLANIFICADO</small>{selected!.scheduled_date&&<strong>{formatDate(selected!.scheduled_date)}</strong>}<span>{orderLots(selected!).length} lote{orderLots(selected!).length===1?"":"s"} · {number(selected!.planned_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</span></article><ArrowRight/><article><small>REAL</small><label>Fecha de ejecución<input required type="date" value={actualDate} onChange={e=>setActualDate(e.target.value)}/></label><small>La superficie queda individualizada por lote según lo planificado.</small></article></div>{plan!=="free"&&<div className="comparison-note"><TrendingUp/><span><strong>Registros por lote</strong><small>Los reportes futuros tomarán cada campo/lote por separado.</small></span></div>}{message&&<p className="form-error">{message}</p>}<footer><button type="button" className="secondary-action" onClick={()=>setMode("view")}>Volver</button><button className="primary-action" disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Check/>}Finalizar y crear registros</button></footer></form>
 :selected&&<div className="work-order-detail"><div className="work-order-hero"><div><span className={`status-${selected.status}`}>{statusLabel(selected.status)}</span><h3>{typeLabel(selected.order_type)}</h3>{selected.instructions&&<p>{selected.instructions}</p>}</div><span className={`priority priority-${selected.priority}`}>{selected.priority==="urgent"?"Urgente":selected.priority==="high"?"Alta":selected.priority==="low"?"Baja":"Normal"}</span></div>{Boolean(selected.scheduled_date||selected.field_id||selected.planned_area||selected.assigned_to||selected.contractor_id)&&<div className="work-order-facts">{selected.scheduled_date&&<article><CalendarDays/><small>Fecha prevista</small><strong>{formatDate(selected.scheduled_date)}{selected.scheduled_end_date?` → ${formatDate(selected.scheduled_end_date)}`:""}</strong></article>}{selected.field_id&&<article><Sprout/><small>Campo</small><strong>{selected.fields?.name}</strong></article>}{selected.planned_area&&<article><Grid2X2/><small>Superficie total</small><strong>{number(selected.planned_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</strong></article>}{selected.assigned_to&&<article><Users/><small>Responsable</small><strong>{[selected.profiles?.first_name,selected.profiles?.last_name].filter(Boolean).join(" ")||selected.profiles?.username}</strong></article>}{selected.contractor_id&&<article><Tractor/><small>Contratista</small><strong>{selected.contractors?.name}</strong></article>}</div>}{orderLots(selected).length>0&&<section className="work-order-lots-detail"><h3>Lotes incluidos</h3><div>{orderLots(selected).map(lot=><article key={lot.id}><div><strong>{lot.plots?.name??plots.find(p=>p.id===lot.plot_id)?.name??"Lote"}</strong><small>{selected.fields?.name}</small></div><b>{number(lot.planned_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</b></article>)}</div></section>}{Boolean(selected.work_order_products?.length)&&<section className="work-order-product-section"><h3>Insumos y dosis</h3><div className="work-order-product-table work-order-product-table-readable"><div className="work-order-product-table-head"><span>INSUMO</span><span>DOSIS</span><span>TOTAL OT</span></div>{selected.work_order_products!.map(p=>{const total=plannedTotal(p.dose,selected.planned_area,p.dose_unit);return <div className="work-order-product-row" key={p.id}><strong>{p.product_name}</strong><b className="work-order-dose">{doseText(p)}</b><span>{total!==null?`${total.toLocaleString("es-AR",{maximumFractionDigits:3})} ${totalUnit(p.dose_unit)}`:p.dose_unit==="cc/100kg"?"Según kg tratados":"—"}</span></div>})}</div></section>}{selected.notes&&<section className="work-order-notes"><h3>Notas</h3><p>{selected.notes}</p></section>}<div className="print-only-brand-footer">Orden generada con Growr360 · growr360.com</div><footer className="work-order-actions"><button onClick={printWorkOrder}><Download/>PDF</button><button onClick={()=>void share(selected)}><Link2/>Compartir</button>{mayEdit(selected)&&selected.status!=="completed"&&selected.status!=="cancelled"&&<button onClick={()=>openEdit(selected)}><Settings2/>Editar</button>}{mayEdit(selected)&&selected.status==="pending"&&<button onClick={()=>void changeStatus(selected,"in_progress")}><Activity/>Iniciar</button>}{canCreate&&selected.status!=="completed"&&selected.status!=="cancelled"&&<button className="primary-action" onClick={()=>{setActualDate(new Date().toISOString().slice(0,10));setMode("complete")}}><Check/>Completar</button>}{mayEdit(selected)&&!["completed","cancelled"].includes(selected.status)&&<button className="danger-text" onClick={()=>void changeStatus(selected,"cancelled")}>Cancelar orden</button>}</footer>{message&&<p className="form-error">{message}</p>}</div>}
 </article></div>}
 </div>
}
function ContractorsView({contractors,canManage,onCreateContractor}:{contractors:Contractor[];canManage:boolean;onCreateContractor:()=>void}){
  const [open,setOpen]=useState<Contractor|null>(null);
  return <div className="page-content contractor-directory-page"><PageHead title="Contratistas" text="Directorio operativo del grupo."/><section className="content-card contractor-directory"><header><div className="settings-title"><ContactRound/><div><h3>{contractors.length} contratista{contractors.length===1?"":"s"}</h3><p>Contactos operativos disponibles para asignar en los registros.</p></div></div>{canManage&&<button className="primary-action" onClick={onCreateContractor}><Plus/>Nuevo contratista</button>}</header><div className="contractor-directory-list">{contractors.map(contractor=><button key={contractor.id} onClick={()=>setOpen(contractor)}><div className="avatar">{initials(contractor.name)}</div><div><strong>{contractor.name}</strong><small>{contractor.document?`CUIT/DNI ${contractor.document}`:"Sin documento"}{contractor.phone?` · ${contractor.phone}`:""}</small></div><span>Ver ficha</span><ChevronRight/></button>)}{!contractors.length&&<EmptyLine text="Todavía no hay contratistas cargados."/>}</div></section>{open&&<div className="record-detail-backdrop"><article className="record-detail-sheet compact-detail"><header><div><span className="eyebrow">CONTRATISTA</span><h2>{open.name}</h2></div><button className="icon-button" onClick={()=>setOpen(null)}><X/></button></header><div className="contractor-contact-grid"><div><Phone/><small>Teléfono</small><strong>{open.phone||"Sin datos"}</strong></div><div><CreditCard/><small>CUIT o DNI</small><strong>{open.document||"Sin datos"}</strong></div><div><Home/><small>Dirección</small><strong>{open.address||"Sin datos"}</strong></div></div>{open.notes&&<section><h3>Nota</h3><p>{open.notes}</p></section>}</article></div>}</div>
}

function MoreView({canManageGroup,onOpenTeam,onOpenSettings,onOpenGroupSettings,onOpenPlans}:{canManageGroup:boolean;onOpenTeam:()=>void;onOpenSettings:()=>void;onOpenGroupSettings:()=>void;onOpenPlans:()=>void}){
  return <div className="page-content"><PageHead title="Más" text="Cuenta, configuración y administración."/><div className="more-tools-clean"><button className="more-option" onClick={onOpenTeam}><Users/><div><strong>Equipo y permisos</strong><small>Miembros, roles y accesos</small></div><ChevronRight/></button><button className="more-option" onClick={onOpenPlans}><CreditCard/><div><strong>Planes Growr360</strong><small>Plan actual, límites y funciones</small></div><ChevronRight/></button>{canManageGroup&&<button className="more-option" onClick={onOpenGroupSettings}><ShieldCheck/><div><strong>Configuración del grupo</strong><small>Identidad, foto y datos institucionales</small></div><ChevronRight/></button>}<button className="more-option" onClick={onOpenSettings}><Settings2/><div><strong>Ajustes personales</strong><small>Unidades, fechas y notificaciones</small></div><ChevronRight/></button></div></div>
}

function PlansView({plans,subscription,activePlan,subscriptionError,plots,campaigns,assignments,members,groupName}:{plans:SubscriptionPlan[];subscription:GroupSubscription|null;activePlan:"free"|"pro"|"business";subscriptionError?:string;plots:Plot[];campaigns:Campaign[];assignments:PlotCampaign[];members:Member[];groupName:string}){
  const currentCode=activePlan;
  const ordered=["free","pro","business"].map(code=>plans.find(plan=>plan.code===code)).filter(Boolean) as SubscriptionPlan[];
  const current=ordered.find(plan=>plan.code===currentCode)??plans.find(plan=>plan.code===currentCode);
  const activeCampaignIds=new Set(campaigns.filter(campaign=>campaign.status==="active").map(campaign=>campaign.id));
  const activePlotIds=new Set(assignments.filter(item=>activeCampaignIds.has(item.campaign_id)).map(item=>item.plot_id));
  // "Hectáreas activas" only counted plots explicitly linked to a campaign whose status is
  // "active" (via plot_campaigns). Many groups have real fields/plots loaded but haven't linked
  // them to an active campaign yet (e.g. before sowing, or if campaigns aren't used at all), which
  // made this always read 0 even though the group clearly has hectares registered. Fall back to
  // counting every plot in the group when there's no active-campaign assignment to rely on.
  const hectaresFromActiveCampaigns=sum(plots.filter(plot=>activePlotIds.has(plot.id)).map(plot=>number(plot.arable_area||plot.total_area)));
  const hectaresFromAllPlots=sum(plots.map(plot=>number(plot.arable_area||plot.total_area)));
  const hectares=activePlotIds.size>0?hectaresFromActiveCampaigns:hectaresFromAllPlots;
  const metrics=[
    {label:"Hectáreas activas",value:hectares,limit:current?.included_hectares??current?.max_hectares,suffix:" ha"},
    {label:"Integrantes",value:members.length,limit:current?.max_users}
  ];
  const planText=(plan:SubscriptionPlan)=>plan.code==="free"?"Para empezar a ordenar la operación":plan.code==="pro"?"Para productores y equipos en crecimiento":"Para operaciones sin límites";
  const planPrice=(code:SubscriptionPlan["code"])=>code==="free"?{amount:"USD 0",caption:"para siempre"}:code==="pro"?{amount:"USD 55",caption:"por mes"}:{amount:"USD 100",caption:"por mes"};
  const planBenefits:Record<SubscriptionPlan["code"],string[]>={
    free:["Registros, monitoreos, fotos y tareas ilimitados","Campañas e historial agrícola ilimitados","Dibujo e importación KML/KMZ","Mapa productivo y monitoreos geolocalizados","Última imagen NDVI y analítica básica"],
    pro:["Todo lo incluido en Growr Free","Historial y comparación NDVI entre fechas","Historial satelital y alertas","Analítica, dashboards y reportes avanzados","Exportación PDF y Excel/CSV","Roles, permisos y tareas avanzadas","Comparación de campañas, rendimiento y gastos"],
    business:["Todo lo incluido en Growr Pro","Gestión preparada para múltiples organizaciones y clientes","Dashboard global multiempresa","Administración y permisos empresariales","Reportes empresariales centralizados","Soporte prioritario y onboarding dedicado","Arquitectura preparada para futuras integraciones y API"]
  };
  return <div className="page-content plans-page"><PageHead title="Planes Growr360" text={`Funciones y límites de la organización ${groupName}.`}/>
    {subscriptionError&&<div className="content-card" style={{borderColor:"#e0a100"}}><EmptyLine text={`No pudimos confirmar el plan del grupo (${subscriptionError}). Se muestra Growr Free por seguridad hasta poder verificarlo — actualizá la página o contactá a soporte si el problema persiste.`}/></div>}
    <section className="plan-current"><div><span><ShieldCheck/></span><div><small>PLAN DEL GRUPO · {groupName}</small><h3>{current?.name??"Growr Free"}</h3><p>{subscription?.status==="trialing"?"Período de prueba activo para todo el grupo":"Todos los miembros acceden a estas funciones; sus acciones dependen del rol."}</p></div></div>{subscription?.expires_at&&<time>Vigente hasta {formatDate(subscription.expires_at)}</time>}</section>
    <section className="plan-usage"><header><div><h3>Uso del plan</h3><p>Los límites se aplican igual en la web y en la aplicación.</p></div><span>{currentCode.toUpperCase()}</span></header><div>{metrics.map(metric=>{const percent=metric.limit==null?0:Math.min(100,(metric.value/Math.max(1,metric.limit))*100);return <article key={metric.label}><div><strong>{metric.label}</strong><span>{metric.value.toLocaleString("es-AR",{maximumFractionDigits:2})}{metric.suffix??""} de {metric.limit==null?"Ilimitado":`${metric.limit.toLocaleString("es-AR")}${metric.suffix??""}`}</span></div><div className={metric.limit!=null&&percent>=90?"near-limit":""}><i style={{width:metric.limit==null?"100%":`${percent}%`}}/></div></article>})}</div></section>
    <div className="plans-grid">{ordered.map(plan=>{const price=planPrice(plan.code);return <article key={plan.code} className={`${plan.code===currentCode?"current":""} ${plan.code}`}><header><div><span>{plan.code==="free"?<Leaf/>:plan.code==="pro"?<TrendingUp/>:<BriefcaseBusiness/>}</span><div><small>{plan.code==="free"?"INICIAL":plan.code==="pro"?"PROFESIONAL":"EMPRESA"}</small><h3>{plan.name}</h3><p>{planText(plan)}</p></div></div>{plan.code===currentCode&&<b>Tu plan</b>}</header><div className="plan-price"><strong>{price.amount}</strong><span>{price.caption}</span><small>Precio informativo · sin cobros desde Growr360</small></div><div className="plan-limits"><span>{`Hasta ${(plan.included_hectares??plan.max_hectares??0).toLocaleString("es-AR")} ha activas incluidas`}</span><span>{plan.max_fields==null?"Campos ilimitados":`Hasta ${plan.max_fields} campos`}</span><span>{plan.max_lots==null?"Lotes ilimitados":`Hasta ${plan.max_lots} lotes`}</span><span>Campañas e historial ilimitados</span><span>{plan.max_users==null?"Integrantes ilimitados":`Hasta ${plan.max_users} integrantes`}</span><span>{plan.max_kml_imports==null?"Importaciones KML/KMZ ilimitadas":`Hasta ${plan.max_kml_imports} importaciones KML/KMZ`}</span>{plan.extra_hectare_price_year_usd>0&&<span>Superficie adicional: USD {plan.extra_hectare_price_year_usd.toLocaleString("es-AR")} por ha/año</span>}</div><ul>{planBenefits[plan.code].map(benefit=><li key={benefit}><Check/>{benefit}</li>)}</ul><button disabled>{plan.code===currentCode?"Plan actual":"Solicitar acceso próximamente"}</button></article>})}</div>
    {!ordered.length&&<div className="content-card"><EmptyLine text="No pudimos cargar el catálogo de planes. Actualizá la página para volver a intentar."/></div>}
  </div>;
}

function RealSettingsView({ mode, groupId, userId, settings, group, canManageGroup, onSaved, onGroupSaved }: { mode:"personal"|"group";groupId: string; userId: string; settings: AppSettings; group:Group|null; canManageGroup:boolean; onSaved: (value: AppSettings) => void; onGroupSaved:()=>void }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [groupName,setGroupName]=useState(group?.name??"");
  const [groupDescription,setGroupDescription]=useState(group?.description??"");
  const [groupCuit,setGroupCuit]=useState(group?.cuit??"");
  const [groupImage,setGroupImage]=useState<File|null>(null);
  const [groupImageUrl,setGroupImageUrl]=useState("");
  useEffect(() => setDraft(settings), [settings]);
  useEffect(()=>{setGroupName(group?.name??"");setGroupDescription(group?.description??"");setGroupCuit(group?.cuit??"");setGroupImage(null);if(!group?.image_path){setGroupImageUrl("");return}if(/^https?:\/\//.test(group.image_path)){setGroupImageUrl(group.image_path);return}supabase.storage.from("group-images").createSignedUrl(group.image_path,3600).then(({data})=>setGroupImageUrl(data?.signedUrl??""));},[group]);
  useEffect(()=>{if(!groupImage)return;const url=URL.createObjectURL(groupImage);setGroupImageUrl(url);return()=>URL.revokeObjectURL(url)},[groupImage]);
  async function save() {
    setSaving(true); setMessage("");
    const { error } = await supabase.from("app_settings").upsert({ group_id: groupId, user_id: userId, ...draft }, { onConflict: "group_id,user_id" });
    setSaving(false);
    if (error) setMessage(error.message); else { onSaved(draft); setMessage("Configuración guardada."); }
  }
  async function saveGroup(){
    if(groupCuit.replace(/\D/g,"").length!==11){setMessage("El CUIT debe tener 11 números.");return}
    setSaving(true);setMessage("");let imagePath=group?.image_path??null;
    if(groupImage){if(groupImage.size>5*1024*1024){setSaving(false);setMessage("La imagen no puede superar los 5 MB.");return}const extension=(groupImage.name.split(".").pop()||"jpg").toLowerCase();imagePath=`${groupId}/group-${Date.now()}.${extension}`;const uploaded=await supabase.storage.from("group-images").upload(imagePath,groupImage,{contentType:groupImage.type||"image/jpeg",upsert:false});if(uploaded.error){setSaving(false);setMessage(uploaded.error.message);return}}
    const {error}=await supabase.from("groups").update({name:groupName.trim(),description:groupDescription.trim()||null,cuit:groupCuit.replace(/\D/g,""),image_path:imagePath}).eq("id",groupId);setSaving(false);if(error)setMessage(error.message);else{setGroupImage(null);setMessage("Grupo actualizado.");onGroupSaved();}
  }
  async function removeGroupImage(){if(!group?.image_path&&!groupImage)return;setSaving(true);setMessage("");const path=group?.image_path;const{error}=await supabase.from("groups").update({image_path:null}).eq("id",groupId);if(!error&&path&&!/^https?:\/\//.test(path))await supabase.storage.from("group-images").remove([path]);setSaving(false);if(error)setMessage(error.message);else{setGroupImage(null);setGroupImageUrl("");setMessage("Imagen del grupo eliminada.");onGroupSaved();}}
  return <div className="page-content settings-page"><PageHead title={mode==="group"?"Configuración del grupo":"Ajustes personales"} text={mode==="group"?"Identidad y datos institucionales separados de tus preferencias.":"Apariencia, formatos y avisos de tu cuenta."}/><div className="settings-grid">
    {mode==="personal"&&<section className="content-card"><div className="settings-title"><Settings2/><div><h3>Apariencia y formato</h3><p>La configuración se sincroniza con tu cuenta.</p></div></div>
      <label>Tema<select value={draft.appearance} onChange={e => setDraft({ ...draft, appearance: e.target.value })}><option value="system">Usar tema del dispositivo</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>
      <label>Unidad de superficie<select value={draft.area_unit} onChange={e => setDraft({ ...draft, area_unit: e.target.value })}><option value="ha">Hectáreas (ha)</option><option value="m2">Metros cuadrados (m²)</option></select></label>
      <label>Formato de fecha<select value={draft.date_format} onChange={e => setDraft({ ...draft, date_format: e.target.value })}><option value="dd-MM-yyyy">Día-mes-año</option><option value="dd/MM/yyyy">Día/mes/año</option><option value="yyyy-MM-dd">Año-mes-día</option></select></label>
      <label className="settings-check"><input type="checkbox" checked={draft.notifications_enabled} onChange={e => setDraft({ ...draft, notifications_enabled: e.target.checked })}/><span><strong>Notificaciones</strong><small>Recibir avisos operativos del grupo.</small></span></label>

      {message && <p className={/(guardad|actualizad|eliminad)/i.test(message) ? "save-success" : "form-error"}>{message}</p>}<button className="settings-save" disabled={saving} onClick={save}>{saving ? <LoaderCircle className="spin"/> : <Save/>}Guardar cambios</button>
    </section>}
    {mode==="group"&&(canManageGroup?<section className="content-card group-settings group-settings-premium"><div className="settings-title"><Users/><div><h3>Identidad del grupo</h3><p>Estos datos se muestran al equipo y al buscar el grupo.</p></div></div><div className="group-image-editor"><div>{groupImageUrl?<img src={groupImageUrl} alt={`Imagen de ${groupName||"grupo"}`}/>:<ImageIcon/>}</div><section><strong>Foto institucional</strong><small>JPG, PNG o WebP · máximo 5 MB. Recomendamos una imagen horizontal.</small><label className="group-upload"><UploadCloud/>Elegir imagen<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setGroupImage(event.target.files?.[0]??null)}/></label>{(groupImageUrl||group?.image_path)&&<button className="group-remove-image" type="button" onClick={()=>void removeGroupImage()}>Quitar imagen</button>}</section></div><div className="group-settings-fields"><label>Nombre del grupo<input maxLength={120} value={groupName} onChange={e=>setGroupName(e.target.value)}/></label><label>CUIT<input inputMode="numeric" maxLength={11} value={groupCuit} onChange={e=>setGroupCuit(e.target.value.replace(/\D/g,"").slice(0,11))}/></label><label className="wide">Descripción<textarea maxLength={500} placeholder="Contá brevemente quiénes son y cómo trabajan…" value={groupDescription} onChange={e=>setGroupDescription(e.target.value)}/><small>{groupDescription.length}/500</small></label></div><div className="group-settings-actions group-settings-actions-clean"><span>Los cambios se aplican a todos los integrantes del grupo.</span><button className="settings-save" disabled={saving||!groupName.trim()||groupCuit.length!==11} onClick={()=>void saveGroup()}>{saving?<LoaderCircle className="spin"/>:<Save/>}Guardar cambios</button></div></section>:<section className="content-card settings-help"><SlidersHorizontal/><h3>Configuración del grupo</h3><p>Solo el propietario y los administradores pueden modificar los datos institucionales.</p></section>)}
  </div></div>;
}

function ManagementView({ groupId, userId, fields, plots, campaigns, clients, contractors, crops, supplies, planBlockReason, initialForm, initialRecord, onInitialRecordConsumed, onClose, onSaved }: { groupId: string; userId: string; fields: Field[]; plots: Plot[]; campaigns: Campaign[]; clients: ClientRow[]; contractors:Contractor[]; crops: Crop[]; supplies: Supply[]; canFields: boolean; canLots: boolean; canCampaigns: boolean; canRecords: boolean; initialForm:"field"|"campaign"|"client"|"contractor"|"record"; planBlockReason:(kind:"field"|"lot",extraArea?:number)=>string; initialRecord: {plotId:string;type:string}|null; onInitialRecordConsumed:()=>void; onClose:()=>void; onMap: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<"field"|"campaign"|"client"|"contractor"|"record"|null>(null);
  const [data, setData] = useState<Record<string,string>>({}); const [saving,setSaving]=useState(false); const [message,setMessage]=useState("");
  function open(value: typeof form, seed?: {plotId:string;type:string}){const selected=seed?plots.find(plot=>plot.id===seed.plotId):null;const selectedType=seed?.type??"";const initial:Record<string,string>=value === "record" ? { record_type:selectedType, _type_locked:seed?.type?"true":"", record_date:new Date().toISOString().slice(0,10), campaign_id:campaigns.find(c=>c.status==="active")?.id ?? campaigns[0]?.id ?? "", plot_id:selected?.id??"",field_id:selected?.field_id??"",worked_area:String(selected?.arable_area??""),monitoring_priority:"3",input_lines_json:["sowing","spraying","fertilization"].includes(selectedType)?JSON.stringify([{inputId:"",name:"",dose:"",price:"",unit:""}]):"" } : {};setForm(value);setData(initial);setMessage("");if(seed?.type==="monitoring"&&selected&&navigator.geolocation){navigator.geolocation.getCurrentPosition(position=>{const point:[number,number]=[position.coords.longitude,position.coords.latitude];const feature=geometry(selected.geometry_json);setData(current=>({...current,gps_latitude:String(point[1]),gps_longitude:String(point[0]),gps_accuracy_m:String(position.coords.accuracy),gps_captured_at:new Date(position.timestamp).toISOString(),gps_status:feature&&pointInsidePolygon(point,feature)?"Dentro del lote":"Fuera del lote"}));},()=>setData(current=>({...current,gps_status:"Ubicación no disponible"})),{enableHighAccuracy:true,timeout:12000});}}
  useEffect(()=>{open(initialForm, initialRecord ?? undefined);if(initialRecord)onInitialRecordConsumed();},[initialForm]);
  async function save(event: FormEvent){event.preventDefault();setSaving(true);setMessage("");let error: {message:string}|null=null;
    try{await ensureActiveSession();}catch(reason){setSaving(false);setMessage(spanishError(reason));return;}
    if(form==="field"){const reason=planBlockReason("field");if(reason){setSaving(false);setMessage(reason);return;}({error}=await supabase.from("fields").insert({id:crypto.randomUUID(),group_id:groupId,client_id:data.client_id||null,name:data.name?.trim(),location:data.location||null,locality:data.locality||null,province:data.province||null,total_area:number(data.total_area),arable_area:number(data.arable_area),created_by:userId}));}
    if(form==="client")({error}=await supabase.from("clients").insert({id:crypto.randomUUID(),group_id:groupId,name:data.name?.trim(),cuit:data.cuit?.replace(/\D/g,"")||null,phone:data.phone||null,email:data.email||null,created_by:userId}));
    if(form==="contractor")({error}=await supabase.from("contractors").insert({id:crypto.randomUUID(),group_id:groupId,name:data.name?.trim(),phone:data.phone?.trim()||null,document:data.document?.replace(/[^0-9]/g,"")||null,address:data.address?.trim()||null,notes:data.notes?.trim()||null,created_by:userId}));
    if(form==="campaign")({error}=await supabase.from("campaigns").insert({id:crypto.randomUUID(),group_id:groupId,name:data.name?.trim(),start_date:data.start_date,end_date:data.end_date,status:"planned",created_by:userId}));
    if(form==="record"){const selectedPlot=plots.find(p=>p.id===data.plot_id);const details=recordDetailsPayload(data);const storedType=["napa","soil_analysis"].includes(data.record_type)?"other":data.record_type;const result=await supabase.rpc("save_activity_record",{p_id:null,p_group_id:groupId,p_campaign_id:data.campaign_id,p_field_id:data.field_id||selectedPlot?.field_id||null,p_plot_id:data.plot_id||null,p_type:storedType,p_date:data.record_date,p_worked_area:data.record_type==="napa"?null:number(data.worked_area)||null,p_responsible_id:null,p_contractor:["monitoring","napa","soil_analysis"].includes(data.record_type)?"":data.contractor||"",p_machinery:["monitoring","napa","soil_analysis"].includes(data.record_type)?"":data.machinery||"",p_observations:data.record_type==="napa"?"":data.observations||"",p_allow_member_edits:data.record_type==="monitoring"?false:data.allow_member_edits==="true",p_data:details});error=result.error;}
    setSaving(false);if(error)setMessage(spanishError(error));else{setForm(null);onSaved();}}
  return <div className="creation-host">
    {form&&<div className="record-detail-backdrop"><form className="entity-form" onSubmit={save}><header><button type="button" className="page-back-button" onClick={onClose}><ChevronLeft/>Volver</button><div><span className="eyebrow">NUEVA ALTA</span><h2>{formTitle(form)}</h2></div></header>
      {(form==="field"||form==="client"||form==="campaign"||form==="contractor")&&<label>Nombre<input required value={data.name||""} onChange={e=>setData({...data,name:e.target.value})}/></label>}
      {form==="field"&&<><label>Cliente<select value={data.client_id||""} onChange={e=>setData({...data,client_id:e.target.value})}><option value="">Sin cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="form-pair"><label>Superficie total (ha)<input required inputMode="decimal" value={data.total_area||""} onChange={e=>setData({...data,total_area:e.target.value})}/></label><label>Superficie sembrable (ha)<input required inputMode="decimal" value={data.arable_area||""} onChange={e=>setData({...data,arable_area:e.target.value})}/></label></div><div className="form-pair"><label>Localidad<input value={data.locality||""} onChange={e=>setData({...data,locality:e.target.value})}/></label><label>Provincia<input value={data.province||""} onChange={e=>setData({...data,province:e.target.value})}/></label></div></>}
      {form==="client"&&<div className="form-pair"><label>CUIT<input value={data.cuit||""} onChange={e=>setData({...data,cuit:e.target.value})}/></label><label>Teléfono<input value={data.phone||""} onChange={e=>setData({...data,phone:e.target.value})}/></label><label>Correo<input type="email" value={data.email||""} onChange={e=>setData({...data,email:e.target.value})}/></label></div>}
      {form==="contractor"&&<><div className="form-pair"><label>Teléfono de contacto<input inputMode="tel" value={data.phone||""} onChange={e=>setData({...data,phone:e.target.value})}/></label><label>CUIT o DNI<input inputMode="numeric" value={data.document||""} onChange={e=>setData({...data,document:e.target.value})}/></label></div><label>Dirección<input value={data.address||""} onChange={e=>setData({...data,address:e.target.value})}/></label><label>Nota breve<textarea maxLength={240} value={data.notes||""} onChange={e=>setData({...data,notes:e.target.value})}/></label></>}
      {form==="campaign"&&<div className="form-pair"><label>Fecha de inicio<input required type="date" value={data.start_date||""} onChange={e=>setData({...data,start_date:e.target.value})}/></label><label>Fecha de cierre<input required type="date" value={data.end_date||""} onChange={e=>setData({...data,end_date:e.target.value})}/></label></div>}
      {form==="record"&&<RecordWizard data={data} setData={setData} fields={fields} plots={plots} campaigns={campaigns} contractors={contractors} crops={crops} supplies={supplies}/>} 
      {message&&<p className="form-error">{message}</p>}<div className="entity-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="save" disabled={saving||(form==="record"&&!recordReady(data))}>{saving?<LoaderCircle className="spin"/>:<Save/>}Guardar</button></div></form></div>}
  </div>;
}

const specificRecordFields: Record<string, Array<[string,string,string?]>> = {
  sowing: [["variety","Variedad"],["row_distance","Distancia entre surcos","number"],["seeding_density","Densidad de siembra (semillas/m²)","number"],["labor_cost_per_ha","Costo de labor por ha","number"]],
  spraying: [["application_volume","Volumen de aplicación","number"],["target","Objetivo"],["weather","Condiciones climáticas"],["applicator","Aplicador"],["application_cost_per_ha","Costo de aplicación por ha","number"]],
  fertilization: [["method","Método de aplicación"],["labor_cost_per_ha","Costo de labor por ha","number"]],
  work: [["work_type","Tipo de roturación"],["operator","Operador"],["price_per_ha","Precio por hectárea","number"]],
  harvest: [["harvested_area","Superficie cosechada","number"],["total_production","Producción total","number"],["unit","Unidad"],["humidity","Humedad","number"],["losses","Pérdidas","number"],["harvest_cost_per_ha","Costo de cosecha por ha","number"],["destination","Destino del grano"],["price","Precio","number"]],
  monitoring: [],
  napa: [["water_table_depth","Profundidad de napa","number"]],
  soil_analysis: [["sample_depth","Profundidad de muestreo (cm)","number"],["sampling_method","Método de muestreo"],["laboratory","Laboratorio"],["ph","pH","number"],["organic_matter","Materia orgánica (%)","number"],["phosphorus","Fósforo (ppm)","number"],["nitrogen","Nitrógeno (ppm)","number"],["sulfur","Azufre (ppm)","number"],["zinc","Zinc (ppm)","number"],["no3","NO3 (ppm)","number"],["potassium","Potasio (ppm)","number"],["cec","CIC (meq/100g)","number"],["ec","CE (dS/m)","number"],["recommendations","Recomendaciones"]],
  other: [["title","Tipo de registro"],["description","Descripción"]]
};
type InputLine={inputId:string;name:string;dose:string;price:string;unit:string};
function RecordWizard({data,setData,fields,plots,campaigns,contractors,crops,supplies}:{data:Record<string,string>;setData:(value:Record<string,string>)=>void;fields:Field[];plots:Plot[];campaigns:Campaign[];contractors:Contractor[];crops:Crop[];supplies:Supply[]}){
  const [step,setStep]=useState(0);const type=data.record_type||"";const special=["monitoring","napa"].includes(type);
  useEffect(()=>{setData({...data,_wizard_ready:special||step===3?"true":"false"});},[step,type]);
  const location=<><label>Campaña<select required value={data.campaign_id||""} onChange={event=>setData({...data,campaign_id:event.target.value})}><option value="">Seleccionar campaña…</option>{campaigns.map(c=><option key={c.id} value={c.id}>{c.name}{c.status==="active"?" · Activa":""}</option>)}</select></label><div className="form-pair"><label>Campo<select required value={data.field_id||""} onChange={event=>setData({...data,field_id:event.target.value,plot_id:"",worked_area:""})}><option value="">Seleccionar campo…</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>Lote<select required value={data.plot_id||""} onChange={event=>{const plot=plots.find(p=>p.id===event.target.value);setData({...data,plot_id:event.target.value,field_id:plot?.field_id||data.field_id,worked_area:String(plot?.arable_area||"")})}}><option value="">Seleccionar lote…</option>{plots.filter(p=>!data.field_id||p.field_id===data.field_id).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><label>Fecha<input required type="date" value={data.record_date||""} onChange={event=>setData({...data,record_date:event.target.value})}/></label></>;
  if(!data._type_locked)return <RecordTypePicker onSelect={value=>setData({...data,record_type:value,_type_locked:"true",input_lines_json:["sowing","spraying","fertilization"].includes(value)?JSON.stringify([{inputId:"",name:"",dose:"",price:"",unit:""}]):""})}/>;
  if(type==="monitoring")return <div className="record-wizard"><WizardHead step={1} total={1} title="Nuevo monitoreo"/><section className="wizard-card"><h3>Ubicación y estado del cultivo</h3>{location}<label>Cultivo<select required value={data.crop||""} onChange={event=>setData({...data,crop:event.target.value,phenological_state:""})}><option value="">Seleccionar cultivo…</option>{crops.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><MonitoringEditor data={data} setData={setData}/><label>Observaciones<textarea value={data.observations||""} onChange={event=>setData({...data,observations:event.target.value})}/></label><div className={`gps-form-status ${data.gps_status==="Dentro del lote"?"inside":"outside"}`}><MapPin/><div><strong>{data.gps_status||"Obteniendo ubicación GPS…"}</strong><small>{data.gps_accuracy_m?`Precisión aproximada: ${Math.round(number(data.gps_accuracy_m))} m`:"El monitoreo se puede guardar aunque no haya señal."}</small></div></div></section></div>;
  if(type==="napa")return <div className="record-wizard"><WizardHead step={1} total={1} title="Medición de napa"/><section className="wizard-card">{location}<RecordSpecificFields data={data} setData={setData}/></section></div>;
  return <div className="record-wizard"><WizardHead step={step+1} total={4} title={recordType(type)}/>{step===0&&<section className="wizard-card"><span>PASO 1</span><h3>Ubicación del trabajo</h3><div className="fixed-record-type"><RecordTypeIcon type={type}/><div><small>TIPO DE REGISTRO</small><strong>{recordType(type)}</strong></div></div>{type==="other"&&<label>¿Qué tipo de registro es?<input required value={data.title||""} onChange={event=>setData({...data,title:event.target.value})}/></label>}{location}<WizardNext enabled={Boolean(data.campaign_id&&data.field_id&&data.plot_id&&data.record_date)} next={()=>setStep(1)}/></section>}{step===1&&<section className="wizard-card"><span>PASO 2</span><h3>Datos de {recordType(type).toLowerCase()}</h3>{type!=="napa"&&<label>Superficie trabajada (ha)<input required inputMode="decimal" value={data.worked_area||""} onChange={event=>setData({...data,worked_area:event.target.value})}/></label>}{!["soil_analysis","napa"].includes(type)&&<label>Cultivo<select value={data.crop||""} onChange={event=>setData({...data,crop:event.target.value})}><option value="">Sin cultivo</option>{crops.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>}{type==="soil_analysis"?<SoilSamplesEditor data={data} setData={setData}/>:<RecordSpecificFields data={data} setData={setData}/>}<WizardNavigation back={()=>setStep(0)} next={()=>setStep(2)}/></section>}{step===2&&<section className="wizard-card"><span>PASO 3</span><h3>{["sowing","spraying","fertilization"].includes(type)?"Productos y ejecución":type==="soil_analysis"?"Revisión de muestras":"Ejecución del trabajo"}</h3>{["sowing","spraying","fertilization"].includes(type)&&<SupplyLinesEditor supplies={supplies} data={data} setData={setData}/>} {!["soil_analysis","napa"].includes(type)&&<div className="form-pair"><label>Contratista<select value={data.contractor||""} onChange={event=>setData({...data,contractor:event.target.value})}><option value="">Sin contratista</option>{contractors.map(contractor=><option key={contractor.id} value={contractor.name}>{contractor.name}{contractor.document?` · ${contractor.document}`:""}</option>)}</select>{!contractors.length&&<small>Cargá contratistas desde Gestión → Contratistas.</small>}</label><label>Maquinaria<input value={data.machinery||""} onChange={event=>setData({...data,machinery:event.target.value})}/></label></div>}{type==="soil_analysis"&&<p className="wizard-note">El análisis de suelo no requiere contratista ni maquinaria.</p>}<WizardNavigation back={()=>setStep(1)} next={()=>setStep(3)}/></section>}{step===3&&<section className="wizard-card"><span>PASO 4</span><h3>Listo para guardar</h3><div className="record-review"><strong>{recordType(type)}</strong><small>{plots.find(p=>p.id===data.plot_id)?.name}{type!=="napa"?` · ${data.worked_area} ha`:""}</small><small>{campaigns.find(c=>c.id===data.campaign_id)?.name} · {data.record_date}</small></div><label>Observaciones<textarea value={data.observations||""} onChange={event=>setData({...data,observations:event.target.value})}/></label><label className="wizard-check"><input type="checkbox" checked={data.allow_member_edits==="true"} onChange={event=>setData({...data,allow_member_edits:String(event.target.checked)})}/><span>Permitir que otros miembros editen este registro</span></label><button type="button" className="wizard-back-only" onClick={()=>setStep(2)}>Volver a editar</button></section>}</div>;
}
function RecordTypePicker({onSelect}:{onSelect:(type:string)=>void}){const types=["sowing","spraying","fertilization","harvest","work","soil_analysis","other"];return <div className="record-type-picker"><div><span className="eyebrow">NUEVO REGISTRO</span><h3>¿Qué querés registrar?</h3><p>Elegí una opción para continuar. Los monitoreos se crean desde su sección propia.</p></div><div>{types.map(type=><button className={`record-type-${type}`} type="button" key={type} onClick={()=>onSelect(type)}><RecordTypeIcon type={type}/><span><strong>{recordType(type)}</strong><small>{recordTypeDescription(type)}</small></span><ChevronRight/></button>)}</div></div>}
function RecordTypeIcon({type}:{type:string}){if(type==="sowing")return <Sprout/>;if(type==="spraying")return <CloudSun/>;if(type==="fertilization")return <Leaf/>;if(type==="harvest")return <Tractor/>;if(type==="monitoring")return <Activity/>;if(type==="soil_analysis")return <MapPin/>;if(type==="other")return <Grid2X2/>;return <RotateCcw/>}
function recordTypeDescription(type:string){return ({sowing:"Implantación, densidad e insumos",spraying:"Aplicaciones, productos y dosis",fertilization:"Nutrición y método de aplicación",harvest:"Producción, humedad y rendimiento",work:"Roturación y labores del suelo",monitoring:"Estado del cultivo con ubicación GPS",soil_analysis:"Muestras y parámetros del suelo",other:"Una actividad personalizada"} as Record<string,string>)[type]||"Actividad del lote"}
function WizardHead({step,total,title}:{step:number;total:number;title:string}){return <div className="wizard-head"><div><small>{step}/{total}</small><h3>{title}</h3></div><i><b style={{width:`${step/total*100}%`}}/></i></div>}
function WizardNext({enabled,next}:{enabled:boolean;next:()=>void}){return <button type="button" className="wizard-next" disabled={!enabled} onClick={next}>Continuar <ChevronRight/></button>}
function WizardNavigation({back,next}:{back:()=>void;next:()=>void}){return <div className="wizard-navigation"><button type="button" onClick={back}><ChevronLeft/>Atrás</button><button type="button" onClick={next}>Continuar<ChevronRight/></button></div>}
function SupplyLinesEditor({supplies,data,setData}:{supplies:Supply[];data:Record<string,string>;setData:(value:Record<string,string>)=>void}){
  const lines:InputLine[]=data.input_lines_json?JSON.parse(data.input_lines_json):[];const update=(next:InputLine[])=>setData({...data,input_lines_json:JSON.stringify(next)});const area=number(data.worked_area);const total=lines.reduce((sum,line)=>sum+area*number(line.dose)*number(line.price),0);
  return <div className="supply-lines"><div className="section-title"><strong>Insumos</strong><span>${total.toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>{lines.map((line,index)=><article key={index}><div><strong>Insumo {index+1}</strong><button type="button" onClick={()=>update(lines.filter((_,i)=>i!==index))}><X/></button></div><label>Seleccionar insumo<select value={line.inputId} onChange={event=>{const supply=supplies.find(item=>item.id===event.target.value);const next=[...lines];next[index]={inputId:supply?.id||"",name:supply?.name||"",dose:line.dose,price:String(supply?.unit_price??""),unit:supply?.unit||""};update(next)}}><option value="">Seleccionar…</option>{supplies.map(supply=><option key={supply.id} value={supply.id}>{supply.name} · ${number(supply.unit_price).toLocaleString("es-AR")} {supply.currency}/{supply.unit}</option>)}</select></label><div className="form-pair"><label>Dosis/ha ({line.unit||"unidad"})<input inputMode="decimal" value={line.dose} onChange={event=>{const next=[...lines];next[index]={...line,dose:event.target.value};update(next)}}/></label><label>Precio unitario<input inputMode="decimal" value={line.price} onChange={event=>{const next=[...lines];next[index]={...line,price:event.target.value};update(next)}}/></label></div><small>Subtotal: ${(area*number(line.dose)*number(line.price)).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}</small></article>)}{supplies.length?<button type="button" className="add-supply-line" onClick={()=>update([...lines,{inputId:"",name:"",dose:"",price:"",unit:""}])}><Plus/>Agregar producto</button>:<p className="form-error">Primero creá un insumo en Operaciones → Insumos.</p>}</div>
}
function SoilSamplesEditor({data,setData}:{data:Record<string,string>;setData:(value:Record<string,string>)=>void}){const samples:Record<string,string>[]=data.soil_samples_json?JSON.parse(data.soil_samples_json):[{}];const update=(next:Record<string,string>[])=>setData({...data,soil_samples_json:JSON.stringify(next)});return <div className="soil-samples">{samples.map((sample,index)=><article key={index}><div><strong>Muestra {index+1}</strong>{samples.length>1&&<button type="button" onClick={()=>update(samples.filter((_,i)=>i!==index))}><X/></button>}</div><div className="specific-fields">{specificRecordFields.soil_analysis.map(([key,label,type])=><label key={key}>{label}<input type={type||"text"} value={sample[key]||""} onChange={event=>{const next=[...samples];next[index]={...sample,[key]:event.target.value};update(next)}}/></label>)}</div></article>)}<button type="button" className="add-supply-line" onClick={()=>update([...samples,{}])}><Plus/>Agregar otra muestra</button></div>}
const fineWeeds=["Raygrass","Sorgo de Alepo","Gramón","Capín","Avena fatua","Cebadilla criolla","Cola de zorro","Pasto cuaresma","Eleusine","Cloris"];
const broadWeeds=["Yuyo colorado","Malva","Capiquí","Cardo","Rama negra","Nabo","Quínoa","Chamico","Abrojo","Verdolaga"];
const monitoringInsects=["Oruga cortadora","Chinche verde","Chinche de la alfalfa","Oruga medidora","Arañuela roja"];
function cropStages(crop:string){const name=crop.toLowerCase();if(name.includes("soja"))return["Barbecho","VE · Emergencia","VC · Cotiledonar","V1 · Primer nudo","V3 · Tercer nudo","R1 · Inicio de floración","R3 · Inicio de vainas","R5 · Inicio de llenado","R8 · Madurez completa"];if(name.includes("maíz")||name.includes("maiz"))return["Barbecho","VE · Emergencia","V1 · Primera hoja","V3 · Tercera hoja","V6 · Sexta hoja","VT · Panojamiento","R1 · Floración","R3 · Grano lechoso","R6 · Madurez fisiológica"];if(name.includes("trigo")||name.includes("cebada"))return["Barbecho","Z00–Z09 · Germinación","Z10–Z19 · Desarrollo de hojas","Z20–Z29 · Macollaje","Z30–Z39 · Encañazón","Z50–Z59 · Espigazón","Z60–Z69 · Floración","Z90–Z99 · Maduración"];return["Barbecho","Emergencia","Desarrollo vegetativo","Floración","Fructificación / llenado","Madurez fisiológica","Madurez de cosecha"]}
function diseaseOptions(crop:string){const name=crop.toLowerCase();if(name.includes("trigo"))return["Roya amarilla","Roya anaranjada","Mancha amarilla","Fusariosis de la espiga","Septoriosis"];if(name.includes("cebada"))return["Ramularia","Escaldadura","Mancha en red","Roya de la hoja","Fusariosis"];if(name.includes("maíz")||name.includes("maiz"))return["Tizón foliar","Roya común","Cercosporiosis","Podredumbre de tallo","Carbón común"];if(name.includes("soja"))return["Mancha ojo de rana","Septoriosis","Mancha púrpura","Roya asiática","Podredumbre de raíz"];if(name.includes("girasol"))return["Mildiu","Alternaria","Roya","Verticilosis","Podredumbre de capítulo"];return["Oídio","Roya","Mildiu","Mancha foliar","Podredumbre de raíz"]}
function severityColor(level:number){return["#22c55e","#84cc16","#eab308","#f97316","#dc2626"][level-1]}
function parseLevels(value:string){return Object.fromEntries(value.split("|").map(item=>item.split(":" )).filter(pair=>pair.length===2))}
function SeverityGroup({title,options,selectionKey,levelsKey,data,setData,custom=false}:{title:string;options:string[];selectionKey:string;levelsKey:string;data:Record<string,string>;setData:(value:Record<string,string>)=>void;custom?:boolean}){const selected=data[selectionKey]?.split(",").map(value=>value.trim()).filter(Boolean)||[];const levels=parseLevels(data[levelsKey]||"");const commit=(name:string,level:number)=>{const nextSelected=selected.includes(name)?selected:[...selected,name];const nextLevels={...levels,[name]:String(level)};setData({...data,[selectionKey]:nextSelected.join(", "),[levelsKey]:Object.entries(nextLevels).map(([key,value])=>`${key}:${value}`).join("|")})};return <details className="monitoring-group"><summary>{title}<ChevronDown/></summary><div>{options.map(name=><div className="severity-row" key={name}><span>{name}</span><div>{[1,2,3,4,5].map(level=><button type="button" key={level} className={Number(levels[name])===level?"active":""} style={{"--severity":severityColor(level)} as React.CSSProperties} onClick={()=>commit(name,level)}>{level}</button>)}</div></div>)}{custom&&<label>Otra maleza<input placeholder="Escribí el nombre y presioná Enter" onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();const name=event.currentTarget.value.trim();if(name){commit(name,1);event.currentTarget.value=""}}}}/></label>}</div></details>}
function MonitoringEditor({data,setData}:{data:Record<string,string>;setData:(value:Record<string,string>)=>void}){return <div className="monitoring-editor"><label>Estado fenológico<select required value={data.phenological_state||""} onChange={event=>setData({...data,phenological_state:event.target.value})}><option value="">Seleccionar estado…</option>{cropStages(data.crop||"").map(value=><option key={value}>{value}</option>)}</select></label><div><strong>Importancia</strong><div className="severity-scale">{[1,2,3,4,5].map(level=><button key={level} type="button" className={data.monitoring_priority===String(level)?"active":""} style={{"--severity":severityColor(level)} as React.CSSProperties} onClick={()=>setData({...data,monitoring_priority:String(level)})}>{level}<small>{["Baja","Moderada","Media","Alta","Crítica"][level-1]}</small></button>)}</div></div><SeverityGroup title="Malezas · hoja fina" options={fineWeeds} selectionKey="weeds" levelsKey="weed_levels" data={data} setData={setData}/><SeverityGroup title="Malezas · hoja ancha" options={broadWeeds} selectionKey="weeds" levelsKey="weed_levels" data={data} setData={setData} custom/><SeverityGroup title="Insectos" options={monitoringInsects} selectionKey="insects" levelsKey="insect_levels" data={data} setData={setData}/><SeverityGroup title="Enfermedades" options={diseaseOptions(data.crop||"")} selectionKey="diseases" levelsKey="disease_levels" data={data} setData={setData}/></div>}
function recordReady(data:Record<string,string>){if(data._wizard_ready!=="true")return false;if(!data.campaign_id||!data.field_id||!data.plot_id||!data.record_date)return false;if(data.record_type==="monitoring")return Boolean(data.crop&&data.phenological_state);if(data.record_type==="napa")return String(data.water_table_depth??"").trim()!=="";if(["sowing","spraying","fertilization"].includes(data.record_type)){const lines:InputLine[]=data.input_lines_json?JSON.parse(data.input_lines_json):[];return lines.length>0&&lines.every(line=>line.inputId&&number(line.dose)>0&&number(line.price)>=0)}return true}
function RecordSpecificFields({data,setData}:{data:Record<string,string>;setData:(value:Record<string,string>)=>void}){
  const fields=specificRecordFields[data.record_type]??[];
  return <><div className="specific-fields">{fields.map(([key,label,type])=><label key={key}>{label}<input type={type??"text"} inputMode={type==="number"?"decimal":undefined} min={key==="monitoring_priority"?1:undefined} max={key==="monitoring_priority"?5:undefined} value={data[key]??""} onChange={event=>setData({...data,[key]:event.target.value})}/></label>)}</div>{data.record_type==="monitoring"&&<div className={`gps-form-status ${data.gps_status==="Dentro del lote"?"inside":"outside"}`}><MapPin/><div><strong>{data.gps_status||"Obteniendo ubicación GPS…"}</strong><small>{data.gps_accuracy_m?`Precisión aproximada: ${Math.round(number(data.gps_accuracy_m))} m`:"El monitoreo se puede guardar aunque no haya señal."}</small></div></div>}</>;
}
function recordDetailsPayload(data:Record<string,string>){
  const baseKeys=new Set(["record_type","record_date","campaign_id","field_id","plot_id","worked_area","contractor","machinery","observations","allow_member_edits","_wizard_ready","input_lines_json","soil_samples_json"]);
  const details=Object.fromEntries(Object.entries(data).filter(([key,value])=>!baseKeys.has(key)&&String(value).trim()!==""));
  if(data.record_type==="napa")details.record_kind="water_table";
  if(data.record_type==="soil_analysis"){
    const samples:Record<string,string>[]=data.soil_samples_json?JSON.parse(data.soil_samples_json):[{}];details.record_kind="soil_analysis";details.soil_sample_count=String(samples.length);
    samples.forEach((sample,index)=>specificRecordFields.soil_analysis.forEach(([key])=>{if(sample[key])details[`soil_sample_${index}_${key}`]=sample[key]}));
  }
  if(data.record_type==="harvest"){
    const area=number(data.harvested_area),production=number(data.total_production),price=number(data.price);
    if(area>0&&production>=0)details.yield_per_ha=String(production/area);
    if(price>0&&production>=0)details.estimated_income=String(price*production);
  }
  if(["sowing","spraying","fertilization"].includes(data.record_type)){
    const lines:InputLine[]=data.input_lines_json?JSON.parse(data.input_lines_json):[];details.input_count=String(lines.length);let total=0;lines.forEach((line,index)=>{const prefix=`input_${index}_`;details[prefix+"id"]=line.inputId;details[prefix+"name"]=line.name;details[prefix+"dose"]=line.dose;details[prefix+"price"]=line.price;details[prefix+"unit"]=line.unit;total+=number(data.worked_area)*number(line.dose)*number(line.price)});details.inputs_total=String(total);
  }
  const area=number(data.worked_area);const rateKey=data.record_type==="spraying"?"application_cost_per_ha":data.record_type==="work"?"price_per_ha":data.record_type==="harvest"?"harvest_cost_per_ha":"labor_cost_per_ha";const totalKey=data.record_type==="spraying"?"application_cost":data.record_type==="harvest"?"harvest_cost":"labor_cost";if(details[rateKey])details[totalKey]=String(number(details[rateKey])*(data.record_type==="harvest"?number(details.harvested_area)||area:area));
  if(!["monitoring","napa"].includes(data.record_type))details.total_cost=String(number(details.inputs_total)+number(details.labor_cost)+number(details.application_cost)+number(details.harvest_cost));
  return details;
}

const permissionCatalog=[
  ["view_fields","Ver campos y lotes"],["manage_fields","Crear y editar campos"],["manage_lots","Crear y editar lotes"],
  ["view_records","Ver registros"],["create_records","Crear registros"],["edit_records","Editar registros"],
  ["create_monitoring","Crear monitoreos"],["view_satellite","Ver imágenes satelitales"],["view_ndvi","Analizar NDVI"],
  ["manage_campaigns","Administrar campañas"],["export_reports","Exportar reportes"],["manage_members","Administrar equipo"]
] as const;
function roleDefault(role:string,permission:string){if(role==="owner")return true;if(role==="admin")return true;if(role==="agronomist")return ["view_fields","view_records","create_records","edit_records","create_monitoring","view_satellite","view_ndvi","export_reports"].includes(permission);if(role==="operator")return ["view_fields","view_records","create_records","create_monitoring"].includes(permission);return ["view_fields","view_records"].includes(permission)}
function MemberDetailPage({member,fields,plots,canManage,busy,draft,setDraft,fieldIds,setFieldIds,plotIds,setPlotIds,onBack,onRole,onRemove,onSave}:{member:Member;fields:Field[];plots:Plot[];canManage:boolean;busy:string;draft:Record<string,boolean>;setDraft:(value:Record<string,boolean>)=>void;fieldIds:Set<string>;setFieldIds:(value:Set<string>)=>void;plotIds:Set<string>;setPlotIds:(value:Set<string>)=>void;onBack:()=>void;onRole:(role:string)=>void;onRemove:()=>void;onSave:()=>void}){
  const profile=relation(member.profiles);const memberName=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||profile?.username||"Usuario";const editable=canManage&&member.role!=="owner";
  const [openFields,setOpenFields]=useState<Set<string>>(new Set());
  const plotsFor=(fieldId:string)=>plots.filter(plot=>plot.field_id===fieldId);
  const fieldState=(field:Field)=>{const children=plotsFor(field.id);const selected=fieldIds.has(field.id)?children.length:children.filter(plot=>plotIds.has(plot.id)).length;return{children,selected,full:fieldIds.has(field.id)||(children.length>0&&selected===children.length),partial:!fieldIds.has(field.id)&&selected>0&&selected<children.length}};
  const toggleOpen=(fieldId:string)=>setOpenFields(current=>{const next=new Set(current);if(next.has(fieldId))next.delete(fieldId);else next.add(fieldId);return next});
  const toggleField=(field:Field,checked:boolean)=>{const nextFields=new Set(fieldIds);const nextPlots=new Set(plotIds);const children=plotsFor(field.id);if(checked)nextFields.add(field.id);else nextFields.delete(field.id);children.forEach(plot=>nextPlots.delete(plot.id));setFieldIds(nextFields);setPlotIds(nextPlots)};
  const togglePlot=(field:Field,plot:Plot,checked:boolean)=>{const children=plotsFor(field.id);const nextFields=new Set(fieldIds);const nextPlots=new Set(plotIds);if(nextFields.has(field.id)){nextFields.delete(field.id);children.forEach(child=>{if(child.id!==plot.id||checked)nextPlots.add(child.id)});}else if(checked)nextPlots.add(plot.id);else nextPlots.delete(plot.id);if(children.length&&children.every(child=>nextPlots.has(child.id))){nextFields.add(field.id);children.forEach(child=>nextPlots.delete(child.id));}setFieldIds(nextFields);setPlotIds(nextPlots)};
  const selectEverything=()=>{setFieldIds(new Set(fields.map(field=>field.id)));setPlotIds(new Set())};
  const clearEverything=()=>{setFieldIds(new Set());setPlotIds(new Set())};
  return <div className="page-content member-profile-page">
    <button className="page-back-button" onClick={onBack}><ChevronLeft/>Volver al equipo</button>
    <section className="member-profile-hero"><ProfileAvatar profile={profile} name={memberName}/><div><span className="eyebrow">INTEGRANTE DEL EQUIPO</span><h2>{memberName}</h2><p>{roleName(member.role)} · <i/>Activo</p></div></section>
    <div className="member-profile-layout">
      <section className="member-profile-card contact-card"><header><div><span className="eyebrow">CONTACTO</span><h3>Datos de la persona</h3></div><ContactRound/></header><div className="member-contact-list"><div><Mail/><span><small>Correo</small><strong>{profile?.email||"No informado"}</strong></span></div><div><Phone/><span><small>Teléfono</small><strong>{profile?.phone||"No informado"}</strong></span></div><div><CircleUserRound/><span><small>Usuario</small><strong>{profile?.username?`@${profile.username}`:"No informado"}</strong></span></div></div></section>
      <section className="member-profile-card role-card"><header><div><span className="eyebrow">ROL</span><h3>Acceso general</h3></div><ShieldCheck/></header>{editable?<><label>Rol dentro del grupo<select disabled={busy===member.user_id} value={member.role} onChange={event=>onRole(event.target.value)}>{["admin","agronomist","operator","monitor","producer","member"].map(item=><option key={item} value={item}>{roleName(item)}</option>)}</select></label><p>El rol define la base de permisos y se puede complementar con accesos específicos.</p></>:<div className="member-readonly-role"><strong>{roleName(member.role)}</strong><small>Podés consultar el perfil. La administración de accesos está reservada a responsables autorizados.</small></div>}</section>
    </div>
    {editable&&<section className="member-profile-card resource-access-card">
      <header><div><span className="eyebrow">ALCANCE DE TRABAJO</span><h3>Campos y lotes asignados</h3><p>Abrí un campo para elegir todos sus lotes o solamente los que correspondan.</p></div><MapPin/></header>
      <div className="resource-access-toolbar"><div><strong>{fieldIds.size+plotIds.size}</strong><span>asignaciones directas</span></div><button type="button" disabled={!editable} onClick={selectEverything}><Check/>Seleccionar todo</button><button type="button" disabled={!editable} onClick={clearEverything}><X/>Limpiar</button></div>
      <div className="resource-tree">{fields.map(field=>{const state=fieldState(field);const open=openFields.has(field.id);return <article key={field.id} className={state.full?"is-selected":state.partial?"is-partial":""}><div className="resource-field-row"><label><input ref={input=>{if(input)input.indeterminate=state.partial}} type="checkbox" disabled={!editable} checked={state.full} onChange={event=>toggleField(field,event.target.checked)}/><span><strong>{field.name}</strong><small>{state.full?"Campo completo":state.selected?`${state.selected} de ${state.children.length} lotes`:`${state.children.length} lote${state.children.length===1?"":"s"}`}</small></span></label><button type="button" onClick={()=>toggleOpen(field.id)} aria-expanded={open} aria-label={`${open?"Cerrar":"Abrir"} ${field.name}`}><ChevronDown/></button></div>{open&&<div className="resource-lot-list">{state.children.map(plot=>{const checked=fieldIds.has(field.id)||plotIds.has(plot.id);return <label key={plot.id}><input type="checkbox" disabled={!editable} checked={checked} onChange={event=>togglePlot(field,plot,event.target.checked)}/><span><strong>{plot.name}</strong><small>{number(plot.arable_area||plot.total_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha</small></span></label>})}{!state.children.length&&<small>Este campo todavía no tiene lotes.</small>}</div>}</article>})}{!fields.length&&<div className="resource-tree-empty">No hay campos para asignar.</div>}</div>
    </section>}
    {editable&&<section className="member-profile-card permissions-card"><header><div><span className="eyebrow">PERMISOS</span><h3>Permisos personalizados</h3><p>Estos cambios tienen prioridad sobre los permisos predeterminados del rol.</p></div><Settings2/></header><div className="permission-grid">{permissionCatalog.map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" checked={Boolean(draft[key])} onChange={event=>setDraft({...draft,[key]:event.target.checked})}/></label>)}</div></section>}
    {editable&&<footer className="member-profile-actions"><button className="danger-button" onClick={onRemove}>Quitar del grupo</button><button className="settings-save" disabled={busy===member.user_id} onClick={onSave}>{busy===member.user_id?<LoaderCircle className="spin"/>:<Save/>}Guardar cambios</button></footer>}
  </div>
}
function RealTeamView({ section, groupId, members, fields, plots, currentRole, canManage, memberLimit, onSection, onSaved }: { section:"members"|"requests"|"invitations"; groupId:string; members: Member[]; fields:Field[];plots:Plot[];currentRole:string; canManage:boolean; memberLimit:number|null; onSection:(view:View)=>void; onSaved:()=>void }) {
  const [busy,setBusy]=useState("");const [message,setMessage]=useState("");const [selected,setSelected]=useState<Member|null>(null);const [draft,setDraft]=useState<Record<string,boolean>>({});const [resourceFieldIds,setResourceFieldIds]=useState<Set<string>>(new Set());const [resourcePlotIds,setResourcePlotIds]=useState<Set<string>>(new Set());
  const [requests,setRequests]=useState<PendingGroupRequest[]>([]);const [loadingRequests,setLoadingRequests]=useState(false);
  const [invitations,setInvitations]=useState<GroupInvitation[]>([]);const [inviteEmail,setInviteEmail]=useState("");const [inviteRole,setInviteRole]=useState("agronomist");const [createdLink,setCreatedLink]=useState("");
  const loadRequests=useCallback(async()=>{if(!canManage){setRequests([]);return}setLoadingRequests(true);const{data,error}=await supabase.rpc("group_pending_join_requests",{p_group_id:groupId});setLoadingRequests(false);if(error)setMessage(error.message);else setRequests((data??[])as PendingGroupRequest[])},[canManage,groupId]);
  const loadInvitations=useCallback(async()=>{if(!canManage){setInvitations([]);return}const{data,error}=await supabase.rpc("list_group_invitations",{p_group_id:groupId});if(error)setMessage(error.message);else setInvitations((data??[])as GroupInvitation[])},[canManage,groupId]);
  useEffect(()=>{void loadRequests();void loadInvitations()},[loadRequests,loadInvitations]);
  async function role(userId:string,nextRole:string){setBusy(userId);const {error}=await supabase.rpc("change_member_role",{p_group_id:groupId,p_user_id:userId,p_role:nextRole});setBusy("");if(error)setMessage(error.message);else onSaved();}
  async function remove(userId:string){if(!confirm("¿Quitar este usuario del grupo?"))return;setBusy(userId);const {error}=await supabase.rpc("remove_group_member",{p_group_id:groupId,p_user_id:userId});setBusy("");if(error)setMessage(error.message);else{setSelected(null);onSaved();}}
  function openMember(member:Member){setSelected(member);setDraft(Object.fromEntries(permissionCatalog.map(([key])=>[key,member.member_permission_overrides?.find(item=>item.permission===key)?.allowed??roleDefault(member.role,key)])));setResourceFieldIds(new Set((member.member_resource_access??[]).map(item=>item.field_id).filter((id):id is string=>Boolean(id))));setResourcePlotIds(new Set((member.member_resource_access??[]).map(item=>item.lot_id).filter((id):id is string=>Boolean(id))))}
  async function savePermissions(){if(!selected)return;setBusy(selected.user_id);setMessage("");const rows=permissionCatalog.map(([permission])=>({group_id:groupId,user_id:selected.user_id,permission,allowed:Boolean(draft[permission])}));const [permissionResult,resourceResult]=await Promise.all([supabase.from("member_permission_overrides").upsert(rows,{onConflict:"group_id,user_id,permission"}),supabase.rpc("set_member_resource_access",{p_group_id:groupId,p_user_id:selected.user_id,p_field_ids:[...resourceFieldIds],p_lot_ids:[...resourcePlotIds],p_access_level:"write"})]);setBusy("");const error=permissionResult.error??resourceResult.error;if(error)setMessage(error.message);else{setSelected(null);onSaved();}}
  async function resolveRequest(request:PendingGroupRequest,approve:boolean){setMessage("");if(approve&&memberLimit!=null&&members.length>=memberLimit){setMessage(`Tu plan permite hasta ${memberLimit} integrantes. No se modificó el equipo actual.`);return;}setBusy(request.id);const{error}=await supabase.rpc("admin_console_resolve_request",{p_request_id:request.id,p_approve:approve,p_role:request.requested_role||"producer"});setBusy("");if(error)setMessage(error.message);else{setMessage(approve?`${request.name||request.username||"El usuario"} ya forma parte del grupo.`:"Solicitud rechazada.");await Promise.all([loadRequests(),Promise.resolve(onSaved())])}}
  async function createInvitation(event:FormEvent){event.preventDefault();setMessage("");setCreatedLink("");if(memberLimit!=null&&members.length>=memberLimit){setMessage(`Tu plan permite hasta ${memberLimit} integrantes. Los miembros actuales se conservan, pero no podés sumar uno nuevo.`);return;}setBusy("invite");const{data,error}=await supabase.rpc("create_group_invitation",{p_group_id:groupId,p_email:inviteEmail.trim(),p_role:inviteRole,p_expires_days:7});setBusy("");if(error){setMessage(error.message);return}const token=String(data?.[0]?.token??"");const link=`${window.location.origin}/?invite=${encodeURIComponent(token)}`;setCreatedLink(link);setMessage("Invitación creada. Compartí el enlace con la persona indicada.");await loadInvitations()}
  async function copyInvitation(){if(!createdLink)return;await navigator.clipboard.writeText(createdLink);setMessage("Enlace copiado.")}
  async function revokeInvitation(id:string){setBusy(id);const{error}=await supabase.rpc("revoke_group_invitation",{p_invitation_id:id});setBusy("");if(error)setMessage(error.message);else{setMessage("Invitación revocada.");await loadInvitations()}}
  const invitationPanel=canManage&&section==="invitations"?<section className="team-invitations"><header><div><span className="eyebrow">NUEVA INVITACIÓN</span><h3>Invitar a una persona</h3><p>Generá un enlace individual con un rol preasignado. El acceso vence automáticamente a los 7 días.</p></div><Link2/></header><form onSubmit={createInvitation}><label>Correo de la persona<input type="email" required value={inviteEmail} onChange={event=>setInviteEmail(event.target.value)} placeholder="persona@empresa.com"/></label><label>Rol asignado<select value={inviteRole} onChange={event=>setInviteRole(event.target.value)}>{currentRole==="owner"&&<option value="admin">Administrador</option>}<option value="agronomist">Ingeniero / Agrónomo</option><option value="operator">Operario</option><option value="producer">Productor / Cliente</option></select></label><button className="settings-save" disabled={busy==="invite"}>{busy==="invite"?<LoaderCircle className="spin"/>:<UserPlus/>}Crear enlace</button></form>{createdLink&&<div className="created-invite-link"><Link2/><span><strong>Enlace listo</strong><small>{createdLink}</small></span><button onClick={()=>void copyInvitation()}><Copy/>Copiar</button></div>}{invitations.some(item=>item.status==="pending")&&<div className="pending-invites"><strong>Invitaciones pendientes</strong>{invitations.filter(item=>item.status==="pending").map(item=><article key={item.id}><Mail/><span><b>{item.email}</b><small>{roleName(item.role)} · vence {new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"short"}).format(new Date(item.expires_at))}</small></span><button disabled={busy===item.id} onClick={()=>void revokeInvitation(item.id)}>Revocar</button></article>)}</div>}</section>:null;
  if(section==="members"&&selected)return <MemberDetailPage member={selected} fields={fields} plots={plots} canManage={canManage} busy={busy} draft={draft} setDraft={setDraft} fieldIds={resourceFieldIds} setFieldIds={setResourceFieldIds} plotIds={resourcePlotIds} setPlotIds={setResourcePlotIds} onBack={()=>setSelected(null)} onRole={nextRole=>{void role(selected.user_id,nextRole);setSelected({...selected,role:nextRole})}} onRemove={()=>void remove(selected.user_id)} onSave={()=>void savePermissions()}/>;
  if(section==="invitations")return <div className="page-content team-subpage"><button className="page-back-button" onClick={()=>onSection("equipo")}><ChevronLeft/>Volver al equipo</button><PageHead title="Invitaciones" text="Generá accesos controlados para incorporar personas al equipo."/>{message&&<p className={/(creada|copiado|revocada)/i.test(message)?"save-success":"form-error"}>{message}</p>}{invitationPanel}{!canManage&&<EmptyLine text="No tenés permiso para administrar invitaciones."/>}</div>;
  if(section==="requests")return <div className="page-content team-subpage"><button className="page-back-button" onClick={()=>onSection("equipo")}><ChevronLeft/>Volver al equipo</button><PageHead title="Solicitudes de ingreso" text="Revisá y resolvé las solicitudes de acceso a la organización."/>{message&&<p className={/(forma parte|rechazada)/i.test(message)?"save-success":"form-error"}>{message}</p>}{canManage?<section className="team-requests standalone"><header><div><span className="eyebrow">ACCESOS PENDIENTES</span><h3>Solicitudes por revisar</h3><p>Verificá los datos y el rol solicitado antes de habilitar el acceso.</p></div><span className="request-count">{loadingRequests?<LoaderCircle className="spin"/>:requests.length}</span></header>{requests.length?<div>{requests.map(request=><article key={request.id}><div className="member-avatar">{initials(request.name||request.username||"Usuario")}</div><div className="request-person"><strong>{request.name||request.username||"Usuario"}</strong><span>{request.username?`@${request.username} · `:""}{request.email}</span><small>Solicita ingresar como {roleName(request.requested_role||"producer")} · {new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"short",year:"numeric"}).format(new Date(request.created_at))}</small>{request.phone&&<small>{request.phone}</small>}</div><div className="request-actions"><button className="request-reject" disabled={busy===request.id} onClick={()=>void resolveRequest(request,false)}><X/>Rechazar</button><button className="request-accept" disabled={busy===request.id} onClick={()=>void resolveRequest(request,true)}>{busy===request.id?<LoaderCircle className="spin"/>:<Check/>}Aceptar</button></div></article>)}</div>:!loadingRequests&&<div className="requests-empty"><Check/><span><strong>Todo al día</strong><small>No hay solicitudes pendientes.</small></span></div>}</section>:<EmptyLine text="No tenés permiso para administrar solicitudes."/>}</div>;
  if(section==="members")return <div className="page-content team-directory-page"><PageHead title="Equipo" text="Integrantes, roles y permisos del grupo."/>{canManage&&<div className="team-shortcuts"><button onClick={()=>onSection("solicitudes")}><span><Users/></span><div><strong>Solicitudes de ingreso</strong><small>{loadingRequests?"Actualizando…":requests.length?`${requests.length} pendiente${requests.length===1?"":"s"}`:"No hay solicitudes pendientes"}</small></div><ChevronRight/></button><button onClick={()=>onSection("invitaciones")}><span><Link2/></span><div><strong>Invitaciones por enlace</strong><small>Crear, copiar y revocar accesos directos</small></div><ChevronRight/></button></div>}{message&&<p className="form-error">{message}</p>}<section className="content-card contractor-directory team-directory"><header><div className="settings-title"><Users/><div><h3>{members.length} integrante{members.length===1?"":"s"}</h3><p>Personas activas y acceso operativo dentro del grupo.</p></div></div></header><div className="contractor-directory-list team-directory-list">{members.map(member=>{const profile=relation(member.profiles);const memberName=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||profile?.username||"Usuario";return <button key={member.user_id} onClick={()=>openMember(member)}><ProfileAvatar profile={profile} name={memberName}/><div><strong>{memberName}</strong><small>{roleName(member.role)} · {profile?.email??"Sin correo visible"}</small></div><span>Ver perfil</span><ChevronRight/></button>})}{!members.length&&<EmptyLine text="No hay miembros visibles."/>}</div></section></div>;
  return <div className="page-content"><PageHead title="Equipo" text="Miembros, solicitudes, roles y permisos del grupo."/>{invitationPanel}{message&&<p className={/(forma parte|rechazada|creada|copiado|revocada)/i.test(message)?"save-success":"form-error"}>{message}</p>}{canManage&&<section className="team-requests"><header><div><span className="eyebrow">SOLICITUDES DE INGRESO</span><h3>Personas esperando aprobación</h3><p>Revisá sus datos antes de incorporarlas al grupo.</p></div><span className="request-count">{loadingRequests?<LoaderCircle className="spin"/>:requests.length}</span></header>{requests.length?<div>{requests.map(request=><article key={request.id}><div className="member-avatar">{initials(request.name||request.username||"Usuario")}</div><div className="request-person"><strong>{request.name||request.username||"Usuario"}</strong><span>{request.username?`@${request.username} · `:""}{request.email}</span><small>Solicita ingresar como {roleName(request.requested_role||"producer")} · {new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"short",year:"numeric"}).format(new Date(request.created_at))}</small>{request.phone&&<small>{request.phone}</small>}</div><div className="request-actions"><button className="request-reject" disabled={busy===request.id} onClick={()=>void resolveRequest(request,false)}><X/>Rechazar</button><button className="request-accept" disabled={busy===request.id} onClick={()=>void resolveRequest(request,true)}>{busy===request.id?<LoaderCircle className="spin"/>:<Check/>}Aceptar</button></div></article>)}</div>:!loadingRequests&&<div className="requests-empty"><Check/><span><strong>Todo al día</strong><small>No hay solicitudes pendientes.</small></span></div>}</section>}<div className="team-section-title"><div><span className="eyebrow">INTEGRANTES ACTIVOS</span><h3>{members.length} miembro{members.length===1?"":"s"}</h3></div></div><div className="team-grid">{members.map(member=>{const profile=relation(member.profiles);const name=[profile?.first_name,profile?.last_name].filter(Boolean).join(" ")||profile?.username||"Usuario";return <button className="member-card member-card-button" key={member.user_id} onClick={()=>openMember(member)}><ProfileAvatar profile={profile} name={name}/><div><h3>{name}</h3><p>{roleName(member.role)}</p></div><span className="member-active"><i/>Activo</span><div className="access"><small>Cuenta</small><strong>{profile?.email??"Sin correo visible"}</strong></div><ChevronRight/></button>})}{!members.length&&<EmptyLine text="No hay miembros visibles."/>}</div>{selected&&<div className="record-detail-backdrop"><article className="permission-sheet"><header><div><span className="eyebrow">MIEMBRO DEL EQUIPO</span><h2>{[relation(selected.profiles)?.first_name,relation(selected.profiles)?.last_name].filter(Boolean).join(" ")}</h2><p>{relation(selected.profiles)?.email}</p></div><button className="icon-button" onClick={()=>setSelected(null)}><X/></button></header><label>Rol<select disabled={!canManage||selected.role==="owner"||busy===selected.user_id} value={selected.role} onChange={e=>{void role(selected.user_id,e.target.value);setSelected({...selected,role:e.target.value})}}>{["admin","agronomist","operator","monitor","producer","member"].map(r=><option key={r} value={r}>{roleName(r)}</option>)}</select></label><section><h3>Permisos personalizados</h3><p>Estos cambios tienen prioridad sobre los permisos predeterminados del rol.</p><div className="permission-grid">{permissionCatalog.map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" disabled={!canManage||selected.role==="owner"} checked={Boolean(draft[key])} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/></label>)}</div></section>{canManage&&selected.role!=="owner"&&<footer><button className="danger-button" onClick={()=>void remove(selected.user_id)}>Quitar del grupo</button><button className="settings-save" onClick={()=>void savePermissions()}><Save/>Guardar permisos</button></footer>}</article></div>}</div>;
}

function GroupBrowser({ memberships, onClose, onMembershipChanged }: {
  memberships: Membership[]; onClose: () => void; onMembershipChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GroupDiscovery[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [requestedRole, setRequestedRole] = useState("producer");
  const [images, setImages] = useState<Record<string, string>>({});
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");
  const [browserError, setBrowserError] = useState("");
  const [creating,setCreating]=useState(false);
  const [newGroup,setNewGroup]=useState({name:"",description:"",cuit:""});
  const [newGroupImage,setNewGroupImage]=useState<File|null>(null);
  const [newGroupImageUrl,setNewGroupImageUrl]=useState("");

  useEffect(()=>{if(!newGroupImage){setNewGroupImageUrl("");return}const url=URL.createObjectURL(newGroupImage);setNewGroupImageUrl(url);return()=>URL.revokeObjectURL(url)},[newGroupImage]);

  const loadRequests = useCallback(async () => {
    const response = await supabase.from("group_join_requests")
      .select("id,group_id,status,requested_role,created_at,groups(id,name,description)")
      .order("created_at", { ascending: false });
    if (!response.error) setRequests((response.data ?? []) as unknown as GroupJoinRequest[]);
  }, []);

  const searchGroups = useCallback(async (text: string) => {
    const normalizedQuery = text.trim();
    if (normalizedQuery.length < 2) {
      setResults([]);
      setSelectedId("");
      setHasSearched(false);
      setBrowserError("Escribí al menos 2 caracteres del nombre o CUIT.");
      return;
    }
    setLoadingGroups(true);
    setHasSearched(true);
    setBrowserError("");
    const response = await supabase.rpc("search_groups_for_join", { p_query: normalizedQuery });
    if (response.error) {
      setBrowserError(response.error.message);
      setResults([]);
      setLoadingGroups(false);
      return;
    }
    const rows = (response.data ?? []) as GroupDiscovery[];
    setResults(rows);
    setSelectedId(current => rows.some(row => row.group_id === current) ? current : rows[0]?.group_id ?? "");
    setLoadingGroups(false);
    const paths = rows.filter(row => row.image_path && !images[row.group_id]);
    if (paths.length) {
      const signed = await Promise.all(paths.map(async row => {
        const path = row.image_path as string;
        if (/^https?:\/\//.test(path)) return [row.group_id, path] as const;
        const result = await supabase.storage.from("group-images").createSignedUrl(path, 60 * 30);
        return [row.group_id, result.data?.signedUrl ?? ""] as const;
      }));
      setImages(current => ({ ...current, ...Object.fromEntries(signed.filter(([, value]) => value)) }));
    }
  }, [images]);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const selected = results.find(row => row.group_id === selectedId) ?? null;
  const isMember = selected ? selected.is_member || memberships.some(item => item.group_id === selected.group_id) : false;
  const pendingRequest = selected ? requests.find(item => item.group_id === selected.group_id && item.status === "pending") : null;
  const isPending = Boolean(selected?.has_pending_request || pendingRequest);

  const sendRequest = async () => {
    if (!selected || isMember || isPending) return;
    setWorkingId(selected.group_id); setBrowserError(""); setMessage("");
    const response = await supabase.rpc("request_group_join", { p_group_id: selected.group_id, p_requested_role: requestedRole });
    if (response.error) setBrowserError(response.error.message);
    else {
      setResults(current => current.map(row => row.group_id === selected.group_id ? { ...row, has_pending_request: true } : row));
      setMessage(`Solicitud enviada a ${selected.name}.`);
      await loadRequests();
    }
    setWorkingId("");
  };

  const cancelRequest = async () => {
    if (!selected || !pendingRequest) return;
    setWorkingId(selected.group_id); setBrowserError(""); setMessage("");
    const response = await supabase.rpc("cancel_join_request", { p_request_id: pendingRequest.id });
    if (response.error) setBrowserError(response.error.message);
    else {
      setRequests(current => current.map(item => item.id === pendingRequest.id ? { ...item, status: "cancelled" } : item));
      setResults(current => current.map(row => row.group_id === selected.group_id ? { ...row, has_pending_request: false } : row));
      setMessage("Solicitud cancelada.");
    }
    setWorkingId("");
  };

  const createGroup=async(event:FormEvent)=>{event.preventDefault();setWorkingId("create");setBrowserError("");if(newGroupImage&&newGroupImage.size>5*1024*1024){setWorkingId("");setBrowserError("La imagen no puede superar los 5 MB.");return}const{data,error}=await supabase.rpc("create_group",{p_name:newGroup.name.trim(),p_description:newGroup.description.trim(),p_cuit:newGroup.cuit.replace(/\D/g,"")});if(error){setWorkingId("");setBrowserError(error.message);return}const created=relation(data as Group|Group[]|null);if(created?.id&&newGroupImage){const extension=(newGroupImage.name.split(".").pop()||"jpg").toLowerCase();const imagePath=`${created.id}/group-${Date.now()}.${extension}`;const uploaded=await supabase.storage.from("group-images").upload(imagePath,newGroupImage,{contentType:newGroupImage.type||"image/jpeg",upsert:false});if(uploaded.error){setWorkingId("");setBrowserError(`El grupo se creó, pero no pudimos guardar la foto: ${uploaded.error.message}`);await onMembershipChanged();return}const updated=await supabase.from("groups").update({image_path:imagePath}).eq("id",created.id);if(updated.error){setWorkingId("");setBrowserError(`El grupo se creó, pero no pudimos vincular la foto: ${updated.error.message}`);await onMembershipChanged();return}}setWorkingId("");setMessage("Grupo creado. Ya podés empezar a configurarlo.");setNewGroup({name:"",description:"",cuit:""});setNewGroupImage(null);await onMembershipChanged();setCreating(false);};

  return <div className="record-detail-backdrop group-browser-backdrop">
    <section className="group-browser">
      <header className="group-browser-head"><div><span className="eyebrow">ORGANIZACIONES</span><h2>Buscar un grupo de trabajo</h2><p>Encontrá una organización por nombre o CUIT y solicitá acceso de forma segura.</p></div><div><button className="soft-button create-group-shortcut" onClick={()=>setCreating(value=>!value)}><Plus/>{creating?"Volver a buscar":"Crear grupo"}</button><button className="soft-button" onClick={onMembershipChanged}><RotateCcw/>Actualizar mis grupos</button><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X/></button></div></header>
      <form className="group-search" onSubmit={event => { event.preventDefault(); void searchGroups(query); }}><Search/><input value={query} onChange={event => { setQuery(event.target.value); setResults([]); setSelectedId(""); setHasSearched(false); setBrowserError(""); }} placeholder="Buscar por nombre de organización o CUIT" autoFocus/><button type="submit">Buscar</button></form>
      {message && <div className="group-message success"><Check/>{message}</div>}
      {browserError && <div className="group-message error"><X/>{browserError}</div>}
      {creating&&<form className="create-group-panel" onSubmit={createGroup}><div className="create-group-intro"><div className="create-group-image-preview">{newGroupImageUrl?<img src={newGroupImageUrl} alt="Vista previa del grupo"/>:<Tractor/>}</div><div><span className="eyebrow">NUEVO ESPACIO DE TRABAJO</span><h3>Creá el grupo de tu empresa</h3><p>Vas a quedar registrado como dueño y después podrás invitar al equipo.</p><label className="create-group-image-button"><UploadCloud/>Elegir foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>setNewGroupImage(event.target.files?.[0]??null)}/></label></div></div><label>Nombre del grupo<input required minLength={2} value={newGroup.name} onChange={event=>setNewGroup({...newGroup,name:event.target.value})} placeholder="Ej. Establecimiento La Esperanza"/></label><label>CUIT<input required inputMode="numeric" value={newGroup.cuit} onChange={event=>setNewGroup({...newGroup,cuit:event.target.value.replace(/\D/g,"").slice(0,11)})} placeholder="11 dígitos"/></label><label className="wide">Descripción<textarea value={newGroup.description} onChange={event=>setNewGroup({...newGroup,description:event.target.value})} placeholder="Contá brevemente a qué se dedica el grupo"/></label><button className="group-primary" disabled={workingId==="create"}>{workingId==="create"?<LoaderCircle className="spin"/>:<Plus/>}Crear grupo</button></form>}
      {!creating&&<>
      <div className="group-browser-layout">
        <div className="group-results">
          <div className="group-results-title"><strong>{hasSearched ? "Resultados" : "Organizaciones"}</strong>{hasSearched && <small>{results.length} resultado{results.length===1?"":"s"}</small>}</div>
          {loadingGroups ? <div className="group-loading"><LoaderCircle className="spin"/>Buscando grupos…</div> : !hasSearched ? <div className="group-empty"><Search/><strong>Buscá una organización</strong><small>Ingresá al menos dos caracteres del nombre o el CUIT.</small></div> : results.length === 0 ? <div className="group-empty"><Search/><strong>No encontramos grupos</strong><small>Probá con otro nombre o CUIT.</small></div> : results.map(row => {
            const member = row.is_member || memberships.some(item => item.group_id === row.group_id);
            const pending = row.has_pending_request || requests.some(item => item.group_id === row.group_id && item.status === "pending");
            return <button type="button" key={row.group_id} className={`group-result-card ${selectedId === row.group_id ? "active" : ""}`} onClick={() => { setSelectedId(row.group_id); setMessage(""); setBrowserError(""); }}>
              <div className="group-result-image">{images[row.group_id] ? <img src={images[row.group_id]} alt=""/> : <Tractor/>}</div>
              <div><strong>{row.name}</strong><small>{row.description || "Grupo de trabajo agrícola"}</small><span>{member ? "Ya sos miembro" : pending ? "Solicitud pendiente" : "Disponible para solicitar acceso"}</span></div><ChevronRight/>
            </button>;
          })}
        </div>
        <aside className="group-detail">
          {!selected ? <div className="group-empty"><Users/><strong>Seleccioná un grupo</strong><small>Vas a poder revisar sus datos antes de solicitar acceso.</small></div> : <>
            <div className="group-detail-cover">{images[selected.group_id] ? <img src={images[selected.group_id]} alt={`Foto de ${selected.name}`}/> : <div><Tractor/></div>}<span className={isMember ? "member" : isPending ? "pending" : "open"}>{isMember ? "Sos miembro" : isPending ? "Solicitud pendiente" : "Acepta solicitudes"}</span></div>
            <div className="group-detail-copy"><span className="eyebrow">GRUPO</span><h3>{selected.name}</h3><p>{selected.description || "Este grupo todavía no agregó una descripción."}</p></div>
            <div className="group-facts"><div><small>Creado por</small><strong>{selected.creator_name || selected.creator_username || "Equipo administrador"}</strong></div><div><small>CUIT</small><strong>{selected.cuit || "No informado"}</strong></div></div>
            {!isMember && !isPending && <label className="group-role-picker"><span>Quiero ingresar como</span><select value={requestedRole} onChange={event => setRequestedRole(event.target.value)}><option value="producer">Productor / Cliente</option><option value="agronomist">Ingeniero / Agrónomo</option><option value="operator">Operador</option></select><small>El administrador podrá ajustar tu rol y permisos al aceptarte.</small></label>}
            {isMember ? <button className="group-primary disabled" disabled><Check/>Ya pertenecés a este grupo</button> : isPending ? <><button className="group-primary disabled" disabled><LoaderCircle/>Solicitud pendiente de aprobación</button>{pendingRequest && <button className="group-cancel" onClick={() => void cancelRequest()} disabled={workingId === selected.group_id}>Cancelar solicitud</button>}</> : <button className="group-primary" onClick={() => void sendRequest()} disabled={workingId === selected.group_id}>{workingId === selected.group_id ? <LoaderCircle className="spin"/> : <ArrowRight/>}Enviar solicitud</button>}
          </>}
        </aside>
      </div>
      </>}
    </section>
  </div>;
}

function Brand() {
  return <div className="brand"><img className="brand-logo brand-logo-symbol" src="/favicon.svg" alt="Growr360"/><div><strong>Growr<span>360</span></strong><small>Gestión agrícola</small></div></div>;
}
function LoadingScreen({ text }: { text: string }) { return <div className="loading-screen"><img className="splash-logo" src="/favicon.svg" alt="Growr360"/><LoaderCircle className="spin"/><strong>{text}</strong></div>; }
function EmptyWorkspace({ onGroups }: { onGroups: () => void }) { return <div className="empty-workspace"><Users/><h2>Tu cuenta todavía no tiene un grupo activo</h2><p>Buscá tu empresa o grupo de trabajo y enviá una solicitud de ingreso. Cuando te acepten, aparecerá acá automáticamente.</p><button onClick={onGroups}><Search/>Buscar grupos</button></div>; }
function EmptyLine({ text }: { text: string }) { return <div className="empty-line">{text}</div>; }
function PageHead({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="page-head"><div><h2>{title}</h2><p>{text}</p></div>{action}</div>; }
function Stat({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof MapPin }) { return <div className="stat-card"><div><Icon/></div><section><small>{label}</small><strong>{value}</strong><p>{detail}</p></section></div>; }
function Kpi({ label, value }: { label: string; value: string }) { return <div className="kpi"><small>{label}</small><strong>{value}</strong><span className="positive">Datos reales</span></div>; }
function subtitle(view: View) { return ({ campos: "Estructura territorial y productiva", contratistas:"Directorio operativo del grupo", registros: "Actividad sincronizada del equipo", monitoreos:"Seguimiento agronómico", napas:"Seguimiento de profundidad", campanas: "Ciclos productivos", reportes: "Análisis del grupo activo", equipo: "Miembros, roles y permisos", solicitudes:"Ingresos pendientes al grupo", invitaciones:"Accesos directos por enlace", mas:"Catálogos y herramientas", configuracion: "Preferencias personales", grupo:"Identidad y datos del grupo", planes:"Plan, límites y consumo", mapa: "" } as Record<View, string>)[view]; }
function formTitle(value:string){return({field:"Crear campo",campaign:"Crear campaña",client:"Crear cliente",contractor:"Nuevo contratista",record:"Crear registro"}as Record<string,string>)[value]??"Nueva alta";}
function cap(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "G"; }
function roleName(role?: string) { return ({ owner: "Propietario", admin: "Administrador", agronomist: "Ingeniero / Agrónomo", operator: "Operador", monitor: "Monitoreador", producer: "Productor", member: "Miembro" } as Record<string, string>)[role ?? ""] ?? cap(role ?? "Miembro"); }
function recordType(type: string) { return ({ sowing: "Siembra", spraying: "Pulverización", fertilization: "Fertilización", harvest: "Cosecha", work: "Roturación", monitoring: "Monitoreo", napa: "Napa", soil_analysis: "Análisis de suelo", expense: "Gasto", other: "Otros" } as Record<string, string>)[type] ?? cap(type); }
function formatDate(value: string) {
  if (!value) return "";
  const raw = String(value).trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(dateOnly ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function sum(values: number[]) { return values.reduce((total, value) => total + value, 0); }
function plotColor(plot: Plot, layer: string) { if (layer === "prioridad") return plot.priority_color || "#718078"; return plot.cropColor || "#77847e"; }
function recordCrop(row: RecordRow) {
  const details = recordData(row);
  return String(details.crop ?? details.cultivo ?? details.crop_name ?? "");
}
function recordData(row: RecordRow) {
  const relationNames = ["sowing_records", "spraying_records", "fertilization_records", "harvest_records", "work_records", "monitoring_records", "expense_records", "other_records"] as const;
  const embedded = relationNames.map(name => relation(row[name])?.data).find(Boolean) ?? {};
  return { ...embedded, ...(row.details ?? {}), ...(row.observations?.trim() ? { observations: row.observations.trim() } : {}) } as Record<string, unknown>;
}
function effectiveRecordType(row:RecordRow){
  if(row.record_type!=="other")return row.record_type;
  const kind=normalizeText(String(recordData(row).record_kind??""));
  if(kind==="water table"||kind==="water_table"||kind==="napa")return"napa";
  if(kind==="soil analysis"||kind==="soil_analysis"||kind==="analisis de suelo")return"soil_analysis";
  return"other";
}
const DETAIL_LABELS:Record<string,string>={
  crop:"Cultivo",cultivo:"Cultivo",crop_name:"Cultivo",title:"Tipo de registro",observations:"Observaciones",
  variety:"Variedad",row_distance:"Distancia entre surcos",seeding_density:"Densidad de siembra",seed_density:"Densidad de siembra",
  application_volume:"Volumen de aplicación",target:"Objetivo",weather:"Condiciones climáticas",applicator:"Aplicador",
  method:"Método de aplicación",work_type:"Tipo de roturación",operator:"Operador",price_per_ha:"Precio por hectárea",
  harvested_area:"Superficie cosechada",total_production:"Producción total",yield_per_ha:"Rendimiento por hectárea",humidity:"Humedad",losses:"Pérdidas",destination:"Destino del grano",estimated_income:"Ingreso total",
  water_table_depth:"Profundidad de napa",phenological_state:"Estado fenológico",monitoring_priority:"Importancia",
  weeds:"Malezas",custom_fine_weed:"Otra maleza de hoja fina",custom_broad_weed:"Otra maleza de hoja ancha",weed_levels:"Nivel de infestación por maleza",insects:"Insectos",insect_levels:"Nivel por insecto",diseases:"Enfermedades",disease_levels:"Nivel por enfermedad",plant_count:"Conteo de plantas",plant_count_unit:"Unidad del conteo",
  labor_cost_per_ha:"Costo de labor por hectárea",labor_cost:"Costo de labor",application_cost_per_ha:"Costo de aplicación por hectárea",application_cost:"Costo de aplicación",harvest_cost_per_ha:"Costo de cosecha por hectárea",total_cost:"Costo total",inputs_total:"Costo de insumos",input_count:"Cantidad de insumos",
  soil_sample_count:"Cantidad de muestras",sample_depth:"Profundidad de muestreo",depth_from:"Profundidad desde",depth_to:"Profundidad hasta",sampling_method:"Método de muestreo",laboratory:"Laboratorio",organic_matter:"Materia orgánica",ph:"pH",phosphorus:"Fósforo",nitrogen:"Nitrógeno",sulfur:"Azufre",zinc:"Zinc",nitrate:"Nitratos",no3:"NO3",potassium:"Potasio",cec:"CIC",conductivity:"Conductividad eléctrica",ec:"Conductividad eléctrica",recommendations:"Recomendaciones",
  gps_latitude:"Latitud GPS",gps_longitude:"Longitud GPS",gps_accuracy_m:"Precisión GPS",gps_captured_at:"Fecha y hora de captura GPS",gps_status:"Verificación de ubicación",
  name:"Nombre",dose:"Dosis por hectárea",price:"Precio unitario",unit:"Unidad",quantity:"Cantidad",responsible:"Responsable",machinery:"Maquinaria",contractor:"Contratista"
};
function visibleDetails(details:Record<string,unknown>){return Object.entries(details).filter(([key,value])=>key!=="record_kind"&&!key.endsWith("_id")&&key!=="id"&&value!==null&&value!=="")}
const DETAIL_WORDS:Record<string,string>={application:"aplicación",volume:"volumen",captured:"captura",status:"estado",accuracy:"precisión",latitude:"latitud",longitude:"longitud",date:"fecha",time:"hora",area:"superficie",cost:"costo",total:"total",count:"cantidad",density:"densidad",distance:"distancia",row:"surco",seed:"semilla",production:"producción",yield:"rendimiento",harvest:"cosecha",work:"labor",price:"precio",weather:"clima",method:"método",type:"tipo",priority:"importancia",level:"nivel",notes:"notas",unit:"unidad",from:"desde",to:"hasta",per:"por",ha:"hectárea",at:""};
function fallbackDetailLabel(key:string){return cap(key.split("_").map(word=>DETAIL_WORDS[word]??word).filter(Boolean).join(" "));}
function detailLabel(key:string){const soil=key.match(/^soil_sample_(\d+)_(.+)$/);if(soil)return `Muestra ${Number(soil[1])+1} · ${DETAIL_LABELS[soil[2]]||fallbackDetailLabel(soil[2])}`;const input=key.match(/^input_(\d+)_(.+)$/);if(input)return `Insumo ${Number(input[1])+1} · ${DETAIL_LABELS[input[2]]||fallbackDetailLabel(input[2])}`;return DETAIL_LABELS[key]||fallbackDetailLabel(key);}
function translatedDetailText(value:unknown){const text=String(value??"");const translations:Record<string,string>={"custom fine weed":"Otra maleza de hoja fina","custom_fine_weed":"Otra maleza de hoja fina","custom broad weed":"Otra maleza de hoja ancha","custom_broad_weed":"Otra maleza de hoja ancha","custom weed":"Otra maleza","custom_weed":"Otra maleza"};return text.split(",").map(part=>translations[normalizeText(part)]??part.trim()).join(", ")}
function SeverityDetail({value}:{value:unknown}){const entries=Object.entries(parseSeverityValue(value));if(!entries.length)return <span>Sin niveles informados</span>;return <span className="severity-detail-list">{entries.map(([name,level])=><span key={name} style={{"--severity":severityColor(level)} as React.CSSProperties}><i/>{translatedDetailText(name)}<b>{level}</b></span>)}</span>}
function ImportanceDetail({value}:{value:unknown}){const level=Math.max(1,Math.min(5,Math.round(number(value as string|number)||3)));const label=["Baja","Moderada","Media","Alta","Crítica"][level-1];return <span className="importance-visual" style={{"--severity":severityColor(level)} as React.CSSProperties}><i/><span><strong>{label}</strong><small>Nivel {level} de 5</small></span></span>}
function formatDetailValue(key:string,value:unknown){if(key==="monitoring_priority")return <ImportanceDetail value={value}/>;if(key.endsWith("_levels"))return <SeverityDetail value={value}/>;if(typeof value==="boolean")return value?"Sí":"No";if(["total_production","production","yield_per_ha"].includes(key)&&String(value).trim()!=="")return number(value as string|number).toLocaleString("es-AR",{maximumFractionDigits:0});if(key.includes("depth")&&String(value).trim()!=="")return `${number(value as string|number).toLocaleString("es-AR",{maximumFractionDigits:2})} cm`;if(key.endsWith("_at")){const date=new Date(String(value));if(!Number.isNaN(date.getTime()))return new Intl.DateTimeFormat("es-AR",{dateStyle:"medium",timeStyle:"short"}).format(date);}return translatedDetailText(value);}
function formatNapaDepth(value:unknown){return `${number(value as string|number).toLocaleString("es-AR",{maximumFractionDigits:2})} cm`;}
function attachmentSize(value?:number|null){if(!value)return"Archivo adjunto";if(value<1024*1024)return`${Math.max(1,Math.round(value/1024))} KB`;return`${(value/(1024*1024)).toLocaleString("es-AR",{maximumFractionDigits:1})} MB`;}
function spanishError(reason:unknown){const message=reason instanceof Error?reason.message:typeof reason==="object"&&reason&&"message" in reason?String((reason as {message:unknown}).message):String(reason??"");if(/jwt|token.*expir|session.*expir/i.test(message))return"Tu sesión venció. La renovamos cuando fue posible; si el problema continúa, cerrá sesión y volvé a ingresar.";return message||"No se pudo completar la operación.";}
function defaultCropColor(name: string) {
  const palette = ["#8E24AA", "#7CB342", "#F4511E", "#FDD835", "#FB8C00", "#1E88E5", "#31E048", "#43A047", "#00897B", "#D32F2F", "#F9A825", "#6D4C41", "#3949AB", "#00ACC1"];
  let hash = 0; for (const char of name.toLowerCase()) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return palette[Math.abs(hash) % palette.length];
}
function normalizeText(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es"); }
function monitoringPriorityColor(level: number) { return (["#2E7D32", "#7CB342", "#FBC02D", "#F57C00", "#D32F2F"])[Math.max(1, Math.min(5, level)) - 1]; }
function normalizePriorityColor(value?: string | null) { const color = String(value ?? "").toUpperCase(); return ({ RED: "#D32F2F", YELLOW: "#FBC02D", GREEN: "#388E3C" } as Record<string,string>)[color] ?? color; }
function normalizeCropName(value: string) { return normalizeText(value); }
function plotOperationalSummary(plot:Plot,records:RecordRow[]){
  const ordered=[...records].filter(row=>row.plot_id===plot.id).sort((a,b)=>String(b.record_date).localeCompare(String(a.record_date)));
  const sowing=ordered.find(row=>effectiveRecordType(row)==="sowing");
  const sowingData=sowing?recordData(sowing):{};
  const harvest=ordered.find(row=>effectiveRecordType(row)==="harvest");
  const harvestData=harvest?recordData(harvest):{};
  const cropRecord=ordered.find(row=>recordCrop(row));
  let yieldPerHa="";
  if(harvest){
    const area=number((harvestData.harvested_area??harvest.worked_area) as string|number);
    const production=number(harvestData.total_production as string|number);
    const yieldValue=number(harvestData.yield_per_ha as string|number)||(area>0?production/area:0);
    const unit=String(harvestData.unit||"kg").trim()||"kg";
    if(yieldValue>0)yieldPerHa=`${yieldValue.toLocaleString("es-AR",{maximumFractionDigits:1})} ${unit}/ha`;
  }
  return {campaign:relation(ordered[0]?.campaigns)?.name||"",lastCrop:cropRecord?recordCrop(cropRecord):"",sowingDate:sowing?.record_date||"",sowingVariety:String(sowingData.variety||"").trim(),yieldPerHa,lastActivity:ordered[0]||null};
}
function buildPlotMapLabel(plot:MapPlot,records:RecordRow[],assignments:PlotCampaign[],campaigns:Campaign[],preferredCampaignId:string|undefined,fields:PlotLabelField[]){
  const plotRecords=records.filter(row=>row.plot_id===plot.id).sort((a,b)=>String(b.record_date).localeCompare(String(a.record_date)));
  const preferredRecords=preferredCampaignId?plotRecords.filter(row=>row.campaign_id===preferredCampaignId):plotRecords;
  const contextual=preferredRecords.length?preferredRecords:plotRecords;
  const sowing=plotRecords.find(row=>effectiveRecordType(row)==="sowing");
  const sowingData=sowing?recordData(sowing):{};
  const harvest=plotRecords.find(row=>effectiveRecordType(row)==="harvest");
  const harvestData=harvest?recordData(harvest):{};
  const lastCropRecord=plotRecords.find(row=>recordCrop(row));
  const assignment=assignments.find(item=>item.plot_id===plot.id&&item.campaign_id===preferredCampaignId)||assignments.find(item=>item.plot_id===plot.id&&relation(item.campaigns)?.status==="active")||assignments.find(item=>item.plot_id===plot.id);
  const campaignName=relation(contextual[0]?.campaigns)?.name||relation(assignment?.campaigns)?.name||campaigns.find(item=>item.id===preferredCampaignId)?.name||"";
  let yieldText="";
  if(harvest){const area=number((harvestData.harvested_area??harvest.worked_area) as string|number);const production=number(harvestData.total_production as string|number);const value=number(harvestData.yield_per_ha as string|number)||(area>0?production/area:0);const unit=String(harvestData.unit||"kg").trim()||"kg";if(value>0)yieldText=`${value.toLocaleString("es-AR",{maximumFractionDigits:1})} ${unit}/ha`;}
  const values:Record<PlotLabelField,string>={plot_name:plot.name,field_name:plot.fieldName,campaign:campaignName,sowing_variety:String(sowingData.variety||"").trim()?String(sowingData.variety).trim():"",sowing_date:sowing?.record_date?formatDate(sowing.record_date):"",last_crop:(lastCropRecord?recordCrop(lastCropRecord):plot.cropName)||"",area:`${number(plot.arable_area).toLocaleString("es-AR",{maximumFractionDigits:2})} ha`,yield_per_ha:yieldText};
  return fields.map(field=>values[field]).filter(Boolean).join("\n")||plot.name;
}
function resolvePlotCrops(plots: Plot[], records: RecordRow[], assignments: PlotCampaign[], colors: CropColor[], crops: Crop[], preferredCampaignId?: string) {
  return plots.map(plot => {
    const plotRecords = records.filter(row => row.plot_id === plot.id && recordCrop(row));
    const campaignRecords = preferredCampaignId ? plotRecords.filter(row => row.campaign_id === preferredCampaignId) : plotRecords;
    const newest = campaignRecords.sort((a, b) => String(b.record_date).localeCompare(String(a.record_date)))[0];
    const preferredAssignment = assignments.find(item => item.plot_id === plot.id && item.campaign_id === preferredCampaignId);
    const activeAssignment = preferredAssignment ?? assignments.find(item => item.plot_id === plot.id && relation(item.campaigns)?.status === "active") ?? assignments.find(item => item.plot_id === plot.id);
    const name = newest ? recordCrop(newest) : relation(activeAssignment?.crops)?.name ?? null;
    // Android resuelve el color por el primer cultivo del catálogo cuyo nombre coincide.
    // Mantener esta misma regla evita que una asignación duplicada use otra paleta en web.
    const catalogMatch = crops.find(crop => name && crop.name.trim().toLocaleLowerCase("es") === name.trim().toLocaleLowerCase("es"));
    const cropId = catalogMatch?.id;
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

