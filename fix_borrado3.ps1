$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$anchors = @(
  @{ old = '{r.fin ? ` - ${horaCorta(r.fin)}` : ""}</p>'; new = (@('{r.fin ? ` - ${horaCorta(r.fin)}` : ""}</p>', '                  {userRole !== "jardinero" && (', '                    <button onClick={async () => { if (!confirm("Eliminar este registro de trabajo?")) return; await borrarDoc("mant_registro_trabajo", r.id); }} className="text-stone-400 hover:text-red-500 ml-2"><Trash2 size={12} /></button>', '                  )}') -join "`n") },
  @{ old = '<span className="font-semibold text-sm" style={{ color: DORADO }}>{l.lectura} m3</span>'; new = (@('<span className="font-semibold text-sm" style={{ color: DORADO }}>{l.lectura} m3</span>', '                {userRole !== "jardinero" && (', '                  <button onClick={async () => { if (!confirm("Eliminar esta lectura?")) return; await borrarDoc("mant_lecturas_caudalimetro", l.id); }} className="text-stone-400 hover:text-red-500 ml-2 shrink-0"><Trash2 size={14} /></button>', '                )}') -join "`n") }
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
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
}