$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$anchors = @(
  @{ old = '{r.maquinaNombre ? `${r.maquinaNombre} · ` : ""}{duracion(r)}'; new = (@('{horaCorta(r.inicio)}{r.fin ? ` - ${horaCorta(r.fin)}` : ""} · {r.maquinaNombre ? `${r.maquinaNombre} · ` : ""}{duracion(r)}') -join "`n") },
  @{ old = '{enCurso.maquinaNombre && <p className="text-sm text-stone-400">Maquina: {enCurso.maquinaNombre}</p>}'; new = (@('{enCurso.maquinaNombre && <p className="text-sm text-stone-400">Maquina: {enCurso.maquinaNombre}</p>}', '              <p className="text-sm text-stone-400">Iniciada a las {horaCorta(enCurso.inicio)}</p>') -join "`n") },
  @{ old = 'const misLecturas = userRole === "jardinero" ? lecturas.filter((l) => l.operarioNombre === nombreOperario) : lecturas;'; new = (@('const misLecturas = userRole === "jardinero" ? lecturas.filter((l) => l.operarioNombre === nombreOperario) : lecturas;', '  const [modalInformes, setModalInformes] = useState(false);', '  const [ultimoGuardado, setUltimoGuardado] = useState(null);') -join "`n") },
  @{ old = 'setLectura("");'; new = (@('setLectura("");', '    const ahora = new Date();', '    setUltimoGuardado({ fecha: ahora.toLocaleDateString("es-ES"), hora: ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) });') -join "`n") },
  @{ old = '<BotonPrimario onClick={guardar} icon={Droplets} className="mt-1">Registrar lectura</BotonPrimario>'; new = (@('<BotonPrimario onClick={guardar} icon={Droplets} className="mt-1">Registrar lectura</BotonPrimario>', '        {ultimoGuardado && (', '          <p className="text-xs text-emerald-600 mt-2">Registrado el {ultimoGuardado.fecha} a las {ultimoGuardado.hora}.</p>', '        )}') -join "`n") },
  @{ old = '<BotonSecundario onClick={() => setModalConfig(true)} icon={Settings}>Configurar caudalimetros</BotonSecundario>'; new = (@('<>', '            <BotonSecundario onClick={() => setModalConfig(true)} icon={Settings}>Configurar caudalimetros</BotonSecundario>', '            <BotonSecundario onClick={() => setModalInformes(true)} icon={BarChart3}>Informes</BotonSecundario>', '          </>') -join "`n") },
  @{ old = '<ModalConfigCaudalimetros open={modalConfig} onClose={() => setModalConfig(false)} caudalimetros={caudalimetros} />'; new = (@('<ModalConfigCaudalimetros open={modalConfig} onClose={() => setModalConfig(false)} caudalimetros={caudalimetros} />', '      <ModalInformesCaudalimetro open={modalInformes} onClose={() => setModalInformes(false)} caudalimetros={caudalimetros} lecturas={lecturas} />') -join "`n") }
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
    'function ModalInformesCaudalimetro({ open, onClose, caudalimetros, lecturas }) {',
    '  const [salidaId, setSalidaId] = useState("");',
    '  const [entradaId, setEntradaId] = useState("");',
    '  const hoy = fechaISO(new Date());',
    '  const hace30 = fechaISO(new Date(Date.now() - 30 * 86400000));',
    '  const [desde, setDesde] = useState(hace30);',
    '  const [hasta, setHasta] = useState(hoy);',
    '',
    '  function consumosDiarios(caudalimetroId) {',
    '    if (!caudalimetroId) return {};',
    '    const propias = lecturas',
    '      .filter((l) => l.caudalimetroId === caudalimetroId)',
    '      .slice()',
    '      .sort((a, b) => (a.momento?.toDate?.() || 0) - (b.momento?.toDate?.() || 0));',
    '    const porDia = {};',
    '    propias.forEach((l) => { porDia[fechaISO(l.momento)] = l.lectura; });',
    '    const dias = Object.keys(porDia).sort();',
    '    const consumos = {};',
    '    for (let i = 1; i < dias.length; i++) {',
    '      consumos[dias[i]] = porDia[dias[i]] - porDia[dias[i - 1]];',
    '    }',
    '    return consumos;',
    '  }',
    '',
    '  const consumosSalida = consumosDiarios(salidaId);',
    '  const consumosEntrada = consumosDiarios(entradaId);',
    '  const diasUnion = Array.from(new Set([...Object.keys(consumosSalida), ...Object.keys(consumosEntrada)]))',
    '    .filter((d) => d >= desde && d <= hasta)',
    '    .sort();',
    '',
    '  return (',
    '    <Modal open={open} onClose={onClose} title="Desfase pozo vs. campo" wide>',
    '      <div className="grid sm:grid-cols-2 gap-x-4 mb-4">',
    '        <Field label="Caudalimetro de salida (pozo)">',
    '          <select className={inputCls} value={salidaId} onChange={(e) => setSalidaId(e.target.value)}>',
    '            <option value="">Selecciona...</option>',
    '            {caudalimetros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}',
    '          </select>',
    '        </Field>',
    '        <Field label="Caudalimetro de entrada (campo)">',
    '          <select className={inputCls} value={entradaId} onChange={(e) => setEntradaId(e.target.value)}>',
    '            <option value="">Selecciona...</option>',
    '            {caudalimetros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}',
    '          </select>',
    '        </Field>',
    '      </div>',
    '      <div className="grid sm:grid-cols-2 gap-x-4 mb-4">',
    '        <Field label="Desde"><input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} /></Field>',
    '        <Field label="Hasta"><input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} /></Field>',
    '      </div>',
    '',
    '      {(!salidaId || !entradaId) && <p className="text-xs text-stone-500">Elige ambos caudalimetros para ver el desfase.</p>}',
    '',
    '      {salidaId && entradaId && (',
    '        <div className="space-y-1.5">',
    '          {diasUnion.length === 0 && <p className="text-xs text-stone-500">Sin datos suficientes en este periodo (hacen falta al menos 2 lecturas de cada caudalimetro para calcular el consumo diario).</p>}',
    '          {diasUnion.map((dia) => {',
    '            const salida = consumosSalida[dia];',
    '            const entrada = consumosEntrada[dia];',
    '            const desfase = (salida != null && entrada != null) ? salida - entrada : null;',
    '            return (',
    '              <div key={dia} className="flex items-center justify-between text-sm p-2 rounded" style={{ background: "rgba(255,255,255,0.03)" }}>',
    '                <span style={{ color: BLANCO }}>{fechaLegible(dia)}</span>',
    '                <span className="text-xs text-stone-400">',
    '                  Pozo {salida != null ? `${salida.toFixed(2)} m3` : "-"} - Campo {entrada != null ? `${entrada.toFixed(2)} m3` : "-"}',
    '                  {desfase != null && (',
    '                    Math.abs(desfase) > 0.01',
    '                      ? <span className={desfase > 0 ? "text-amber-600" : "text-emerald-600"}> - desfase {desfase > 0 ? "+" : ""}{desfase.toFixed(2)} m3</span>',
    '                      : <span className="text-emerald-600"> - sin desfase</span>',
    '                  )}',
    '                </span>',
    '              </div>',
    '            );',
    '          })}',
    '        </div>',
    '      )}',
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