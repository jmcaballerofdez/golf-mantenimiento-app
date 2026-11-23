$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$old1 = 'Cabecera titulo="Registro de trabajo" subtitulo="Inicia y finaliza tareas para registrar tiempos, maquinaria y combustible." />'
$new1 = 'Cabecera titulo="Registro de trabajo" subtitulo="Inicia y finaliza tareas para registrar tiempos, maquinaria y combustible.">
        {userRole !== "jardinero" && (
          <BotonSecundario onClick={() => setMostrarInformes(true)} icon={BarChart3}>Informes</BotonSecundario>
        )}
      </Cabecera>'

$c1 = ([regex]::Matches($content, [regex]::Escape($old1))).Count
Write-Host "Ancla boton (x$c1)" -ForegroundColor Yellow

$pattern2 = '<div className="mt-4"><BotonPrimario onClick=\{finalizar\} icon=\{null\}>Finalizar</BotonPrimario></div>\s*</Modal>\s*</div>\s*\);\s*\}\s*function PlanificacionSemanal\(\{ userRole \}\) \{'

$m2 = [regex]::Matches($content, $pattern2)
Write-Host "Ancla modal (x$($m2.Count))" -ForegroundColor Yellow

if ($c1 -eq 1 -and $m2.Count -eq 1) {
  $content = $content.Replace($old1, $new1)

  $replacement2 = @'
<div className="mt-4"><BotonPrimario onClick={finalizar} icon={null}>Finalizar</BotonPrimario></div>
        </Modal>

        <ModalInformesRegistroTrabajo open={mostrarInformes} onClose={() => setMostrarInformes(false)} />
      </div>
    );
  }

  function ModalInformesRegistroTrabajo({ open, onClose }) {
    const { datos: equipo } = useColeccion("mant_equipo", "nombre", "asc");
    const { datos: tipos } = useColeccion("mant_tipos_tarea", "nombre", "asc");
    const { datos: registros } = useColeccion("mant_registro_trabajo", "inicio", "desc");

    const hoy = new Date().toISOString().slice(0, 10);
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [desde, setDesde] = useState(hace30);
    const [hasta, setHasta] = useState(hoy);

    function fechaDe(r) {
      return r.inicio?.toDate ? r.inicio.toDate().toISOString().slice(0, 10) : null;
    }

    function minutosDe(r) {
      if (!r.inicio?.toDate || !r.fin?.toDate) return null;
      return Math.round((r.fin.toDate() - r.inicio.toDate()) / 60000);
    }

    const completados = registros.filter((r) => {
      const f = fechaDe(r);
      return f && f >= desde && f <= hasta && r.fin;
    });

    function resumenPorOperario() {
      return equipo.map((op) => {
        const suyos = completados.filter((r) => r.operarioUid === op.id || r.operarioNombre === op.nombre);
        const minutos = suyos.map(minutosDe).filter((m) => m != null);
        const total = minutos.reduce((s, m) => s + m, 0);
        const media = minutos.length ? Math.round(total / minutos.length) : 0;
        return { nombre: op.nombre, cantidad: suyos.length, total, media };
      }).filter((r) => r.cantidad > 0);
    }

    function resumenPorTipo() {
      return tipos.map((t) => {
        const suyos = completados.filter((r) => r.tipoTareaId === t.id);
        const minutos = suyos.map(minutosDe).filter((m) => m != null);
        const total = minutos.reduce((s, m) => s + m, 0);
        const media = minutos.length ? Math.round(total / minutos.length) : 0;
        const estimada = t.duracionEstimada ? Number(t.duracionEstimada) : null;
        const exceso = estimada ? media - estimada : null;
        return { nombre: t.nombre, cantidad: suyos.length, media, estimada, exceso };
      }).filter((r) => r.cantidad > 0);
    }

    function fmt(min) {
      if (min < 60) return `${min} min`;
      return `${Math.floor(min / 60)}h ${min % 60}min`;
    }

    return (
      <Modal open={open} onClose={onClose} title="Informes de registro de trabajo" wide>
        <div className="grid sm:grid-cols-2 gap-x-4 mb-4">
          <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>
        </div>

        <p className="text-sm font-semibold mb-2" style={{ color: BLANCO }}>Por operario</p>
        <div className="space-y-1.5 mb-5">
          {resumenPorOperario().length === 0 && <p className="text-xs text-stone-500">Sin datos en este periodo.</p>}
          {resumenPorOperario().map((r) => (
            <div key={r.nombre} className="flex items-center justify-between text-sm p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span style={{ color: BLANCO }}>{r.nombre}</span>
              <span className="text-xs text-stone-400">{r.cantidad} tareas - {fmt(r.total)} total - media {fmt(r.media)}</span>
            </div>
          ))}
        </div>

        <p className="text-sm font-semibold mb-2" style={{ color: BLANCO }}>Por tipo de tarea</p>
        <div className="space-y-1.5">
          {resumenPorTipo().length === 0 && <p className="text-xs text-stone-500">Sin datos en este periodo.</p>}
          {resumenPorTipo().map((r) => (
            <div key={r.nombre} className="flex items-center justify-between text-sm p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>
              <span style={{ color: BLANCO }}>{r.nombre}</span>
              <span className="text-xs text-stone-400">
                {r.cantidad} veces - media {fmt(r.media)}
                {r.estimada != null && (
                  r.exceso > 5 ? <span className="text-red-400"> - +{r.exceso}min sobre estimado</span> :
                  r.exceso < -5 ? <span className="text-emerald-400"> - {r.exceso}min bajo estimado</span> :
                  <span> - dentro de lo estimado</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  function PlanificacionSemanal({ userRole }) {
'@

  $content = [regex]::Replace($content, $pattern2, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $replacement2 })

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
} else {
  Write-Host "FALLO - NADA GUARDADO. c1=$c1 m2=$($m2.Count)" -ForegroundColor Red
}