import { useState, useEffect, useMemo, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, setDoc, addDoc, deleteDoc, updateDoc,
  onSnapshot, serverTimestamp, query, orderBy, Timestamp,
} from "firebase/firestore";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  LayoutDashboard, Users, ClipboardCheck, AlertTriangle, FlaskConical,
  Tractor, Clock, Plus, Pencil, Trash2, X, Menu,
  LogIn, LogOut, FileDown, ShieldCheck, KeyRound,
} from "lucide-react";

// ─── Firebase Config ───────────────────────────────────────────────
// Usa el MISMO proyecto Firebase que Golf B (golf-ciudad-real-50819).
// Las colecciones llevan el prefijo "mant_" para no mezclarse con Academia.
const firebaseConfig = {
  apiKey: "AIzaSyDQMYwKTt05hfSPW-Trl7NYPGyDFKA76dQ",
  authDomain: "golf-ciudad-real-50819.firebaseapp.com",
  projectId: "golf-ciudad-real-50819",
  storageBucket: "golf-ciudad-real-50819.firebasestorage.app",
  messagingSenderId: "447720199984",
  appId: "1:447720199984:web:312a8a1140d95554821af5",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app);

// ─── Resolución del club (multi-cliente) ───────────────────────────
// golfsantander.golfb.es → "golfsantander"  |  en local o dominio raíz → "ciudad-real"
function resolverClubId() {
  const host = window.location.hostname;
  // Solo interpretamos el subdominio como clubId en dominios propios tipo
  // "golfsantander.golfb.es". En GitHub Pages (*.github.io) o en local,
  // usamos siempre el club piloto por defecto.
  if (host.endsWith(".golfb.es")) {
    const sub = host.split(".")[0];
    if (sub && sub !== "www") return sub;
  }
  return "ciudad-real"; // valor por defecto: GitHub Pages, localhost, etc.
}
const CLUB_ID = resolverClubId();

// ─── Paleta de marca Golf B ────────────────────────────────────────
const VERDE = "#0F501E";
const VERDE_OSCURO = "#0A3A15";
const VERDE_NEGRO = "#07270F"; // sidebar, botones primarios — tono más corporativo
const DORADO = "#B48C3C";
const CREMA = "#F7F5F0";
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";

// ─── Equipo por defecto (se crea la primera vez si la colección está vacía) ──
const EQUIPO_INICIAL = [
  { nombre: "José Manuel Caballero", rol: "Director-Gerente / Greenkeeper" },
  { nombre: "Mario", rol: "Oficial de mantenimiento" },
  { nombre: "Manolo", rol: "Oficial de mantenimiento" },
  { nombre: "Miguel", rol: "Oficial de mantenimiento" },
  { nombre: "Aleyda", rol: "Mantenimiento" },
  { nombre: "Yaiza", rol: "Mantenimiento" },
  { nombre: "Mecánico", rol: "Taller / Maquinaria" },
];

const ZONAS = ["Green", "Tee", "Calle", "Rough", "Bunker", "Riego", "Instalaciones", "Otra"];
const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"];
const ESTADOS_TAREA = ["Pendiente", "En curso", "Completada"];
const GRAVEDADES = ["Leve", "Moderada", "Grave"];
const TIPOS_APLICACION = ["Fertilizante", "Fitosanitario (herbicida)", "Fitosanitario (fungicida)", "Fitosanitario (insecticida)", "Enmienda", "Otro"];
const ESTADOS_MAQUINA = ["Operativa", "En taller", "Fuera de servicio"];

// ─── Utilidades ─────────────────────────────────────────────────────
function cx(...args) { return args.filter(Boolean).join(" "); }

function fechaCorta(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Badge corporativo (tonos planos, sin bordes llamativos) ────────
function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-stone-100 text-stone-600",
    verde: "bg-emerald-50 text-emerald-700",
    ambar: "bg-amber-50 text-amber-700",
    rojo: "bg-red-50 text-red-600",
    dorado: "bg-amber-50 text-amber-800",
  };
  return (
    <span className={cx("px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap", tones[tone] || tones.neutral)}>
      {children}
    </span>
  );
}

function toneEstado(estado) {
  if (estado === "Pendiente") return "ambar";
  if (estado === "En curso") return "dorado";
  if (estado === "Completada") return "verde";
  if (estado === "Operativa") return "verde";
  if (estado === "En taller") return "ambar";
  if (estado === "Fuera de servicio") return "rojo";
  return "neutral";
}

function toneGravedad(g) {
  if (g === "Grave") return "rojo";
  if (g === "Moderada") return "ambar";
  return "neutral";
}

function tonePrioridad(p) {
  if (p === "Urgente") return "rojo";
  if (p === "Alta") return "ambar";
  return "neutral";
}

// ─── Cabecera de sección reutilizable (título serif + subtítulo + acción) ──
function Cabecera({ titulo, subtitulo, children }) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight" style={{ color: VERDE_NEGRO, fontFamily: SERIF }}>{titulo}</h1>
        {subtitulo && <p className="text-stone-500 text-sm mt-1">{subtitulo}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// ─── Botones corporativos ────────────────────────────────────────────
function BotonPrimario({ children, onClick, icon: Icon = Plus, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm hover:opacity-90 active:scale-[0.99] transition"
      style={{ background: VERDE_NEGRO }}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
}

function BotonSecundario({ children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 transition"
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
}

function PillFiltro({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "px-3.5 py-1.5 rounded-lg text-sm font-medium border transition",
        activo ? "text-white border-transparent" : "text-stone-600 border-stone-300 bg-white hover:bg-stone-50"
      )}
      style={activo ? { background: VERDE_NEGRO } : {}}
    >
      {children}
    </button>
  );
}

// ─── Tarjeta base ─────────────────────────────────────────────────────
function Tarjeta({ children, className = "", onClick }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        "bg-white rounded-xl border border-stone-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        onClick && "cursor-pointer hover:shadow-md hover:border-stone-300 transition",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Modal genérico ──────────────────────────────────────────────────
function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cx("bg-white rounded-2xl shadow-xl w-full max-h-[90vh] overflow-y-auto", wide ? "max-w-2xl" : "max-w-md")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-lg" style={{ color: VERDE_NEGRO, fontFamily: SERIF }}>{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 rounded-md p-1 hover:bg-stone-100 transition">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3.5">
      <span className="block text-[13px] font-medium text-stone-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0A3A15]/15 focus:border-[#0A3A15] transition";

// ─── Rutas de Firestore ancladas al club (multi-cliente) ─────────────
// Todo documento vive bajo clubes/{CLUB_ID}/{coleccion}/{id}.
// Así un club NUNCA puede leer accidentalmente los datos de otro: la ruta lo impide.
function coleccionClub(nombre) {
  return collection(db, "clubes", CLUB_ID, nombre);
}
function docClub(nombre, id) {
  return doc(db, "clubes", CLUB_ID, nombre, id);
}

// ─── Firestore hook genérico ─────────────────────────────────────────
function useColeccion(nombre, ordenarPor = "creadoEn", dir = "desc") {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const q = query(coleccionClub(nombre), orderBy(ordenarPor, dir));
    const unsub = onSnapshot(q, (snap) => {
      setDatos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCargando(false);
    }, (err) => {
      console.error(`Error leyendo ${nombre}:`, err);
      setCargando(false);
    });
    return () => unsub();
  }, [nombre, ordenarPor, dir]);

  return { datos, cargando };
}

