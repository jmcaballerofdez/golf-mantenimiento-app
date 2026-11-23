$path = "src\App.jsx"
$lines = Get-Content $path -Encoding UTF8

Write-Host "Linea 688 actual:" -ForegroundColor Yellow
Write-Host $lines[687]

if ($lines[687] -match "PGA") {
  $indent = ($lines[687] -replace '\S.*$', '')
  $lines[687] = $indent + "Golf Ciudad Real C.D."
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines((Resolve-Path $path), $lines, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
} else {
  Write-Host "FALLO - la linea 688 no contiene PGA, revisar manualmente." -ForegroundColor Red
}