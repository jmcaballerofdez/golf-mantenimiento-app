$path = "src\App.jsx"
$content = Get-Content $path -Raw -Encoding UTF8

$anchors = @(
  @{ old = 'import { getAuth, signInWithCustomToken, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";'; new = 'import { getAuth, signInWithCustomToken, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";' },
  @{ old = 'const [nombreOperario, setNombreOperario] = useState(null);'; new = (@('const [nombreOperario, setNombreOperario] = useState(null);', '  const [empleadoId, setEmpleadoId] = useState(null);') -join "`n") },
  @{ old = 'setNombreOperario(snap.exists() ? (snap.data().nombre || null) : null);'; new = (@('setNombreOperario(snap.exists() ? (snap.data().nombre || null) : null);', '            setEmpleadoId(snap.exists() ? (snap.data().empleadoId || null) : null);') -join "`n") },
  @{ old = 'setNombreOperario(null);'; new = (@('setNombreOperario(null);', '        setEmpleadoId(null);') -join "`n") },
  @{ old = 'return { currentUser, userRole, modulosActivos, nombreOperario, cargandoAuth };'; new = 'return { currentUser, userRole, modulosActivos, nombreOperario, empleadoId, cargandoAuth };' },
  @{ old = 'const { currentUser: usuario, userRole, modulosActivos, nombreOperario, cargandoAuth } = useAuthMantenimiento();'; new = 'const { currentUser: usuario, userRole, modulosActivos, nombreOperario, empleadoId, cargandoAuth } = useAuthMantenimiento();' },
  @{ old = 'const VISTAS_JARDINERO = ["registro_trabajo", "planificacion", "maquinaria", "fichajes", "caudalimetro"];'; new = 'const VISTAS_JARDINERO = ["registro_trabajo", "planificacion", "maquinaria", "fichajes", "caudalimetro", "mi_cuenta"];' },
  @{ old = 'return ["registro_trabajo", "planificacion", "maquinaria", "fichajes", "caudalimetro"].includes(it.id);'; new = 'return ["registro_trabajo", "planificacion", "maquinaria", "fichajes", "caudalimetro", "mi_cuenta"].includes(it.id);' },
  @{ old = '{ id: "fichajes", label: "Fichajes", Icon: Clock },'; new = (@('{ id: "fichajes", label: "Fichajes", Icon: Clock },', '          { id: "mi_cuenta", label: "Mi cuenta", Icon: KeyRound },') -join "`n") },
  @{ old = 'maquinaria: "Maquinaria", tipos_tarea: "Tipos de tarea", registro_trabajo: "Registro de trabajo", planificacion: "Planificacion", carga_trabajo: "Carga de trabajo", fichajes: "Fichajes", ausencias: "Ausencias y vacaciones", caudalimetro: "Caudalimetro",'; new = 'maquinaria: "Maquinaria", tipos_tarea: "Tipos de tarea", registro_trabajo: "Registro de trabajo", planificacion: "Planificacion", carga_trabajo: "Carga de trabajo", fichajes: "Fichajes", ausencias: "Ausencias y vacaciones", caudalimetro: "Caudalimetro", mi_cuenta: "Mi cuenta",' },
  @{ old = '{vista === "caudalimetro" && <Caudalimetro usuario={usuario} nombreOperario={nombreOperario} userRole={userRole} />}'; new = (@('{vista === "caudalimetro" && <Caudalimetro usuario={usuario} nombreOperario={nombreOperario} userRole={userRole} />}', '          {vista === "mi_cuenta" && <MiCuenta usuario={usuario} empleadoId={empleadoId} nombreOperario={nombreOperario} />}') -join "`n") }
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
    'function MiCuenta({ usuario, empleadoId, nombreOperario }) {',
    '  const [passActual, setPassActual] = useState("");',
    '  const [passNueva, setPassNueva] = useState("");',
    '  const [passNueva2, setPassNueva2] = useState("");',
    '  const [passError, setPassError] = useState("");',
    '  const [passOk, setPassOk] = useState(false);',
    '  const [cargandoPass, setCargandoPass] = useState(false);',
    '',
    '  const [pin, setPin] = useState("");',
    '  const [pin2, setPin2] = useState("");',
    '  const [pinError, setPinError] = useState("");',
    '  const [pinOk, setPinOk] = useState(false);',
    '  const [cargandoPin, setCargandoPin] = useState(false);',
    '',
    '  async function cambiarPassword() {',
    '    setPassError(""); setPassOk(false);',
    '    if (!passActual || !passNueva) { setPassError("Rellena todos los campos."); return; }',
    '    if (passNueva.length < 6) { setPassError("La contrasena nueva debe tener al menos 6 caracteres."); return; }',
    '    if (passNueva !== passNueva2) { setPassError("Las contrasenas nuevas no coinciden."); return; }',
    '    setCargandoPass(true);',
    '    try {',
    '      const cred = EmailAuthProvider.credential(usuario.email, passActual);',
    '      await reauthenticateWithCredential(auth.currentUser, cred);',
    '      await updatePassword(auth.currentUser, passNueva);',
    '      setPassOk(true);',
    '      setPassActual(""); setPassNueva(""); setPassNueva2("");',
    '    } catch (err) {',
    '      if (err?.code === "auth/wrong-password" || err?.code === "auth/invalid-credential") setPassError("La contrasena actual no es correcta.");',
    '      else setPassError("No se pudo cambiar la contrasena. Intentalo de nuevo.");',
    '    } finally {',
    '      setCargandoPass(false);',
    '    }',
    '  }',
    '',
    '  async function cambiarPin() {',
    '    setPinError(""); setPinOk(false);',
    '    if (!empleadoId) { setPinError("No se ha encontrado tu ficha de empleado. Contacta con el administrador."); return; }',
    '    if (pin.length !== 4) { setPinError("El PIN debe tener 4 digitos."); return; }',
    '    if (pin !== pin2) { setPinError("Los PIN no coinciden."); return; }',
    '    setCargandoPin(true);',
    '    try {',
    '      await actualizarDoc("mant_equipo", empleadoId, { pin });',
    '      setPinOk(true);',
    '      setPin(""); setPin2("");',
    '    } catch (err) {',
    '      setPinError("No se pudo actualizar el PIN. Intentalo de nuevo.");',
    '    } finally {',
    '      setCargandoPin(false);',
    '    }',
    '  }',
    '',
    '  return (',
    '    <div>',
    '      <Cabecera titulo="Mi cuenta" subtitulo="Cambia tu contrasena de acceso y tu PIN de fichaje." />',
    '',
    '      <div className="grid lg:grid-cols-2 gap-6">',
    '        <Tarjeta className="p-5">',
    '          <p className="font-semibold mb-1" style={{ color: BLANCO }}>Cambiar contrasena</p>',
    '          <p className="text-xs text-stone-500 mb-4">{usuario?.email}</p>',
    '          <Field label="Contrasena actual">',
    '            <input type="password" className={inputCls} value={passActual} onChange={(e) => setPassActual(e.target.value)} />',
    '          </Field>',
    '          <Field label="Contrasena nueva">',
    '            <input type="password" className={inputCls} value={passNueva} onChange={(e) => setPassNueva(e.target.value)} />',
    '          </Field>',
    '          <Field label="Repite la contrasena nueva">',
    '            <input type="password" className={inputCls} value={passNueva2} onChange={(e) => setPassNueva2(e.target.value)} />',
    '          </Field>',
    '          {passError && <p className="text-sm text-red-600 mb-2">{passError}</p>}',
    '          {passOk && <p className="text-sm text-emerald-600 mb-2">Contrasena actualizada correctamente.</p>}',
    '          <BotonPrimario onClick={cambiarPassword} icon={null} disabled={cargandoPass}>{cargandoPass ? "Guardando..." : "Guardar contrasena"}</BotonPrimario>',
    '        </Tarjeta>',
    '',
    '        <Tarjeta className="p-5">',
    '          <p className="font-semibold mb-1" style={{ color: BLANCO }}>Cambiar PIN de fichaje</p>',
    '          <p className="text-xs text-stone-500 mb-4">{nombreOperario || "Tu ficha"}</p>',
    '          <Field label="PIN nuevo (4 digitos)">',
    '            <input',
    '              className={inputCls} inputMode="numeric" maxLength={4} placeholder="Ej. 1234"',
    '              value={pin}',
    '              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}',
    '            />',
    '          </Field>',
    '          <Field label="Repite el PIN">',
    '            <input',
    '              className={inputCls} inputMode="numeric" maxLength={4} placeholder="Ej. 1234"',
    '              value={pin2}',
    '              onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}',
    '            />',
    '          </Field>',
    '          {pinError && <p className="text-sm text-red-600 mb-2">{pinError}</p>}',
    '          {pinOk && <p className="text-sm text-emerald-600 mb-2">PIN actualizado correctamente.</p>}',
    '          <BotonPrimario onClick={cambiarPin} icon={null} disabled={cargandoPin}>{cargandoPin ? "Guardando..." : "Guardar PIN"}</BotonPrimario>',
    '        </Tarjeta>',
    '      </div>',
    '    </div>',
    '  );',
    '}'
  )
  $newCode = ($newCodeLines -join "`n")
  $content = $content.TrimEnd() + "`n" + $newCode + "`n"

  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)
  Write-Host "GUARDADO CORRECTAMENTE." -ForegroundColor Green
}