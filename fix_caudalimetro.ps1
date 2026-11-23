$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$anchors = @(
  @{ old = 'UserPlus, Mail, Timer, Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, BarChart3,'; new = 'UserPlus, Mail, Timer, Calendar, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, BarChart3, Droplets,' },
  @{ old = 'const VISTAS_JARDINERO = ["registro_trabajo", "planificacion", "maquinaria", "fichajes"];'; new = 'const VISTAS_JARDINERO = ["registro_trabajo", "planificacion", "maquinaria", "fichajes", "caudalimetro"];' },
  @{ old = 'return ["registro_trabajo", "planificacion", "maquinaria", "fichajes"].includes(it.id);'; new = 'return ["registro_trabajo", "planificacion", "maquinaria", "fichajes", "caudalimetro"].includes(it.id);' },
  @{ old = '{ id: "registro_trabajo", label: "Registro de trabajo", Icon: Timer },'; new = '{ id: "registro_trabajo", label: "Registro de trabajo", Icon: Timer },
          { id: "caudalimetro", label: "Caudalimetro", Icon: Droplets },' },
  @{ old = 'maquinaria: "Maquinaria", tipos_tarea: "Tipos de tarea", registro_trabajo: "Registro de trabajo", planificacion: "Planificacion", carga_trabajo: "Carga de trabajo", fichajes: "Fichajes", ausencias: "Ausencias y vacaciones",'; new = 'maquinaria: "Maquinaria", tipos_tarea: "Tipos de tarea", registro_trabajo: "Registro de trabajo", planificacion: "Planificacion", carga_trabajo: "Carga de trabajo", fichajes: "Fichajes", ausencias: "Ausencias y vacaciones", caudalimetro: "Caudalimetro",' },
  @{ old = '{vista === "fichajes" && <Fichajes userRole={userRole} nombreOperario={nombreOperario} />}'; new = '{vista === "fichajes" && <Fichajes userRole={userRole} nombreOperario={nombreOperario} />}
          {vista === "caudalimetro" && <Caudalimetro usuario={usuario} nombreOperario={nombreOperario} userRole={userRole} />}' }
)

$ok = $true
foreach ($a in $anchors) {
  $c = ([regex]::Matches($content, [regex]::Escape($a.old))).Count
  if ($c -ne 1) {
    Write-Host "MISMATCH (x$c): $($a.old.Substring(0,[Math]::Min(70,$a.old.Length)))" -ForegroundColor Red
    $ok = $false
  }
}

if (-not $ok) {
  Write-Host "FALLO - no se ha tocado nada." -ForegroundColor Red
} else {
  foreach ($a in $anchors) { $content = $content.Replace($a.old, $a.new) }

  $newCodeLines = @(
    '',
    'function Caudalimetro({ usuario, nombreOperario, userRole }) {',
    '  const { datos: caudalimetros } = useColeccion("mant_caudalimetros", "nombre", "asc");',
    '  const { datos: lecturas } = useColeccion("mant_lecturas_caudalimetro", "momento", "desc");',
    '  const [caudalimetroId, setCaudalimetroId] = useState("");',
    '  const [lectura, setLectura] = useState("");',
    '  const [modalConfig, setModalConfig] = useState(false);',
    '',
    '  const misLecturas = userRole === "jardinero" ? lecturas.filter((l) => l.operarioNombre === nombreOperario) : lecturas;',
    '',
    '  async function guardar() {',
    '    if (!caudalimetroId) { alert("Elige un caudalimetro."); return; }',
    '    if (lectura === "" || isNaN(Number(lectura))) { alert("Introduce una lectura valida en m3."); return; }',
    '    const c = caudalimetros.find((x) => x.id === caudalimetroId);',
    '    await crearDoc("mant_lecturas_caudalimetro", {',
    '      caudalimetroId,',
    '      caudalimetroNombre: c?.nombre || "",',
    '      lectura: Number(lectura),',
    '      operarioUid: usuario?.uid || null,',
    '      operarioNombre: nombreOperario || usuario?.email || "Desconocido",',
    '      momento: serverTimestamp(),',
    '    });',
    '    setLectura("");',
    '  }',
    '',
    '  return (',
    '    <div>',
    '      <Cabecera titulo="Caudalimetro" subtitulo="Registra la lectura en m3 de cada contador de agua.">',
    '        {userRole !== "jardinero" && (',
    '          <BotonSecundario onClick={() => setModalConfig(true)} icon={Settings}>Configurar caudalimetros</BotonSecundario>',
    '        )}',
    '      </Cabecera>',
    '',
    '      <Tarjeta className="p-5 mb-6 max-w-md">',
    '        <Field label="Caudalimetro">',
    '          <select className={inputCls} value={caudalimetroId} onChange={(e) => setCaudalimetroId(e.target.value)}>',
    '            <option value="">Selecciona...</option>',
    '            {caudalimetros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}',
    '          </select>',
    '        </Field>',
    '        <Field label="Lectura (m3)">',
    '          <input type="number" step="0.001" className={inputCls} value={lectura} onChange={(e) => setLectura(e.target.value)} placeholder="p.ej. 1234.567" />',
    '        </Field>',
    '        <BotonPrimario onClick={guardar} icon={Droplets} className="mt-1">Registrar lectura</BotonPrimario>',
    '      </Tarjeta>',
    '',
    '      <p className="text-sm font-semibold mb-3" style={{ color: BLANCO }}>Historial{userRole === "jardinero" ? " (mis lecturas)" : ""}</p>',
    '      <div className="space-y-1.5">',
    '        {misLecturas.length === 0 && <p className="text-sm text-stone-400">Sin lecturas registradas.</p>}',
    '        {misLecturas.slice(0, 30).map((l) => (',
    '          <Tarjeta key={l.id} className="p-3 flex items-center justify-between">',
    '            <div>',
    '              <p className="font-medium text-sm" style={{ color: BLANCO }}>{l.caudalimetroNombre}</p>',
    '              <p className="text-xs text-stone-500">{fechaCorta(l.momento)} - {horaCorta(l.momento)}{userRole !== "jardinero" ? ` - ${l.operarioNombre}` : ""}</p>',
    '            </div>',
    '            <span className="font-semibold text-sm" style={{ color: DORADO }}>{l.lectura} m3</span>',
    '          </Tarjeta>',
    '        ))}',
    '      </div>',
    '',
    '      <ModalConfigCaudalimetros open={modalConfig} onClose={() => setModalConfig(false)} caudalimetros={caudalimetros} />',
    '    </div>',
    '  );',
    '}',
    '',
    'function ModalConfigCaudalimetros({ open, onClose, caudalimetros }) {',
    '  const [nuevo, setNuevo] = useState("");',
    '',
    '  async function anadir() {',
    '    if (!nuevo.trim()) return;',
    '    await crearDoc("mant_caudalimetros", { nombre: nuevo.trim() });',
    '    setNuevo("");',
    '  }',
    '',
    '  async function eliminar(id) {',
    '    if (!confirm("Eliminar este caudalimetro del catalogo?")) return;',
    '    await borrarDoc("mant_caudalimetros", id);',
    '  }',
    '',
    '  return (',
    '    <Modal open={open} onClose={onClose} title="Configurar caudalimetros">',
    '      <div className="flex flex-wrap gap-2 mb-4">',
    '        {caudalimetros.map((c) => (',
    '          <span key={c.id} className="inline-flex items-center gap-1.5 text-xs rounded-full pl-3 pr-1.5 py-1" style={{ background: "rgba(198,162,83,0.14)", color: BLANCO }}>',
    '            {c.nombre}',
    '            <button onClick={() => eliminar(c.id)} className="hover:opacity-70"><X size={12} /></button>',
    '          </span>',
    '        ))}',
    '        {caudalimetros.length === 0 && <p className="text-xs text-stone-500">Sin caudalimetros configurados todavia.</p>}',
    '      </div>',
    '      <div className="flex gap-2">',
    '        <input className={inputCls} placeholder="Nuevo caudalimetro..." value={nuevo} onChange={(e) => setNuevo(e.target.value)} />',
    '        <BotonSecundario onClick={anadir} icon={Plus}>Anadir</BotonSecundario>',
    '      </div>',
    '    </Modal>',
    '  );',
    '}'
  )
  $newCode = ($newCodeLines -join "`n")
  $content = $content.TrimEnd() + "`n" + $newCode + "`n"

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
}