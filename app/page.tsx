"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  Activity, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound,
  CloudSun, Droplets, FileText, Filter, Grid2X2, Layers3, Leaf, Map, MapPin, Menu,
  MoreHorizontal, Plus, RotateCcw, Satellite, Search, Settings2, Sparkles, Sprout,
  Tractor, TrendingUp, Users, X
} from "lucide-react";

type View = "mapa" | "campos" | "registros" | "reportes" | "equipo";
type Lot = { id: string; name: string; field: string; crop: string; area: number; color: string; priority: "Alta" | "Media" | "Baja"; coordinates: number[][][] };
type RecordRow = { id: number; type: string; crop: string; lot: string; field: string; date: string; author: string };

const lots: Lot[] = [
  { id: "l1", name: "Lote 1", field: "Don Pablo", crop: "Trigo", area: 49.22, color: "#f5c542", priority: "Alta", coordinates: [[[-60.030,-34.894],[-60.021,-34.889],[-60.015,-34.898],[-60.024,-34.904],[-60.030,-34.894]]] },
  { id: "l2", name: "La Esquina", field: "Don Pablo", crop: "Soja de primera", area: 36.84, color: "#49a553", priority: "Media", coordinates: [[[-60.020,-34.907],[-60.013,-34.901],[-60.006,-34.908],[-60.014,-34.914],[-60.020,-34.907]]] },
  { id: "l3", name: "Norte", field: "El Ñato", crop: "Camelina", area: 28.1, color: "#9a39b8", priority: "Baja", coordinates: [[[-60.040,-34.903],[-60.031,-34.899],[-60.026,-34.908],[-60.035,-34.913],[-60.040,-34.903]]] }
];

const records: RecordRow[] = [
  { id: 1, type: "Monitoreo", crop: "Trigo", lot: "Lote 1", field: "Don Pablo", date: "Hoy · 16:42", author: "Benicio Iglesias" },
  { id: 2, type: "Pulverización", crop: "Soja de primera", lot: "La Esquina", field: "Don Pablo", date: "Hoy · 11:10", author: "Juan Campos" },
  { id: 3, type: "Napa", crop: "—", lot: "Norte", field: "El Ñato", date: "Ayer · 17:30", author: "Benicio Iglesias" },
  { id: 4, type: "Análisis de suelo", crop: "Trigo", lot: "Lote 1", field: "Don Pablo", date: "28 jul · 09:12", author: "Lucía Méndez" }
];

const nav = [
  { id: "mapa" as View, label: "Mapa", icon: Map },
  { id: "campos" as View, label: "Campos", icon: Sprout },
  { id: "registros" as View, label: "Registros", icon: FileText },
  { id: "reportes" as View, label: "Reportes", icon: TrendingUp },
  { id: "equipo" as View, label: "Equipo", icon: Users }
];

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><div className="brand-mark"><span>G</span><Leaf size={compact ? 13 : 16}/></div>{!compact && <div><strong>Growr<span>360</span></strong><small>Gestión agrícola</small></div>}</div>;
}

export default function GrowrWeb() {
  const [view, setView] = useState<View>("mapa");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(lots[0]);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [satelliteOpen, setSatelliteOpen] = useState(false);
  const [campaign, setCampaign] = useState("26/27");

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-top"><Brand/><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)}><X/></button></div>
        <nav>{nav.map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => { setView(item.id); setSidebarOpen(false); }}><item.icon/><span>{item.label}</span>{item.id === "registros" && <em>12</em>}</button>)}</nav>
        <div className="workspace-card"><div className="workspace-icon"><Tractor/></div><div><small>Espacio activo</small><strong>Gestagro</strong></div><ChevronRight/></div>
        <div className="sidebar-footer"><button><Settings2/>Configuración</button><div className="user-mini"><div className="avatar">BI</div><div><strong>Benicio</strong><small>Administrador</small></div><MoreHorizontal/></div></div>
      </aside>

      <main>
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button hamburger" onClick={() => setSidebarOpen(true)}><Menu/></button><div><h1>{nav.find(n => n.id === view)?.label}</h1><p>{view === "mapa" ? "Todo el campo, en una sola vista" : subtitle(view)}</p></div></div>
          <div className="topbar-actions">
            <div className="sync-pill"><span/>Sincronizado</div>
            <button className="campaign" onClick={() => setCampaign(campaign === "26/27" ? "27/28" : "26/27")}><CalendarDays/><span>Campaña {campaign}</span><ChevronDown/></button>
            <button className="icon-button notification" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell/><b>3</b></button>
            <button className="avatar-button">BI</button>
          </div>
          {notificationsOpen && <Notifications onClose={() => setNotificationsOpen(false)}/>}
        </header>

        {view === "mapa" && <MapView selectedLot={selectedLot} setSelectedLot={setSelectedLot} onCreate={() => setCreateOpen(true)} satelliteOpen={satelliteOpen} setSatelliteOpen={setSatelliteOpen}/>}
        {view === "campos" && <FieldsView onOpenLot={(lot) => { setSelectedLot(lot); setView("mapa"); }}/>}
        {view === "registros" && <RecordsView onCreate={() => setCreateOpen(true)}/>}
        {view === "reportes" && <ReportsView/>}
        {view === "equipo" && <TeamView/>}
      </main>
      {createOpen && <CreateRecord onClose={() => setCreateOpen(false)}/>}
    </div>
  );
}

