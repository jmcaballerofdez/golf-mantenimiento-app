$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$anchors = @(
  @{ old = 'const EQUIPO_INICIAL = ['; new = 'const CAUDALIMETROS_INICIALES = ["Salida del pozo", "Entrada lago", "Salida del bombeo"];
const EQUIPO_INICIAL = [' },
  @{ old = '  const { datos: caudalimetros } = useColeccion("mant_caudalimetros", "nombre", "asc");'; new = '  const { datos: caudalimetros, cargando: cargandoCaudalimetros } = useColeccion("mant_caudalimetros", "nombre", "asc");' },
  @{ old = '  const [lectura, setLectura] = useState("");
  const [modalConfig, setModalConfig] = useState(false);'; new = '  const [lectura, setLectura] = useState("");
  const [modalConfig, setModalConfig] = useState(false);

  useEffect(() => {
    if (!cargandoCaudalimetros && caudalimetros.length === 0) {
      CAUDALIMETROS_INICIALES.forEach((nombre) => crearDoc("mant_caudalimetros", { nombre }));
    }
  }, [cargandoCaudalimetros, caudalimetros.length]);' }
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