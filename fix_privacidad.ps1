$path = "src\App.jsx"
$lines = Get-Content $path -Encoding UTF8

$checks = @(
  @{ idx = 708;  expect = '{vista === "planificacion" && <PlanificacionSemanal userRole={userRole} />}' },
  @{ idx = 714;  expect = '{vista === "fichajes" && <Fichajes />}' },
  @{ idx = 1658; expect = 'function PlanificacionSemanal({ userRole }) {' },
  @{ idx = 1778; expect = '{equipo.map((op) => (' },
  @{ idx = 1973; expect = 'function Fichajes() {' },
  @{ idx = 1977; expect = 'const tabs = [' },
  @{ idx = 1978; expect = '{ id: "registro", label: "Fichar" },' },
  @{ idx = 1979; expect = '{ id: "informes", label: "Informes" },' },
  @{ idx = 1980; expect = '{ id: "corregir", label: "Corregir" },' },
  @{ idx = 1981; expect = '];' },
  @{ idx = 1992; expect = '{tab === "registro" && <FichajeRegistro />}' },
  @{ idx = 2070; expect = 'function FichajeRegistro() {' },
  @{ idx = 2076; expect = 'const fichajesHoy = fichajes.filter((f) => fechaISO(f.momento) === hoy && !f.anulado && !f.corregido);' },
  @{ idx = 2107; expect = '{equipo.map((m) => {' }
)

$ok = $true
foreach ($c in $checks) {
  $actual = $lines[$c.idx].Trim()
  if ($actual -ne $c.expect) {
    Write-Host "MISMATCH en linea $($c.idx + 1):" -ForegroundColor Red
    Write-Host "  Esperado:   $($c.expect)" -ForegroundColor Yellow
    Write-Host "  Encontrado: $actual" -ForegroundColor Yellow
    $ok = $false
  }
}

if (-not $ok) {
  Write-Host "FALLO - no se ha modificado nada. Revisa los mismatches de arriba." -ForegroundColor Red
} else {
  function Indent($s) { return ($s -replace '\S.*$', '') }

  $lines[708]  = (Indent $lines[708])  + '{vista === "planificacion" && <PlanificacionSemanal userRole={userRole} nombreOperario={nombreOperario} />}'
  $lines[714]  = (Indent $lines[714])  + '{vista === "fichajes" && <Fichajes userRole={userRole} nombreOperario={nombreOperario} />}'
  $lines[1658] = (Indent $lines[1658]) + 'function PlanificacionSemanal({ userRole, nombreOperario }) {'
  $lines[1778] = (Indent $lines[1778]) + '{equipo.filter((op) => userRole !== "jardinero" || op.nombre === nombreOperario).map((op) => ('
  $lines[1973] = (Indent $lines[1973]) + 'function Fichajes({ userRole, nombreOperario }) {'

  $indentTabs = Indent $lines[1977]
  $newTabs = @(
    $indentTabs + 'const tabs = userRole === "jardinero"',
    $indentTabs + '  ? [{ id: "registro", label: "Fichar" }]',
    $indentTabs + '  : [',
    $indentTabs + '      { id: "registro", label: "Fichar" },',
    $indentTabs + '      { id: "informes", label: "Informes" },',
    $indentTabs + '      { id: "corregir", label: "Corregir" },',
    $indentTabs + '    ];'
  )
  $before = $lines[0..1976]
  $after  = $lines[1982..($lines.Count - 1)]
  $lines = $before + $newTabs + $after

  $shift = 2
  $idx1992 = 1992 + $shift
  $idx2070 = 2070 + $shift
  $idx2076 = 2076 + $shift
  $idx2107 = 2107 + $shift

  $lines[$idx1992] = (Indent $lines[$idx1992]) + '{tab === "registro" && <FichajeRegistro userRole={userRole} nombreOperario={nombreOperario} />}'
  $lines[$idx2070] = (Indent $lines[$idx2070]) + 'function FichajeRegistro({ userRole, nombreOperario }) {'
  $lines[$idx2076] = (Indent $lines[$idx2076]) + 'const fichajesHoy = fichajes.filter((f) => fechaISO(f.momento) === hoy && !f.anulado && !f.corregido && (userRole !== "jardinero" || f.empleado === nombreOperario));'
  $lines[$idx2107] = (Indent $lines[$idx2107]) + '{equipo.filter((m) => userRole !== "jardinero" || m.nombre === nombreOperario).map((m) => {'

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines((Resolve-Path $path), $lines, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
}