function MapView({ selectedLot, setSelectedLot, onCreate, satelliteOpen, setSatelliteOpen }: {
  selectedLot: Lot | null; setSelectedLot: (lot: Lot | null) => void; onCreate: () => void;
  satelliteOpen: boolean; setSatelliteOpen: (value: boolean) => void;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [layer, setLayer] = useState<"cultivo" | "prioridad" | "sin-relleno">("cultivo");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      center: [-60.022, -34.902],
      zoom: 12.8,
      maxZoom: 18,
      style: { version: 8, sources: { satellite: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Esri" } }, layers: [{ id: "satellite", type: "raster", source: "satellite" }] }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("lots", { type: "geojson", data: lotsGeoJson("cultivo") });
      map.addLayer({ id: "lot-fill", type: "fill", source: "lots", paint: { "fill-color": ["get","color"], "fill-opacity": .55 } });
      map.addLayer({ id: "lot-line", type: "line", source: "lots", paint: { "line-color": "#f8faf8", "line-width": 2 } });
      map.addLayer({ id: "lot-label", type: "symbol", source: "lots", layout: { "text-field": ["get","name"], "text-size": 13, "text-font": ["Open Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#ffffff", "text-halo-color": "#10261f", "text-halo-width": 3 } });
      map.on("click", "lot-fill", e => { const id = e.features?.[0]?.properties?.id; setSelectedLot(lots.find(l => l.id === id) ?? null); });
      map.on("mouseenter", "lot-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "lot-fill", () => { map.getCanvas().style.cursor = ""; });
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [setSelectedLot]);

  useEffect(() => {
    const source = mapRef.current?.getSource("lots") as GeoJSONSource | undefined;
    source?.setData(lotsGeoJson(layer));
    if (mapRef.current?.getLayer("lot-fill")) mapRef.current.setPaintProperty("lot-fill", "fill-opacity", layer === "sin-relleno" ? 0 : .55);
  }, [layer]);

  return <div className="map-workspace">
    <div ref={mapNode} className="map-canvas"/>
    <div className="map-search"><Search/><input placeholder="Buscar campo, lote o localidad…"/><kbd>⌘ K</kbd></div>
    <div className="map-toolbar">
      <button onClick={onCreate} className="primary-map-action"><Plus/><span>Agregar</span></button>
      <button className={filterOpen ? "selected" : ""} onClick={() => setFilterOpen(!filterOpen)}><Filter/><span>Filtros</span></button>
      <button className={satelliteOpen ? "selected" : ""} onClick={() => setSatelliteOpen(!satelliteOpen)}><Satellite/><span>Satélite</span></button>
      <button><RotateCcw/><span>Actualizar</span></button>
    </div>
    <div className="layer-switcher">
      <div><Layers3/><span>Visualización</span></div>
      {(["cultivo","prioridad","sin-relleno"] as const).map(value => <button key={value} className={layer === value ? "active" : ""} onClick={() => setLayer(value)}>{value === "sin-relleno" ? "Sin relleno" : cap(value)}</button>)}
    </div>
    {filterOpen && <div className="filter-pop"><div><strong>Filtros del mapa</strong><button onClick={() => setFilterOpen(false)}><X/></button></div><label>Campaña<select><option>26/27</option><option>25/26</option></select></label><label>Campo<select><option>Todos los campos</option><option>Don Pablo</option><option>El Ñato</option></select></label><button className="apply">Aplicar filtros</button></div>}
    {selectedLot && <LotPanel lot={selectedLot} onClose={() => setSelectedLot(null)} onSatellite={() => setSatelliteOpen(true)}/>}
    {satelliteOpen && <SatellitePanel lot={selectedLot ?? lots[0]} onClose={() => setSatelliteOpen(false)}/>}
  </div>;
}

function LotPanel({ lot, onClose, onSatellite }: { lot: Lot; onClose: () => void; onSatellite: () => void }) {
  return <aside className="lot-panel">
    <div className="panel-handle"/>
    <div className="lot-head"><div><span className="eyebrow">LOTE SELECCIONADO</span><h2>{lot.name}</h2><p><MapPin/> {lot.field}</p></div><button className="icon-button" onClick={onClose}><X/></button></div>
    <div className="lot-metrics"><div><small>Superficie</small><strong>{lot.area.toLocaleString("es-AR")} ha</strong></div><div><small>Cultivo</small><strong><i style={{background: lot.color}}/>{lot.crop}</strong></div><div><small>Prioridad</small><strong>{lot.priority}</strong></div></div>
    <div className="quick-actions"><button><Plus/><span>Registro</span></button><button><Activity/><span>Monitoreo</span></button><button onClick={onSatellite}><Satellite/><span>Imagen</span></button></div>
    <section><div className="section-title"><div><Activity/><span>Actividad reciente</span></div><button>Ver todo</button></div>{records.filter(r => r.lot === lot.name).slice(0,3).map(r => <div className="activity-row" key={r.id}><div className="activity-icon"><Leaf/></div><div><strong>{r.type} · {r.crop}</strong><small>{r.author} · {r.date}</small></div><ChevronRight/></div>)}</section>
    <button className="full-detail">Abrir detalle del lote <ChevronRight/></button>
  </aside>;
}

function SatellitePanel({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const [index, setIndex] = useState("NDVI contrastado");
  return <div className="satellite-panel"><div className="sat-top"><div><span className="eyebrow">IMÁGENES SATELITALES</span><strong>{lot.name} · {lot.field}</strong></div><button onClick={onClose}><X/></button></div><div className="sat-selector">{["NDVI contrastado","NDVI","RGB natural","NDRE"].map(i => <button className={index === i ? "active" : ""} onClick={() => setIndex(i)} key={i}>{i}</button>)}</div><div className="sat-meta"><span><Satellite/>Sentinel-2B</span><span><CloudSun/>8% nubes</span><span><CalendarDays/>24 jul 2026</span></div><div className="history"><strong>Historial</strong><div className="dates">{["24 JUL","19 JUL","14 JUL","09 JUL"].map((d,i) => <button className={i === 0 ? "active" : ""} key={d}><div className={`ndvi-preview p${i}`}/><b>{d}</b><small>{[8,14,3,22][i]}% nubes</small></button>)}</div></div></div>;
}

function FieldsView({ onOpenLot }: { onOpenLot: (lot: Lot) => void }) {
  return <div className="page-content"><PageHead title="Campos y lotes" text="Organizá la estructura productiva de tu empresa." action="Nuevo campo"/><div className="stats-grid"><Stat label="Campos activos" value="2" detail="77,32 ha totales" icon={MapPin}/><Stat label="Lotes" value="3" detail="100% georreferenciados" icon={Grid2X2}/><Stat label="En producción" value="3" detail="Campaña 26/27" icon={Sprout}/></div><div className="content-card"><div className="card-toolbar"><div><h3>Todos los lotes</h3><p>Información actualizada de la campaña activa</p></div><div><button className="soft-button"><Filter/>Filtrar</button><button className="soft-button"><Search/>Buscar</button></div></div><div className="lot-table"><div className="table-head"><span>Lote</span><span>Campo</span><span>Cultivo</span><span>Superficie</span><span>Prioridad</span><span/></div>{lots.map(lot => <button className="table-row" key={lot.id} onClick={() => onOpenLot(lot)}><span><i style={{background: lot.color}}/><b>{lot.name}</b></span><span>{lot.field}</span><span>{lot.crop}</span><span>{lot.area.toLocaleString("es-AR")} ha</span><span><em className={`priority ${lot.priority.toLowerCase()}`}>{lot.priority}</em></span><ChevronRight/></button>)}</div></div></div>;
}

function RecordsView({ onCreate }: { onCreate: () => void }) {
  const [query, setQuery] = useState("");
  const visible = records.filter(r => `${r.type} ${r.crop} ${r.lot} ${r.field}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page-content"><PageHead title="Registros" text="Historial productivo y operativo de todos tus lotes." action="Nuevo registro" onAction={onCreate}/><div className="records-toolbar"><div className="inner-search"><Search/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por campo, lote, cultivo…"/></div><button className="soft-button"><Filter/>Filtros <b>2</b></button><button className="soft-button"><Settings2/>Ordenar</button></div><div className="record-list">{visible.map(record => <article className="record-card" key={record.id}><div className="record-type-icon"><Leaf/></div><div className="record-main"><span>{record.type}</span><h3>{record.crop}</h3><p>{record.field} · {record.lot}</p></div><div className="record-meta"><strong>{record.date}</strong><small>Creado por {record.author}</small></div><div className="record-chip">26/27</div><button className="icon-button"><ChevronRight/></button></article>)}</div></div>;
}

function ReportsView() {
  return <div className="page-content"><PageHead title="Reportes" text="Indicadores claros para decidir mejor." action="Exportar informe"/><div className="report-filter"><select><option>Campaña 26/27</option></select><select><option>Todos los campos</option></select><select><option>Todos los cultivos</option></select><button><Filter/>Más filtros</button></div><div className="kpi-grid"><Kpi label="Superficie trabajada" value="114,8 ha" change="+8,4%" positive/><Kpi label="Costo total" value="$ 18,4 M" change="+2,1%"/><Kpi label="Costo por hectárea" value="$ 160.278" change="-4,6%" positive/><Kpi label="Monitoreos" value="28" change="+12 este mes" positive/></div><div className="report-grid"><div className="chart-card wide"><div className="chart-head"><div><h3>Costos por actividad</h3><p>Distribución de la campaña activa</p></div><button><MoreHorizontal/></button></div><div className="bars">{[["Siembra",78],["Pulverización",55],["Fertilización",68],["Cosecha",42],["Roturación",28]].map(([n,v]) => <div key={n}><span>{n}</span><i><b style={{width:`${v}%`}}/></i><strong>{v}%</strong></div>)}</div></div><div className="chart-card"><div className="chart-head"><div><h3>Superficie por cultivo</h3><p>114,8 ha totales</p></div></div><div className="donut"><div><strong>3</strong><small>cultivos</small></div></div><div className="legend"><span><i className="wheat"/>Trigo <b>43%</b></span><span><i className="soy"/>Soja <b>32%</b></span><span><i className="camelina"/>Camelina <b>25%</b></span></div></div></div></div>;
}

function TeamView() {
  return <div className="page-content"><PageHead title="Equipo" text="Miembros, roles y accesos a campos y lotes." action="Invitar persona"/><div className="team-grid">{[["BI","Benicio Iglesias","Propietario","Todos los campos"],["JM","Juan Manuel","Ingeniero / Agrónomo","Don Pablo · 2 lotes"],["LM","Lucía Méndez","Monitoreador","El Ñato · 1 lote"]].map(([initials,name,role,scope]) => <article className="member-card" key={name}><div className="member-avatar">{initials}</div><div><h3>{name}</h3><p>{role}</p></div><span className="member-active"><i/>Activo</span><div className="access"><small>Acceso asignado</small><strong>{scope}</strong></div><button><MoreHorizontal/></button></article>)}</div></div>;
}

function CreateRecord({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState("Monitoreo");
  const [step, setStep] = useState(1);
  return <div className="modal-backdrop"><div className="record-modal"><div className="modal-head"><div><span className="eyebrow">NUEVO REGISTRO</span><h2>{type}</h2></div><button className="icon-button" onClick={onClose}><X/></button></div><div className="steps"><span className={step >= 1 ? "done" : ""}><b>1</b>Tipo</span><i/><span className={step >= 2 ? "done" : ""}><b>2</b>Ubicación</span><i/><span className={step >= 3 ? "done" : ""}><b>3</b>Datos</span></div>{step === 1 && <div className="type-grid">{["Monitoreo","Siembra","Pulverización","Fertilización","Cosecha","Roturación","Napa","Análisis de suelo"].map(item => <button className={type === item ? "active" : ""} onClick={() => setType(item)} key={item}><div><Leaf/></div><strong>{item}</strong><small>Registrar actividad</small></button>)}</div>}{step === 2 && <div className="form-grid"><label>Campaña<select><option>26/27 · Activa</option></select></label><label>Campo<select><option>Don Pablo</option><option>El Ñato</option></select></label><label>Lote<select><option>Lote 1</option><option>La Esquina</option></select></label><label>Fecha<input type="date" defaultValue="2026-07-30"/></label></div>}{step === 3 && <div className="form-grid"><label>Cultivo<select><option>Trigo</option><option>Soja de primera</option><option>Camelina</option></select></label><label>Estado fenológico<input placeholder="Ej. Macollaje"/></label><label className="full">Observaciones<textarea placeholder="Agregá información relevante del recorrido…"/></label><label className="upload full"><Plus/><strong>Agregar fotos o archivos</strong><small>JPG, PNG o PDF · hasta 12 archivos</small></label></div>}<div className="modal-footer"><button className="back" onClick={() => step === 1 ? onClose() : setStep(step - 1)}><ChevronLeft/>{step === 1 ? "Cancelar" : "Volver"}</button><button className="next" onClick={() => step === 3 ? onClose() : setStep(step + 1)}>{step === 3 ? "Guardar registro" : "Continuar"}<ChevronRight/></button></div></div></div>;
}

function Notifications({ onClose }: { onClose: () => void }) {
  return <div className="notifications"><div className="notification-head"><div><h3>Notificaciones</h3><span>3 nuevas</span></div><button onClick={onClose}><X/></button></div>{[["Nuevo monitoreo","Juan registró un monitoreo en Lote 1.","Hace 8 min"],["Imagen disponible","Nueva imagen Sentinel-2 con 8% de nubes.","Hace 2 h"],["Solicitud aprobada","Lucía ya forma parte de Gestagro.","Ayer"]].map(([t,d,time],i) => <div className="notification-row" key={t}><div className={i === 1 ? "sat" : ""}>{i === 1 ? <Satellite/> : <Bell/>}</div><section><strong>{t}</strong><p>{d}</p><small>{time}</small></section><i/></div>)}<button className="all-notifications">Ver todas las notificaciones</button></div>;
}

function PageHead({ title, text, action, onAction }: { title: string; text: string; action: string; onAction?: () => void }) { return <div className="page-head"><div><h2>{title}</h2><p>{text}</p></div><button onClick={onAction}><Plus/>{action}</button></div>; }
function Stat({ label, value, detail, icon: Icon }: { label:string; value:string; detail:string; icon:typeof MapPin }) { return <div className="stat-card"><div><Icon/></div><section><small>{label}</small><strong>{value}</strong><p>{detail}</p></section></div>; }
function Kpi({ label,value,change,positive=false }: { label:string;value:string;change:string;positive?:boolean }) { return <div className="kpi"><small>{label}</small><strong>{value}</strong><span className={positive ? "positive" : ""}>{change}</span></div>; }
function subtitle(view: View) { return ({campos:"Estructura territorial y productiva",registros:"Actividad del equipo en tiempo real",reportes:"Decisiones basadas en información real",equipo:"Roles, permisos y recursos asignados",mapa:""} as Record<View,string>)[view]; }
function cap(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function lotsGeoJson(layer: "cultivo"|"prioridad"|"sin-relleno") {
  return { type: "FeatureCollection" as const, features: lots.map(lot => ({ type:"Feature" as const, properties:{ id:lot.id,name:lot.name,color: layer === "prioridad" ? ({Alta:"#f04444",Media:"#f4c542",Baja:"#48a75b"}[lot.priority]) : lot.color }, geometry:{ type:"Polygon" as const, coordinates:lot.coordinates } })) };
}
