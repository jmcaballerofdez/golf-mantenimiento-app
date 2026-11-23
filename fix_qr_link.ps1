$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$old = '<p className="text-xs text-stone-500 mb-3 break-all">{urlFichaje(p)}</p>'
$new = '<a href={urlFichaje(p)} target="_blank" rel="noreferrer" className="text-xs block mb-3 break-all" style={{ color: DORADO }}>{urlFichaje(p)}</a>'

$c = ([regex]::Matches($content, [regex]::Escape($old))).Count
if ($c -ne 1) {
  Write-Host "MISMATCH (x$c)" -ForegroundColor Red
} else {
  $content = $content.Replace($old, $new)
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
}