async function crearDoc(coleccion, data) {
  return addDoc(coleccionClub(coleccion), { ...data, creadoEn: serverTimestamp() });
}
async function actualizarDoc(coleccion, id, data) {
  return updateDoc(docClub(coleccion, id), data);
}
async function borrarDoc(coleccion, id) {
  return deleteDoc(docClub(coleccion, id));
}


// ═══════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargandoAuth, setCargandoAuth] = useState(true);
  const [errorClub, setErrorClub] = useState(null);
  const [vista, setVista] = useState("dashboard");
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { setUsuario(u); setCargandoAuth(false); return; }
      try {
        const mintTenantToken = httpsCallable(functions, "mintTenantToken");
        const res = await mintTenantToken({ clubId: CLUB_ID });
        await signInWithCustomToken(auth, res.data.token);
      } catch (e) {
        console.error("No se pudo autenticar con el club:", e);
        setErrorClub(e.message || "No se pudo verificar el club.");
        setCargandoAuth(false);
      }
    });
    return () => unsub();
  }, []);

  // Navegación agrupada por bloques, al estilo del panel de Finanzas
  const NAV_GROUPS = [
    { label: "Principal", items: [
      { id: "dashboard", label: "Panel", Icon: LayoutDashboard },
    ]},
    { label: "Operativa", items: [
      { id: "tareas", label: "Tareas de campo", Icon: ClipboardCheck },
      { id: "partes", label: "Partes de incidencia", Icon: AlertTriangle },
      { id: "aplicaciones", label: "Aplicaciones", Icon: FlaskConical },
    ]},
    { label: "Recursos", items: [
      { id: "equipo", label: "Equipo", Icon: Users },
      { id: "maquinaria", label: "Maquinaria", Icon: Tractor },
    ]},
    { label: "Sistema", items: [
      { id: "fichajes", label: "Fichajes", Icon: Clock },
    ]},
  ];

  const TITULOS = {
    dashboard: "Panel", equipo: "Equipo", tareas: "Tareas de campo",
    partes: "Partes de incidencia", aplicaciones: "Aplicaciones",
    maquinaria: "Maquinaria", fichajes: "Fichajes",
  };

  if (errorClub) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: CREMA }}>
        <Tarjeta className="p-6 max-w-sm text-center">
          <AlertTriangle className="mx-auto mb-2 text-amber-600" size={28} strokeWidth={1.75} />
          <p className="font-semibold mb-1" style={{ color: VERDE_NEGRO }}>No se pudo acceder a este club</p>
          <p className="text-sm text-stone-500">{errorClub}</p>
        </Tarjeta>
      </div>
    );
  }

  if (cargandoAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CREMA }}>
        <p className="text-stone-500 text-sm">Cargando Mantenimiento…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: CREMA }}>
      {/* Sidebar */}
      <aside
        className={cx(
          "fixed md:static z-40 inset-y-0 left-0 w-64 text-white flex flex-col transition-transform",
          menuAbierto ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: VERDE_NEGRO }}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <p className="text-2xl font-bold italic tracking-tight" style={{ fontFamily: "'Exo 2', sans-serif" }}>Golf B</p>
          <p className="text-[11px] text-white/45 mt-1 uppercase tracking-widest">Mantenimiento</p>
          <p className="text-xs text-white/60 mt-2">Golf Ciudad Real C.D.</p>
        </div>
        <nav className="flex-1 py-5 px-3 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10.5px] font-semibold uppercase tracking-widest text-white/35">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const activo = vista === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setVista(item.id); setMenuAbierto(false); }}
                      className={cx(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition",
                        activo ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <item.Icon size={16} strokeWidth={1.75} className={activo ? "opacity-100" : "opacity-70"} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-[11px] text-white/45 leading-relaxed">
          José Manuel Caballero Fernández<br />PGA España Nº 1908P
          <div className="mt-1.5 text-white/25">Club: {CLUB_ID}</div>
        </div>
      </aside>

      {menuAbierto && (
        <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setMenuAbierto(false)} />
      )}

      {/* Contenido */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-100">
          <button onClick={() => setMenuAbierto(true)} className="p-1 text-stone-600"><Menu size={22} /></button>
          <p className="font-semibold italic" style={{ color: VERDE_NEGRO }}>Golf B · {TITULOS[vista]}</p>
          <div className="w-6" />
        </header>
        <main className="flex-1 p-4 md:p-10 max-w-6xl w-full mx-auto">
          {vista === "dashboard" && <Dashboard irA={setVista} />}
          {vista === "equipo" && <Equipo />}
          {vista === "tareas" && <Tareas />}
          {vista === "partes" && <Partes />}
          {vista === "aplicaciones" && <Aplicaciones />}
          {vista === "maquinaria" && <Maquinaria />}
          {vista === "fichajes" && <Fichajes />}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function Dashboard({ irA }) {
  const { datos: tareas } = useColeccion("mant_tareas");
  const { datos: partes } = useColeccion("mant_partes");
  const { datos: maquinaria } = useColeccion("mant_maquinaria");
  const { datos: aplicaciones } = useColeccion("mant_aplicaciones");

  const tareasPendientes = tareas.filter((t) => t.estado !== "Completada").length;
  const partesAbiertos = partes.filter((p) => p.estado !== "Completada").length;
  const maquinasOperativas = maquinaria.filter((m) => m.estado === "Operativa").length;
  const aplicacionesMes = aplicaciones.filter((a) => {
    const d = a.creadoEn?.toDate ? a.creadoEn.toDate() : null;
    if (!d) return false;
    const ahora = new Date();
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  }).length;

  const tarjetas = [
    { id: "tareas", label: "Tareas pendientes", valor: tareasPendientes, Icon: ClipboardCheck, tone: "verde" },
    { id: "partes", label: "Partes abiertos", valor: partesAbiertos, Icon: AlertTriangle, tone: partesAbiertos > 0 ? "rojo" : "verde" },
    { id: "maquinaria", label: "Maquinaria operativa", valor: `${maquinasOperativas}/${maquinaria.length || 0}`, Icon: Tractor, tone: "neutral" },
    { id: "aplicaciones", label: "Aplicaciones este mes", valor: aplicacionesMes, Icon: FlaskConical, tone: "dorado" },
  ];

  const iconBg = {
    verde: "bg-emerald-50 text-emerald-700",
    rojo: "bg-red-50 text-red-600",
    dorado: "bg-amber-50 text-amber-700",
    neutral: "bg-stone-100 text-stone-500",
  };

  return (
    <div>
      <Cabecera titulo="Panel de mantenimiento" subtitulo="Vista general del campo, equipo y actividad reciente." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {tarjetas.map((c) => (
          <Tarjeta key={c.id} onClick={() => irA(c.id)} className="p-5 text-left">
            <div className={cx("w-9 h-9 rounded-lg flex items-center justify-center mb-3", iconBg[c.tone])}>
              <c.Icon size={18} strokeWidth={1.75} />
            </div>
            <div className="text-2xl font-semibold" style={{ color: VERDE_NEGRO, fontFamily: SERIF }}>{c.valor}</div>
            <div className="text-xs text-stone-500 mt-1">{c.label}</div>
          </Tarjeta>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Tarjeta className="p-5">
          <h2 className="font-semibold mb-3 text-[15px]" style={{ color: VERDE_NEGRO }}>Últimos partes de incidencia</h2>
          {partes.slice(0, 5).length === 0 && <p className="text-sm text-stone-400">Sin partes registrados.</p>}
          <ul className="space-y-2.5">
            {partes.slice(0, 5).map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm gap-3">
                <span className="truncate text-stone-700">{p.titulo}</span>
                <Badge tone={toneGravedad(p.gravedad)}>{p.gravedad}</Badge>
              </li>
            ))}
          </ul>
        </Tarjeta>
        <Tarjeta className="p-5">
          <h2 className="font-semibold mb-3 text-[15px]" style={{ color: VERDE_NEGRO }}>Tareas próximas</h2>
          {tareas.slice(0, 5).length === 0 && <p className="text-sm text-stone-400">Sin tareas registradas.</p>}
          <ul className="space-y-2.5">
            {tareas.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm gap-3">
                <span className="truncate text-stone-700">{t.titulo}</span>
                <Badge tone={toneEstado(t.estado)}>{t.estado}</Badge>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EQUIPO
// ═══════════════════════════════════════════════════════════════════
function Equipo() {
  const { datos: equipo, cargando } = useColeccion("mant_equipo", "nombre", "asc");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", rol: "", telefono: "", pin: "", esAdmin: false });

  useEffect(() => {
    if (!cargando && equipo.length === 0) {
      EQUIPO_INICIAL.forEach((m, i) => crearDoc("mant_equipo", { ...m, pin: "", esAdmin: i === 0 }));
    }
  }, [cargando, equipo.length]);

  function abrirNuevo() { setEditando(null); setForm({ nombre: "", rol: "", telefono: "", pin: "", esAdmin: false }); setModal(true); }
  function abrirEditar(m) { setEditando(m); setForm({ nombre: m.nombre, rol: m.rol || "", telefono: m.telefono || "", pin: m.pin || "", esAdmin: !!m.esAdmin }); setModal(true); }

  async function guardar() {
    if (!form.nombre.trim()) return;
    if (editando) await actualizarDoc("mant_equipo", editando.id, form);
    else await crearDoc("mant_equipo", form);
    setModal(false);
  }

  return (
    <div>
      <Cabecera titulo="Equipo" subtitulo="Personal de mantenimiento del campo.">
        <BotonPrimario onClick={abrirNuevo}>Añadir</BotonPrimario>
      </Cabecera>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipo.map((m) => (
          <Tarjeta key={m.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold" style={{ color: VERDE_NEGRO }}>{m.nombre}</p>
                <p className="text-sm text-stone-500">{m.rol}</p>
                {m.telefono && <p className="text-xs text-stone-400 mt-1">{m.telefono}</p>}
                <div className="flex gap-1.5 mt-2.5">
                  {m.esAdmin && <Badge tone="dorado">Administrador</Badge>}
                  <Badge tone={m.pin ? "verde" : "neutral"}>{m.pin ? "PIN configurado" : "Sin PIN"}</Badge>
                </div>
              </div>
              <button onClick={() => abrirEditar(m)} className="text-stone-400 hover:text-stone-700 p-1 rounded hover:bg-stone-100 transition">
                <Pencil size={15} />
              </button>
            </div>
          </Tarjeta>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar miembro" : "Nuevo miembro"}>
        <Field label="Nombre"><input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
        <Field label="Rol / puesto"><input className={inputCls} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} /></Field>
        <Field label="Teléfono (opcional)"><input className={inputCls} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Field>
        <Field label="PIN de fichaje (4 dígitos)">
          <input
            className={inputCls} inputMode="numeric" maxLength={4} placeholder="Ej. 1234"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          />
        </Field>
        <label className="flex items-center gap-2 mb-3 text-sm text-stone-600">
          <input type="checkbox" checked={form.esAdmin} onChange={(e) => setForm({ ...form, esAdmin: e.target.checked })} />
          Puede corregir fichajes de todo el equipo (administrador)
        </label>
        <div className="flex justify-between items-center mt-4">
          {editando ? (
            <button onClick={async () => { await borrarDoc("mant_equipo", editando.id); setModal(false); }} className="inline-flex items-center gap-1.5 text-red-600 text-sm hover:text-red-700">
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <span />}
          <BotonPrimario onClick={guardar} icon={null}>Guardar</BotonPrimario>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAREAS DE CAMPO
// ═══════════════════════════════════════════════════════════════════
function Tareas() {
  const { datos: tareas } = useColeccion("mant_tareas");
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("Todas");
  const vacio = { titulo: "", descripcion: "", zona: ZONAS[0], asignadoA: "", prioridad: "Media", estado: "Pendiente", fechaLimite: "" };
  const [form, setForm] = useState(vacio);

  function abrirNuevo() { setEditando(null); setForm(vacio); setModal(true); }
  function abrirEditar(t) { setEditando(t); setForm({ ...vacio, ...t }); setModal(true); }

  async function guardar() {
    if (!form.titulo.trim()) return;
    if (editando) await actualizarDoc("mant_tareas", editando.id, form);
    else await crearDoc("mant_tareas", form);
    setModal(false);
  }

  const tareasFiltradas = tareas.filter((t) => filtroEstado === "Todas" || t.estado === filtroEstado);

  return (
    <div>
      <Cabecera titulo="Tareas de campo" subtitulo="Trabajo diario asignado al equipo.">
        <BotonPrimario onClick={abrirNuevo}>Nueva tarea</BotonPrimario>
      </Cabecera>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["Todas", ...ESTADOS_TAREA].map((e) => (
          <PillFiltro key={e} activo={filtroEstado === e} onClick={() => setFiltroEstado(e)}>{e}</PillFiltro>
        ))}
      </div>

      <div className="space-y-2">
        {tareasFiltradas.length === 0 && <p className="text-sm text-stone-400">No hay tareas en este filtro.</p>}
        {tareasFiltradas.map((t) => (
          <Tarjeta key={t.id} onClick={() => abrirEditar(t)} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: VERDE_NEGRO }}>{t.titulo}</p>
                <p className="text-xs text-stone-500 mt-0.5">{t.zona} · {t.asignadoA || "Sin asignar"} {t.fechaLimite ? `· vence ${t.fechaLimite}` : ""}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Badge tone={tonePrioridad(t.prioridad)}>{t.prioridad}</Badge>
                <Badge tone={toneEstado(t.estado)}>{t.estado}</Badge>
              </div>
            </div>
          </Tarjeta>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar tarea" : "Nueva tarea"} wide>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Título"><input className={inputCls} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Field>
          <Field label="Zona">
            <select className={inputCls} value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })}>
              {ZONAS.map((z) => <option key={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Asignado a">
            <select className={inputCls} value={form.asignadoA} onChange={(e) => setForm({ ...form, asignadoA: e.target.value })}>
              <option value="">Sin asignar</option>
              {equipo.map((m) => <option key={m.id}>{m.nombre}</option>)}
            </select>
          </Field>
          <Field label="Prioridad">
            <select className={inputCls} value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })}>
              {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_TAREA.map((e2) => <option key={e2}>{e2}</option>)}
            </select>
          </Field>
          <Field label="Fecha límite"><input type="date" className={inputCls} value={form.fechaLimite} onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })} /></Field>
        </div>
        <Field label="Descripción"><textarea className={inputCls} rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
        <div className="flex justify-between items-center mt-4">
          {editando ? (
            <button onClick={async () => { await borrarDoc("mant_tareas", editando.id); setModal(false); }} className="inline-flex items-center gap-1.5 text-red-600 text-sm hover:text-red-700">
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <span />}
          <BotonPrimario onClick={guardar} icon={null}>Guardar</BotonPrimario>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PARTES DE INCIDENCIA
// ═══════════════════════════════════════════════════════════════════
function Partes() {
  const { datos: partes } = useColeccion("mant_partes");
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const vacio = { titulo: "", descripcion: "", zona: ZONAS[0], gravedad: "Leve", estado: "Pendiente", reportadoPor: "" };
  const [form, setForm] = useState(vacio);

  function abrirNuevo() { setEditando(null); setForm(vacio); setModal(true); }
  function abrirEditar(p) { setEditando(p); setForm({ ...vacio, ...p }); setModal(true); }

  async function guardar() {
    if (!form.titulo.trim()) return;
    if (editando) await actualizarDoc("mant_partes", editando.id, form);
    else await crearDoc("mant_partes", form);
    setModal(false);
  }

  return (
    <div>
      <Cabecera titulo="Partes de incidencia" subtitulo="Averías, daños o problemas detectados en el campo.">
        <BotonPrimario onClick={abrirNuevo}>Nuevo parte</BotonPrimario>
      </Cabecera>

      <div className="space-y-2">
        {partes.length === 0 && <p className="text-sm text-stone-400">No hay partes registrados.</p>}
        {partes.map((p) => (
          <Tarjeta key={p.id} onClick={() => abrirEditar(p)} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: VERDE_NEGRO }}>{p.titulo}</p>
                <p className="text-xs text-stone-500 mt-0.5">{p.zona} · {fechaCorta(p.creadoEn)} {p.reportadoPor ? `· ${p.reportadoPor}` : ""}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Badge tone={toneGravedad(p.gravedad)}>{p.gravedad}</Badge>
                <Badge tone={toneEstado(p.estado)}>{p.estado}</Badge>
              </div>
            </div>
          </Tarjeta>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar parte" : "Nuevo parte de incidencia"} wide>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Título"><input className={inputCls} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></Field>
          <Field label="Zona">
            <select className={inputCls} value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })}>
              {ZONAS.map((z) => <option key={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Gravedad">
            <select className={inputCls} value={form.gravedad} onChange={(e) => setForm({ ...form, gravedad: e.target.value })}>
              {GRAVEDADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_TAREA.map((e2) => <option key={e2}>{e2}</option>)}
            </select>
          </Field>
          <Field label="Reportado por">
            <select className={inputCls} value={form.reportadoPor} onChange={(e) => setForm({ ...form, reportadoPor: e.target.value })}>
              <option value="">—</option>
              {equipo.map((m) => <option key={m.id}>{m.nombre}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Descripción"><textarea className={inputCls} rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></Field>
        <div className="flex justify-between items-center mt-4">
          {editando ? (
            <button onClick={async () => { await borrarDoc("mant_partes", editando.id); setModal(false); }} className="inline-flex items-center gap-1.5 text-red-600 text-sm hover:text-red-700">
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <span />}
          <BotonPrimario onClick={guardar} icon={null}>Guardar</BotonPrimario>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// APLICACIONES (fitosanitarios / fertilizantes)
// ═══════════════════════════════════════════════════════════════════
function Aplicaciones() {
  const { datos: aplicaciones } = useColeccion("mant_aplicaciones");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const vacio = { producto: "", tipo: TIPOS_APLICACION[0], zona: ZONAS[0], dosis: "", superficie: "", fechaAplicacion: "", plazoSeguridad: "", condiciones: "", aplicadoPor: "", notas: "" };
  const [form, setForm] = useState(vacio);
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");

  function abrirNuevo() { setEditando(null); setForm(vacio); setModal(true); }
  function abrirEditar(a) { setEditando(a); setForm({ ...vacio, ...a }); setModal(true); }

  async function guardar() {
    if (!form.producto.trim()) return;
    if (editando) await actualizarDoc("mant_aplicaciones", editando.id, form);
    else await crearDoc("mant_aplicaciones", form);
    setModal(false);
  }

  return (
    <div>
      <Cabecera titulo="Aplicaciones" subtitulo="Registro de fertilizantes y fitosanitarios aplicados al campo.">
        <BotonPrimario onClick={abrirNuevo}>Nueva aplicación</BotonPrimario>
      </Cabecera>

      <Tarjeta className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-3.5 font-medium">Producto</th>
              <th className="px-5 py-3.5 font-medium">Tipo</th>
              <th className="px-5 py-3.5 font-medium">Zona</th>
              <th className="px-5 py-3.5 font-medium">Fecha</th>
              <th className="px-5 py-3.5 font-medium">Carencia</th>
            </tr>
          </thead>
          <tbody>
            {aplicaciones.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-stone-400">Sin aplicaciones registradas.</td></tr>
            )}
            {aplicaciones.map((a) => (
              <tr key={a.id} onClick={() => abrirEditar(a)} className="border-b border-stone-50 last:border-0 cursor-pointer hover:bg-stone-50/70 transition">
                <td className="px-5 py-3.5 font-medium" style={{ color: VERDE_NEGRO }}>{a.producto}</td>
                <td className="px-5 py-3.5 text-stone-600">{a.tipo}</td>
                <td className="px-5 py-3.5 text-stone-600">{a.zona}</td>
                <td className="px-5 py-3.5 text-stone-600">{a.fechaAplicacion || "—"}</td>
                <td className="px-5 py-3.5 text-stone-600">{a.plazoSeguridad ? `${a.plazoSeguridad} días` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar aplicación" : "Nueva aplicación"} wide>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Producto"><input className={inputCls} value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} /></Field>
          <Field label="Tipo">
            <select className={inputCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS_APLICACION.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Zona">
            <select className={inputCls} value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })}>
              {ZONAS.map((z) => <option key={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Dosis"><input className={inputCls} placeholder="p.ej. 25 g/m²" value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} /></Field>
          <Field label="Superficie tratada"><input className={inputCls} placeholder="p.ej. 6.500 m²" value={form.superficie} onChange={(e) => setForm({ ...form, superficie: e.target.value })} /></Field>
          <Field label="Fecha de aplicación"><input type="date" className={inputCls} value={form.fechaAplicacion} onChange={(e) => setForm({ ...form, fechaAplicacion: e.target.value })} /></Field>
          <Field label="Plazo de seguridad (días)"><input type="number" className={inputCls} value={form.plazoSeguridad} onChange={(e) => setForm({ ...form, plazoSeguridad: e.target.value })} /></Field>
          <Field label="Aplicado por">
            <select className={inputCls} value={form.aplicadoPor} onChange={(e) => setForm({ ...form, aplicadoPor: e.target.value })}>
              <option value="">—</option>
              {equipo.map((m) => <option key={m.id}>{m.nombre}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Condiciones climáticas"><input className={inputCls} placeholder="p.ej. 18°C, sin viento" value={form.condiciones} onChange={(e) => setForm({ ...form, condiciones: e.target.value })} /></Field>
        <Field label="Notas"><textarea className={inputCls} rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></Field>
        <div className="flex justify-between items-center mt-4">
          {editando ? (
            <button onClick={async () => { await borrarDoc("mant_aplicaciones", editando.id); setModal(false); }} className="inline-flex items-center gap-1.5 text-red-600 text-sm hover:text-red-700">
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <span />}
          <BotonPrimario onClick={guardar} icon={null}>Guardar</BotonPrimario>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAQUINARIA
// ═══════════════════════════════════════════════════════════════════
function Maquinaria() {
  const { datos: maquinaria } = useColeccion("mant_maquinaria", "nombre", "asc");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const vacio = { nombre: "", tipo: "", modelo: "", horometro: "", estado: ESTADOS_MAQUINA[0], proximoMantenimiento: "", notas: "" };
  const [form, setForm] = useState(vacio);

  function abrirNuevo() { setEditando(null); setForm(vacio); setModal(true); }
  function abrirEditar(m) { setEditando(m); setForm({ ...vacio, ...m }); setModal(true); }

  async function guardar() {
    if (!form.nombre.trim()) return;
    if (editando) await actualizarDoc("mant_maquinaria", editando.id, form);
    else await crearDoc("mant_maquinaria", form);
    setModal(false);
  }

  return (
    <div>
      <Cabecera titulo="Maquinaria" subtitulo="Estado y mantenimiento del parque de maquinaria.">
        <BotonPrimario onClick={abrirNuevo}>Añadir máquina</BotonPrimario>
      </Cabecera>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {maquinaria.length === 0 && <p className="text-sm text-stone-400">Sin maquinaria registrada.</p>}
        {maquinaria.map((m) => (
          <Tarjeta key={m.id} onClick={() => abrirEditar(m)} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold" style={{ color: VERDE_NEGRO }}>{m.nombre}</p>
                <p className="text-xs text-stone-500">{m.tipo} {m.modelo ? `· ${m.modelo}` : ""}</p>
              </div>
              <Badge tone={toneEstado(m.estado)}>{m.estado}</Badge>
            </div>
            {m.horometro && <p className="text-xs text-stone-500">Horómetro: {m.horometro} h</p>}
            {m.proximoMantenimiento && <p className="text-xs text-stone-500">Próx. mantenimiento: {m.proximoMantenimiento}</p>}
          </Tarjeta>
        ))}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar máquina" : "Nueva máquina"} wide>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Nombre"><input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Field>
          <Field label="Tipo"><input className={inputCls} placeholder="p.ej. Cortacésped de greens" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></Field>
          <Field label="Modelo"><input className={inputCls} value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} /></Field>
          <Field label="Horómetro (h)"><input type="number" className={inputCls} value={form.horometro} onChange={(e) => setForm({ ...form, horometro: e.target.value })} /></Field>
          <Field label="Estado">
            <select className={inputCls} value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              {ESTADOS_MAQUINA.map((e2) => <option key={e2}>{e2}</option>)}
            </select>
          </Field>
          <Field label="Próximo mantenimiento"><input type="date" className={inputCls} value={form.proximoMantenimiento} onChange={(e) => setForm({ ...form, proximoMantenimiento: e.target.value })} /></Field>
        </div>
        <Field label="Notas"><textarea className={inputCls} rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></Field>
        <div className="flex justify-between items-center mt-4">
          {editando ? (
            <button onClick={async () => { await borrarDoc("mant_maquinaria", editando.id); setModal(false); }} className="inline-flex items-center gap-1.5 text-red-600 text-sm hover:text-red-700">
              <Trash2 size={14} /> Eliminar
            </button>
          ) : <span />}
          <BotonPrimario onClick={guardar} icon={null}>Guardar</BotonPrimario>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FICHAJES + INFORMES
// ═══════════════════════════════════════════════════════════════════
function cargarJsPDF() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("jsPDF no cargó"));
    document.head.appendChild(s);
  });
}

function horaCorta(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function fechaISO(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fechaLegible(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Empareja fichajes (entrada→salida en orden cronológico) y calcula horas trabajadas por día
function calcularJornadas(fichajesEmpleado) {
  const porDia = {};
  fichajesEmpleado
    .slice()
    .sort((a, b) => (a.momento?.toDate?.() || 0) - (b.momento?.toDate?.() || 0))
    .forEach((f) => {
      const dia = fechaISO(f.momento);
      if (!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(f);
    });

  return Object.entries(porDia).map(([dia, registros]) => {
    let horas = 0;
    let entradaAbierta = null;
    const pares = [];
    registros.forEach((r) => {
      const t = r.momento?.toDate ? r.momento.toDate() : new Date(r.momento);
      if (r.tipo === "entrada") {
        entradaAbierta = t;
      } else if (r.tipo === "salida" && entradaAbierta) {
        horas += (t - entradaAbierta) / 3600000;
        pares.push({ entrada: entradaAbierta, salida: t });
        entradaAbierta = null;
      }
    });
    return { dia, registros, horas, incompleto: !!entradaAbierta, primeraEntrada: pares[0]?.entrada || entradaAbierta, ultimaSalida: pares[pares.length - 1]?.salida || null };
  }).sort((a, b) => b.dia.localeCompare(a.dia));
}

function Fichajes() {
  const [tab, setTab] = useState("registro");
  const [adminOk, setAdminOk] = useState(null); // null = no autenticado, { nombre } = autenticado

  const tabs = [
    { id: "registro", label: "Fichar" },
    { id: "informes", label: "Informes" },
    { id: "corregir", label: "Corregir" },
  ];

  return (
    <div>
      <Cabecera titulo="Fichajes" subtitulo="Registro horario del equipo e informes de jornada.">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <PillFiltro key={t.id} activo={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</PillFiltro>
          ))}
        </div>
      </Cabecera>
      {tab === "registro" && <FichajeRegistro />}
      {tab === "informes" && <FichajeInformes />}
      {tab === "corregir" && (
        adminOk ? <FichajeCorreccion admin={adminOk} onSalir={() => setAdminOk(null)} /> : <AdminGate onOk={setAdminOk} />
      )}
    </div>
  );
}

// Modal para introducir el PIN de un empleado
function PinModal({ open, onClose, titulo, onConfirm }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setPin(""); setError(""); } }, [open]);

  function confirmar() {
    if (pin.length !== 4) { setError("El PIN debe tener 4 dígitos."); return; }
    const ok = onConfirm(pin);
    if (!ok) setError("PIN incorrecto.");
  }

  return (
    <Modal open={open} onClose={onClose} title={titulo}>
      <input
        autoFocus type="password" inputMode="numeric" maxLength={4}
        className={cx(inputCls, "text-center text-2xl tracking-[0.5em]")}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        onKeyDown={(e) => e.key === "Enter" && confirmar()}
        placeholder="····"
      />
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      <BotonPrimario onClick={confirmar} icon={KeyRound}>Confirmar</BotonPrimario>
    </Modal>
  );
}

// Pantalla de acceso al panel de corrección (solo empleados marcados como administrador)
function AdminGate({ onOk }) {
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
  const admins = equipo.filter((m) => m.esAdmin);
  const [nombre, setNombre] = useState("");
  const [pinModal, setPinModal] = useState(false);

  return (
    <Tarjeta className="p-6 max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={18} className="text-stone-500" />
        <p className="text-sm text-stone-500">Solo personal administrador puede corregir fichajes. Identifícate para continuar.</p>
      </div>
      <Field label="Administrador">
        <select className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)}>
          <option value="">Selecciona…</option>
          {admins.map((m) => <option key={m.id}>{m.nombre}</option>)}
        </select>
      </Field>
      <button
        disabled={!nombre}
        onClick={() => setPinModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-30 mt-1"
        style={{ background: VERDE_NEGRO }}
      ><KeyRound size={16} /> Introducir PIN</button>

      <PinModal
        open={pinModal}
        onClose={() => setPinModal(false)}
        titulo={`PIN de ${nombre}`}
        onConfirm={(pin) => {
          const m = admins.find((a) => a.nombre === nombre);
          if (m && m.pin && m.pin === pin) { onOk({ nombre }); setPinModal(false); return true; }
          return false;
        }}
      />
    </Tarjeta>
  );
}

function FichajeRegistro() {
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
  const { datos: fichajes } = useColeccion("mant_fichajes", "momento", "desc");
  const [pinPara, setPinPara] = useState(null); // { nombre, tipo }

  const hoy = fechaISO(new Date());
  const fichajesHoy = fichajes.filter((f) => fechaISO(f.momento) === hoy);

  function ultimoEstado(nombre) {
    const propios = fichajesHoy.filter((f) => f.empleado === nombre);
    if (propios.length === 0) return "fuera";
    return propios[0].tipo === "entrada" ? "dentro" : "fuera";
  }

  // Aviso de descanso: si han pasado menos de 12h desde la última salida (mínimo legal)
  function avisoDescanso(nombre) {
    const propios = fichajes.filter((f) => f.empleado === nombre && f.tipo === "salida");
    if (propios.length === 0) return null;
    const ultima = propios[0].momento?.toDate ? propios[0].momento.toDate() : null;
    if (!ultima) return null;
    const horasDesde = (new Date() - ultima) / 3600000;
    if (horasDesde < 12 && horasDesde >= 0) return `Han pasado solo ${horasDesde.toFixed(1)}h desde la última salida (mínimo legal: 12h de descanso)`;
    return null;
  }

  async function fichar(nombre, tipo) {
    await crearDoc("mant_fichajes", { empleado: nombre, tipo, momento: serverTimestamp() });
  }

  function pedirFichaje(m, tipo) {
    if (!m.pin) { alert(`${m.nombre} no tiene un PIN configurado todavía. Añádelo en Equipo.`); return; }
    setPinPara({ nombre: m.nombre, pin: m.pin, tipo });
  }

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {equipo.map((m) => {
          const estado = ultimoEstado(m.nombre);
          const aviso = estado === "fuera" ? avisoDescanso(m.nombre) : null;
          return (
            <Tarjeta key={m.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold" style={{ color: VERDE_NEGRO }}>{m.nombre}</p>
                <Badge tone={estado === "dentro" ? "verde" : "neutral"}>{estado === "dentro" ? "Dentro" : "Fuera"}</Badge>
              </div>
              {aviso && (
                <p className="text-xs text-red-600 mb-2 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {aviso}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  disabled={estado === "dentro"}
                  onClick={() => pedirFichaje(m, "entrada")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-30"
                  style={{ background: VERDE_NEGRO }}
                ><LogIn size={14} /> Entrada</button>
                <button
                  disabled={estado === "fuera"}
                  onClick={() => pedirFichaje(m, "salida")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-30"
                  style={{ background: DORADO }}
                ><LogOut size={14} /> Salida</button>
              </div>
            </Tarjeta>
          );
        })}
      </div>

      <Tarjeta className="p-5">
        <h2 className="font-semibold mb-3 text-[15px]" style={{ color: VERDE_NEGRO }}>Fichajes de hoy</h2>
        {fichajesHoy.length === 0 && <p className="text-sm text-stone-400">Nadie ha fichado todavía.</p>}
        <ul className="space-y-1">
          {fichajesHoy.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-sm border-b border-stone-50 last:border-0 py-1.5">
              <span className="text-stone-700">{f.empleado}</span>
              <span className="flex items-center gap-2 text-stone-500">
                <Badge tone={f.tipo === "entrada" ? "verde" : "dorado"}>{f.tipo}</Badge>
                {horaCorta(f.momento)}
              </span>
            </li>
          ))}
        </ul>
      </Tarjeta>

      <PinModal
        open={!!pinPara}
        onClose={() => setPinPara(null)}
        titulo={pinPara ? `PIN de ${pinPara.nombre} · ${pinPara.tipo}` : ""}
        onConfirm={(pin) => {
          if (pinPara && pin === pinPara.pin) { fichar(pinPara.nombre, pinPara.tipo); setPinPara(null); return true; }
          return false;
        }}
      />
    </div>
  );
}

function FichajeInformes() {
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
  const { datos: fichajes } = useColeccion("mant_fichajes", "momento", "desc");
  const [empleado, setEmpleado] = useState("");
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return fechaISO(d);
  });
  const [hasta, setHasta] = useState(fechaISO(new Date()));

  const fichajesEmpleado = useMemo(
    () => fichajes.filter((f) => (!empleado || f.empleado === empleado) && fechaISO(f.momento) >= desde && fechaISO(f.momento) <= hasta),
    [fichajes, empleado, desde, hasta]
  );

  const jornadas = useMemo(() => calcularJornadas(fichajesEmpleado), [fichajesEmpleado]);
  const totalHoras = jornadas.reduce((acc, j) => acc + j.horas, 0);

  async function exportarPDF() {
    if (!empleado) { alert("Elige un empleado para exportar el informe."); return; }
    await cargarJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16); doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 80, 30);
    doc.text("Golf Ciudad Real C.D. · Informe de horario", W / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80);
    doc.text(`Empleado: ${empleado}`, 15, y); y += 6;
    doc.text(`Periodo: ${fechaLegible(desde)} – ${fechaLegible(hasta)}`, 15, y); y += 10;

    doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", 15, y); doc.text("Entrada", 60, y); doc.text("Salida", 95, y); doc.text("Horas", 130, y);
    y += 2; doc.line(15, y, W - 15, y); y += 5;
    doc.setFont("helvetica", "normal");
    jornadas.slice().sort((a, b) => a.dia.localeCompare(b.dia)).forEach((j) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(fechaLegible(j.dia), 15, y);
      doc.text(j.primeraEntrada ? j.primeraEntrada.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—", 60, y);
      doc.text(j.ultimaSalida ? j.ultimaSalida.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : (j.incompleto ? "sin fichar" : "—"), 95, y);
      doc.text(j.horas.toFixed(2) + " h", 130, y);
      y += 6;
    });
    y += 4; doc.line(15, y, W - 15, y); y += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`Total horas del periodo: ${totalHoras.toFixed(2)} h`, 15, y);

    doc.save(`informe_horario_${empleado.replace(/\s+/g, "_")}_${desde}_${hasta}.pdf`);
  }

  return (
    <div>
      <Tarjeta className="p-4 mb-4">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Field label="Empleado">
            <select className={inputCls} value={empleado} onChange={(e) => setEmpleado(e.target.value)}>
              <option value="">Todos</option>
              {equipo.map((m) => <option key={m.id}>{m.nombre}</option>)}
            </select>
          </Field>
          <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
          <BotonPrimario onClick={exportarPDF} icon={FileDown}>Exportar PDF</BotonPrimario>
        </div>
      </Tarjeta>

      <Tarjeta className="p-5 mb-4">
        <p className="text-sm text-stone-500">Total del periodo</p>
        <p className="text-3xl font-semibold" style={{ color: VERDE_NEGRO, fontFamily: SERIF }}>{totalHoras.toFixed(2)} h</p>
      </Tarjeta>

      <Tarjeta className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-3.5 font-medium">Fecha</th>
              <th className="px-5 py-3.5 font-medium">Entrada</th>
              <th className="px-5 py-3.5 font-medium">Salida</th>
              <th className="px-5 py-3.5 font-medium">Horas</th>
            </tr>
          </thead>
          <tbody>
            {jornadas.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-stone-400">Sin fichajes en este periodo.</td></tr>
            )}
            {jornadas.map((j) => (
              <tr key={j.dia} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-3.5 font-medium" style={{ color: VERDE_NEGRO }}>{fechaLegible(j.dia)}</td>
                <td className="px-5 py-3.5 text-stone-600">{j.primeraEntrada ? j.primeraEntrada.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td className="px-5 py-3.5 text-stone-600">{j.ultimaSalida ? j.ultimaSalida.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : (j.incompleto ? <span className="text-red-500">sin fichar salida</span> : "—")}</td>
                <td className="px-5 py-3.5 text-stone-600">{j.horas.toFixed(2)} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CORRECCIÓN MANUAL DE FICHAJES (solo administradores)
// ═══════════════════════════════════════════════════════════════════
function FichajeCorreccion({ admin, onSalir }) {
  const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
  const { datos: fichajes } = useColeccion("mant_fichajes", "momento", "desc");
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroFecha, setFiltroFecha] = useState(fechaISO(new Date()));
  const [editando, setEditando] = useState(null); // fichaje en edición
  const [modalNuevo, setModalNuevo] = useState(false);

  const lista = fichajes.filter(
    (f) => (!filtroEmpleado || f.empleado === filtroEmpleado) && (!filtroFecha || fechaISO(f.momento) === filtroFecha)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-stone-500">Sesión de corrección: <strong className="text-stone-700">{admin.nombre}</strong></p>
        <button onClick={onSalir} className="text-sm text-stone-500 underline hover:text-stone-700">Salir del modo corrección</button>
      </div>

      <Tarjeta className="p-4 mb-4">
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <Field label="Empleado">
            <select className={inputCls} value={filtroEmpleado} onChange={(e) => setFiltroEmpleado(e.target.value)}>
              <option value="">Todos</option>
              {equipo.map((m) => <option key={m.id}>{m.nombre}</option>)}
            </select>
          </Field>
          <Field label="Fecha"><input type="date" className={inputCls} value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} /></Field>
          <BotonPrimario onClick={() => setModalNuevo(true)}>Añadir fichaje manual</BotonPrimario>
        </div>
      </Tarjeta>

      <Tarjeta className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
              <th className="px-5 py-3.5 font-medium">Empleado</th>
              <th className="px-5 py-3.5 font-medium">Tipo</th>
              <th className="px-5 py-3.5 font-medium">Fecha y hora</th>
              <th className="px-5 py-3.5 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-stone-400">Sin fichajes con este filtro.</td></tr>
            )}
            {lista.map((f) => (
              <tr key={f.id} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-3.5 font-medium" style={{ color: VERDE_NEGRO }}>{f.empleado}</td>
                <td className="px-5 py-3.5"><Badge tone={f.tipo === "entrada" ? "verde" : "dorado"}>{f.tipo}</Badge></td>
                <td className="px-5 py-3.5 text-stone-600">{fechaLegible(fechaISO(f.momento))} · {horaCorta(f.momento)}</td>
                <td className="px-5 py-3.5 text-right">
                  <button onClick={() => setEditando(f)} className="text-stone-400 hover:text-stone-700 p-1 rounded hover:bg-stone-100 transition mr-1">
                    <Pencil size={14} />
                  </button>
                  <button onClick={async () => { if (confirm("¿Eliminar este fichaje?")) await borrarDoc("mant_fichajes", f.id); }} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <FichajeFormModal
        open={!!editando || modalNuevo}
        fichaje={editando}
        equipo={equipo}
        onClose={() => { setEditando(null); setModalNuevo(false); }}
      />
    </div>
  );
}

function FichajeFormModal({ open, fichaje, equipo, onClose }) {
  const vacio = { empleado: "", tipo: "entrada", fecha: fechaISO(new Date()), hora: "08:00" };
  const [form, setForm] = useState(vacio);

  useEffect(() => {
    if (fichaje) {
      const d = fichaje.momento?.toDate ? fichaje.momento.toDate() : new Date();
      setForm({
        empleado: fichaje.empleado, tipo: fichaje.tipo,
        fecha: fechaISO(d),
        hora: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      });
    } else if (open) {
      setForm(vacio);
    }
  }, [fichaje, open]);

  async function guardar() {
    if (!form.empleado) { alert("Elige un empleado."); return; }
    const [h, min] = form.hora.split(":").map(Number);
    const [y, m, d] = form.fecha.split("-").map(Number);
    const fechaCompleta = new Date(y, m - 1, d, h, min);
    const datos = { empleado: form.empleado, tipo: form.tipo, momento: Timestamp.fromDate(fechaCompleta) };

    if (fichaje) await actualizarDoc("mant_fichajes", fichaje.id, datos);
    else await crearDoc("mant_fichajes", datos);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={fichaje ? "Editar fichaje" : "Añadir fichaje manual"}>
      <Field label="Empleado">
        <select className={inputCls} value={form.empleado} onChange={(e) => setForm({ ...form, empleado: e.target.value })}>
          <option value="">Selecciona…</option>
          {equipo.map((m) => <option key={m.id}>{m.nombre}</option>)}
        </select>
      </Field>
      <Field label="Tipo">
        <select className={inputCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          <option value="entrada">entrada</option>
          <option value="salida">salida</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></Field>
        <Field label="Hora"><input type="time" className={inputCls} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></Field>
      </div>
      <BotonPrimario onClick={guardar} icon={null}>Guardar</BotonPrimario>
    </Modal>
  );
}
