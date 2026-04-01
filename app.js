// ════════════════════════════════════════════════════════════
//  PROINTEL 2.0 — app.js  |  ÍNDICE DE MÓDULOS
//  Usa Ctrl+G (VS Code) para ir a la línea exacta
// ════════════════════════════════════════════════════════════
//
//  [AUTH / SESIÓN]
//    L  301  logout()
//    L  220  hashearSiEsTextoPlano()
//    L 4671  verificarPermisos()
//    L  348  changeTab()
//
//  [UI / UTILIDADES]
//    L 1260  esc()
//    L 1251  filtrarTabla()
//    L 5364  _mostrarToast()
//    L 5356  _mostrarToastExito()
//    L 5360  _notificar()
//    L 5383  toggleTheme()
//    L 3029  limpiarFirma()
//    L 2982  initFirmaCanvas()
//    L 3595  navSugerencias()
//    L 5442  cerrarModal()
//    L 5408  _modalTieneDatos()
//    L 3601  autoFillCuadrilla()
//    L 5020  switchMiBodegaTab()
//    L 3584  limpiarBuscadorSalida()
//
//  [INVENTARIO BODEGA]
//    L 1680  cargarInventarioBodega()
//    L 1892  abrirModalArticulo()
//    L 2327  guardarArticulo()
//    L 2512  eliminarArticulo()
//    L 1871  exportarInventarioCSV()
//    L 2416  verMaterialEnCampo()
//    L 2497  devolverABodega()
//    L 2114  buscarCodigoHistorico()
//    L 2234  generarCodigoAuto()
//    L 2247  agregarSerie()
//    L 1533  ejecutarImport()
//
//  [SALIDAS]
//    L 2531  cargarSalidas()
//    L 3036  abrirModalSalida()
//    L 3253  buscarArticuloSalida()
//    L 3470  seleccionarArticuloSalida()
//    L 3610  agregarAlCarritoSalida()
//    L 3684  renderCarritoSalida()
//    L 3719  quitarDelCarrito()
//    L 3726  guardarSalida()
//    L 2954  generarNumeroOT()
//    L 2704  verFacturaSalida()
//    L 2896  imprimirFacturaSalida()
//
//  [TÉCNICO / BODEGA]
//    L 4761  cargarMisArticulos()
//    L 5049  abrirDescargos()
//    L 5249  guardarDescargo()
//    L 5187  onDescItemChange()
//    L 5230  validarCantidadDesc()
//
//  [FACTURAS]
//    L  607  abrirModalFactura()
//    L  834  guardarFactura()
//    L  964  imprimirFactura()
//    L  488  cargarFacturas()
//
//  [TRANSFERENCIAS]
//    L 3920  cargarTransferencias()
//    L 4015  abrirModalTransferencia()
//    L 4063  guardarTransferencia()
//
//  [REPORTES]
//    L 4353  cargarReportes()
//    L 4625  exportarReporteCSV()
//
//  [USUARIOS]
//    L 4102  cargarUsuarios()
//    L 4175  abrirModalUsuario()
//    L 4287  guardarUsuario()
//    L 1231  eliminarUsuario()
//
//  [DIAGNÓSTICO]
//    L 5484  runDiagnostic()
// ════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════

// ── Variables globales ────────────────────────
let currentUser     = null;
let currentTab      = null;
let clockInterval   = null;
let cacheInventario = [];
let cacheFacturas   = [];

const SUPERUSUARIO = 'mgvillegas';

// ── Arranque ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('PROINTEL 2.0 — Listo');

    // ── Restaurar preferencia de tema ────────────────────
    const temaGuardado = localStorage.getItem('prointel_theme') || 'dark';
    document.body.setAttribute('data-theme', temaGuardado);
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) toggleBtn.textContent = temaGuardado === 'dark' ? '🌙' : '☀️';

    // ── Restaurar sesión si el usuario recargó la página ─
    const sesionGuardada = localStorage.getItem('prointel_session');
    if (sesionGuardada) {
        try {
            currentUser = JSON.parse(sesionGuardada);
            const nombre = currentUser.nombre_completo || currentUser.usuario || 'Usuario';
            const userEl = document.getElementById('user-display');
            if (userEl) userEl.textContent = nombre;
            showSection('view-dashboard');
            iniciarReloj();
            verificarPermisos();
            changeTab('servicios');
            cargarDatosRecordados();
            return; // No mostrar landing si ya hay sesión
        } catch (e) {
            localStorage.removeItem('prointel_session');
        }
    }

    // ── Guard: verificar que Supabase cargó correctamente ─
    if (!window.supabase) {
        document.body.innerHTML = `
            <div style="
                display:flex;flex-direction:column;align-items:center;
                justify-content:center;min-height:100vh;
                background:#0d1520;color:#f0f6fc;font-family:sans-serif;
                gap:1rem;padding:2rem;text-align:center">
                <div style="font-size:2.5rem">⚠️</div>
                <h2 style="color:#ff4d6d;margin:0">Error de conexión con Supabase</h2>
                <p style="color:#8892a4;max-width:400px;margin:0">
                    No se pudo cargar la librería de base de datos.<br>
                    Verifica tu conexión a internet e intenta recargar la página.
                </p>
                <button onclick="location.reload()"
                    style="background:#00c8f0;color:#000;border:none;
                           padding:.7rem 1.8rem;border-radius:5px;
                           font-weight:700;font-size:1rem;cursor:pointer;margin-top:.5rem">
                    ↺ Recargar
                </button>
                <p style="color:#3a4a5e;font-size:.75rem;font-family:monospace;margin:0">
                    Código: SUPABASE_UNDEFINED
                </p>
            </div>`;
        return;
    }

    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    } else {
        console.error('PROINTEL — No se encontró #login-form en el DOM');
    }

    // ── Limpiar formulario por si hay datos residuales ──────
    limpiarVistaLogin();

    // ── Solo rellenar si el usuario activó "recordar" ────────
    cargarDatosRecordados();

    showSection('view-landing');
});

// ── Navegación ────────────────────────────────
function showSection(id) {
    // Limpiar formulario al entrar a login
    if (id === 'view-login') limpiarVistaLogin();

    // Ocultar TODAS las secciones usando style.display directamente
    // — evita conflictos de especificidad CSS entre .hidden y #id
    const VISTAS = ['view-landing', 'view-login', 'view-dashboard'];
    VISTAS.forEach(vid => {
        const v = document.getElementById(vid);
        if (!v) return;
        v.style.display = 'none';
        v.classList.add('hidden');
    });

    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('hidden');
        el.style.display = (id === 'view-dashboard') ? 'grid' : 'block';
    }
}

// ── Login ─────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();

    const usuario   = document.getElementById('login-user').value.trim();
    const clave     = document.getElementById('login-pass').value.trim();
    const errorEl   = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    errorEl.textContent  = '';
    submitBtn.disabled   = true;
    submitBtn.textContent = 'VERIFICANDO...';

    try {
        // ── Consulta filtrada: solo busca el usuario exacto ──
        // No descarga toda la tabla — solo pide la fila que coincide
        const { data, error } = await window.supabase
            .from('usuarios')
            .select('id, usuario, clave, nombre_completo, rol, estado')
            .eq('usuario', usuario)
            .eq('estado', 'activo')
            .maybeSingle();

        if (error) {
            console.error('PROINTEL — Error Supabase:', error.code, error.message);

            // Códigos de error específicos de Postgres/Supabase
            const msgs = {
                'PGRST116': '⚠ No se encontró el usuario.',
                '42P01':    '❌ Tabla usuarios no encontrada. Verifica la BD.',
                '42501':    '❌ Sin permisos. Verifica las políticas RLS.',
                'JWTExpired': '❌ Sesión expirada. Recarga la página.',
            };
            errorEl.textContent = msgs[error.code] || 'Error de conexión: ' + error.message;
            return;
        }

        // No encontró el usuario
        if (!data) {
            errorEl.textContent = '⚠ Usuario o contraseña incorrectos.';
            return;
        }

        // Verificar contraseña — compara hash SHA-256
        const claveEnBD   = String(data.clave ?? '').trim();
        const claveHash   = await hashPassword(clave.trim());
        // Soporta tanto hash como texto plano (para migración gradual)
        const claveOk = claveEnBD === claveHash || claveEnBD === clave.trim();
        if (!claveOk) {
            errorEl.textContent = '⚠ Usuario o contraseña incorrectos.';
            return;
        }

        // Verificar que no esté inactivo
        if ((data.estado || 'activo').toLowerCase() === 'inactivo') {
            errorEl.textContent = '⛔ Usuario inactivo. Contacta al administrador.';
            return;
        }

        const encontrado = data;

        // ── Éxito ──
        currentUser = encontrado;
        const nombre = encontrado.nombre_completo || encontrado.nombre || encontrado.usuario || 'Usuario';
        const userEl = document.getElementById('user-display');
        if (userEl) userEl.textContent = nombre;

        // Actualizar label de rol en sidebar
        const roleEl = document.querySelector('.su-role');
        if (roleEl) {
            const rolMap = { admin:'Administrador', bodega:'Bodega', tecnico:'Técnico' };
            roleEl.textContent = rolMap[(encontrado.rol||'').toLowerCase()] || 'Operador';
        }

        // ── Guardar en localStorage ───────────────────────
        guardarDatosRecordados(usuario, clave);
        // Persistir sesión para sobrevivir recargas de página
        localStorage.setItem('prointel_session', JSON.stringify(encontrado));

        showSection('view-dashboard');
        iniciarReloj();
        verificarPermisos(); // Control de acceso por rol
        changeTab('servicios');

    } catch (err) {
        console.error('PROINTEL — Excepción:', err);
        errorEl.textContent = 'Error inesperado: ' + err.message;
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'INGRESAR';
    }
}

// ════════════════════════════════════════════════════════════
//  SEGURIDAD — Hash de contraseñas (SHA-256 nativo del navegador)
// ════════════════════════════════════════════════════════════

/**
 * Genera un hash SHA-256 de la contraseña usando la API nativa
 * del navegador (SubtleCrypto). No requiere librerías externas.
 * Las contraseñas nunca viajan ni se almacenan en texto plano.
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data    = encoder.encode(password + 'PROINTEL_SALT_2025');
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    const hashArr = Array.from(new Uint8Array(hashBuf));
    return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Migra las contraseñas del sistema a SHA-256.
 * Se llama una sola vez desde el módulo de usuarios al guardar.
 */
async function hashearSiEsTextoPlano(clave) {
    // Si ya tiene 64 caracteres hex, asumimos que ya está hasheada
    if (/^[a-f0-9]{64}$/.test(clave)) return clave;
    return await hashPassword(clave);
}

// ── LocalStorage: Recordar usuario/contraseña ───────────
const LS_USUARIO = 'prointel_usuario';
const LS_CLAVE   = 'prointel_clave';
const LS_RECORDAR = 'prointel_recordar';

/**
 * Al login exitoso: guarda siempre el usuario.
 * Guarda la clave solo si el checkbox está marcado.
 */
function guardarDatosRecordados(usuario, clave) {
    // Siempre guardar el usuario
    localStorage.setItem(LS_USUARIO, usuario);

    const recordar = document.getElementById('chk-recordar');
    if (recordar && recordar.checked) {
        // Ofuscación básica con btoa (no es cifrado fuerte,
        // pero evita que la clave quede en texto plano visible)
        localStorage.setItem(LS_CLAVE,    btoa(unescape(encodeURIComponent(clave))));
        localStorage.setItem(LS_RECORDAR, '1');
    } else {
        // Si no está marcado, borrar clave guardada
        localStorage.removeItem(LS_CLAVE);
        localStorage.removeItem(LS_RECORDAR);
    }
}

/**
 * Al cargar la página: rellena los campos SOLO si el usuario
 * activó "Recordar contraseña". Sin ese permiso explícito,
 * el formulario aparece vacío y limpio.
 */
function cargarDatosRecordados() {
    const recordarGuardado = localStorage.getItem(LS_RECORDAR);

    // Solo rellenar si el usuario lo pidió explícitamente
    if (recordarGuardado !== '1') return;

    const usuarioGuardado = localStorage.getItem(LS_USUARIO);
    const claveGuardada   = localStorage.getItem(LS_CLAVE);

    const campoUsuario = document.getElementById('login-user');
    const campoClave   = document.getElementById('login-pass');
    const chkRecordar  = document.getElementById('chk-recordar');

    if (campoUsuario && usuarioGuardado) campoUsuario.value = usuarioGuardado;
    if (chkRecordar) chkRecordar.checked = true;

    if (claveGuardada) {
        try {
            if (campoClave) campoClave.value = decodeURIComponent(escape(atob(claveGuardada)));
        } catch (e) {
            localStorage.removeItem(LS_CLAVE);
            localStorage.removeItem(LS_RECORDAR);
        }
    }
}

/**
 * Limpia visualmente el formulario de login.
 * Se llama al mostrar la pantalla de login para
 * que nunca aparezcan datos residuales de sesiones anteriores.
 */
function limpiarVistaLogin() {
    const campos = ['login-user','login-pass','login-error'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.tagName === 'INPUT') el.value = '';
        else el.textContent = '';
    });
    const chk = document.getElementById('chk-recordar');
    if (chk) chk.checked = false;
}

// ── Logout ────────────────────────────────────
function logout() {
    // Limpiar nombre antes de salir para que no quede visible un instante
    const userEl   = document.getElementById('user-display');
    const avatarEl = document.getElementById('su-avatar');
    if (userEl)   userEl.textContent   = 'Usuario';
    if (avatarEl) avatarEl.textContent = 'U';

    // Limpiar todo el estado de la app
    currentUser         = null;
    cacheInventario     = [];
    cacheFacturas       = [];
    cacheSalidas        = [];
    cacheUsuarios       = [];
    cacheTransferencias = [];
    window._misBodegaItems    = null;
    window._articuloSeleccionado = null;

    // Limpiar sesión persistida
    localStorage.removeItem('prointel_session');

    // Detener reloj
    detenerReloj();

    // Limpiar rol del body para que CSS no quede en modo técnico
    document.body.removeAttribute('data-rol');

    // Limpiar formulario de login
    limpiarVistaLogin();

    // Mostrar landing con el botón INICIAR SESIÓN visible
    showSection('view-landing');
}

// ── Reloj ─────────────────────────────────────
function iniciarReloj() {
    actualizarReloj();
    clockInterval = setInterval(actualizarReloj, 1000);
}
function detenerReloj() {
    if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
}
function actualizarReloj() {
    const el = document.getElementById('live-clock');
    if (el) el.textContent = new Date().toLocaleTimeString('es-SV');
}

// ── Tabs ──────────────────────────────────────
function changeTab(tab) {
    currentTab = tab;

    // Marcar botón activo en el menú (desktop y tab bar móvil)
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.remove('menu-btn-active');
    });
    // Resaltar el botón correspondiente al tab
    const tabToBtn = {
        'servicios':    '#btn-inicio',
        'mis-articulos': null, // botón sin ID, buscar por onclick
    };
    const sel = tabToBtn[tab];
    if (sel) {
        document.querySelector(sel)?.classList.add('menu-btn-active');
    } else {
        // Buscar por texto del onclick
        document.querySelectorAll('.menu-btn').forEach(btn => {
            if ((btn.getAttribute('onclick')||'').includes(`'${tab}'`)) {
                btn.classList.add('menu-btn-active');
            }
        });
    }

    // Título del topbar
    const titulos = {
        servicios:    'Inicio',
        importar:     'Importar Archivo',
        articulos:    'Artículos',
        bodega:       'Inventario Bodega y Cuadrilla',
        salidas:      'Salida de Inventario',
        transferencia:'Transferencia de Inventario',
        reportes:     'Reportes',
        usuarios:            'Gestión de Usuarios',
        'puestas-servicio':  'Puestas en Servicio',
    };
    const tEl = document.getElementById('topbar-title');
    if (tEl) tEl.textContent = titulos[tab] || tab;

    // Fecha
    const dEl = document.getElementById('topbar-date');
    if (dEl) dEl.textContent = new Date().toLocaleDateString('es-SV', {
        weekday:'short', day:'2-digit', month:'short', year:'numeric'
    });

    // Avatar
    const av = document.getElementById('su-avatar');
    const ud = document.getElementById('user-display');
    if (av && ud) av.textContent = (ud.textContent || 'U').charAt(0).toUpperCase();

    // Botón activo en sidebar
    document.querySelectorAll('.menu-btn').forEach(b => {
        b.classList.toggle('active',
            b.getAttribute('onclick') === "changeTab('" + tab + "')");
    });

    // Cargar módulo
    if (tab === 'servicios')     cargarServicios();
    if (tab === 'importar')      cargarImportar();
    if (tab === 'articulos')     cargarArticulos();
    if (tab === 'mis-articulos')    cargarMisArticulos();
    if (tab === 'puestas-servicio') cargarPuestasServicio();
    if (tab === 'bodega')        cargarInventarioBodega();
    if (tab === 'salidas')       cargarSalidas();
    if (tab === 'transferencia') cargarTransferencias();
    if (tab === 'reportes')      cargarReportes();
    if (tab === 'usuarios')      cargarUsuarios();

    // Re-aplicar permisos — respetar formularios activos del técnico
    setTimeout(() => {
        const hayForm = document.getElementById('form-instalacion-panel');
        if (!hayForm) verificarPermisos();
    }, 80);
}

// ── Módulo: Servicios ─────────────────────────
function cargarServicios() {
    const nombre = currentUser
        ? (currentUser.nombre_completo || currentUser.nombre || currentUser.usuario || 'Usuario')
        : 'Usuario';
    const hoy = new Date().toLocaleDateString('es-SV', {
        weekday:'long', year:'numeric', month:'long', day:'numeric'
    });
    const esTecnico = (currentUser?.rol || '').toLowerCase() === 'tecnico';

    document.getElementById('dashboard-content').innerHTML = `
        <div class="module-header">
            <h2>Panel de Servicios Residenciales</h2>
        </div>
        <div class="welcome-banner">
            <p class="welcome-name">Hola, <strong>${esc(nombre)}</strong> 👋</p>
            <p class="welcome-date">${hoy}</p>
        </div>
        <div class="cards-grid">

            ${esTecnico ? `
            <!-- Tarjetas del técnico -->
            <div class="summary-card" onclick="cargarMisArticulos()">
                <div class="card-icon">🎒</div>
                <div class="card-label">Mi Bodega</div>
                <div class="card-sub">Ver mi stock personal</div>
            </div>
            <div class="summary-card" onclick="abrirDescargos()">
                <div class="card-icon">📦</div>
                <div class="card-label">Descargos</div>
                <div class="card-sub">Registrar material instalado</div>
            </div>
            <div class="summary-card"
                onclick="window.open('https://speed.cloudflare.com/','_blank','noopener,noreferrer')">
                <div class="card-icon">⚡</div>
                <div class="card-label">Test de Calidad</div>
                <div class="card-sub">Verificar velocidad y latencia</div>
            </div>
            <div class="summary-card" onclick="cargarInstaladas()">
                <div class="card-icon">✅</div>
                <div class="card-label">Instaladas</div>
                <div class="card-sub">Ver mis descargos realizados</div>
            </div>

            ` : `
            <!-- Tarjetas de admin/bodega -->
            <div class="summary-card" onclick="changeTab('bodega')">
                <div class="card-icon">📦</div>
                <div class="card-label">Bodega / Series</div>
                <div class="card-sub">Ver inventario completo</div>
            </div>
            <div class="summary-card" onclick="changeTab('facturas')">
                <div class="card-icon">🧾</div>
                <div class="card-label">Facturación</div>
                <div class="card-sub">Consultar facturas emitidas</div>
            </div>
            <div class="summary-card" id="card-usuarios" onclick="changeTab('usuarios')">
                <div class="card-icon">👤</div>
                <div class="card-label">Usuarios</div>
                <div class="card-sub">Gestión de accesos</div>
            </div>
            `}

        </div>`;
}

// ── Módulo: Bodega ────────────────────────────

// ════════════════════════════════════════════════════════════
//  MÓDULO: FACTURACIÓN — CRUD completo
// ════════════════════════════════════════════════════════════

async function cargarFacturas() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>🧾 Facturación</h2>
            <div class="header-actions">
                <button class="btn-nav" onclick="cargarFacturas()">↺ Actualizar</button>
                <button class="btn-cyan" onclick="abrirModalFactura()">+ Nueva Factura</button>
            </div>
        </div>
        <div class="inv-stats" id="fact-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="fact-search"
                    placeholder="🔍  Buscar por número, cliente, NIT…"
                    oninput="filtrarTabla('fact-search','tabla-facturas')" />
            </div>
            <select id="filtro-fact-estado" onchange="filtrarFacturasLive()" class="filter-select">
                <option value="">Todos los estados</option>
                <option value="emitida">Emitida</option>
                <option value="pagada">Pagada</option>
                <option value="anulada">Anulada</option>
            </select>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-facturas">
                <thead>
                    <tr>
                        <th style="width:36px">#</th>
                        <th>Nº FACTURA</th>
                        <th>CLIENTE</th>
                        <th>NIT</th>
                        <th>TOTAL</th>
                        <th>ESTADO</th>
                        <th>FECHA</th>
                        <th>ACCIONES</th>
                    </tr>
                </thead>
                <tbody id="fact-tbody">
                    <tr><td colspan="8" class="empty-row">⏳ Cargando facturas…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="fact-count"></p>`;

    try {
        const { data, error } = await window.supabase
            .from('facturas').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        cacheFacturas = data || [];
        renderFacturas(cacheFacturas);

        // Stats
        const emitidas = cacheFacturas.filter(f => (f.estado||'emitida') === 'emitida').length;
        const pagadas  = cacheFacturas.filter(f => f.estado === 'pagada').length;
        const anuladas = cacheFacturas.filter(f => f.estado === 'anulada').length;
        const totalAc  = cacheFacturas
            .filter(f => f.estado !== 'anulada')
            .reduce((s,f) => s + parseFloat(f.total||0), 0);

        document.getElementById('fact-stats').innerHTML = `
            <div class="istat"><span class="istat-num">${cacheFacturas.length}</span><span class="istat-label">Total</span></div>
            <div class="istat istat-blue"><span class="istat-num">${emitidas}</span><span class="istat-label">Emitidas</span></div>
            <div class="istat istat-green"><span class="istat-num">${pagadas}</span><span class="istat-label">Pagadas</span></div>
            <div class="istat istat-cyan"><span class="istat-num">$${totalAc.toFixed(2)}</span><span class="istat-label">Total facturado</span></div>`;

    } catch (err) {
        document.getElementById('fact-tbody').innerHTML =
            `<tr><td colspan="8" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

function renderFacturas(filas) {
    const tbody = document.getElementById('fact-tbody');
    const count = document.getElementById('fact-count');
    if (!filas || !filas.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay facturas registradas.</td></tr>';
        if (count) count.textContent = ''; return;
    }
    tbody.innerHTML = filas.map((f, idx) => `
        <tr>
            <td class="row-num">${idx+1}</td>
            <td><code class="serie-code">${esc(f.numero_factura || String(f.id).slice(0,8).toUpperCase())}</code></td>
            <td class="td-bold">${esc(f.cliente || '—')}</td>
            <td style="font-family:var(--font-mono);font-size:.8rem;color:var(--dim)">${esc(f.nit || '—')}</td>
            <td class="td-price">$${parseFloat(f.total||0).toFixed(2)}</td>
            <td><span class="badge badge-${(f.estado||'emitida').toLowerCase()}">${esc(f.estado||'emitida')}</span></td>
            <td class="td-date">${formatFecha(f.created_at)}</td>
            <td>
                <div class="action-row">
                    <button class="act-btn act-edit" onclick="verFactura('${f.id}')" title="Ver documento">🖨 Ver PDF</button>
                    ${f.estado !== 'anulada'
                        ? `<button class="act-btn act-edit" onclick="cambiarEstadoFactura('${f.id}','${f.estado||'emitida'}')">✎</button>
                           <button class="act-btn act-del" onclick="anularFactura('${f.id}','${esc(f.numero_factura||'')}')">✕</button>`
                        : `<span style="font-size:.73rem;color:var(--muted)">Anulada</span>`}
                </div>
            </td>
        </tr>`).join('');
    if (count) count.textContent = filas.length + ' facturas';
}

function filtrarFacturasLive() {
    const q   = (document.getElementById('fact-search')?.value||'').toLowerCase();
    const est = (document.getElementById('filtro-fact-estado')?.value||'').toLowerCase();
    renderFacturas(cacheFacturas.filter(f => {
        const mQ = !q || (f.numero_factura||'').toLowerCase().includes(q)
                       || (f.cliente||'').toLowerCase().includes(q)
                       || (f.nit||'').toLowerCase().includes(q);
        const mE = !est || (f.estado||'emitida').toLowerCase() === est;
        return mQ && mE;
    }));
}

// ── Nueva Factura ─────────────────────────────────────────
async function abrirModalFactura(id) {
    const f = id ? cacheFacturas.find(x => x.id === id) : null;

    // Generar número de factura sugerido
    const { count } = await window.supabase
        .from('facturas').select('id', { count:'exact', head:true });
    const numSugerido = 'FAC-' + String((count||0)+1).padStart(5,'0');

    // Items de bodega disponibles para vincular
    let itemsDisp = [];
    if (cacheInventario.length === 0) {
        const { data } = await window.supabase
            .from('bodega').select('id,nombre,articulo,serie,precio,estado')
            .ilike('estado','disponible');
        itemsDisp = data || [];
    } else {
        itemsDisp = cacheInventario.filter(i => (i.estado||'').toLowerCase() === 'disponible');
    }

    const optsItems = itemsDisp.length
        ? itemsDisp.map(i =>
            `<option value="${i.id}"
                data-precio="${i.precio||0}"
                data-nombre="${esc(i.nombre||i.articulo||'')}">
                ${esc(i.nombre||i.articulo||'Sin nombre')}${i.serie ? ' — ' + i.serie : ''}
             </option>`).join('')
        : '<option value="" disabled>Sin artículos disponibles</option>';

    const estadoOpts = ['emitida','pagada','anulada'].map(s =>
        `<option value="${s}" ${(f?.estado||'emitida')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
    ).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-factura" onclick="cerrarModalClick(event,'modal-factura')">
            <div class="modal-content modal-inventario">
                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">🧾</span>
                        <span>${f ? 'Editar Factura' : 'Nueva Factura'}</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('modal-factura')">✕</button>
                </div>
                <form id="form-factura" onsubmit="guardarFactura(event,'${id||''}')">
                <div class="modal-body">
                    <div class="form-grid">
                        <div class="field">
                            <label>Nº FACTURA
                                <span style="font-size:.68rem;color:var(--cyan);
                                    background:rgba(0,200,240,.08);border:1px solid var(--border-cyan);
                                    padding:.1rem .4rem;border-radius:3px;margin-left:.3rem">
                                    ⚡ Auto-generado
                                </span>
                            </label>
                            <input type="text" id="fact-numero"
                                value="${esc(f?.numero_factura || numSugerido)}"
                                readonly
                                style="opacity:.7;cursor:not-allowed;font-family:var(--font-mono);
                                       letter-spacing:.06em;font-weight:700" />
                        </div>
                        <div class="field">
                            <label>ESTADO</label>
                            <select id="fact-estado">${estadoOpts}</select>
                        </div>
                        <div class="field field-full">
                            <label>CLIENTE *</label>
                            <input type="text" id="fact-cliente"
                                value="${esc(f?.cliente||'')}" required
                                placeholder="Nombre completo del cliente" />
                        </div>
                        <div class="field">
                            <label>NIT / DUI</label>
                            <input type="text" id="fact-nit"
                                value="${esc(f?.nit||'')}"
                                placeholder="0000-000000-000-0" />
                        </div>
                        <div class="field">
                            <label>DIRECCIÓN</label>
                            <input type="text" id="fact-direccion"
                                value="${esc(f?.direccion||'')}"
                                placeholder="Ciudad, País" />
                        </div>
                    </div>

                    <!-- Artículos vinculados -->
                    <div class="panel-section-title" style="margin-top:.8rem">
                        <span>📦 Artículos / Servicios</span>
                        <button type="button" class="btn-autogen"
                            onclick="agregarLineaFactura()">+ Agregar línea</button>
                    </div>
                    <div id="fact-lineas">
                        <div class="fact-linea" id="linea-0">
                            <select class="fact-item-sel filter-select" style="flex:2"
                                onchange="onFactItemChange(this,0)">
                                <option value="">— Seleccionar artículo —</option>
                                ${optsItems}
                            </select>
                            <input type="text" class="fact-item-desc" placeholder="Descripción"
                                style="flex:2;background:rgba(255,255,255,.04);border:1px solid var(--border);
                                       border-radius:5px;color:var(--white);padding:.55rem .8rem;font-size:.85rem" />
                            <input type="number" class="fact-item-qty" value="1" min="1"
                                style="width:64px;background:rgba(255,255,255,.04);border:1px solid var(--border);
                                       border-radius:5px;color:var(--white);padding:.55rem .5rem;text-align:center;font-size:.85rem"
                                onchange="recalcularFactura()" />
                            <input type="number" class="fact-item-precio" placeholder="Precio"
                                step="0.01" min="0"
                                style="width:96px;background:rgba(255,255,255,.04);border:1px solid var(--border);
                                       border-radius:5px;color:var(--cyan);padding:.55rem .6rem;
                                       font-family:var(--font-mono);font-size:.85rem"
                                onchange="recalcularFactura()" />
                            <button type="button" class="act-btn act-del" style="flex-shrink:0"
                                onclick="quitarLineaFactura(0)">✕</button>
                        </div>
                    </div>

                    <!-- Totales -->
                    <div class="fact-totales">
                        <div class="fact-total-row">
                            <span>Subtotal</span>
                            <span id="fact-subtotal" class="fact-total-val">$0.00</span>
                        </div>
                        <div class="fact-total-row">
                            <span>Descuento</span>
                            <div style="display:flex;align-items:center;gap:.5rem">
                                <input type="number" id="fact-descuento" value="0" min="0"
                                    step="0.01" style="width:80px;background:rgba(255,255,255,.04);
                                    border:1px solid var(--border);border-radius:4px;color:var(--white);
                                    padding:.3rem .5rem;font-size:.85rem;text-align:right"
                                    onchange="recalcularFactura()" />
                                <span>$</span>
                            </div>
                        </div>
                        <div class="fact-total-row fact-total-final">
                            <span>TOTAL</span>
                            <span id="fact-total-display" class="fact-total-val">$0.00</span>
                        </div>
                    </div>

                    <div class="field" style="margin-top:.6rem">
                        <label>NOTAS</label>
                        <textarea id="fact-notas" rows="2"
                            placeholder="Condiciones de pago, observaciones…">${esc(f?.notas||'')}</textarea>
                    </div>

                </div><!-- /modal-body -->
                    <div class="modal-foot">
                        <button type="button" class="btn-ghost-sm"
                            onclick="cerrarModal('modal-factura')">Cancelar</button>
                        <button type="button" class="btn-outline-sm"
                            onclick="previsualizarFactura()">👁 Vista previa</button>
                        <button type="submit" class="btn-cyan" id="btn-guardar-fact">
                            ${f ? 'Guardar cambios' : 'Emitir factura'}
                        </button>
                    </div>
                </form>
            </div>
        </div>`);

    recalcularFactura();
}

let _lineaCount = 1;
function agregarLineaFactura() {
    const idx = _lineaCount++;
    // Reusar opciones del primer select
    const optsRef = document.querySelector('.fact-item-sel')?.innerHTML || '';
    const linea = document.createElement('div');
    linea.className = 'fact-linea';
    linea.id = `linea-${idx}`;
    linea.innerHTML = `
        <select class="fact-item-sel filter-select" style="flex:2"
            onchange="onFactItemChange(this,${idx})">
            ${optsRef}
        </select>
        <input type="text" class="fact-item-desc" placeholder="Descripción"
            style="flex:2;background:rgba(255,255,255,.04);border:1px solid var(--border);
                   border-radius:5px;color:var(--white);padding:.55rem .8rem;font-size:.85rem" />
        <input type="number" class="fact-item-qty" value="1" min="1"
            style="width:64px;background:rgba(255,255,255,.04);border:1px solid var(--border);
                   border-radius:5px;color:var(--white);padding:.55rem .5rem;text-align:center;font-size:.85rem"
            onchange="recalcularFactura()" />
        <input type="number" class="fact-item-precio" placeholder="Precio"
            step="0.01" min="0"
            style="width:96px;background:rgba(255,255,255,.04);border:1px solid var(--border);
                   border-radius:5px;color:var(--cyan);padding:.55rem .6rem;
                   font-family:var(--font-mono);font-size:.85rem"
            onchange="recalcularFactura()" />
        <button type="button" class="act-btn act-del" style="flex-shrink:0"
            onclick="quitarLineaFactura(${idx})">✕</button>`;
    document.getElementById('fact-lineas').appendChild(linea);
}

function quitarLineaFactura(idx) {
    const el = document.getElementById(`linea-${idx}`);
    if (el && document.querySelectorAll('.fact-linea').length > 1) {
        el.remove(); recalcularFactura();
    }
}

function onFactItemChange(sel, idx) {
    const opt    = sel.options[sel.selectedIndex];
    const precio = parseFloat(opt.getAttribute('data-precio')||0);
    const nombre = opt.getAttribute('data-nombre')||'';
    const linea  = document.getElementById(`linea-${idx}`);
    if (!linea) return;
    const descEl   = linea.querySelector('.fact-item-desc');
    const precioEl = linea.querySelector('.fact-item-precio');
    if (descEl && nombre)   descEl.value   = nombre;
    if (precioEl && precio) precioEl.value = precio.toFixed(2);
    recalcularFactura();
}

function recalcularFactura() {
    const lineas   = document.querySelectorAll('.fact-linea');
    let subtotal   = 0;
    lineas.forEach(l => {
        const qty    = parseFloat(l.querySelector('.fact-item-qty')?.value||1);
        const precio = parseFloat(l.querySelector('.fact-item-precio')?.value||0);
        subtotal += qty * precio;
    });
    const desc  = parseFloat(document.getElementById('fact-descuento')?.value||0);
    const total = Math.max(0, subtotal - desc);
    const sub   = document.getElementById('fact-subtotal');
    const tot   = document.getElementById('fact-total-display');
    if (sub) sub.textContent = `$${subtotal.toFixed(2)}`;
    if (tot) tot.textContent = `$${total.toFixed(2)}`;
}

async function guardarFactura(e, id) {
    e.preventDefault();
    const numero  = document.getElementById('fact-numero').value.trim();
    const cliente = document.getElementById('fact-cliente').value.trim();
    const nit     = document.getElementById('fact-nit').value.trim()       || null;
    const dir     = document.getElementById('fact-direccion').value.trim() || null;
    const estado  = document.getElementById('fact-estado').value;
    const notas   = document.getElementById('fact-notas').value.trim()     || null;
    const desc    = parseFloat(document.getElementById('fact-descuento').value||0);

    if (!numero)  { _notificar('El número de factura es obligatorio.'); return; }
    if (!cliente) { _notificar('El nombre del cliente es obligatorio.'); return; }

    // Recolectar líneas
    const lineas = [];
    document.querySelectorAll('.fact-linea').forEach(l => {
        const itemId = l.querySelector('.fact-item-sel')?.value || null;
        const desc2  = l.querySelector('.fact-item-desc')?.value.trim() || '';
        const qty    = parseFloat(l.querySelector('.fact-item-qty')?.value||1);
        const precio = parseFloat(l.querySelector('.fact-item-precio')?.value||0);
        if (desc2 || precio > 0) lineas.push({ bodega_id: itemId||null, descripcion: desc2, cantidad: qty, precio_unit: precio, subtotal: qty*precio });
    });

    if (!lineas.length) { _notificar('Agrega al menos una línea a la factura.'); return; }

    const subtotal = lineas.reduce((s,l) => s + l.subtotal, 0);
    const total    = Math.max(0, subtotal - desc);

    const payload = {
        numero_factura: numero,
        cliente, nit,
        direccion: dir,
        estado,
        notas,
        descuento: desc,
        subtotal,
        total,
        lineas: JSON.stringify(lineas)   // guardado como JSON en columna notas extendida
    };

    const btn = document.getElementById('btn-guardar-fact');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    const { error } = id
        ? await window.supabase.from('facturas').update(payload).eq('id', id)
        : await window.supabase.from('facturas').insert(payload);

    if (btn) { btn.disabled = false; btn.textContent = id ? 'Guardar cambios' : 'Emitir factura'; }

    if (error) {
        const msg = error.message.includes('unique') ? 'Ya existe una factura con ese número.' : 'Error: ' + error.message;
        alert(msg); return;
    }

    cerrarModal('modal-factura');
    cacheFacturas = [];
    cargarFacturas();
}

// ── Ver / imprimir factura ────────────────────────────────
function verFactura(id) {
    const f = cacheFacturas.find(x => x.id === id);
    if (!f) return;
    let lineas = [];
    try { lineas = JSON.parse(f.lineas||'[]'); } catch {}

    const lineasHTML = lineas.length
        ? lineas.map(l => `
            <tr>
                <td>${esc(l.descripcion||'—')}</td>
                <td style="text-align:center">${l.cantidad||1}</td>
                <td style="text-align:right">$${parseFloat(l.precio_unit||0).toFixed(2)}</td>
                <td style="text-align:right"><strong>$${parseFloat(l.subtotal||0).toFixed(2)}</strong></td>
            </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:#999">Sin líneas de detalle</td></tr>';

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-ver-factura" onclick="cerrarModalClick(event,'modal-ver-factura')">
            <div class="modal-content modal-inventario">
                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">🧾</span>
                        <span>Detalle de Factura</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('modal-ver-factura')">✕</button>
                </div>
                <div class="fact-recibo">
                    <div class="fact-rec-header">
                        <div>
                            <div class="fact-rec-brand">PROINTEL <span style="color:var(--cyan)">2.0</span></div>
                            <div class="fact-rec-sub">Sistema de Gestión Residencial</div>
                        </div>
                        <div style="text-align:right">
                            <div class="fact-rec-num">${esc(f.numero_factura||f.id.slice(0,8).toUpperCase())}</div>
                            <div class="fact-rec-fecha">${formatFecha(f.created_at)}</div>
                            <span class="badge badge-${(f.estado||'emitida').toLowerCase()}" style="margin-top:.3rem;display:inline-block">${esc(f.estado||'emitida')}</span>
                        </div>
                    </div>
                    <div class="fact-rec-client">
                        <div class="fact-rec-label">FACTURAR A</div>
                        <div class="fact-rec-nombre">${esc(f.cliente||'—')}</div>
                        ${f.nit ? `<div class="fact-rec-nit">NIT: ${esc(f.nit)}</div>` : ''}
                        ${f.direccion ? `<div style="font-size:.83rem;color:var(--dim)">${esc(f.direccion)}</div>` : ''}
                    </div>
                    <table class="fact-rec-table">
                        <thead>
                            <tr>
                                <th>Descripción</th>
                                <th style="text-align:center">Cant.</th>
                                <th style="text-align:right">P. Unit.</th>
                                <th style="text-align:right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${lineasHTML}</tbody>
                    </table>
                    <div class="fact-rec-totales">
                        <div class="fact-rec-total-row"><span>Subtotal</span><span>$${parseFloat(f.subtotal||f.total||0).toFixed(2)}</span></div>
                        ${f.descuento > 0 ? `<div class="fact-rec-total-row"><span>Descuento</span><span>−$${parseFloat(f.descuento).toFixed(2)}</span></div>` : ''}
                        <div class="fact-rec-total-row fact-rec-grand"><span>TOTAL</span><span>$${parseFloat(f.total||0).toFixed(2)}</span></div>
                    </div>
                    ${f.notas ? `<div class="fact-rec-notas"><strong>Notas:</strong> ${esc(f.notas)}</div>` : ''}
                </div>
                <div class="modal-foot">
                    <button class="btn-ghost-sm" onclick="cerrarModal('modal-ver-factura')">Cerrar</button>
                    <button class="btn-cyan" onclick="imprimirFactura('${id}')">🖨 Imprimir</button>
                </div>
            </div>
        </div>`);
}

function imprimirFactura(id) {
    const f = cacheFacturas.find(x => x.id === id);
    if (!f) return;
    let lineas = [];
    try { lineas = JSON.parse(f.lineas||'[]'); } catch {}

    const lineasHTML = lineas.length
        ? lineas.map(l => `
            <tr>
                <td>${esc(l.descripcion||'—')}</td>
                <td style="text-align:center">${l.cantidad||1}</td>
                <td style="text-align:right">$${parseFloat(l.precio_unit||0).toFixed(2)}</td>
                <td style="text-align:right"><strong>$${parseFloat(l.subtotal||0).toFixed(2)}</strong></td>
            </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:#999;padding:1rem">Sin líneas de detalle</td></tr>';

    const win = window.open('','_blank','width=820,height=700');
    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura ${esc(f.numero_factura||f.id.slice(0,8).toUpperCase())} — PROINTEL</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            background: #fff;
            color: #111;
            padding: 2.5rem;
            max-width: 780px;
            margin: 0 auto;
        }
        /* ── Header ── */
        .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 1.2rem;
            border-bottom: 3px solid #00c8f0;
            margin-bottom: 1.5rem;
        }
        .doc-brand-logo {
            font-size: 2rem;
            font-weight: 900;
            letter-spacing: -.01em;
            color: #0d1520;
        }
        .doc-brand-logo span { color: #00c8f0; }
        .doc-brand-sub { font-size: .75rem; color: #636e72; margin-top: .2rem; }
        .doc-num-wrap  { text-align: right; }
        .doc-num       { font-size: 1.3rem; font-weight: 800; color: #0d1520;
                         font-family: 'Courier New', monospace; }
        .doc-fecha     { font-size: .78rem; color: #636e72; margin-top: .2rem; }
        .doc-estado    {
            display: inline-block;
            margin-top: .4rem;
            padding: .2rem .7rem;
            border-radius: 20px;
            font-size: .72rem;
            font-weight: 700;
            letter-spacing: .06em;
            text-transform: uppercase;
            background: ${f.estado==='pagada'?'#e8f8ef':'#fff8e7'};
            color: ${f.estado==='pagada'?'#00a854':'#e67e22'};
            border: 1px solid ${f.estado==='pagada'?'#b7ebcc':'#f8d8a0'};
        }
        /* ── Cliente ── */
        .doc-client {
            background: #f8fafb;
            border-left: 4px solid #00c8f0;
            border-radius: 0 6px 6px 0;
            padding: .9rem 1rem;
            margin-bottom: 1.5rem;
        }
        .doc-client-label { font-size: .65rem; font-weight: 700;
                            letter-spacing: .12em; color: #636e72;
                            text-transform: uppercase; margin-bottom: .3rem; }
        .doc-client-name  { font-size: 1rem; font-weight: 700; color: #0d1520; }
        .doc-client-nit   { font-size: .82rem; color: #555;
                            font-family: 'Courier New', monospace; margin-top: .2rem; }
        .doc-client-dir   { font-size: .78rem; color: #636e72; margin-top: .15rem; }
        /* ── Tabla detalle ── */
        .doc-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
        .doc-table thead tr {
            background: #0d1520;
            color: #fff;
        }
        .doc-table th {
            padding: .6rem .9rem;
            font-size: .78rem;
            font-weight: 600;
            letter-spacing: .04em;
            text-align: left;
        }
        .doc-table td {
            padding: .6rem .9rem;
            font-size: .85rem;
            border-bottom: 1px solid #edf2f0;
            color: #2d3436;
        }
        .doc-table tbody tr:nth-child(even) { background: #f8fafb; }
        /* ── Totales ── */
        .doc-totals {
            display: flex;
            justify-content: flex-end;
            margin-top: .5rem;
        }
        .doc-totals-box {
            min-width: 240px;
            border-top: 2px solid #edf2f0;
            padding-top: .6rem;
        }
        .doc-total-row {
            display: flex;
            justify-content: space-between;
            font-size: .85rem;
            color: #636e72;
            padding: .2rem 0;
        }
        .doc-total-grand {
            display: flex;
            justify-content: space-between;
            font-size: 1.1rem;
            font-weight: 800;
            color: #0d1520;
            border-top: 2px solid #0d1520;
            padding-top: .5rem;
            margin-top: .3rem;
        }
        /* ── Notas ── */
        .doc-notas {
            font-size: .78rem;
            color: #636e72;
            margin-top: 1.2rem;
            padding: .7rem .9rem;
            background: #f8fafb;
            border-radius: 5px;
            border-left: 3px solid #dfe6e9;
        }
        /* ── Footer ── */
        .doc-footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #edf2f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: .72rem;
            color: #b2bec3;
        }
        /* ── Print ── */
        .print-btn {
            display: block;
            margin: 1.5rem auto 0;
            padding: .7rem 2rem;
            background: #00c8f0;
            color: #000;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 700;
            cursor: pointer;
        }
        @media print {
            .print-btn { display: none; }
            body { padding: 1rem; }
        }
    </style>
</head>
<body>

    <div class="doc-header">
        <div>
            <div class="doc-brand-logo">PRO<span>INTEL</span></div>
            <div class="doc-brand-sub">Sistema de Gestión Residencial</div>
        </div>
        <div class="doc-num-wrap">
            <div class="doc-num">${esc(f.numero_factura||f.id.slice(0,8).toUpperCase())}</div>
            <div class="doc-fecha">${new Date(f.created_at||Date.now()).toLocaleDateString('es-SV',{
                weekday:'long', day:'2-digit', month:'long', year:'numeric'
            })}</div>
            <span class="doc-estado">${esc(f.estado||'emitida')}</span>
        </div>
    </div>

    <div class="doc-client">
        <div class="doc-client-label">Facturar a</div>
        <div class="doc-client-name">${esc(f.cliente||'—')}</div>
        ${f.nit      ? `<div class="doc-client-nit">NIT / DUI: ${esc(f.nit)}</div>`       : ''}
        ${f.direccion? `<div class="doc-client-dir">${esc(f.direccion)}</div>`             : ''}
    </div>

    <table class="doc-table">
        <thead>
            <tr>
                <th>Descripción</th>
                <th style="text-align:center;width:70px">Cant.</th>
                <th style="text-align:right;width:100px">P. Unit.</th>
                <th style="text-align:right;width:110px">Subtotal</th>
            </tr>
        </thead>
        <tbody>${lineasHTML}</tbody>
    </table>

    <div class="doc-totals">
        <div class="doc-totals-box">
            <div class="doc-total-row">
                <span>Subtotal</span>
                <span>$${parseFloat(f.subtotal||f.total||0).toFixed(2)}</span>
            </div>
            ${f.descuento > 0 ? `<div class="doc-total-row">
                <span>Descuento</span>
                <span>− $${parseFloat(f.descuento).toFixed(2)}</span>
            </div>` : ''}
            <div class="doc-total-grand">
                <span>TOTAL</span>
                <span>$${parseFloat(f.total||0).toFixed(2)}</span>
            </div>
        </div>
    </div>

    ${f.notas ? `<div class="doc-notas"><strong>Notas:</strong> ${esc(f.notas)}</div>` : ''}

    <div class="doc-footer">
        <span>PROINTEL 2.0 — Sistema de Gestión Residencial</span>
        <span>Impreso el ${new Date().toLocaleDateString('es-SV')}</span>
    </div>

    <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>

</body>
</html>`);
    win.document.close();
}

// ── Cambiar estado factura ────────────────────────────────
async function cambiarEstadoFactura(id, estadoActual) {
    const estados  = ['emitida','pagada','anulada'];
    const opciones = estados.filter(e => e !== estadoActual)
        .map(e => e.charAt(0).toUpperCase()+e.slice(1)).join(' / ');
    const nuevo = prompt(`Estado actual: ${estadoActual}
Nuevo estado (${opciones}):`);
    if (!nuevo) return;
    const val = nuevo.trim().toLowerCase();
    if (!estados.includes(val)) { _notificar('Estado no válido. Usa: emitida, pagada o anulada'); return; }
    const { error } = await window.supabase.from('facturas').update({ estado: val }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    cacheFacturas = [];
    cargarFacturas();
}

// ── Anular factura ────────────────────────────────────────
async function anularFactura(id, numero) {
    if (!confirm(`¿Anular la factura "${numero||id}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await window.supabase.from('facturas').update({ estado:'anulada' }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    cacheFacturas = [];
    cargarFacturas();
}

// ── Vista previa rápida ───────────────────────────────────
function previsualizarFactura() {
    alert('💡 Guarda primero la factura para ver la vista previa completa con el recibo.');
}

// ── Módulo: Usuarios ──────────────────────────

async function eliminarUsuario(usuario, id) {
    if (esSuperusuario(usuario)) {
        alert('⛔ El superusuario ' + SUPERUSUARIO + ' no puede eliminarse desde la plataforma.');
        return;
    }
    if (!confirm('¿Eliminar al usuario "' + usuario + '"? Esta acción no se puede deshacer.')) return;
    try {
        const { error } = await window.supabase.from('usuarios').delete().eq('id', id);
        if (error) throw error;
        cargarUsuarios();
    } catch (err) {
        alert('Error al eliminar: ' + err.message);
    }
}

function esSuperusuario(u) {
    return String(u || '').trim().toLowerCase() === SUPERUSUARIO.toLowerCase();
}

// ── Utilidades ────────────────────────────────
function filtrarTabla(inputId, tablaId) {
    const q = document.getElementById(inputId).value.toLowerCase();
    const tbody = document.querySelector('#' + tablaId + ' tbody');
    if (!tbody) return;
    Array.from(tbody.rows).forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatFecha(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('es-SV',{
            year:'numeric', month:'short', day:'2-digit'
        });
    } catch { return iso; }
}

// ── Módulo: Importar Archivo ──────────────────

// ════════════════════════════════════════════════════════════
//  MÓDULO: IMPORTAR ARCHIVO (Excel / CSV → Supabase bodega)
// ════════════════════════════════════════════════════════════

// Columnas reconocidas — incluye variantes comunes de nombres de columna
const COLS_RECONOCIDAS = [
    'nombre','articulo','codigo','sku',
    'serie','numero_serie','num_serie','n_serie',
    'modelo','descripcion',
    'unidad','um','unidad_medida',
    'cantidad','qty','cant',
    'precio','precio_unit','costo','valor',
    'estado','condicion',
    'cuadrilla','asignado','responsable',
    'ubicacion','bodega','almacen',
    'notas','observaciones','comentarios'
];

let datosImportados  = [];
let archivoActivo    = null;
let _mapeoColumnas   = {};   // mapeo detectado: campo_bd → columna_excel

// ════════════════════════════════════════════════════════════
//  MÓDULO: IMPORTAR ARCHIVO (Excel / CSV → bodega)
// ════════════════════════════════════════════════════════════
function cargarImportar() {
    document.getElementById('dashboard-content').innerHTML = `
        <div class="module-header">
            <h2>📤 Importar Archivo</h2>
            <span class="mod-sub">Cargue un archivo Excel (.xlsx) o CSV — el sistema detecta las columnas automáticamente</span>
        </div>

        <!-- Plantilla de descarga -->
        <div class="import-hint-bar">
            <span>💡 ¿No tienes plantilla? </span>
            <button class="btn-autogen" onclick="descargarPlantilla()">⬇ Descargar plantilla Excel</button>
            <span style="margin-left:1rem;color:var(--muted)">Formatos aceptados: .xlsx · .xls · .csv</span>
        </div>

        <!-- Drop zone -->
        <div class="drop-zone" id="drop-zone"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="onFileDrop(event)">
            <div class="drop-icon">📁</div>
            <div class="drop-title">Arrastra tu archivo aquí</div>
            <div class="drop-sub">o haz clic para seleccionar desde tu equipo</div>
            <input type="file" id="file-input" accept=".xlsx,.xls,.csv"
                style="display:none" onchange="onFileSelect(event)" />
            <button class="btn-cyan" style="margin-top:1.2rem"
                onclick="document.getElementById('file-input').click()">
                Seleccionar archivo
            </button>
        </div>

        <!-- Columnas reconocidas -->
        <div class="cols-info">
            <div class="cols-title">COLUMNAS QUE RECONOCE EL SISTEMA</div>
            <div class="cols-tags">
                <span class="col-tag required">NOMBRE / ARTICULO *</span>
                <span class="col-tag required">SERIE / NUMERO_SERIE / NUM_SERIE *</span>
                <span class="col-tag">CODIGO / SKU</span>
                <span class="col-tag">MODELO / DESCRIPCION</span>
                <span class="col-tag required">PRECIO / COSTO / VALOR *</span>
                <span class="col-tag">CANTIDAD / QTY / CANT</span>
                <span class="col-tag">ESTADO / CONDICION</span>
                <span class="col-tag">CUADRILLA / ASIGNADO</span>
                <span class="col-tag">UBICACION / BODEGA</span>
                <span class="col-tag">NOTAS / OBSERVACIONES</span>
            </div>
        </div>

        <!-- Preview -->
        <div id="import-preview" style="display:none">
            <div class="import-file-bar">
                <span>📄 <strong id="import-filename">—</strong></span>
                <span id="import-rowcount" class="badge badge-disponible">0 filas</span>
                <span id="import-mapeadas" class="badge badge-reservado" style="display:none">0 cols. mapeadas</span>
                <button class="btn-danger-sm" onclick="limpiarImport()">✕ Limpiar</button>
            </div>

            <!-- Mapeo de columnas detectado -->
            <div class="mapeo-wrap" id="mapeo-wrap" style="display:none">
                <div class="mapeo-title">🔗 MAPEO DETECTADO</div>
                <div class="mapeo-grid" id="mapeo-grid"></div>
            </div>

            <!-- Tabla de datos -->
            <div class="table-wrap" style="max-height:280px;overflow-y:auto">
                <table class="data-table" id="tabla-preview">
                    <thead id="preview-thead"></thead>
                    <tbody id="preview-tbody"></tbody>
                </table>
            </div>

            <!-- Resumen y acción -->
            <div class="import-actions">
                <div id="import-status" class="import-status"></div>
                <div style="display:flex;gap:.6rem">
                    <button class="btn-outline-sm" id="btn-solo-nuevos"
                        onclick="ejecutarImport(true)">⬆ Solo nuevos (omitir duplicados)</button>
                    <button class="btn-cyan btn-lg" id="btn-importar"
                        onclick="ejecutarImport(false)">⬆ Importar todo</button>
                </div>
            </div>
        </div>`;
}

function onFileDrop(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
}
function onFileSelect(e) { const f = e.target.files[0]; if (f) procesarArchivo(f); }

function procesarArchivo(file) {
    archivoActivo = file.name;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
        const r = new FileReader();
        r.onload = ev => parsearCSV(ev.target.result);
        r.readAsText(file, 'UTF-8');
    } else if (ext === 'xlsx' || ext === 'xls') {
        if (typeof XLSX === 'undefined') { setImportStatus('❌ Librería XLSX no disponible. Usa CSV.','error'); return; }
        const r = new FileReader();
        r.onload = ev => {
            const wb = XLSX.read(ev.target.result, { type:'array' });
            renderPreview(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' }));
        };
        r.readAsArrayBuffer(file);
    } else { setImportStatus('❌ Formato no soportado.','error'); }
}

function parsearCSV(texto) {
    const lineas = texto.trim().split('\n');
    if (lineas.length < 2) { setImportStatus('❌ Archivo vacío','error'); return; }
    const sep = lineas[0].includes(';') ? ';' : ',';
    const hdrs = lineas[0].split(sep).map(h => h.trim().replace(/["\r]/g,'').toLowerCase());
    const rows = lineas.slice(1).map(l => {
        const vals = l.split(sep).map(v => v.trim().replace(/["\r]/g,''));
        const o = {}; hdrs.forEach((h,i) => { o[h] = vals[i]||''; }); return o;
    }).filter(r => Object.values(r).some(v => v !== ''));
    renderPreview(rows);
}

// ── Mapeo automático de columnas ─────────────────────────
// Diccionario: campo_bd → lista de nombres posibles en Excel/CSV
const MAPA_CAMPOS = {
    nombre:    ['nombre','articulo','descripcion','producto','item','name'],
    serie:     ['serie','numero_serie','num_serie','n_serie','serial','sn'],
    codigo:    ['codigo','code','sku','cod','ref','referencia'],
    precio:    ['precio','price','costo','cost','valor','value','precio_unit'],
    cantidad:  ['cantidad','qty','cant','quantity','stock'],
    estado:    ['estado','status','condicion','condition'],
    cuadrilla: ['cuadrilla','asignado','assigned','tecnico','responsable'],
    ubicacion: ['ubicacion','bodega','almacen','location','lugar'],
    notas:     ['notas','notes','observaciones','comentarios','obs'],
};

function detectarMapeo(cols) {
    const mapa = {};
    const colsLower = cols.map(c => c.toLowerCase().trim());
    for (const [campo, variantes] of Object.entries(MAPA_CAMPOS)) {
        for (const v of variantes) {
            const idx = colsLower.indexOf(v);
            if (idx !== -1) { mapa[campo] = cols[idx]; break; }
        }
    }
    return mapa;
}

function renderPreview(rows) {
    if (!rows || !rows.length) { setImportStatus('❌ Sin filas válidas','error'); return; }
    datosImportados = rows;

    const cols     = Object.keys(rows[0]);
    _mapeoColumnas = detectarMapeo(cols);
    const mapeadas = Object.keys(_mapeoColumnas).length;

    // Cabeceras con indicador de mapeo
    document.getElementById('preview-thead').innerHTML = '<tr>' +
        cols.map(col => {
            const esMapeada = Object.values(_mapeoColumnas).includes(col);
            const campoMapeado = Object.entries(_mapeoColumnas).find(([,v]) => v===col)?.[0] || '';
            return `<th style="${esMapeada?'color:var(--cyan)':''}">
                ${esc(col)}
                ${esMapeada ? `<span style="display:block;font-size:.65rem;color:var(--cyan);opacity:.7">→ ${campoMapeado}</span>` : ''}
            </th>`;
        }).join('') + '</tr>';

    // Primeras 50 filas de preview
    document.getElementById('preview-tbody').innerHTML = rows.slice(0,50).map(row =>
        '<tr>' + cols.map(col => {
            const esMapeada = Object.values(_mapeoColumnas).includes(col);
            return `<td style="${esMapeada?'color:var(--white)':''}">${esc(String(row[col]??''))}</td>`;
        }).join('') + '</tr>').join('');

    // Barra de archivo
    document.getElementById('import-filename').textContent = archivoActivo;
    document.getElementById('import-rowcount').textContent = rows.length + ' filas';

    // Badge de columnas mapeadas
    const badgeMapeadas = document.getElementById('import-mapeadas');
    if (badgeMapeadas) {
        badgeMapeadas.textContent = mapeadas + ' cols. detectadas';
        badgeMapeadas.style.display = 'inline-block';
    }

    // Panel de mapeo visual
    const mapeoWrap = document.getElementById('mapeo-wrap');
    const mapeoGrid = document.getElementById('mapeo-grid');
    if (mapeoGrid && mapeadas > 0) {
        mapeoGrid.innerHTML = Object.entries(_mapeoColumnas).map(([campo, col]) =>
            `<div class="mapeo-item">
                <span class="mapeo-bd">${campo}</span>
                <span class="mapeo-arrow">←</span>
                <span class="mapeo-col">${esc(col)}</span>
            </div>`
        ).join('');
        // Campos no detectados
        const noDetectados = Object.keys(MAPA_CAMPOS).filter(k => !_mapeoColumnas[k]);
        if (noDetectados.length) {
            mapeoGrid.innerHTML += noDetectados.map(campo =>
                `<div class="mapeo-item mapeo-faltante">
                    <span class="mapeo-bd">${campo}</span>
                    <span class="mapeo-arrow">←</span>
                    <span class="mapeo-col mapeo-nd">no detectado</span>
                </div>`
            ).join('');
        }
        if (mapeoWrap) mapeoWrap.style.display = 'block';
    }

    document.getElementById('import-preview').style.display = 'block';
    document.getElementById('drop-zone').style.display      = 'none';

    const warn = !_mapeoColumnas.nombre && !_mapeoColumnas.serie
        ? ' ⚠ No se detectaron columnas clave (nombre/serie).' : '';
    setImportStatus(`✓ ${rows.length} filas listas · ${mapeadas} columnas detectadas.${warn}`,
        warn ? 'warn' : 'ok');
}

function limpiarImport() {
    datosImportados  = []; archivoActivo = null; _mapeoColumnas = {};
    const preview = document.getElementById('import-preview');
    const drop    = document.getElementById('drop-zone');
    const fi      = document.getElementById('file-input');
    if (preview) preview.style.display = 'none';
    if (drop)    drop.style.display    = 'block';
    if (fi)      fi.value              = '';
    setImportStatus('','');
}

// ── Ejecutar importación ──────────────────────────────────
async function ejecutarImport(soloNuevos = false) {
    if (!datosImportados.length) return;

    const btnTodo   = document.getElementById('btn-importar');
    const btnNuevos = document.getElementById('btn-solo-nuevos');
    if (btnTodo)   { btnTodo.disabled   = true; btnTodo.textContent   = '⏳ Importando…'; }
    if (btnNuevos) { btnNuevos.disabled = true; }

    // Helper: buscar valor en la fila por campo mapeado
    const kMapeado = (row, campo) => {
        const col = _mapeoColumnas[campo];
        if (col && row[col] !== undefined) return String(row[col]||'').trim();
        // Fallback: buscar directamente por variantes
        for (const v of (MAPA_CAMPOS[campo]||[])) {
            const key = Object.keys(row).find(k => k.toLowerCase().trim() === v);
            if (key) return String(row[key]||'').trim();
        }
        return '';
    };

    // Construir registros
    let registros = datosImportados.map(row => {
        const nombre   = kMapeado(row,'nombre');
        const serie    = kMapeado(row,'serie');
        const esSeriado = !!serie;
        return {
            nombre:        nombre || serie || '(sin nombre)',
            articulo:      nombre || serie || '(sin nombre)',
            serie:         serie || null,
            codigo:        kMapeado(row,'codigo') || null,
            precio:        parseFloat(kMapeado(row,'precio'))  || 0,
            cantidad:      parseInt(kMapeado(row,'cantidad'))  || 1,
            estado:        kMapeado(row,'estado')  || 'disponible',
            cuadrilla:     kMapeado(row,'cuadrilla') || null,
            ubicacion:     kMapeado(row,'ubicacion') || null,
            notas:         kMapeado(row,'notas')     || null,
            tipo_material: esSeriado ? 'seriado' : 'miscelaneo'
        };
    }).filter(r => r.nombre !== '(sin nombre)' || r.serie);

    if (!registros.length) {
        setImportStatus('❌ Ninguna fila tiene datos válidos (nombre o serie).','error');
        if (btnTodo)   { btnTodo.disabled   = false; btnTodo.textContent   = '⬆ Importar todo'; }
        if (btnNuevos) { btnNuevos.disabled = false; }
        return;
    }

    // Omitir duplicados por serie si soloNuevos = true
    if (soloNuevos) {
        setImportStatus('🔍 Verificando duplicados…','ok');
        const seriesNuevas = registros.map(r => r.serie).filter(Boolean);
        if (seriesNuevas.length) {
            const { data: existentes } = await window.supabase
                .from('bodega').select('serie').in('serie', seriesNuevas);
            const setExist = new Set((existentes||[]).map(e => e.serie));
            const antes = registros.length;
            registros = registros.filter(r => !r.serie || !setExist.has(r.serie));
            const omitidos = antes - registros.length;
            if (omitidos > 0) setImportStatus(`⚠ ${omitidos} duplicados omitidos. Importando ${registros.length} nuevos…`,'warn');
        }
        if (!registros.length) {
            setImportStatus('✅ Todos los registros ya existen en bodega. Nada que importar.','ok');
            if (btnTodo)   { btnTodo.disabled   = false; btnTodo.textContent   = '⬆ Importar todo'; }
            if (btnNuevos) { btnNuevos.disabled = false; }
            return;
        }
    }

    // Insertar en lotes de 100
    let insertados = 0;
    let errMsg     = null;
    const LOTE = 100;
    for (let i = 0; i < registros.length; i += LOTE) {
        const lote = registros.slice(i, i + LOTE);
        setImportStatus(`⏳ Importando… ${Math.min(i+LOTE, registros.length)} / ${registros.length}`,'ok');
        const { error } = await window.supabase.from('bodega').insert(lote);
        if (error) {
            errMsg = error.message;
            // Si es error de duplicado, intentar continuar con el resto
            if (!error.message.includes('unique') && !error.message.includes('duplicate')) break;
        } else {
            insertados += lote.length;
        }
    }

    if (btnTodo)   { btnTodo.disabled   = false; btnTodo.textContent   = '⬆ Importar todo'; }
    if (btnNuevos) { btnNuevos.disabled = false; }

    if (insertados > 0) {
        setImportStatus(`✅ ${insertados} de ${registros.length} registros importados correctamente.${errMsg ? ' ⚠ Algunos duplicados omitidos.' : ''}`, 'ok');
        cacheInventario = [];
        setTimeout(limpiarImport, 4000);
    } else {
        setImportStatus('❌ Error al importar: ' + (errMsg||'sin detalles'), 'error');
    }
}

// ── Descargar plantilla Excel ─────────────────────────────
function descargarPlantilla() {
    if (typeof XLSX === 'undefined') {
        // Fallback: descargar CSV de plantilla
        const csv = [
            'nombre,serie,codigo,precio,cantidad,estado,cuadrilla,ubicacion,notas',
            'Modem Dual Band,SN-ABC123,PRO-00001,45.00,1,disponible,Cuadrilla A,Bodega Central,Ejemplo seriado',
            'Cable UTP Cat6,,CAB-001,1.50,100,disponible,,Bodega Central,100 metros'
        ].join('\n');
        const a = Object.assign(document.createElement('a'), {
            href: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv),
            download: 'plantilla_prointel.csv'
        });
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        return;
    }
    const datos = [
        { nombre:'Módem Dual Band', serie:'SN-ABC123', codigo:'PRO-00001', precio:45.00, cantidad:1, estado:'disponible', cuadrilla:'Cuadrilla A', ubicacion:'Bodega Central', notas:'Ejemplo seriado' },
        { nombre:'Router WiFi 6', serie:'SN-XYZ456', codigo:'PRO-00002', precio:89.00, cantidad:1, estado:'disponible', cuadrilla:'', ubicacion:'Bodega Norte', notas:'' },
        { nombre:'Cable UTP Cat6', serie:'', codigo:'CAB-001', precio:1.50, cantidad:100, estado:'disponible', cuadrilla:'', ubicacion:'Bodega Central', notas:'100 metros' },
        { nombre:'Conector RJ45', serie:'', codigo:'CON-001', precio:0.15, cantidad:500, estado:'disponible', cuadrilla:'', ubicacion:'Bodega Central', notas:'Bolsa de 500' },
    ];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    // Ancho de columnas
    ws['!cols'] = [{wch:25},{wch:15},{wch:12},{wch:10},{wch:10},{wch:12},{wch:15},{wch:18},{wch:30}];
    XLSX.writeFile(wb, 'plantilla_prointel.xlsx');
}

function setImportStatus(msg, tipo) {
    const el = document.getElementById('import-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'import-status' +
        (tipo==='error' ? ' import-error' : tipo==='ok' ? ' import-ok' : tipo==='warn' ? ' import-warn' : '');
}


// ════════════════════════════════════════════════════════════
//  MÓDULO: ARTÍCULOS (catálogo simple de tipos de artículo)
// ════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════
//  MÓDULO: INVENTARIO BODEGA — Vista unificada (Artículos + Series)
// ════════════════════════════════════════════════════════════

// Alias legacy
function cargarArticulos() { cargarInventarioBodega(); }

async function cargarInventarioBodega() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>📦 Inventario Bodega</h2>
            <div class="header-actions">
                <button class="btn-nav" onclick="cargarInventarioBodega()">↺</button>
                <button class="btn-outline-sm" onclick="exportarInventarioCSV()">⬇ Exportar</button>
                <button class="btn-outline-sm" onclick="verMaterialEnCampo()">🚛 Material en Campo</button>
                <button class="btn-outline-sm" onclick="changeTab('importar')">📤 Importar Excel</button>
                <button class="btn-cyan" onclick="abrirModalArticulo()">+ Nuevo Artículo</button>
            </div>
        </div>

        <!-- Stats ──────────────────────────────────────── -->
        <div class="inv-stats" id="inv-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>

        <!-- Toolbar ────────────────────────────────────── -->
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1;min-width:220px">
                <input type="text" id="bodega-search"
                    placeholder="🔍  Nombre, código, serie, categoría…"
                    oninput="filtrarBodegaLive()" />
            </div>
            <select id="filtro-tipo" onchange="filtrarBodegaLive()" class="filter-select">
                <option value="">Todos los tipos</option>
                <option value="seriado">Seriado</option>
                <option value="miscelaneo">Misceláneos</option>
            </select>
            <select id="filtro-estado" onchange="filtrarBodegaLive()" class="filter-select">
                <option value="">Todos los estados</option>
                <option value="disponible">Disponible</option>
                <option value="reservado">Reservado</option>
                <option value="vendido">Vendido</option>
                <option value="dañado">Dañado</option>
            </select>
        </div>

        <!-- Tabla ──────────────────────────────────────── -->
        <div class="table-wrap">
            <table class="data-table" id="tabla-bodega">
                <thead>
                    <tr>
                        <th style="width:36px">#</th>
                        <th>NOMBRE / MODELO</th>
                        <th>CÓDIGO / SKU</th>
                        <th>TIPO</th>
                        <th>SERIE</th>
                        <th>CANT.</th>
                        <th>PRECIO</th>
                        <th>ESTADO</th>
                        <th>INGRESO</th>
                        <th>ACCIONES</th>
                    </tr>
                </thead>
                <tbody id="bodega-tbody">
                    <tr><td colspan="10" class="empty-row">⏳ Cargando inventario…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="bodega-count"></p>`;

    try {
        // Admin ve solo stock central (sin cuadrilla asignada a técnico)
        // Artículos con cuadrilla van a "Material en Campo"
        const { data, error } = await window.supabase
            .from('bodega')
            .select('*')
            .is('asignado_a', null)
            .not('estado', 'eq', 'vendido')
            .order('created_at', { ascending: false });
        if (error) throw error;

        cacheInventario = data || [];
        renderInventario(cacheInventario);

        // Stats
        const tot  = cacheInventario.length;
        const disp = cacheInventario.filter(i => (i.estado||'').toLowerCase() === 'disponible').length;
        const ser  = cacheInventario.filter(i => !i.tipo_material || i.tipo_material === 'seriado').length;
        const cant = cacheInventario.filter(i => i.tipo_material === 'miscelaneo').length;
        const val  = cacheInventario.reduce((s,i) =>
            s + parseFloat(i.precio||0) * (i.tipo_material==='miscelaneo' ? (i.cantidad||1) : 1), 0);

        document.getElementById('inv-stats').innerHTML = `
            <div class="istat">
                <span class="istat-num">${tot}</span>
                <span class="istat-label">Registros</span>
            </div>
            <div class="istat istat-green">
                <span class="istat-num">${disp}</span>
                <span class="istat-label">Disponibles</span>
            </div>
            <div class="istat istat-blue">
                <span class="istat-num">${ser}</span>
                <span class="istat-label">Seriados</span>
            </div>
            <div class="istat">
                <span class="istat-num">${cant}</span>
                <span class="istat-label">Por cantidad</span>
            </div>
            <div class="istat istat-cyan">
                <span class="istat-num">$${val.toFixed(0)}</span>
                <span class="istat-label">Valor total</span>
            </div>`;

    } catch (err) {
        document.getElementById('bodega-tbody').innerHTML =
            `<tr><td colspan="10" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

// ── Renderizar tabla ──────────────────────────────────────
function renderInventario(filas) {
    const tbody = document.getElementById('bodega-tbody');
    const count = document.getElementById('bodega-count');
    if (!filas || !filas.length) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-row">No hay artículos en bodega.</td></tr>';
        if (count) count.textContent = '';
        return;
    }

    tbody.innerHTML = filas.map((item, idx) => {
        const esSeriado = !item.tipo_material || item.tipo_material === 'seriado';
        const serie = item.serie || item.serie || '';
        const tipoBadge = esSeriado
            ? `<span class="tipo-badge tipo-seriado">SERIADO</span>`
            : `<span class="tipo-badge tipo-cantidad">MISCELÁNEOS</span>`;
        const serieTd = esSeriado
            ? `<td><code class="serie-code">${esc(serie || '—')}</code></td>`
            : `<td class="text-muted">—</td>`;
        const cantTd = esSeriado
            ? `<td class="text-center text-muted">1</td>`
            : `<td class="text-center td-bold">${item.cantidad || 1}</td>`;

        return `
            <tr>
                <td class="row-num">${idx + 1}</td>
                <td>
                    <div class="td-nombre">${esc(item.nombre || item.articulo || '—')}</div>
                    ${item.categoria ? `<div class="td-sub">${esc(item.categoria)}</div>` : ''}
                </td>
                <td><span class="sku-code">${esc(item.codigo || '—')}</span></td>
                <td>${tipoBadge}</td>
                ${serieTd}
                ${cantTd}
                <td class="td-price">$${parseFloat(item.precio || 0).toFixed(2)}</td>
                <td><span class="badge badge-${(item.estado||'disponible').toLowerCase()}">
                    ${esc(item.estado || 'disponible')}
                </span></td>
                <td class="td-date">${formatFecha(item.fecha_ingreso)}</td>
                <td>
                    <div class="action-row">
                        <button class="act-btn act-edit"
                            onclick="abrirModalArticulo('${esc(String(item.id))}')">✎</button>
                        <button class="act-btn act-del"
                            onclick="eliminarArticulo('${esc(String(item.id))}','${esc(item.nombre||item.articulo||'')}')">✕</button>
                    </div>
                </td>
            </tr>`;
    }).join('');

    if (count) count.textContent = `${filas.length} artículo${filas.length !== 1 ? 's' : ''}`;
}

// ── Filtro en tiempo real ─────────────────────────────────
function filtrarBodegaLive() {
    const q    = (document.getElementById('bodega-search')?.value || '').toLowerCase();
    const tipo = (document.getElementById('filtro-tipo')?.value   || '').toLowerCase();
    const est  = (document.getElementById('filtro-estado')?.value || '').toLowerCase();

    renderInventario(cacheInventario.filter(i => {
        const mQ = !q
            || (i.nombre        ||'').toLowerCase().includes(q)
            || (i.articulo        ||'').toLowerCase().includes(q)
            || (i.codigo        ||'').toLowerCase().includes(q)
            || (i.serie  ||'').toLowerCase().includes(q)
            || (i.categoria     ||'').toLowerCase().includes(q);
        const mT = !tipo || ((!i.tipo_material || i.tipo_material==='seriado') ? 'seriado' : 'miscelaneo') === tipo;
        const mE = !est  || (i.estado        || '').toLowerCase() === est;
        return mQ && mT && mE;
    }));
}

// ── Exportar CSV ──────────────────────────────────────────
async function exportarInventarioCSV() {
    const { data, error } = await window.supabase.from('bodega').select('*');
    if (error || !data) { alert('Error al exportar: ' + (error?.message||'sin datos')); return; }
    const cols = ['nombre','codigo','tipo_material','numero_serie','modelo','categoria',
                  'cantidad','precio','estado','cuadrilla','created_at'];
    const csv = [
        cols.join(','),
        ...data.map(r => cols.map(c => `"${esc(String(r[c]??''))}"`).join(','))
    ].join('\n');
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' })),
        download: `prointel_inventario_${new Date().toISOString().slice(0,10)}.csv`
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}


// ════════════════════════════════════════════════════════════
//  MODAL: NUEVO / EDITAR ARTÍCULO — dinámico con tipo switch
// ════════════════════════════════════════════════════════════

function abrirModalArticulo(id) {
    const item = id ? cacheInventario.find(i => String(i.id) === String(id)) : null;
    const esEdicion = !!item;
    const tipoActual = (item?.tipo_material && item.tipo_material !== 'cantidad') ? item.tipo_material : (item ? 'miscelaneo' : 'seriado');

    const estadoOpts = ['disponible','reservado','vendido','dañado'].map(s =>
        `<option value="${s}" ${(item?.estado||'disponible')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
    ).join('');

    const htmlModal = `
        <div class="modal-overlay" id="modal-articulo">
            <!-- Backdrop no cierra este modal — protege series escaneadas -->
            <div class="modal-content modal-inventario"
                onclick="event.stopPropagation()">

                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">📦</span>
                        <span>${esEdicion ? 'Editar Artículo' : 'Nuevo Artículo'}</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('modal-articulo')">✕</button>
                </div>

                <form id="form-articulo" onsubmit="guardarArticulo(event,'${id||''}')">
                <div class="modal-body">

                    <!-- CATEGORÍA / TIPO ────────────────────── -->
                    <div class="tipo-switch-wrap">
                        <div class="tipo-switch-label">CATEGORÍA</div>
                        <div class="tipo-switch">
                            <label class="tipo-opt ${tipoActual==='seriado'?'active':''}">
                                <input type="radio" name="tipo_material" value="seriado"
                                    ${tipoActual==='seriado'?'checked':''}
                                    onchange="onTipoMaterialChange(this)" />
                                <span class="tipo-icon">🔖</span>
                                <span class="tipo-name">Seriado</span>
                                <span class="tipo-desc">Equipos con N° de serie único — serie obligatoria</span>
                            </label>
                            <label class="tipo-opt ${tipoActual!=='seriado'?'active':''}">
                                <input type="radio" name="tipo_material" value="miscelaneo"
                                    ${tipoActual!=='seriado'?'checked':''}
                                    onchange="onTipoMaterialChange(this)" />
                                <span class="tipo-icon">📦</span>
                                <span class="tipo-name">Misceláneos</span>
                                <span class="tipo-desc">Cables, grapas, consumibles — sin serie</span>
                            </label>
                        </div>
                    </div>

                    <!-- CAMPOS BASE ──────────────────────── -->
                    <div class="form-grid">
                        <div class="field field-full">
                            <label>NOMBRE DEL ARTÍCULO *</label>
                            <div style="position:relative">
                                <input type="text" id="art-nombre"
                                    placeholder="Ej: Módem Dual Band, Cable UTP Cat6…"
                                    value="${esc(item?.nombre || item?.articulo || '')}"
                                    required
                                    oninput="buscarCodigoHistorico(this.value)"
                                    autocomplete="off" />
                                <div id="hist-status" class="hist-status hidden"></div>
                            </div>
                        </div>
                        <div class="field">
                            <label>
                                CÓDIGO / SKU
                                <span id="art-codigo-origin" class="hist-origin hidden">📚 del historial</span>
                                <button type="button" class="btn-autogen"
                                    onclick="generarCodigoAuto()">⚡ Auto</button>
                            </label>
                            <input type="text" id="art-codigo"
                                placeholder="PRO-00001"
                                value="${esc(item?.codigo || '')}"
                                oninput="document.getElementById('art-codigo-origin')?.classList.add('hidden')" />
                        </div>
                        <!-- categoría viene del switch tipo_material arriba -->
                        <div class="field">
                            <label>PRECIO UNITARIO ($)</label>
                            <input type="number" id="art-precio"
                                placeholder="0.00" step="0.01" min="0"
                                value="${item?.precio || ''}" />
                        </div>
                        <div class="field">
                            <label>ESTADO</label>
                            <select id="art-estado">${estadoOpts}</select>
                        </div>
                        <div class="field field-full">
                            <label>CUADRILLA / ASIGNADO</label>
                            <div class="cuad-wrap">
                                <select id="art-cuadrilla-sel"
                                    onchange="onCuadrillaChange(this)">
                                    <option value="">— Sin asignar —</option>
                                    <option value="PRI1" ${item?.cuadrilla==='PRI1'?'selected':''}>PRI1</option>
                                    <option value="PRI2" ${item?.cuadrilla==='PRI2'?'selected':''}>PRI2</option>
                                    <option value="PRI3" ${item?.cuadrilla==='PRI3'?'selected':''}>PRI3</option>
                                    <option value="PRI4" ${item?.cuadrilla==='PRI4'?'selected':''}>PRI4</option>
                                    ${/* opciones dinámicas de la sesión */
                                      '_cuadrillasExtra' in window
                                        ? window._cuadrillasExtra.map(q => `<option value="${q}" ${item?.cuadrilla===q?'selected':''}>${q}</option>`).join('')
                                        : ''}
                                    <option value="__manual__">✏ Otro / Manual…</option>
                                </select>
                                <input type="text" id="art-cuadrilla-manual"
                                    placeholder="Ej: EXT1, TEMP1…"
                                    value="${item?.cuadrilla && !['PRI1','PRI2','PRI3','PRI4',''].includes(item.cuadrilla) ? esc(item.cuadrilla) : ''}"
                                    class="${item?.cuadrilla && !['PRI1','PRI2','PRI3','PRI4',''].includes(item.cuadrilla) ? '' : 'hidden'}"
                                    oninput="this.value=this.value.toUpperCase()"
                                    style="text-transform:uppercase" />
                            </div>
                        </div>
                    </div>

                    <!-- PANEL SERIADO ───────────────────── -->
                    <div id="panel-seriado" class="${tipoActual!=='seriado'?'hidden':''}">
                        <div class="panel-section-title">
                            <span>🔖 Series / Códigos de Barra</span>
                            <span class="series-count-badge" id="series-count-badge">0 series</span>
                        </div>
                        <div class="scanner-wrap">
                            <input type="text" id="art-scanner"
                                placeholder="Escanea o escribe una serie y presiona Enter…"
                                class="scanner-input"
                                onkeydown="onScannerKeydown(event)"
                                autocomplete="off" />
                            <button type="button" class="btn-scan-add"
                                onclick="agregarSerie()">＋ Agregar</button>
                        </div>
                        <div class="series-list" id="series-list">
                            ${esEdicion && item?.serie
                                ? `<div class="serie-chip" data-serie="${esc(item.serie)}">
                                    <code>${esc(item.serie)}</code>
                                    <button type="button" onclick="quitarSerie(this,'${esc(item.serie)}')">✕</button>
                                   </div>`
                                : '<span class="series-empty">Agrega series usando el campo de arriba o un escáner de código de barras.</span>'
                            }
                        </div>
                        <input type="hidden" id="art-series-json" value="${esEdicion && item?.serie ? JSON.stringify([item.serie]) : '[]'}" />
                    </div>

                    <!-- PANEL CANTIDAD ──────────────────── -->
                    <div id="panel-cantidad" class="${tipoActual==='seriado'?'hidden':''}">
                        <div class="panel-section-title">
                            <span>📦 Cantidad en Bodega</span>
                        </div>
                        <div class="form-grid">
                            <div class="field">
                                <label>CANTIDAD *</label>
                                <input type="number" id="art-cantidad"
                                    min="1" step="1" placeholder="0"
                                    value="${item?.cantidad || 1}" />
                            </div>
                            <div class="field">
                                <label>UNIDAD DE MEDIDA</label>
                                <div style="display:flex;gap:.5rem;align-items:center">
                                    <select id="art-unidad-sel"
                                        onchange="onUnidadChange(this)"
                                        style="flex:1">
                                        <option value="und"   ${(!item?.unidad||item?.unidad==='und')   ?'selected':''}>Unidades (und)</option>
                                        <option value="m"     ${item?.unidad==='m'     ?'selected':''}>Metros (m)</option>
                                        <option value="rl"    ${item?.unidad==='rl'    ?'selected':''}>Rollos (rl)</option>
                                        <option value="kt"    ${item?.unidad==='kt'    ?'selected':''}>Kits (kt)</option>
                                        <option value="pza"   ${item?.unidad==='pza'   ?'selected':''}>Piezas (pza)</option>
                                        <option value="__otro__" ${item?.unidad&&!['und','m','rl','kt','pza'].includes(item.unidad)?'selected':''}>Otro…</option>
                                    </select>
                                    <input type="text" id="art-unidad"
                                        placeholder="Especificar…"
                                        value="${esc(item?.unidad || 'und')}"
                                        class="${item?.unidad&&!['und','m','rl','kt','pza'].includes(item.unidad)?'':'hidden'}"
                                        style="width:100px;font-family:var(--font-mono);font-size:.85rem" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- DESCRIPCIÓN ─────────────────────── -->
                    <div class="field" style="margin-top:.8rem">
                        <label>DESCRIPCIÓN / NOTAS TÉCNICAS</label>
                        <textarea id="art-notas" rows="2"
                            placeholder="Observaciones, especificaciones técnicas, garantía…">${esc(item?.notas || '')}</textarea>
                    </div>

                </div><!-- /modal-body -->
                    <div class="modal-foot">
                        <button type="button" class="btn-ghost-sm"
                            onclick="cerrarModal('modal-articulo')">Cancelar</button>
                        <button type="submit" class="btn-cyan" id="btn-guardar-art">
                            ${esEdicion ? 'Guardar cambios' : 'Registrar artículo'}
                        </button>
                    </div>

                </form>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', htmlModal);
    // Foco al primer campo
    setTimeout(() => document.getElementById('art-nombre')?.focus(), 80);
}

// ── Switch tipo material ──────────────────────────────────
function onTipoMaterialChange(radio) {
    const esSeriado = radio.value === 'seriado';
    document.getElementById('panel-seriado').classList.toggle('hidden', !esSeriado);
    document.getElementById('panel-cantidad').classList.toggle('hidden', esSeriado);
    // Actualizar clases active en labels
    document.querySelectorAll('.tipo-opt').forEach(l => {
        l.classList.toggle('active', l.querySelector('input').value === radio.value);
    });
    if (esSeriado) setTimeout(() => document.getElementById('art-scanner')?.focus(), 50);
    else setTimeout(() => document.getElementById('art-cantidad')?.focus(), 50);
}

// ── Variables de sesión para cuadrillas extra ────────────
if (!window._cuadrillasExtra) window._cuadrillasExtra = [];

// ── Memoria histórica de códigos ─────────────────────────
let _histTimer = null;

/**
 * Al escribir el nombre del artículo, busca en bodega el último
 * código usado para ese nombre exacto y auto-rellena el campo.
 */
async function buscarCodigoHistorico(nombre) {
    clearTimeout(_histTimer);
    const codigoEl  = document.getElementById('art-codigo');
    const statusEl  = document.getElementById('hist-status');
    const originEl  = document.getElementById('art-codigo-origin');

    if (!nombre || nombre.length < 3) {
        if (statusEl) statusEl.classList.add('hidden');
        return;
    }

    _histTimer = setTimeout(async () => {
        if (statusEl) {
            statusEl.textContent = '🔍 Buscando en historial…';
            statusEl.className   = 'hist-status hist-buscando';
        }

        // Buscar en caché local primero (más rápido)
        const enCache = cacheInventario.find(i =>
            (i.nombre||'').toLowerCase() === nombre.toLowerCase() && i.codigo
        );

        if (enCache) {
            _aplicarCodigoHistorico(enCache.codigo, codigoEl, statusEl, originEl, 'caché');
            return;
        }

        // Si no está en caché, consultar Supabase
        const { data } = await window.supabase
            .from('bodega')
            .select('codigo')
            .ilike('nombre', nombre)
            .not('codigo', 'is', null)
            .order('fecha_ingreso', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data?.codigo) {
            _aplicarCodigoHistorico(data.codigo, codigoEl, statusEl, originEl, 'BD');
        } else {
            if (statusEl) {
                statusEl.textContent = '✨ Artículo nuevo — ingresa el código manualmente';
                statusEl.className   = 'hist-status hist-nuevo';
            }
            if (originEl) originEl.classList.add('hidden');
        }
    }, 400);
}

function _aplicarCodigoHistorico(codigo, codigoEl, statusEl, originEl, fuente) {
    if (codigoEl && !codigoEl.value) {
        // Solo auto-rellena si el campo está vacío
        codigoEl.value = codigo;
        if (originEl) originEl.classList.remove('hidden');
        if (statusEl) {
            statusEl.textContent = `✓ Código "${codigo}" recuperado del historial (${fuente})`;
            statusEl.className   = 'hist-status hist-ok';
        }
    } else {
        // Campo ya tiene valor — solo informar
        if (statusEl) {
            statusEl.textContent = `💡 Historial sugiere: ${codigo}`;
            statusEl.className   = 'hist-status hist-sugerencia';
        }
    }
    setTimeout(() => {
        const s = document.getElementById('hist-status');
        if (s) s.classList.add('hidden');
    }, 4000);
}

// ── Lógica de cuadrilla inteligente ──────────────────────
const CUADRILLAS_FIJAS = ['PRI01','PRI02','PRI03','PRI04','PRI05'];

function onUnidadChange(sel) {
    const input = document.getElementById('art-unidad');
    if (!input) return;
    if (sel.value === '__otro__') {
        input.classList.remove('hidden');
        input.value = '';
        input.focus();
    } else {
        input.classList.add('hidden');
        input.value = sel.value;
    }
}

function onCuadrillaChange(sel) {
    const manualEl = document.getElementById('art-cuadrilla-manual');
    if (!manualEl) return;

    if (sel.value === '__manual__') {
        manualEl.classList.remove('hidden');
        manualEl.focus();
    } else {
        manualEl.classList.add('hidden');
        manualEl.value = '';
    }
}

/**
 * Si el usuario ingresa una cuadrilla manual, pregunta si la quiere
 * guardar para el resto de la sesión.
 */
function guardarCuadrillaManualSiAplica(cuadrilla) {
    if (!cuadrilla) return;
    if (CUADRILLAS_FIJAS.includes(cuadrilla)) return;
    if (window._cuadrillasExtra.includes(cuadrilla)) return;

    const guardar = confirm(
        `La cuadrilla "${cuadrilla}" no está en la lista predefinida.
` +
        `¿Deseas agregarla a la lista para el resto de esta sesión?`
    );
    if (guardar) {
        window._cuadrillasExtra.push(cuadrilla);
    }
}

// ── Generador de código automático ───────────────────────
async function generarCodigoAuto() {
    const { count } = await window.supabase
        .from('bodega').select('id', { count: 'exact', head: true });
    const num = String((count || 0) + 1).padStart(5, '0');
    const campo = document.getElementById('art-codigo');
    if (campo) campo.value = `PRO-${num}`;
}

// ── Gestión de series en el modal ─────────────────────────
function onScannerKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); agregarSerie(); }
}

async function agregarSerie() {
    const input = document.getElementById('art-scanner');
    const serie = (input?.value || '').trim();
    if (!serie) return;

    // Validar duplicado local (en el modal)
    const jsonField = document.getElementById('art-series-json');
    const actuales  = JSON.parse(jsonField?.value || '[]');
    if (actuales.includes(serie)) {
        mostrarAlertaInline(`⚠ La serie "${serie}" ya está en la lista.`, 'warn');
        input.value = ''; input.focus(); return;
    }

    // Validar duplicado en base de datos
    const { data: existe } = await window.supabase
        .from('bodega')
        .select('id, nombre, modelo')
        .eq('serie', serie)
        .maybeSingle();

    if (existe) {
        mostrarAlertaInline(
            `⛔ La serie <strong>${serie}</strong> ya existe en bodega (${existe.nombre || existe.articulo || 'sin nombre'}).`,
            'error'
        );
        input.select(); return;
    }

    // Agregar a la lista
    actuales.push(serie);
    jsonField.value = JSON.stringify(actuales);

    const chip = document.createElement('div');
    chip.className = 'serie-chip';
    chip.setAttribute('data-serie', serie);
    chip.innerHTML = `<code>${esc(serie)}</code><button type="button" onclick="quitarSerie(this,'${esc(serie)}')">✕</button>`;

    const lista = document.getElementById('series-list');
    const empty = lista.querySelector('.series-empty');
    if (empty) empty.remove();
    lista.appendChild(chip);

    actualizarContadorSeries(actuales.length);
    input.value = '';
    input.focus();
}

function quitarSerie(btn, serie) {
    const chip      = btn.closest('.serie-chip');
    const jsonField = document.getElementById('art-series-json');
    const actuales  = JSON.parse(jsonField?.value || '[]').filter(s => s !== serie);
    jsonField.value = JSON.stringify(actuales);
    chip.remove();
    actualizarContadorSeries(actuales.length);
    if (actuales.length === 0) {
        document.getElementById('series-list').innerHTML =
            '<span class="series-empty">Agrega series usando el campo de arriba o un escáner de código de barras.</span>';
    }
}

function actualizarContadorSeries(n) {
    const badge = document.getElementById('series-count-badge');
    if (badge) badge.textContent = `${n} serie${n !== 1 ? 's' : ''}`;
}

function mostrarAlertaInline(html, tipo) {
    let el = document.getElementById('art-alerta-inline');
    if (!el) {
        el = document.createElement('div');
        el.id = 'art-alerta-inline';
        const scanner = document.querySelector('.scanner-wrap');
        if (scanner) scanner.insertAdjacentElement('afterend', el);
    }
    el.className = `alerta-inline alerta-${tipo}`;
    el.innerHTML = html;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.remove(), 4000);
}

// ── Guardar artículo ──────────────────────────────────────
async function guardarArticulo(e, id) {
    e.preventDefault();

    // Leer tipo (seriado | miscelaneo)
    const tipo   = document.querySelector('input[name="tipo_material"]:checked')?.value || 'seriado';
    const nombre = document.getElementById('art-nombre').value.trim();
    const codigo = document.getElementById('art-codigo').value.trim() || null;
    const precio = parseFloat(document.getElementById('art-precio').value) || 0;
    const estado = document.getElementById('art-estado').value;
    const notas  = document.getElementById('art-notas').value.trim() || null;

    // Validaciones obligatorias
    if (!nombre) { _notificar('El nombre del artículo es obligatorio.'); return; }

    // Solo para seriados se exige al menos una serie
    if (tipo === 'seriado') {
        const series = JSON.parse(document.getElementById('art-series-json')?.value || '[]');
        if (!id && series.length === 0) {
            alert('El artículo es Seriado. Debes agregar al menos una serie antes de guardar.');
            document.getElementById('art-scanner')?.focus();
            return;
        }
    }

    const btn = document.getElementById('btn-guardar-art');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    // Leer cuadrilla — prioriza manual sobre select
    const cuadSel    = document.getElementById('art-cuadrilla-sel')?.value || '';
    const cuadManual = (document.getElementById('art-cuadrilla-manual')?.value || '').trim().toUpperCase();
    const cuadrilla  = cuadSel === '__manual__' ? (cuadManual || null)
                     : cuadSel || null;

    // Payload base — solo columnas que existen en bodega
    const payloadBase = {
        nombre,
        articulo: nombre,
        codigo,
        precio,
        estado,
        notas,
        cuadrilla,
        tipo_material: tipo
    };

    try {
        if (tipo === 'seriado') {
            const series = JSON.parse(document.getElementById('art-series-json')?.value || '[]');

            if (id) {
                // Editar registro seriado existente
                const payload = { ...payloadBase, serie: series[0] || null };
                const { error } = await window.supabase.from('bodega').update(payload).eq('id', id);
                if (error) throw error;
            } else {
                // Insertar una fila por cada serie
                const registros = series.map(s => ({ ...payloadBase, serie: s }));
                const { error } = await window.supabase.from('bodega').insert(registros);
                if (error) throw error;
            }

        } else {
            // Misceláneos — sin serie, con cantidad
            const cantidad = parseInt(document.getElementById('art-cantidad')?.value) || 1;
            const unidad   = document.getElementById('art-unidad')?.value.trim() || null;
            const payload  = { ...payloadBase, serie: null, cantidad };
            if (unidad) payload.unidad = unidad;

            const { error } = id
                ? await window.supabase.from('bodega').update(payload).eq('id', id)
                : await window.supabase.from('bodega').insert(payload);
            if (error) throw error;
        }

        // Guardar cuadrilla manual en memoria de sesión si aplica
        if (cuadrilla) guardarCuadrillaManualSiAplica(cuadrilla);

        cerrarModal('modal-articulo', true); // forzar = true
        cacheInventario = [];
        cargarInventarioBodega();

    } catch (err) {
        alert('Error al guardar: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = id ? 'Guardar cambios' : 'Registrar artículo'; }
    }
}

// ── Material en Campo ────────────────────────────────────
async function verMaterialEnCampo() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>🚛 Material en Campo</h2>
            <div class="header-actions">
                <button class="btn-nav" onclick="verMaterialEnCampo()">↺</button>
                <button class="btn-outline-sm" onclick="cargarInventarioBodega()">← Bodega Central</button>
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-campo">
                <thead><tr>
                    <th>#</th><th>ARTÍCULO</th><th>CÓDIGO</th>
                    <th>SERIE</th><th>TÉCNICO / CUADRILLA</th><th>ESTADO</th><th>ACCIONES</th>
                </tr></thead>
                <tbody id="campo-tbody">
                    <tr><td colspan="7" class="empty-row">⏳ Cargando…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="campo-count"></p>`;

    // Material en campo: artículos con cuadrilla asignada O asignado_a no nulo
    const { data: d1, error: e1 } = await window.supabase
        .from('bodega').select('*')
        .not('cuadrilla', 'is', null)
        .not('estado', 'eq', 'vendido')
        .order('fecha_ingreso', { ascending: false });

    const { data: d2 } = await window.supabase
        .from('bodega').select('*')
        .is('cuadrilla', null)
        .not('asignado_a', 'is', null)
        .not('estado', 'eq', 'vendido');

    const error = e1;
    const ids   = new Set();
    const data  = [...(d1||[]), ...(d2||[])].filter(i => {
        if (ids.has(i.id)) return false;
        ids.add(i.id); return true;
    });

    const tbody = document.getElementById('campo-tbody');
    const count = document.getElementById('campo-count');

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-row error-msg">❌ ${error.message}</td></tr>`;
        return;
    }

    const items = data || [];
    if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No hay material en campo actualmente.</td></tr>';
        return;
    }

    tbody.innerHTML = items.map((item, idx) => `
        <tr>
            <td class="row-num">${idx+1}</td>
            <td class="td-bold">${esc(item.nombre||item.articulo||'—')}</td>
            <td><span class="sku-code">${esc(item.codigo||'—')}</span></td>
            <td>${item.serie ? `<code class="serie-code">${esc(item.serie)}</code>` : '—'}</td>
            <td>
                <div style="line-height:1.4">
                    <div style="font-weight:600;font-size:.85rem">${esc(item.asignado_a||item.responsable||'—')}</div>
                    ${item.cuadrilla ? `<div class="td-date">${esc(item.cuadrilla)}</div>` : ''}
                </div>
            </td>
            <td><span class="badge badge-${(item.estado||'reservado').toLowerCase()}">${esc(item.estado||'reservado')}</span></td>
            <td>
                <button class="act-btn act-edit" title="Devolver a bodega central"
                    onclick="devolverABodega('${item.id}','${esc(item.nombre||item.articulo||'')}')">
                    ↩ Devolver
                </button>
            </td>
        </tr>`).join('');

    if (count) count.textContent = `${items.length} artículo${items.length!==1?'s':''} en campo`;
}

async function devolverABodega(id, nombre) {
    if (!confirm(`¿Devolver "${nombre}" a bodega central?`)) return;
    const { error } = await window.supabase.from('bodega')
        .update({
            estado:      'disponible',
            cuadrilla:   null,
            asignado_a:  null,
            responsable: null
        })
        .eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    verMaterialEnCampo();
}

// ── Eliminar artículo ─────────────────────────────────────
async function eliminarArticulo(id, nombre) {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await window.supabase.from('bodega').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    cacheInventario = [];
    cargarInventarioBodega();
}


// ════════════════════════════════════════════════════════════
//  MÓDULO: SALIDA DE INVENTARIO — formulario inteligente
// ════════════════════════════════════════════════════════════
let cacheSalidas        = [];
let _firmaCanvas        = null;
let _firmaCtx           = null;
let _firmaDibujando     = false;
let _articuloSeleccionado = null;
let _buscarTimer        = null;  // timer del buscador predictivo

async function cargarSalidas() {
    const content = document.getElementById('dashboard-content');
    const esTec   = (currentUser?.rol || '').toUpperCase() === 'TECNICO';

    content.innerHTML = `
        <div class="module-header">
            <h2>📤 Salida de Inventario</h2>
            <div class="header-actions">
                <button class="btn-nav" onclick="cargarSalidas()">↺ Actualizar</button>
                <a href="https://speed.cloudflare.com/" target="_blank"
                    rel="noopener noreferrer" class="btn-outline-sm">⚡ Probar Red</a>
                ${!esTec ? '<button class="btn-cyan" onclick="abrirModalSalida()">+ Registrar Salida</button>' : ''}
            </div>
        </div>
        <div class="inv-stats" id="sal-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="sal-search"
                    placeholder="🔍  Buscar por correlativo, artículo, técnico…"
                    oninput="filtrarTabla('sal-search','tabla-salidas')" />
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-salidas">
                <thead><tr>
                    <th>#</th><th>CORRELATIVO</th><th>ARTÍCULO</th>
                    <th>CANTIDAD</th><th>TÉCNICO</th><th>FECHA</th><th>VER</th>
                </tr></thead>
                <tbody id="sal-tbody">
                    <tr><td colspan="7" class="empty-row">⏳ Cargando…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="sal-count"></p>`;

    try {
        // Consulta con join FK — articulos(nombre,codigo) gracias al puente SQL
        let query = window.supabase
            .from('registros_salida')
            .select('id, correlativo, articulo_id, tecnico_id, cantidad, fecha, firma, nombre_articulo, despachado_por')
            .order('correlativo', { ascending: false });

        if (esTec && currentUser?.id) {
            query = query.eq('tecnico_id', currentUser.id);
        }

        const { data: salidas, error } = await query;

        // Fallback: si el join falla, traer sin relación
        let rows = salidas;
        if (error) {
            console.warn('PROINTEL — join articulos falló, usando fallback:', error.message);
            const { data: fallback } = await window.supabase
                .from('registros_salida')
                .select('id, correlativo, articulo_id, tecnico_id, cantidad, fecha, firma, nombre_articulo')
                .order('correlativo', { ascending: false });
            rows = fallback || [];
        }

        cacheSalidas = rows || [];

        // Enriquecer técnicos por separado
        const tecIds = [...new Set(cacheSalidas.map(s => s.tecnico_id).filter(Boolean))];
        let usrMap = {};
        if (tecIds.length) {
            const { data: usrs } = await window.supabase
                .from('usuarios')
                .select('id, nombre_completo, usuario')
                .in('id', tecIds);
            (usrs || []).forEach(u => { usrMap[u.id] = u; });
        }

        // Stats
        const tot  = cacheSalidas.length;
        const uniq = new Set(cacheSalidas.map(s => s.correlativo)).size;
        document.getElementById('sal-stats').innerHTML = `
            <div class="istat">
                <span class="istat-num">${tot}</span>
                <span class="istat-label">Líneas totales</span>
            </div>
            <div class="istat istat-cyan">
                <span class="istat-num">${uniq}</span>
                <span class="istat-label">Correlativos</span>
            </div>`;

        const tbody = document.getElementById('sal-tbody');
        const count = document.getElementById('sal-count');

        if (!cacheSalidas.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No hay registros de salidas.</td></tr>';
            if (count) count.textContent = '';
            return;
        }

        tbody.innerHTML = cacheSalidas.map((s, idx) => {
            // El join devuelve s.articulos como objeto; el fallback lo omite
            const art   = s.articulos || {};
            const usr   = usrMap[s.tecnico_id] || {};
            const fecha = s.fecha
                ? new Date(s.fecha).toLocaleDateString('es-SV')
                : '—';
            return `<tr>
                <td class="row-num">${idx + 1}</td>
                <td><code class="sku-code">#${s.correlativo || '—'}</code></td>
                <td class="td-bold">
                    ${esc(art.nombre || s.nombre_articulo || '—')}
                    ${art.codigo
                        ? `<br><span style="font-size:.7rem;color:var(--dim)">${esc(art.codigo)}</span>`
                        : ''}
                </td>
                <td style="font-family:var(--font-mono)">
                    ${s.cantidad || 1} ${esc(art.unidad_medida || 'und')}
                </td>
                <td style="font-size:.82rem">
                    ${esc(usr.nombre_completo || usr.usuario || '—')}
                </td>
                <td class="td-date">${fecha}</td>
                <td>
                    <button class="act-btn act-edit"
                        onclick="verFacturaSalida('${s.id}')">👁 Ver</button>
                </td>
            </tr>`;
        }).join('');

        if (count) count.textContent =
            `${tot} línea${tot !== 1 ? 's' : ''} · ${uniq} correlativo${uniq !== 1 ? 's' : ''}`;

    } catch (err) {
        console.error('PROINTEL — cargarSalidas:', err);
        document.getElementById('sal-tbody').innerHTML =
            `<tr><td colspan="7" class="empty-row error-msg">
                ❌ ${esc(err.message)}
            </td></tr>`;
    }
}

function renderSalidas(filas) {
    const tbody = document.getElementById('sal-tbody');
    const count = document.getElementById('sal-count');
    if (!filas || !filas.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No hay salidas registradas.</td></tr>';
        if (count) count.textContent = ''; return;
    }
    tbody.innerHTML = filas.map((s, idx) => `
        <tr>
            <td class="row-num">${idx+1}</td>
            <td><code class="sku-code">${esc(s.numero_ot || '—')}</code></td>
            <td class="td-bold">${esc(s.modelo || s.nombre_articulo || '—')}</td>
            <td>
                ${s.numero_serie
                    ? `<code class="serie-code">${esc(s.numero_serie)}</code>`
                    : `<span style="font-family:var(--font-mono);color:var(--dim)">${s.cantidad||1} uds.</span>`}
            </td>
            <td><span class="cat-pill">${esc(s.motivo || '—')}</span></td>
            <td style="font-size:.82rem">${esc(s.responsable || '—')}</td>
            <td>
                ${s.estado_material
                    ? `<span class="badge ${s.estado_material==='nuevo'?'badge-disponible':'badge-reservado'}">${esc(s.estado_material)}</span>`
                    : '—'}
            </td>
            <td class="td-date">${formatFecha(s.created_at)}</td>
            <td>
                <button class="act-btn act-edit"
                    onclick="verFacturaSalida('${s.id}')">👁 Ver</button>
            </td>
        </tr>`).join('');
    if (count) count.textContent = filas.length + ' registros';
}

// ── Vale de Salida — visor e impresión ───────────────────
async function verFacturaSalida(id) {
    document.getElementById('modal-factura-salida')?.remove();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-factura-salida" onclick="event.stopPropagation()">
            <div class="modal-content mfs-content" onclick="event.stopPropagation()">
                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">🧾</span>
                        <span>Comprobante de Salida</span>
                    </div>
                    <button class="modal-close"
                        onclick="document.getElementById('modal-factura-salida').remove()">✕</button>
                </div>
                <div class="modal-body" id="mfs-body">
                    <p style="padding:2rem;text-align:center;color:var(--dim)">⏳ Cargando…</p>
                </div>
                <div class="modal-foot">
                    <button class="btn-ghost-sm"
                        onclick="document.getElementById('modal-factura-salida').remove()">
                        Cerrar
                    </button>
                    <button class="btn-cyan" onclick="imprimirFacturaSalida()">
                        🖨 Imprimir / PDF
                    </button>
                </div>
            </div>
        </div>`);

    try {
        // 1. Obtener el registro
        let registro = (cacheSalidas || []).find(x => String(x.id) === String(id));
        if (!registro) {
            const { data, error } = await window.supabase
                .from('registros_salida')
                .select('id, correlativo, articulo_id, tecnico_id, cantidad, fecha, firma, nombre_articulo, despachado_por')
                .eq('id', id)
                .maybeSingle();
            if (error) throw new Error(error.message);
            if (!data)  throw new Error('Registro no encontrado.');
            registro = data;
        }

        // 2. Resolver nombre del artículo — FK → nombre_articulo → bodega
        let artNombre = registro.nombre_articulo || '—';
        let artCodigo = '';
        let artUnidad = 'und';
        let artCategoria = '';

        if (registro.articulo_id) {
            const { data: artFK } = await window.supabase
                .from('articulos')
                .select('nombre, codigo, unidad_medida, categoria')
                .eq('id', registro.articulo_id)
                .maybeSingle();
            if (artFK) {
                artNombre    = artFK.nombre        || artNombre;
                artCodigo    = artFK.codigo        || '';
                artUnidad    = artFK.unidad_medida || 'und';
                artCategoria = artFK.categoria     || '';
            }
        }

        // 3. Resolver nombre del técnico
        let tecNombre = '—';
        if (registro.tecnico_id) {
            const { data: tec } = await window.supabase
                .from('usuarios')
                .select('nombre_completo, usuario')
                .eq('id', registro.tecnico_id)
                .maybeSingle();
            if (tec) tecNombre = tec.nombre_completo || tec.usuario || '—';
        }

        const fechaStr = registro.fecha
            ? new Date(registro.fecha).toLocaleDateString('es-SV', {
                weekday:'long', day:'2-digit', month:'long', year:'numeric'
              })
            : '—';

        const firmaHTML = registro.firma
            ? `<div class="mfs-firma">
                   <div class="mfs-firma-label">Firma de recibido</div>
                   <img src="${registro.firma}" class="mfs-firma-img"
                        alt="Firma del técnico" />
               </div>`
            : `<div class="mfs-firma">
                   <div class="mfs-firma-label">Firma de recibido</div>
                   <div class="mfs-firma-linea"></div>
                   <div style="font-size:.7rem;color:var(--dim);margin-top:.3rem">Sin firma capturada</div>
               </div>`;

        document.getElementById('mfs-body').innerHTML = `
            <div id="mfs-printable">

                <!-- Encabezado -->
                <div class="mfs-head">
                    <div>
                        <div class="mfs-brand">PRO<span>INTEL</span></div>
                        <div class="mfs-brand-sub">Comprobante de Despacho de Material</div>
                    </div>
                    <div class="mfs-head-right">
                        <div class="mfs-tipo-badge">SALIDA DE INVENTARIO</div>
                        <div class="mfs-correlativo">#${registro.correlativo || '—'}</div>
                        <div class="mfs-fecha">${fechaStr}</div>
                    </div>
                </div>

                <!-- Info técnico y correlativo -->
                <div class="mfs-info-grid">
                    <div class="mfs-info-card">
                        <div class="mfs-info-label">Recibido por</div>
                        <div class="mfs-info-val">${esc(tecNombre)}</div>
                    </div>
                    <div class="mfs-info-card">
                        <div class="mfs-info-label">Entregado por</div>
                        <div class="mfs-info-val">
                            ${esc(registro.despachado_por || 'Bodega Central')}
                        </div>
                    </div>
                    <div class="mfs-info-card">
                        <div class="mfs-info-label">Correlativo</div>
                        <div class="mfs-info-val" style="font-family:var(--font-mono);font-size:1.1rem">
                            #${registro.correlativo || '—'}
                        </div>
                    </div>
                    <div class="mfs-info-card">
                        <div class="mfs-info-label">Fecha</div>
                        <div class="mfs-info-val">${fechaStr.split(',').slice(-1)[0]?.trim() || '—'}</div>
                    </div>
                </div>

                <!-- Tabla de artículos -->
                <table class="mfs-tabla">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Artículo / Material</th>
                            <th>Código</th>
                            <th style="text-align:center">Cant.</th>
                            <th style="text-align:center">Unidad</th>
                            <th>Categoría</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="row-num">1</td>
                            <td class="td-bold">${esc(artNombre)}</td>
                            <td><code style="font-size:.82rem;font-family:var(--font-mono)">
                                ${esc(artCodigo || '—')}
                            </code></td>
                            <td style="text-align:center;font-weight:700;font-family:var(--font-mono)">
                                ${registro.cantidad || 1}
                            </td>
                            <td style="text-align:center;color:var(--dim)">
                                ${esc(artUnidad)}
                            </td>
                            <td>
                                <span class="tipo-badge ${artCategoria === 'SERIADO' ? 'tipo-seriado' : 'tipo-cantidad'}"
                                    style="font-size:.65rem">
                                    ${esc(artCategoria || 'MATERIAL')}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                ${firmaHTML}

                <!-- Pie de página -->
                <div class="mfs-footer">
                    <span>PROINTEL 2.0 — Sistema de Gestión Residencial</span>
                    <span>Impreso el ${new Date().toLocaleDateString('es-SV')}</span>
                </div>

            </div>`;

    } catch (err) {
        console.error('PROINTEL — verFacturaSalida:', err);
        document.getElementById('mfs-body').innerHTML = `
            <div style="padding:2rem;text-align:center">
                <div style="font-size:2rem">❌</div>
                <div style="color:var(--danger);font-weight:700;margin-top:.5rem">
                    ${esc(err.message)}
                </div>
                <div style="font-size:.78rem;color:var(--dim);margin-top:.3rem">
                    Abre F12 → Console para más detalles.
                </div>
            </div>`;
    }
}

function imprimirFacturaSalida() {
    const area = document.getElementById('mfs-printable');
    if (!area) return;

    const win = window.open('', '_blank', 'width=820,height=700');
    win.document.write(`<!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8">
        <title>Comprobante PROINTEL</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:'Segoe UI',Arial,sans-serif; color:#111;
                   padding:2rem; max-width:760px; margin:0 auto; }
            .mfs-brand { font-size:2rem; font-weight:900; color:#0d1520; }
            .mfs-brand span { color:#00c8f0; }
            .mfs-brand-sub { font-size:.72rem; color:#636e72; }
            .mfs-head { display:flex; justify-content:space-between;
                        align-items:flex-start; padding-bottom:1.2rem;
                        border-bottom:3px solid #00c8f0; margin-bottom:1.4rem; }
            .mfs-tipo-badge { font-size:.62rem; font-weight:700; letter-spacing:.12em;
                              color:#fff; background:#0d1520; padding:.3rem .8rem;
                              border-radius:20px; text-transform:uppercase;
                              display:inline-block; margin-bottom:.3rem; }
            .mfs-correlativo { font-size:1.3rem; font-weight:800;
                               font-family:'Courier New',monospace; }
            .mfs-fecha { font-size:.78rem; color:#636e72; }
            .mfs-info-grid { display:grid; grid-template-columns:1fr 1fr;
                             gap:.8rem; margin-bottom:1.4rem; }
            .mfs-info-card { background:#f8fafb; border-left:3px solid #00c8f0;
                             border-radius:0 5px 5px 0; padding:.7rem .9rem; }
            .mfs-info-label { font-size:.62rem; font-weight:700; letter-spacing:.1em;
                              color:#636e72; text-transform:uppercase; margin-bottom:.2rem; }
            .mfs-info-val { font-size:.92rem; font-weight:600; }
            .mfs-tabla { width:100%; border-collapse:collapse; margin-bottom:1.2rem; }
            .mfs-tabla thead tr { background:#0d1520; color:#fff; }
            .mfs-tabla th { padding:.6rem .9rem; font-size:.76rem; text-align:left; }
            .mfs-tabla td { padding:.6rem .9rem; font-size:.85rem;
                            border-bottom:1px solid #edf2f0; }
            .mfs-firma { margin-top:1.4rem; }
            .mfs-firma-label { font-size:.68rem; font-weight:700; letter-spacing:.1em;
                               color:#636e72; text-transform:uppercase; margin-bottom:.5rem; }
            .mfs-firma-img { max-width:220px; height:80px; object-fit:contain;
                             border:1px solid #dfe6e9; border-radius:4px; }
            .mfs-firma-linea { width:220px; border-bottom:1px solid #aaa; height:50px; }
            .mfs-footer { margin-top:2rem; padding-top:.8rem;
                          border-top:1px solid #edf2f0; display:flex;
                          justify-content:space-between; font-size:.7rem; color:#b2bec3; }
        </style>
    </head><body>${area.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
}


// ── Modal Salida — formulario inteligente ─────────────────
// ════════════════════════════════════════════════════════════
//  MÓDULO: SALIDAS — Registro multi-artículo (carrito)
// ════════════════════════════════════════════════════════════

async function generarNumeroOT() {
    try {
        const anio = new Date().getFullYear();

        const { data, error } = await window.supabase
            .from('registros_salida')
            .select('correlativo')
            .not('correlativo', 'is', null)
            .order('correlativo', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('PROINTEL — generarNumeroOT error:', error.code, error.message);
            // Si la tabla está vacía o sin permisos, iniciar en 1
            return `OT-${anio}-0001`;
        }

        const siguiente = (data?.correlativo || 0) + 1;
        return `OT-${anio}-${String(siguiente).padStart(4, '0')}`;

    } catch (err) {
        console.error('PROINTEL — generarNumeroOT excepción:', err.message);
        return `OT-${new Date().getFullYear()}-0001`;
    }
}

// ── Firma digital en canvas ──────────────────────────────
function initFirmaCanvas() {
    const canvas = document.getElementById('firma-canvas');
    if (!canvas) return;
    const ctx    = canvas.getContext('2d');
    let drawing  = false;

    function getPos(e) {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return {
            x: (src.clientX - r.left) * (canvas.width  / r.width),
            y: (src.clientY - r.top)  * (canvas.height / r.height),
        };
    }

    function start(e) {
        e.preventDefault();
        drawing = true;
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    }

    function draw(e) {
        if (!drawing) return;
        e.preventDefault();
        const p = getPos(e);
        ctx.lineWidth   = 2;
        ctx.lineCap     = 'round';
        ctx.strokeStyle = '#00c8f0';
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }

    function stop() { drawing = false; }

    // Mouse
    canvas.addEventListener('mousedown',  start);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stop);
    canvas.addEventListener('mouseleave', stop);
    // Touch
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  draw,  { passive: false });
    canvas.addEventListener('touchend',   stop);
}

function limpiarFirma() {
    const canvas = document.getElementById('firma-canvas');
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}


async function abrirModalSalida() {
    // Cargar técnicos activos
    const { data: tecnicos } = await window.supabase
        .from('usuarios')
        .select('usuario, nombre_completo, cuadrilla')
        .eq('estado', 'activo')
        .order('nombre_completo');

    const optsTec = (tecnicos || []).map(t =>
        `<option value="${esc(t.nombre_completo || t.usuario)}"
            data-cuadrilla="${esc(t.cuadrilla || '')}"
            data-usuario="${esc(t.usuario || '')}">
            ${esc(t.nombre_completo || t.usuario)}
         </option>`
    ).join('');

    // Inicializar carrito y limpiar caché para datos frescos
    window._listaSalida = [];
    cacheInventario = [];

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-salida">
            <!-- Backdrop bloqueado — stopPropagation en modal-content protege datos y firma -->
            <div class="modal-content modal-salida-wide" onclick="event.stopPropagation()">

                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">📤</span>
                        <span>Registrar Salida de Material</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('modal-salida')">✕</button>
                </div>

                <form id="form-salida" onsubmit="guardarSalida(event)">
                <div class="modal-body">
                <div class="salida-grid">

                    <!-- COLUMNA IZQUIERDA -->
                    <div class="salida-col">

                        <div class="field">
                            <label>Nº OT / TICKET
                                <span style="font-size:.65rem;color:var(--cyan);
                                    background:rgba(0,200,240,.08);
                                    border:1px solid var(--border-cyan);
                                    padding:.1rem .4rem;border-radius:3px;
                                    margin-left:.3rem">
                                    ⚡ Auto-generado
                                </span>
                            </label>
                            <input type="text" id="sal-ot" required
                                readonly
                                style="font-family:var(--font-mono);
                                       font-weight:700;letter-spacing:.06em;
                                       opacity:.85;cursor:not-allowed" />
                        </div>

                        <div class="field">
                            <label>ARTÍCULO <span class="req">*</span>
                                <span id="sal-stock-badge"
                                    class="series-count-badge"
                                    style="display:none"></span>
                            </label>
                            <div class="buscar-wrap">
                                <input type="text" id="sal-articulo-buscar"
                                    placeholder="Nombre, código o serie…"
                                    autocomplete="off"
                                    oninput="buscarArticuloSalida(this.value)"
                                    onkeydown="navSugerencias(event)"
                                    style="padding-right:2.4rem" />
                                <button type="button"
                                    id="sal-buscar-clear"
                                    class="buscar-clear-btn"
                                    style="display:none"
                                    onclick="limpiarBuscadorSalida()"
                                    title="Limpiar">✕</button>
                            </div>
                            <div id="sal-sugerencias" class="sal-sugerencias hidden"></div>
                            <div id="sal-codigo-interno" class="sal-codigo-interno hidden">
                                <span class="sal-codigo-label">Código:</span>
                                <code id="sal-codigo-val" class="serie-code"></code>
                            </div>
                        </div>

                        <div class="field" id="sal-id-wrap">
                            <label id="sal-id-label">SERIE <span class="req">*</span></label>
                            <div class="scanner-wrap">
                                <input type="text" id="sal-identificador"
                                    class="scanner-input"
                                    placeholder="Escanea o escribe la serie…"
                                    autocomplete="off" />
                                <span id="sal-tipo-badge"
                                    class="tipo-badge tipo-seriado">SERIADO</span>
                            </div>
                        </div>

                        <div class="field">
                            <label>ESTADO DEL MATERIAL</label>
                            <div class="radio-group" id="sal-estado-grupo">
                                <label class="radio-opt active">
                                    <input type="radio" name="estado_material"
                                        value="nuevo" checked />Nuevo
                                </label>
                                <label class="radio-opt">
                                    <input type="radio" name="estado_material"
                                        value="usado" />Usado
                                </label>
                                <label class="radio-opt">
                                    <input type="radio" name="estado_material"
                                        value="reparado" />Reparado
                                </label>
                            </div>
                        </div>

                        <div class="field">
                            <button type="button"
                                class="btn-outline-sm"
                                onclick="agregarAlCarritoSalida()"
                                style="width:100%;justify-content:center">
                                ➕ Añadir a la lista
                            </button>
                        </div>

                        <div class="field">
                            <label>ARTÍCULOS A ENTREGAR
                                <span id="carrito-count"
                                    class="series-count-badge"
                                    style="display:none"></span>
                            </label>
                            <div id="carrito-salida" class="carrito-vacio">
                                Sin artículos agregados aún
                            </div>
                        </div>

                    </div>

                    <!-- COLUMNA DERECHA -->
                    <div class="salida-col">

                        <div class="field">
                            <label>TÉCNICO RESPONSABLE <span class="req">*</span></label>
                            <select id="sal-tecnico" required
                                onchange="autoFillCuadrilla(this)">
                                <option value="">— Seleccionar técnico —</option>
                                ${optsTec || '<option disabled>Sin técnicos activos</option>'}
                            </select>
                        </div>

                        <div class="field">
                            <label>CUADRILLA / CÓDIGO</label>
                            <input type="text" id="sal-cuadrilla" readonly
                                placeholder="Se llena automáticamente"
                                style="opacity:.7;cursor:not-allowed" />
                        </div>

                        <div class="field">
                            <label>MOTIVO <span class="req">*</span></label>
                            <select id="sal-motivo" required>
                                <option value="instalación">Instalación</option>
                                <option value="traslado">Traslado</option>
                                <option value="préstamo">Préstamo</option>
                                <option value="venta">Venta</option>
                                <option value="daño">Daño / Baja</option>
                            </select>
                        </div>

                        <div class="field">
                            <label>DESTINO / CLIENTE</label>
                            <input type="text" id="sal-destino"
                                placeholder="Dirección o cliente" />
                        </div>

                        <div class="field">
                            <label>NOTAS</label>
                            <textarea id="sal-notas" rows="2"
                                placeholder="Observaciones…"></textarea>
                        </div>

                        <div class="field">
                            <label>FIRMA DE RECIBIDO
                                <button type="button" class="btn-autogen"
                                    onclick="limpiarFirma()">✕ Limpiar</button>
                            </label>
                            <div class="firma-wrap">
                                <canvas id="firma-canvas" class="firma-canvas"
                                    width="280" height="100"></canvas>
                                <div class="firma-hint">
                                    Firma aquí con el dedo o mouse
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                </div>

                <div class="modal-foot">
                    <button type="button" class="btn-ghost-sm"
                        onclick="cerrarModal('modal-salida')">Cancelar</button>
                    <button type="submit" class="btn-cyan" id="btn-guardar-sal">
                        ✓ Registrar Salida
                    </button>
                </div>
                </form>

            </div>
        </div>`);

    setTimeout(initFirmaCanvas, 100);
    generarNumeroOT().then(ot => {
        const el = document.getElementById('sal-ot');
        if (el && !el.value) el.value = ot;
    });
}

// ── Buscador predictivo ───────────────────────────────────

async function buscarArticuloSalida(q) {
    try {
        clearTimeout(_buscarTimer);
        const sugEl  = document.getElementById('sal-sugerencias');
        const btnX   = document.getElementById('sal-buscar-clear');
        const qClean = (q || '').trim();

        if (btnX) btnX.style.display = qClean ? 'flex' : 'none';
        if (!qClean) { if (sugEl) sugEl.classList.add('hidden'); return; }

        const minLen = /^\d/.test(qClean) ? 1 : 2;
        if (qClean.length < minLen) { if (sugEl) sugEl.classList.add('hidden'); return; }

        _buscarTimer = setTimeout(async () => {
            try {
                const qLow = qClean.toLowerCase();

                // Buscar artículos — debug completo
                console.log('PROINTEL — buscando en articulos, query:', qClean);

                // Buscar en articulos (esquema nuevo) Y bodega (esquema viejo)
                // — cubre ambos casos mientras se completa la migración
                const [resArt, resBodega] = await Promise.all([
                    window.supabase
                        .from('articulos')
                        .select('id, codigo, nombre, categoria, unidad_medida')
                        .or(`nombre.ilike.%${qClean}%,codigo.ilike.%${qClean}%`)
                        .limit(12),
                    window.supabase
                        .from('bodega')
                        .select('id, codigo, nombre, articulo, tipo_material, unidad, cantidad, estado, serie')
                        .or(`nombre.ilike.%${qClean}%,articulo.ilike.%${qClean}%,codigo.ilike.%${qClean}%,serie.ilike.%${qClean}%`)
                        .ilike('estado', 'disponible')
                        .is('asignado_a', null)
                        .limit(12),
                ]);

                console.log('PROINTEL — articulos:', resArt.data?.length, 'bodega:', resBodega.data?.length);

                const artErr = resArt.error;
                if (artErr) console.error('PROINTEL — articulos error:', artErr.code, artErr.message);

                // Normalizar resultados de ambas fuentes al mismo formato
                const deArticulos = (resArt.data || []).map(a => {
                    // Compatibilidad: la columna puede llamarse 'cant' o 'cantidad'
                    const stock = a.cantidad ?? null;
                    console.log('Artículo seleccionado:', a.nombre, '| cantidad:', a.cantidad, '| stock:', stock);
                    return {
                        _fuente:    'articulos',
                        _tipo:      'articulo',
                        art_id:     a.id,
                        nombre:     a.nombre,
                        codigo:     a.codigo,
                        unidad:     a.unidad_medida || 'und',
                        categoria:  a.categoria,
                        cantidad:   stock,
                    };
                });

                const deBodega = (resBodega.data || []).map(b => {
                    const esSer = !b.tipo_material || b.tipo_material === 'seriado';
                    return {
                        _fuente:    'bodega',
                        _tipo:      'articulo',
                        art_id:     b.id,
                        nombre:     b.nombre || b.articulo || '—',
                        codigo:     b.codigo  || '',
                        unidad:     b.unidad  || 'und',
                        // categoria correcta según tipo_material de bodega
                        categoria:  esSer ? 'SERIADO' : 'MISCELANEO',
                        // cantidad viene de bodega.cantidad (la columna real)
                        cantidad:   b.cantidad ?? 0,
                        _bodega_id: b.id,
                    };
                });

                // Priorizar bodega (tiene cantidad real) sobre catálogo articulos
                // Si un item existe en bodega, no mostrar el de articulos
                const codigosBodega = new Set(deBodega.map(b => (b.codigo||'').toLowerCase()));
                const soloArticulos = deArticulos.filter(a =>
                    !codigosBodega.has((a.codigo||'').toLowerCase())
                );

                // Combinar: bodega primero, luego articulos sin duplicado
                const vistos  = new Set();
                const artData = [...deBodega, ...soloArticulos].filter(a => {
                    const key = (a.codigo || a.nombre || '').toLowerCase();
                    if (vistos.has(key)) return false;
                    vistos.add(key);
                    return true;
                });
                const artErr2 = null;

                // Buscar series disponibles
                const { data: serData, error: serErr } = await window.supabase
                    .from('series')
                    .select('id, numero_serie, estado, articulo_id')
                    .ilike('numero_serie', `%${qClean}%`)
                    .eq('estado', 'DISPONIBLE')
                    .limit(6);

                if (serErr) {
                    console.error('PROINTEL — buscar series:', serErr.code, serErr.message);
                }

                const arts   = artData  || [];
                const series = serData  || [];

                if (!sugEl) return;

                if (!arts.length && !series.length) {
                    sugEl.innerHTML = `<div class="sal-sug-empty">
                        Sin coincidencias para "<strong>${esc(qClean)}</strong>"
                        <div style="font-size:.72rem;margin-top:.3rem;color:var(--muted)">
                            Busca por nombre o código del artículo
                        </div>
                    </div>`;
                    sugEl.classList.remove('hidden');
                    return;
                }

                // Auto-selección por serie exacta
                const exacta = series.find(s =>
                    (s.numero_serie || '').toLowerCase() === qLow
                );
                if (exacta) {
                    // Buscar el artículo de esta serie
                    const { data: artSer } = await window.supabase
                        .from('articulos')
                        .select('id, nombre, codigo, unidad_medida')
                        .eq('id', exacta.articulo_id)
                        .maybeSingle();

                    seleccionarArticuloSalida({
                        _tipo:    'seriado',
                        art_id:   artSer?.id,
                        nombre:   artSer?.nombre  || '—',
                        codigo:   artSer?.codigo  || '',
                        serie_id: exacta.id,
                        serie:    exacta.numero_serie,
                        unidad:   artSer?.unidad_medida || 'und',
                        cantidad: 1,
                    });
                    return;
                }

                // Renderizar lista de sugerencias
                const safeQ = qLow.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
                const hlFn  = txt => esc(txt).replace(
                    new RegExp('(' + safeQ + ')', 'gi'),
                    '<mark style="background:rgba(0,200,240,.2);color:var(--cyan);border-radius:2px">$1</mark>'
                );

                const itemsArt = arts.map(a => {
                    // unidad: bodega usa 'unidad', articulos usa 'unidad_medida'
                    const unidad = a.unidad_medida || a.unidad || 'und';
                    // categoria: bodega usa tipo_material, articulos usa categoria
                    const cat    = a.categoria || (
                        (!a.tipo_material || a.tipo_material === 'seriado') ? 'SERIADO' : 'MISCELANEO'
                    );
                    // cantidad: solo misceláneos la tienen (bodega.cantidad)
                    const qty    = a.cantidad ?? 0;
                    console.log('Artículo en sugerencia:', a.nombre, '| cantidad:', qty, '| categoria:', cat);
                    const iJSON = JSON.stringify({
                        _tipo:      'articulo',
                        _fuente:    a._fuente || 'bodega',
                        _bodega_id: a._bodega_id || a.id,
                        art_id:     a.art_id || a.id,
                        nombre:     a.nombre || a.articulo || '—',
                        codigo:     a.codigo  || '',
                        unidad:     unidad,
                        categoria:  cat,
                        cantidad:   qty,
                        tipo_material: a.tipo_material || null,
                    }).replace(/"/g,'&quot;');
                    return `<div class="sal-sug-item" tabindex="0"
                            onclick="seleccionarArticuloSalida(${iJSON})"
                            onkeydown="if(event.key==='Enter')seleccionarArticuloSalida(${iJSON})">
                        <div class="sal-sug-nombre">${hlFn(a.nombre || '—')}</div>
                        <div class="sal-sug-meta">
                            <code>${esc(a.codigo || '—')}</code>
                            <span class="tipo-badge ${a.categoria==='SERIADO'?'tipo-seriado':'tipo-cantidad'}"
                                style="font-size:.65rem">${esc(a.categoria||'')}</span>
                            <span style="color:var(--dim);font-size:.78rem">${esc(a.unidad_medida||'und')}</span>
                        </div>
                    </div>`;
                });

                const itemsSer = series.map(s => {
                    const iJSON = JSON.stringify({
                        _tipo:'seriado', art_id:s.articulo_id, nombre:'',
                        codigo:'', serie_id:s.id,
                        serie:s.numero_serie, unidad:'und', cantidad:1,
                    }).replace(/"/g,'&quot;');
                    return `<div class="sal-sug-item" tabindex="0"
                            onclick="seleccionarArticuloSalida(${iJSON})"
                            onkeydown="if(event.key==='Enter')seleccionarArticuloSalida(${iJSON})">
                        <div class="sal-sug-nombre">Serie: ${hlFn(s.numero_serie || '—')}</div>
                        <div class="sal-sug-meta">
                            <span class="badge badge-disponible" style="font-size:.65rem">DISPONIBLE</span>
                        </div>
                    </div>`;
                });

                sugEl.innerHTML = [...itemsArt, ...itemsSer].join('');
                sugEl.classList.remove('hidden');

            } catch (inner) {
                console.warn('PROINTEL — búsqueda interna:', inner.message);
            }
        }, 250);

    } catch (err) {
        console.warn('PROINTEL — buscarArticuloSalida:', err.message);
    }
}

async function seleccionarArticuloSalida(item) {
    const buscarEl = document.getElementById('sal-articulo-buscar');
    const sugEl    = document.getElementById('sal-sugerencias');
    const stockEl  = document.getElementById('sal-stock-badge');
    const codWrap  = document.getElementById('sal-codigo-interno');
    const codVal   = document.getElementById('sal-codigo-val');
    const identEl  = document.getElementById('sal-identificador');
    const lblEl    = document.getElementById('sal-id-label');
    const badgeEl  = document.getElementById('sal-tipo-badge');
    const btnX     = document.getElementById('sal-buscar-clear');

    if (buscarEl) { buscarEl.value = item.nombre || item.articulo || ''; buscarEl.blur(); }
    if (sugEl)    sugEl.classList.add('hidden');
    if (btnX)     btnX.style.display = 'none';

    // Si el item viene del catálogo articulos sin cantidad real,
    // buscar el stock sumando bodega por código o nombre
    if (!item.cantidad && item._fuente === 'articulos') {
        try {
            const filtro = item.codigo
                ? `codigo.eq.${item.codigo}`
                : `nombre.ilike.${item.nombre}`;
            const { data: bd } = await window.supabase
                .from('bodega')
                .select('id, cantidad, tipo_material, unidad, estado, asignado_a')
                .or(filtro)
                .ilike('estado', 'disponible')
                .is('asignado_a', null);

            if (bd && bd.length > 0) {
                // Sumar cantidades disponibles de todos los registros
                item.cantidad    = bd.reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
                item.tipo_material = bd[0].tipo_material || null;
                item.unidad      = bd[0].unidad || item.unidad || 'und';
                item._bodega_ids = bd.map(r => r.id); // guardar todos los IDs
                item._fuente     = 'bodega_lookup';
            }
        } catch (e) {
            console.warn('PROINTEL — lookup bodega:', e.message);
        }
    }

    // Normalizar cantidad — siempre usar el campo "cantidad"
    item.cantidad = Number(item.cantidad ?? 0);

    // Detectar tipo: categoria (articulos) o tipo_material (bodega)
    const cat    = (item.categoria || item.tipo_material || '').toUpperCase().trim();
    const esMisc = cat === 'MISCELANEO'  ||
                   cat === 'MISCELÁNEOS' ||
                   cat === 'MISCELÁNEO'  ||
                   cat === 'MISCELANEOUS';
    const esSer  = !esMisc;

    // Guardar en global con tipo resuelto
    item._esMisc = esMisc;
    _articuloSeleccionado = item;

    console.log('▶ Artículo seleccionado:', {
        nombre:   item.nombre,
        categoria: cat,
        esMisc,
        cantidad:  item.cantidad,
        unidad:    item.unidad || item.unidad_medida || 'und',
        fuente:    item._fuente,
    });

    // Badge de stock
    const unidad = item.unidad || item.unidad_medida || 'und';
    if (stockEl) {
        const ok  = esMisc ? item.cantidad > 0 : true;
        const txt = esMisc
            ? `Stock: ${item.cantidad.toLocaleString()} ${unidad}`
            : '1 unidad';
        stockEl.textContent    = txt;
        stockEl.style.display  = 'inline-block';
        stockEl.style.background = ok ? 'rgba(0,230,118,.15)' : 'rgba(255,77,109,.15)';
        stockEl.style.color      = ok ? '#00e676' : '#ff4d6d';
        stockEl.style.border     = ok
            ? '1px solid rgba(0,230,118,.3)'
            : '1px solid rgba(255,77,109,.3)';
    }

    // Código interno
    if (codWrap && codVal) {
        if (item.codigo) { codVal.textContent = item.codigo; codWrap.classList.remove('hidden'); }
        else               codWrap.classList.add('hidden');
    }

    // Campo dinámico: número para misceláneos, texto para seriados
    if (esSer) {
        if (lblEl)   lblEl.innerHTML  = 'NÚMERO DE SERIE <span class="req">*</span>';
        if (badgeEl) { badgeEl.textContent = 'SERIADO'; badgeEl.className = 'tipo-badge tipo-seriado'; }
        if (identEl) {
            identEl.type        = 'text';
            identEl.placeholder = 'Escanea o escribe la serie…';
            identEl.value       = item.serie || '';
            identEl.removeAttribute('min');
            identEl.removeAttribute('max');
        }
    } else {
        const max = item.cantidad;
        if (lblEl)   lblEl.innerHTML  = `CANTIDAD A RETIRAR <span class="req">*</span> <small style="font-weight:400;color:var(--dim)">(máx ${max.toLocaleString()} ${unidad})</small>`;
        if (badgeEl) { badgeEl.textContent = 'MISCELÁNEOS'; badgeEl.className = 'tipo-badge tipo-cantidad'; }
        if (identEl) {
            identEl.type        = 'number';
            identEl.placeholder = '1';
            identEl.value       = '1';
            identEl.min         = '1';
            identEl.max         = String(max);
        }
    }
    if (identEl) identEl.focus();
}

function limpiarBuscadorSalida() {
    const els = ['sal-articulo-buscar','sal-sugerencias','sal-codigo-interno','sal-stock-badge'];
    document.getElementById('sal-articulo-buscar') && (document.getElementById('sal-articulo-buscar').value = '');
    document.getElementById('sal-sugerencias')?.classList.add('hidden');
    document.getElementById('sal-codigo-interno')?.classList.add('hidden');
    document.getElementById('sal-stock-badge') && (document.getElementById('sal-stock-badge').style.display = 'none');
    document.getElementById('sal-buscar-clear') && (document.getElementById('sal-buscar-clear').style.display = 'none');
    _articuloSeleccionado = null;
    document.getElementById('sal-articulo-buscar')?.focus();
}

function navSugerencias(e) {
    if (e.key === 'Escape') {
        document.getElementById('sal-sugerencias')?.classList.add('hidden');
    }
}

function autoFillCuadrilla(sel) {
    const opt  = sel.options[sel.selectedIndex];
    const cuad = opt.getAttribute('data-cuadrilla') || '';
    const el   = document.getElementById('sal-cuadrilla');
    if (el) el.value = cuad || '(sin cuadrilla)';
}

// ── Carrito de salida ─────────────────────────────────────

function agregarAlCarritoSalida() {
    if (!_articuloSeleccionado) {
        _notificar('Selecciona un artículo del buscador primero.');
        return;
    }

    const estMat  = document.querySelector('input[name="estado_material"]:checked')?.value || 'nuevo';
    const item    = _articuloSeleccionado;
    const identEl = document.getElementById('sal-identificador');
    const identVal = (identEl?.value || '').trim();

    // Detectar tipo — compatible con ambos esquemas
    const cat     = (item.categoria || item.tipo_material || '').toUpperCase();
    const esMisc  = cat === 'MISCELANEO' || cat === 'MISCELÁNEOS';
    const esSer   = !esMisc;

    // Validar serie para seriados
    if (esSer && !identVal) {
        _notificar('Ingresa o escanea el número de serie.');
        identEl?.focus();
        return;
    }

    // Evitar serie duplicada en el carrito
    if (esSer && (window._listaSalida || []).some(x => x.serie === identVal)) {
        _notificar('La serie ' + identVal + ' ya está en la lista.');
        return;
    }

    // Cantidad para misceláneos
    const cantidad = esSer ? 1 : (parseInt(identVal) || 1);
    // Resolver maxStock: cant o cantidad según esquema
    const maxStock = parseInt(item.cantidad ?? 0);

    if (esMisc && cantidad > maxStock) {
        _notificar(`Stock insuficiente. Disponible: ${maxStock}`);
        return;
    }

    window._listaSalida = window._listaSalida || [];
    // art_id: preferir el id de articulos (BIGINT) si existe, o null
    // _bodega_id: el UUID/id de bodega para updates posteriores
    const artIdFinal = item._art_id_bigint || null;
    window._listaSalida.push({
        _tipo:          esSer ? 'seriado' : 'misc',
        art_id:         artIdFinal,
        _bodega_id:     item._bodega_id || item.art_id || item.id,
        nombre:         item.nombre || item.articulo || '—',
        codigo:         item.codigo || '',
        unidad:         item.unidad || item.unidad_medida || 'und',
        serie:          esSer ? identVal : null,
        serie_id:       item.serie_id || null,
        cantidad,
        esSer,
        estado_material: estMat,
    });

    // Limpiar solo campos del artículo — mantener OT y técnico
    _articuloSeleccionado = null;
    if (document.getElementById('sal-articulo-buscar'))
        document.getElementById('sal-articulo-buscar').value = '';
    if (identEl) identEl.value = '';
    document.getElementById('sal-codigo-interno')?.classList.add('hidden');
    document.getElementById('sal-sugerencias')?.classList.add('hidden');
    document.getElementById('sal-buscar-clear') &&
        (document.getElementById('sal-buscar-clear').style.display = 'none');
    document.getElementById('sal-stock-badge') &&
        (document.getElementById('sal-stock-badge').style.display = 'none');

    renderCarritoSalida();
    // Enfocar de vuelta el buscador para agregar el siguiente
    setTimeout(() => document.getElementById('sal-articulo-buscar')?.focus(), 50);
}

function renderCarritoSalida() {
    const cont   = document.getElementById('carrito-salida');
    const badge  = document.getElementById('carrito-count');
    const lista  = window._listaSalida || [];

    if (badge) {
        badge.textContent   = lista.length;
        badge.style.display = lista.length ? 'inline-block' : 'none';
        badge.style.background = 'rgba(0,200,240,.15)';
        badge.style.color      = 'var(--cyan)';
        badge.style.border     = '1px solid var(--border-cyan)';
    }

    if (!lista.length) {
        cont.className   = 'carrito-vacio';
        cont.textContent = 'Sin artículos agregados aún';
        return;
    }

    cont.className = 'carrito-lista';
    cont.innerHTML = lista.map((e, i) => `
        <div class="carrito-item">
            <div class="carrito-info">
                <span class="carrito-nombre">${esc(e.nombre)}</span>
                ${e.serie
                    ? `<code class="serie-code" style="font-size:.72rem">${esc(e.serie)}</code>`
                    : `<span class="td-date">${e.cantidad} und.</span>`}
                <span class="badge badge-${e.estado_material === 'nuevo' ? 'disponible' : 'reservado'}"
                    style="font-size:.65rem">${esc(e.estado_material)}</span>
            </div>
            <button type="button" class="act-btn act-del"
                onclick="quitarDelCarrito(${i})" title="Quitar">✕</button>
        </div>`).join('');
}

function quitarDelCarrito(idx) {
    if (window._listaSalida) window._listaSalida.splice(idx, 1);
    renderCarritoSalida();
}

// ── Guardar salida (insert masivo) ────────────────────────

async function guardarSalida(e) {
    e.preventDefault();

    const ot      = (document.getElementById('sal-ot')?.value || '').trim();
    const motivo  = document.getElementById('sal-motivo')?.value || '';
    const tecnico = document.getElementById('sal-tecnico')?.value || '';
    const destino = (document.getElementById('sal-destino')?.value || '').trim() || null;
    const notas   = (document.getElementById('sal-notas')?.value || '').trim()   || null;
    const lista   = window._listaSalida || [];

    if (!ot)           { _notificar('El número de OT es obligatorio.'); return; }
    if (!tecnico)      { _notificar('Selecciona el técnico responsable.'); return; }
    if (!lista.length) { _notificar('Agrega al menos un artículo a la lista.'); return; }

    const btn    = document.getElementById('btn-guardar-sal');
    const btnTxt = btn?.textContent || 'Registrar Salida';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

    // Firma comprimida
    let firma = null;
    try {
        const cv = document.getElementById('firma-canvas');
        if (cv) {
            const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            if (Array.from(px).some(v => v !== 0)) firma = cv.toDataURL('image/jpeg', 0.7);
        }
    } catch { firma = null; }

    try {
        // Resolver tecnico_id desde usuarios
        const { data: tData } = await window.supabase
            .from('usuarios')
            .select('id, cuadrilla')
            .or(`nombre_completo.eq.${tecnico},usuario.eq.${tecnico}`)
            .maybeSingle();

        if (!tData) throw new Error('No se encontró el técnico "' + tecnico + '" en el sistema.');
        const tecnico_id        = tData.id;
        const tecNombreCompleto = tData.nombre_completo || tData.usuario || tecnico;

        // Correlativo automático — máximo + 1
        const { data: corrData } = await window.supabase
            .from('registros_salida')
            .select('correlativo')
            .order('correlativo', { ascending: false })
            .limit(1)
            .maybeSingle();
        const correlativo = (corrData?.correlativo || 0) + 1;

        // Insert masivo en registros_salida
        // art_id puede ser UUID (de bodega) o BIGINT (de articulos)
        // registros_salida.articulo_id es BIGINT — solo enviar si es número
        const ahora = new Date().toISOString();
        // Resolver articulo_id BIGINT para items que vienen de bodega (UUID)
        // Buscar en articulos por codigo para obtener el id numérico
        const codigosParaBuscar = lista
            .filter(item => {
                const n = Number(item.art_id);
                return isNaN(n) || String(item.art_id) !== String(n);
            })
            .map(item => item.codigo)
            .filter(Boolean);

        let codigoArtIdMap = {};
        if (codigosParaBuscar.length) {
            const { data: artsLookup } = await window.supabase
                .from('articulos')
                .select('id, codigo')
                .in('codigo', codigosParaBuscar);
            (artsLookup || []).forEach(a => { codigoArtIdMap[a.codigo] = a.id; });
        }

        const lote  = lista.map(item => {
            const artIdNum = Number(item.art_id);
            const esNumero = !isNaN(artIdNum) && artIdNum > 0 && String(item.art_id) === String(artIdNum);
            // Usar BIGINT de articulos si existe, si no buscar por código
            const artId    = esNumero ? artIdNum : (codigoArtIdMap[item.codigo] || null);
            return {
                correlativo,
                tecnico_id,
                articulo_id:     artId,
                nombre_articulo: item.nombre || item.articulo || null,
                cantidad:        item.cantidad,
                fecha:           ahora,
                firma:           firma,
                despachado_por:  currentUser?.nombre_completo || currentUser?.usuario || null,
            };
        });

        const { error: errSal } = await window.supabase
            .from('registros_salida')
            .insert(lote);

        if (errSal) throw new Error(
            `Error al insertar [${errSal.code || ''}]: ${errSal.message}` +
            (errSal.details ? ' | ' + errSal.details : '')
        );

        // Actualizar stock en bodega por cada artículo
        // Esto va DESPUÉS del insert — si falla, el error queda registrado pero
        // el insert de registros_salida ya se hizo (no hay rollback en Supabase JS)
        const erroresStock = [];

        for (const item of lista) {
            const bodegaId = item._bodega_id;

            if (item._tipo === 'seriado') {
                // Seriado: cambiar estado a ENTREGADO
                if (item.serie_id) {
                    const { error } = await window.supabase
                        .from('series')
                        .update({ estado: 'ENTREGADO', asignado_a: tecnico_id })
                        .eq('id', item.serie_id);
                    if (error) erroresStock.push(`Serie ${item.serie}: ${error.message}`);
                }
                if (bodegaId) {
                    const { error } = await window.supabase
                        .from('bodega')
                        .update({ estado: 'entregado', asignado_a: tecnico_id })
                        .eq('id', bodegaId);
                    if (error) erroresStock.push(`Bodega seriado ${item.nombre}: ${error.message}`);
                }

            } else {
                // Misceláneo: restar del stock central Y crear registro personal del técnico
                const srcId = bodegaId || null;

                // 1. Obtener datos completos del artículo fuente
                let srcRow = null;
                if (srcId) {
                    const { data } = await window.supabase
                        .from('bodega')
                        .select('*')
                        .eq('id', srcId)
                        .maybeSingle();
                    srcRow = data;
                } else if (item.codigo) {
                    const { data } = await window.supabase
                        .from('bodega')
                        .select('*')
                        .eq('codigo', item.codigo)
                        .ilike('estado', 'disponible')
                        .is('asignado_a', null)
                        .order('cantidad', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    srcRow = data;
                }

                if (srcRow) {
                    const cantActual = Number(srcRow.cantidad || 0);
                    const cantNueva  = Math.max(0, cantActual - item.cantidad);

                    // 2. Restar del stock central (bodega disponible)
                    const { error: errResta } = await window.supabase
                        .from('bodega')
                        .update({
                            cantidad: cantNueva,
                            estado:   cantNueva <= 0 ? 'agotado' : 'disponible',
                        })
                        .eq('id', srcRow.id);

                    if (errResta) {
                        erroresStock.push(`Resta stock ${item.nombre}: ${errResta.message}`);
                    } else {
                        console.log(`PROINTEL — stock central: ${item.nombre} | ${cantActual} → ${cantNueva}`);
                    }

                    // 3. Crear o actualizar fila personal del técnico en bodega
                    // Buscar si ya tiene una fila asignada para este artículo
                    const { data: yaExiste } = await window.supabase
                        .from('bodega')
                        .select('id, cantidad')
                        .eq('codigo', srcRow.codigo || '')
                        .eq('asignado_a', tecnico_id)
                        .maybeSingle();

                    if (yaExiste) {
                        // Sumar a lo que ya tiene
                        await window.supabase
                            .from('bodega')
                            .update({ cantidad: Number(yaExiste.cantidad || 0) + item.cantidad })
                            .eq('id', yaExiste.id);
                    } else {
                        // Crear fila nueva para el técnico
                        await window.supabase
                            .from('bodega')
                            .insert({
                                nombre:        srcRow.nombre        || srcRow.articulo,
                                articulo:      srcRow.articulo      || srcRow.nombre,
                                codigo:        srcRow.codigo        || null,
                                tipo_material: 'miscelaneo',
                                cantidad:      item.cantidad,
                                unidad:        srcRow.unidad        || 'und',
                                estado:        'disponible',
                                asignado_a:    tecnico_id,
                                responsable:   tecNombreCompleto    || null,
                                cuadrilla:     tData?.cuadrilla     || null,
                                fecha_ingreso: new Date().toISOString().split('T')[0],
                            });
                    }
                    console.log(`PROINTEL — bodega técnico: +${item.cantidad} ${item.nombre} → ${tecNombreCompleto}`);
                }
            }
        }

        // Si hubo errores de stock, avisar pero no bloquear (el registro ya se guardó)
        if (erroresStock.length) {
            console.warn('PROINTEL — errores actualizando stock:', erroresStock);
        }

        // Éxito
        window._listaSalida = [];
        window._articuloSeleccionado = null;
        cerrarModal('modal-salida', true);
        _mostrarToastExito(`✅ Correlativo #${correlativo} — ${lista.length} artículo${lista.length!==1?'s':''} registrado${lista.length!==1?'s':''}`);

        // Refrescar inventario si está visible
        if (currentTab === 'bodega') cargarInventarioBodega();
        cargarSalidas();

    } catch (err) {
        alert('❌ ' + err.message);
        console.error('PROINTEL — guardarSalida:', err);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
    }
}


async function cargarPuestasServicio() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>✅ Puestas en Servicio</h2>
            <div class="header-actions">
                <button class="btn-nav" onclick="cargarPuestasServicio()">↺ Actualizar</button>
                <button class="btn-outline-sm" onclick="exportarPSExcel()">📊 Exportar Excel</button>
            </div>
        </div>
        <div class="inv-stats" id="ps-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="ps-search"
                    placeholder="🔍  Buscar por OT, técnico, cliente…"
                    oninput="filtrarTabla('ps-search','tabla-ps')" />
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-ps">
                <thead><tr>
                    <th>#</th>
                    <th>CORRELATIVO</th>
                    <th>OT / SOLICITUD</th>
                    <th>TÉCNICO</th>
                    <th>MATERIALES</th>
                    <th>CLIENTE</th>
                    <th>FECHA</th>
                    <th>VER</th>
                </tr></thead>
                <tbody id="ps-tbody">
                    <tr><td colspan="8" class="empty-row">⏳ Cargando…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="ps-count"></p>`;

    try {
        // Traer todas las instalaciones de todos los técnicos
        const { data: todos, error } = await window.supabase
            .from('registros_instalaciones')
            .select('id, correlativo_descargo, tecnico_id, numero_ot, cliente, articulo_id, cantidad_usada, fecha')
            .order('correlativo_descargo', { ascending: false });

        if (error) throw error;
        const rows = todos || [];

        // Enriquecer artículos
        const artIds = [...new Set(rows.map(r => r.articulo_id).filter(Boolean))];
        const tecIds = [...new Set(rows.map(r => r.tecnico_id).filter(Boolean))];
        let artMap = {}, tecMap = {};

        const [resArts, resTecs] = await Promise.all([
            artIds.length
                ? window.supabase.from('articulos').select('id, nombre, codigo').in('id', artIds)
                : Promise.resolve({ data: [] }),
            tecIds.length
                ? window.supabase.from('usuarios').select('id, nombre_completo, usuario').in('id', tecIds)
                : Promise.resolve({ data: [] }),
        ]);
        (resArts.data||[]).forEach(a => { artMap[a.id] = a; });
        (resTecs.data||[]).forEach(t => { tecMap[t.id] = t; });

        const rowsRich = rows.map(r => ({
            ...r,
            artNombre: artMap[r.articulo_id]?.nombre || '—',
            artCodigo: artMap[r.articulo_id]?.codigo || '',
            tecNombre: tecMap[r.tecnico_id]?.nombre_completo || tecMap[r.tecnico_id]?.usuario || '—',
        }));

        window._puestasServicio = rowsRich;

        // Agrupar por OT + técnico
        const porOT = {};
        rowsRich.forEach(r => {
            const key = (r.numero_ot || r.correlativo_descargo) + '_' + (r.tecnico_id||'');
            if (!porOT[key]) porOT[key] = {
                correlativo: r.correlativo_descargo,
                ot:          r.numero_ot || '—',
                tecNombre:   r.tecNombre,
                cliente:     r.cliente || '—',
                fecha:       r.fecha,
                items:       [],
                _key:        key,
            };
            porOT[key].items.push(r);
        });

        const grupos = Object.values(porOT);
        const totalMat = rows.length;
        const totalTecs = new Set(rows.map(r => r.tecnico_id)).size;

        document.getElementById('ps-stats').innerHTML = `
            <div class="istat">
                <span class="istat-num">${grupos.length}</span>
                <span class="istat-label">Solicitudes</span>
            </div>
            <div class="istat istat-cyan">
                <span class="istat-num">${totalMat}</span>
                <span class="istat-label">Materiales usados</span>
            </div>
            <div class="istat istat-blue">
                <span class="istat-num">${totalTecs}</span>
                <span class="istat-label">Técnicos activos</span>
            </div>`;

        const tbody = document.getElementById('ps-tbody');
        const count = document.getElementById('ps-count');

        if (!grupos.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay puestas en servicio registradas.</td></tr>';
            if (count) count.textContent = '';
            return;
        }

        tbody.innerHTML = grupos.map((g, idx) => {
            const fecha   = g.fecha
                ? new Date(g.fecha).toLocaleDateString('es-SV')
                : '—';
            const nItems  = g.items.length;
            const resumen = g.items.slice(0,2).map(i => esc(i.artNombre)).join(', ')
                          + (nItems > 2 ? ` +${nItems-2} más` : '');
            const key     = encodeURIComponent(g._key);
            return `<tr>
                <td class="row-num">${idx+1}</td>
                <td><code class="sku-code">#${g.correlativo||'—'}</code></td>
                <td style="font-family:var(--font-mono);font-weight:600">${esc(g.ot)}</td>
                <td style="font-size:.84rem">${esc(g.tecNombre)}</td>
                <td style="font-size:.82rem;color:var(--dim)">
                    <span class="series-count-badge" style="margin-right:.3rem">${nItems}</span>
                    ${resumen}
                </td>
                <td style="font-size:.82rem">${esc(g.cliente)}</td>
                <td class="td-date">${fecha}</td>
                <td>
                    <button class="btn-cyan" style="font-size:.72rem;padding:.3rem .7rem"
                        onclick="verPuestaServicio('${key}')">
                        👁 Ver
                    </button>
                </td>
            </tr>`;
        }).join('');

        if (count) count.textContent =
            `${grupos.length} solicitud${grupos.length!==1?'es':''} · ${totalMat} material${totalMat!==1?'es':''}`;

    } catch (err) {
        console.error('PROINTEL — cargarPuestasServicio:', err);
        document.getElementById('ps-tbody').innerHTML =
            `<tr><td colspan="8" class="empty-row error-msg">❌ ${esc(err.message)}</td></tr>`;
    }
}

async function verPuestaServicio(keyEncoded) {
    const key  = decodeURIComponent(keyEncoded);
    let source = window._puestasServicio || window._instaladas || [];
    if (!source.length) {
        await cargarPuestasServicio();
        source = window._puestasServicio || [];
    }

    // Reconstruir la key para filtrar
    const grupo = source.filter(r => {
        const k = (r.numero_ot || r.correlativo_descargo) + '_' + (r.tecnico_id||'');
        return k === key;
    });

    if (!grupo.length) { _notificar('No se encontraron detalles.'); return; }
    document.getElementById('modal-ps-detalle')?.remove();

    const g     = grupo[0];
    const fecha = g.fecha ? new Date(g.fecha).toLocaleDateString('es-SV', {
        weekday:'long', day:'2-digit', month:'long', year:'numeric'
    }) : '—';

    const artFilasHTML = grupo.map((r, i) => `
        <tr class="ps-art-row">
            <td class="row-num">${i+1}</td>
            <td>
                <input type="text" class="ps-input-serie"
                    value="${esc(r.artCodigo||'')}" readonly
                    placeholder="Serie" style="width:90px;font-family:var(--font-mono);font-size:.8rem" />
            </td>
            <td>
                <input type="text" class="ps-input-codigo"
                    value="${esc(r.artCodigo||'')}" readonly
                    style="width:90px;font-family:var(--font-mono);font-size:.8rem" />
            </td>
            <td class="td-bold" style="min-width:180px">${esc(r.artNombre||'—')}</td>
            <td style="text-align:center">
                <input type="number" class="ps-input-cant"
                    value="${r.cantidad_usada||1}" min="1"
                    style="width:60px;text-align:center;font-weight:700" readonly />
            </td>
        </tr>`).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-ps-detalle" onclick="event.stopPropagation()">
            <div class="modal-content" style="max-width:780px" onclick="event.stopPropagation()">

                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">✅</span>
                        <span>Solicitud: ${esc(g.numero_ot||'—')} — Técnico: ${esc(g.tecNombre||'—')}</span>
                    </div>
                    <button class="modal-close"
                        onclick="document.getElementById('modal-ps-detalle').remove()">✕</button>
                </div>

                <div class="modal-body" id="ps-det-body">
                    <div id="ps-det-printable">

                        <!-- Info general -->
                        <div class="mfs-info-grid" style="margin-bottom:1rem">
                            <div class="mfs-info-card">
                                <div class="mfs-info-label">Estado de solicitud</div>
                                <div class="mfs-info-val">
                                    <span class="badge badge-disponible">Completada / Cerrada</span>
                                </div>
                            </div>
                            <div class="mfs-info-card">
                                <div class="mfs-info-label">Técnico responsable</div>
                                <div class="mfs-info-val">${esc(g.tecNombre||'—')}</div>
                            </div>
                            <div class="mfs-info-card">
                                <div class="mfs-info-label">Cliente / Dirección</div>
                                <div class="mfs-info-val">${esc(g.cliente||'—')}</div>
                            </div>
                            <div class="mfs-info-card">
                                <div class="mfs-info-label">Fecha</div>
                                <div class="mfs-info-val">${fecha}</div>
                            </div>
                        </div>

                        <!-- Tabla de artículos estilo EUROCOMUNICACIONES -->
                        <div style="font-weight:700;font-size:.85rem;color:var(--white);
                                    margin-bottom:.6rem;display:flex;align-items:center;gap:.5rem">
                            📦 Artículos de instalación
                            <span class="series-count-badge">${grupo.length}</span>
                        </div>

                        <div class="table-wrap" style="max-height:340px;overflow-y:auto">
                            <table class="data-table" style="font-size:.83rem">
                                <thead><tr>
                                    <th>#</th>
                                    <th>SERIE</th>
                                    <th>CÓDIGO</th>
                                    <th>ARTÍCULO</th>
                                    <th style="text-align:center">CANT.</th>
                                </tr></thead>
                                <tbody>${artFilasHTML}</tbody>
                            </table>
                        </div>

                    </div>
                </div>

                <div class="modal-foot">
                    <button class="btn-ghost-sm"
                        onclick="document.getElementById('modal-ps-detalle').remove()">
                        Cancelar
                    </button>
                    <button class="btn-outline-sm"
                        onclick="exportarGrupoExcel('${encodeURIComponent(key)}')">
                        📊 Excel
                    </button>
                    <button class="btn-cyan" onclick="imprimirPSDetalle()">
                        📄 Generar PDF
                    </button>
                </div>
            </div>
        </div>`);
}

function imprimirPSDetalle() {
    const area = document.getElementById('ps-det-printable');
    if (!area) return;
    const win = window.open('', '_blank', 'width=860,height=720');
    win.document.write(`<!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8"><title>Puesta en Servicio — PROINTEL</title>
        <style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:2rem;max-width:820px;margin:0 auto}
            h2{font-size:1.1rem;margin-bottom:1rem;color:#0d1520;border-bottom:3px solid #00c8f0;padding-bottom:.5rem}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;margin-bottom:1.2rem}
            .card{background:#f8fafb;border-left:3px solid #00c8f0;padding:.6rem .9rem;border-radius:0 5px 5px 0}
            .lbl{font-size:.62rem;font-weight:700;text-transform:uppercase;color:#636e72;margin-bottom:.2rem}
            .val{font-size:.9rem;font-weight:600;color:#0d1520}
            .badge{display:inline-block;background:#e8f8ee;color:#1a7a4a;border-radius:20px;
                   padding:.2rem .7rem;font-size:.78rem;font-weight:700}
            table{width:100%;border-collapse:collapse;font-size:.84rem}
            thead tr{background:#0d1520;color:#fff}
            th{padding:.55rem .8rem;text-align:left;font-size:.75rem}
            td{padding:.55rem .8rem;border-bottom:1px solid #edf2f0}
            input{border:1px solid #ddd;border-radius:4px;padding:.25rem .4rem;
                  font-size:.8rem;width:100%;background:#f9f9f9}
            .art-label{font-weight:600;color:#0d1520}
            @media print{body{padding:1rem}}
        </style>
    </head><body>
        <h2>✅ Puesta en Servicio — PROINTEL 2.0</h2>
        ${area.innerHTML}
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
}

function exportarGrupoExcel(keyEncoded) {
    const key    = decodeURIComponent(keyEncoded);
    const source = window._puestasServicio || window._instaladas || [];
    const grupo  = source.filter(r => {
        const k = (r.numero_ot || r.correlativo_descargo) + '_' + (r.tecnico_id||'');
        return k === key;
    });
    if (!grupo.length) { _notificar('Sin datos.'); return; }
    const ot = grupo[0].numero_ot || grupo[0].correlativo_descargo;
    exportarExcelGrupoPS(grupo, `OT_${ot}`);
}

function exportarPSExcel() {
    const rows = window._puestasServicio || [];
    if (!rows.length) { _notificar('Sin datos para exportar.'); return; }
    exportarExcelGrupoPS(rows, 'PuestasEnServicio_PROINTEL');
}

function exportarExcelGrupoPS(rows, nombre) {
    const BOM     = '\uFEFF';
    const headers = ['Correlativo','OT','Técnico','Artículo','Código','Cantidad','Cliente','Fecha'];
    const filas   = rows.map(r => [
        r.correlativo_descargo || '—',
        r.numero_ot            || '—',
        r.tecNombre            || '—',
        r.artNombre            || '—',
        r.artCodigo            || '—',
        r.cantidad_usada       || 1,
        r.cliente              || '—',
        r.fecha ? new Date(r.fecha).toLocaleDateString('es-SV') : '—',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));

    const csv  = BOM + [headers.join(','), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${nombre}.csv`; a.click();
    URL.revokeObjectURL(url);
    _mostrarToastExito(`✅ ${nombre}.csv descargado`);
}
async function cargarTransferencias() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>🔄 Transferencia de Inventario</h2>
            <div style="display:flex;gap:.6rem">
                <button class="btn-nav" onclick="cargarTransferencias()">↺ Actualizar</button>
                <button class="btn-cyan" onclick="abrirModalTransferencia()">+ Nueva Transferencia</button>
            </div>
        </div>
        <div class="inv-stats" id="trans-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="trans-search" placeholder="🔍  Buscar por serie, origen, destino…" oninput="filtrarTabla('trans-search','tabla-trans')" />
            </div>
            <select id="filtro-trans-estado" onchange="filtrarTrans()" class="filter-select">
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
            </select>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-trans">
                <thead><tr>
                    <th>#</th><th>Nº SERIE</th><th>MODELO</th><th>ORIGEN</th>
                    <th>DESTINO</th><th>RESPONSABLE</th><th>ESTADO</th><th>FECHA</th><th>ACCIÓN</th>
                </tr></thead>
                <tbody id="trans-tbody">
                    <tr><td colspan="9" class="empty-row">⏳ Cargando transferencias...</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="trans-count"></p>`;

    try {
        const { data, error } = await window.supabase.from('transferencias').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        cacheTransferencias = data || [];

        const pend = cacheTransferencias.filter(t => (t.estado||'').toLowerCase() === 'pendiente').length;
        const comp = cacheTransferencias.filter(t => (t.estado||'').toLowerCase() === 'completada').length;
        document.getElementById('trans-stats').innerHTML = `
            <div class="istat"><span class="istat-num">${cacheTransferencias.length}</span><span class="istat-label">Total</span></div>
            <div class="istat istat-warn"><span class="istat-num">${pend}</span><span class="istat-label">Pendientes</span></div>
            <div class="istat istat-green"><span class="istat-num">${comp}</span><span class="istat-label">Completadas</span></div>`;

        renderTransferencias(cacheTransferencias);
    } catch(err) {
        document.getElementById('trans-tbody').innerHTML = `<tr><td colspan="9" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

function renderTransferencias(filas) {
    const tbody = document.getElementById('trans-tbody');
    const count = document.getElementById('trans-count');
    if (!filas || !filas.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty-row">No hay transferencias registradas.</td></tr>';
        if (count) count.textContent = ''; return;
    }
    tbody.innerHTML = filas.map((t, idx) => `
        <tr>
            <td class="row-num">${idx+1}</td>
            <td><code>${esc(t.numero_serie||'—')}</code></td>
            <td class="td-bold">${esc(t.modelo||'—')}</td>
            <td style="font-size:.82rem">${esc(t.origen||'—')}</td>
            <td style="font-size:.82rem">${esc(t.destino||'—')}</td>
            <td style="font-size:.82rem;color:var(--dim)">${esc(t.responsable||'—')}</td>
            <td><span class="badge badge-${t.estado==='completada'?'disponible':t.estado==='cancelada'?'dañado':'reservado'}">${esc(t.estado||'pendiente')}</span></td>
            <td class="td-date">${formatFecha(t.created_at)}</td>
            <td>${t.estado==='pendiente'
                ? `<div class="action-row">
                    <button class="act-btn act-edit" onclick="completarTransferencia('${t.id}')">✓ OK</button>
                    <button class="act-btn act-del"  onclick="cancelarTransferencia('${t.id}')">✕</button>
                   </div>`
                : `<span style="font-size:.75rem;color:var(--dim)">${t.estado}</span>`}
            </td>
        </tr>`).join('');
    if (count) count.textContent = filas.length + ' transferencias';
}

function filtrarTrans() {
    const q = (document.getElementById('trans-search')?.value||'').toLowerCase();
    const est = (document.getElementById('filtro-trans-estado')?.value||'').toLowerCase();
    renderTransferencias(cacheTransferencias.filter(t => {
        const mQ = !q || (t.numero_serie||'').toLowerCase().includes(q) || (t.modelo||'').toLowerCase().includes(q) || (t.origen||'').toLowerCase().includes(q) || (t.destino||'').toLowerCase().includes(q);
        const mE = !est || (t.estado||'').toLowerCase() === est;
        return mQ && mE;
    }));
}

function abrirModalTransferencia() {
    const series = cacheInventario.length ? cacheInventario : [];
    const opts = series.map(i => `<option value="${i.id}" data-serie="${esc(i.serie||'')}" data-modelo="${esc(i.articulo||'')}">${esc(i.serie||i.articulo||'Sin serie')}</option>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-trans" onclick="cerrarModalClick(event,'modal-trans')">
            <div class="modal-content">
                <div class="modal-head">
                    <span>🔄 Nueva Transferencia</span>
                    <button class="modal-close" onclick="cerrarModal('modal-trans')">✕</button>
                </div>
                <form id="form-trans" onsubmit="guardarTransferencia(event)">
                    <div class="form-grid">
                        <div class="field field-full"><label>ARTÍCULO (SERIE)</label>
                            <select id="trans-bid" onchange="autoFillTrans(this)">
                                <option value="">— Seleccionar del inventario —</option>${opts}
                            </select>
                        </div>
                        <div class="field"><label>Nº SERIE *</label>
                            <input type="text" id="trans-serie" placeholder="SN-XXXXXXXX" required /></div>
                        <div class="field"><label>MODELO</label>
                            <input type="text" id="trans-modelo" placeholder="Auto-completado" /></div>
                        <div class="field"><label>ORIGEN *</label>
                            <input type="text" id="trans-origen" placeholder="Bodega Central, Cuadrilla A…" required /></div>
                        <div class="field"><label>DESTINO *</label>
                            <input type="text" id="trans-destino" placeholder="Bodega Norte, Cuadrilla B…" required /></div>
                        <div class="field"><label>RESPONSABLE</label>
                            <input type="text" id="trans-resp" placeholder="Nombre del responsable" /></div>
                        <div class="field"><label>CANTIDAD</label>
                            <input type="number" id="trans-cant" value="1" min="1" /></div>
                        <div class="field field-full"><label>NOTAS</label>
                            <textarea id="trans-notas" rows="2" placeholder="Observaciones…"></textarea></div>
                    </div>
                    <div class="modal-foot">
                        <button type="button" class="btn-ghost-sm" onclick="cerrarModal('modal-trans')">Cancelar</button>
                        <button type="submit" class="btn-cyan">Registrar Transferencia</button>
                    </div>
                </form>
            </div>
        </div>`);
}

function autoFillTrans(sel) {
    const o = sel.options[sel.selectedIndex];
    const sf = document.getElementById('trans-serie'); const mf = document.getElementById('trans-modelo');
    if (sf) sf.value = o.getAttribute('data-serie')||'';
    if (mf) mf.value = o.getAttribute('data-modelo')||'';
}

async function guardarTransferencia(e) {
    e.preventDefault();
    const bid = document.getElementById('trans-bid').value;
    const payload = {
        bodega_id:    bid ? parseInt(bid) : null,
        numero_serie: document.getElementById('trans-serie').value.trim(),
        modelo:       document.getElementById('trans-modelo').value.trim(),
        origen:       document.getElementById('trans-origen').value.trim(),
        destino:      document.getElementById('trans-destino').value.trim(),
        responsable:  document.getElementById('trans-resp').value.trim()||null,
        cantidad:     parseInt(document.getElementById('trans-cant').value)||1,
        notas:        document.getElementById('trans-notas').value.trim()||null,
        estado:       'pendiente'
    };
    const { error } = await window.supabase.from('transferencias').insert(payload);
    if (error) { alert('Error: ' + error.message); return; }
    if (bid) { await window.supabase.from('bodega').update({ cuadrilla: payload.destino }).eq('id', bid); cacheInventario = []; }
    cerrarModal('modal-trans');
    cargarTransferencias();
}

async function completarTransferencia(id) {
    const { error } = await window.supabase.from('transferencias').update({ estado: 'completada' }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    cargarTransferencias();
}

async function cancelarTransferencia(id) {
    if (!confirm('¿Cancelar esta transferencia?')) return;
    const { error } = await window.supabase.from('transferencias').update({ estado: 'cancelada' }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    cargarTransferencias();
}


// ════════════════════════════════════════════════════════════
//  MÓDULO: USUARIOS (CRUD + superusuario protegido)
// ════════════════════════════════════════════════════════════

async function cargarUsuarios() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>👤 Gestión de Usuarios</h2>
            <button class="btn-cyan" onclick="abrirModalUsuario()">+ Nuevo Usuario</button>
        </div>
        <div class="inv-stats" id="usr-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="usr-search" placeholder="🔍  Buscar usuario, nombre, rol…" oninput="filtrarTabla('usr-search','tabla-usuarios')" />
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-usuarios">
                <thead><tr><th>#</th><th>USUARIO</th><th>NOMBRE COMPLETO</th><th>ROL</th><th>CUADRILLA</th><th>ESTADO</th><th>ACCIONES</th></tr></thead>
                <tbody><tr><td colspan="8" class="empty-row">⏳ Cargando...</td></tr></tbody>
            </table>
        </div>
        <p class="table-count" id="usr-count"></p>`;

    try {
        const { data, error } = await window.supabase.from('usuarios').select('*').order('id', { ascending: true });
        if (error) throw error;
        cacheUsuarios = data || [];

        const act  = cacheUsuarios.filter(u => (u.estado||'activo').toLowerCase() === 'activo').length;
        const adm  = cacheUsuarios.filter(u => (u.rol||'').toLowerCase() === 'admin').length;
        document.getElementById('usr-stats').innerHTML = `
            <div class="istat"><span class="istat-num">${cacheUsuarios.length}</span><span class="istat-label">Total</span></div>
            <div class="istat istat-green"><span class="istat-num">${act}</span><span class="istat-label">Activos</span></div>
            <div class="istat istat-cyan"><span class="istat-num">${adm}</span><span class="istat-label">Administradores</span></div>`;

        const tbody = document.querySelector('#tabla-usuarios tbody');
        if (!cacheUsuarios.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay usuarios.</td></tr>'; return; }
        tbody.innerHTML = cacheUsuarios.map((u, idx) => {
            const esSU = esSuperusuario(u.usuario);
            const _rol = (u.rol||'bodega').toLowerCase();
            const rolClase = _rol === 'admin' ? 'rol-admin' : _rol === 'bodega' ? 'rol-bodega' : 'rol-tecnico';
            const rolLabel = _rol === 'admin' ? 'Admin' : _rol === 'bodega' ? 'Bodega' : 'Técnico';
            const rolB = esSU
                ? `<span class="badge" style="background:rgba(255,179,0,.15);color:#ffb300;border:1px solid rgba(255,179,0,.3)">★ SUPER</span>`
                : `<span class="badge ${rolClase}">${rolLabel}</span>`;
            const acc = esSU
                ? `<span style="font-size:.75rem;color:var(--dim);font-family:var(--font-mono)">🔒 Protegido</span>`
                : `<div class="action-row">
                    <button class="act-btn act-edit" onclick="abrirModalUsuario('${u.id}')">✎ Editar</button>
                    <button class="act-btn act-del"  onclick="eliminarUsuario('${esc(u.usuario)}','${u.id}')">✕</button>
                   </div>`;
            const cuadBadge = u.cuadrilla
                ? `<span class="tipo-badge tipo-seriado" style="font-size:.68rem">${esc(u.cuadrilla.toUpperCase())}</span>`
                : `<span style="color:var(--muted);font-size:.78rem">—</span>`;
            return `<tr ${esSU?'class="su-row"':''}>
                <td class="row-num">${idx+1}</td>
                <td><code>${esc(u.usuario)}</code>${esSU?' <span style="color:#ffb300">★</span>':''}</td>
                <td class="td-bold">${esc(u.nombre_completo||u.nombre||'—')}</td>
                <td>${rolB}</td>
                <td>${cuadBadge}</td>
                <td><span class="badge badge-${(u.estado||'activo').toLowerCase()}">${esc(u.estado||'activo')}</span></td>
                <td>${acc}</td>
            </tr>`;
        }).join('');
        const count = document.getElementById('usr-count');
        if (count) count.textContent = cacheUsuarios.length + ' usuarios';
    } catch(err) {
        document.querySelector('#tabla-usuarios tbody').innerHTML = `<tr><td colspan="8" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

function abrirModalUsuario(id) {
    const u = id ? cacheUsuarios.find(x => String(x.id) === String(id)) : null;

    // Roles disponibles con descripción
    const ROLES = [
        { value: 'admin',    label: 'Admin',    desc: 'Acceso total' },
        { value: 'bodega',   label: 'Bodega',   desc: 'Gestión completa de inventario' },
        { value: 'tecnico',  label: 'Técnico',  desc: 'Solo lectura' }
    ];
    const rolActual = (u?.rol || 'bodega').toLowerCase();
    const optsRol   = ROLES.map(r =>
        `<option value="${r.value}" ${rolActual === r.value ? 'selected' : ''}>${r.label} — ${r.desc}</option>`
    ).join('');

    // Cuadrillas predefinidas en formato PRI01-PRI05
    const CUADS_FIJAS = ['PRI01','PRI02','PRI03','PRI04','PRI05'];
    const cuadActual  = (u?.cuadrilla || '').toUpperCase();
    const esManual    = cuadActual && !CUADS_FIJAS.includes(cuadActual);

    const optsCuad = CUADS_FIJAS.map(q =>
        `<option value="${q}" ${cuadActual === q ? 'selected' : ''}>${q}</option>`
    ).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-usuario" onclick="cerrarModalClick(event,'modal-usuario')">
            <div class="modal-content">
                <div class="modal-head">
                    <span>${u ? '✎ Editar Usuario' : '+ Nuevo Usuario'}</span>
                    <button class="modal-close" onclick="cerrarModal('modal-usuario')">✕</button>
                </div>
                <form id="form-usuario" onsubmit="guardarUsuario(event,'${id||''}')">
                <div class="modal-body">
                    <div class="form-grid">

                        <div class="field field-full">
                            <label>NOMBRE COMPLETO *</label>
                            <input type="text" id="usr-nombre"
                                value="${esc(u?.nombre_completo || u?.nombre || '')}"
                                required placeholder="Juan Pérez" />
                        </div>

                        <div class="field">
                            <label>USUARIO *</label>
                            <input type="text" id="usr-login"
                                value="${esc(u?.usuario || '')}"
                                required placeholder="ej: jperez"
                                ${u ? 'readonly style="opacity:.6"' : ''} />
                        </div>
                        <div class="field">
                            <label>CONTRASEÑA${u ? ' <span style="font-weight:400;color:var(--muted)">(vacío = sin cambios)</span>' : ' *'}</label>
                            <input type="password" id="usr-clave"
                                placeholder="••••••••"
                                ${u ? '' : 'required'} />
                        </div>

                        <div class="field">
                            <label>ROL</label>
                            <select id="usr-rol">${optsRol}</select>
                        </div>
                        <div class="field">
                            <label>ESTADO</label>
                            <select id="usr-estado">
                                <option value="activo"   ${(u?.estado || 'activo') === 'activo'   ? 'selected' : ''}>Activo</option>
                                <option value="inactivo" ${(u?.estado || '')       === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>

                        <!-- Cuadrilla — selector híbrido -->
                        <div class="field field-full">
                            <label>CÓDIGO DE CUADRILLA / TÉCNICO</label>
                            <div class="cuad-wrap">
                                <select id="usr-cuadrilla-sel"
                                    onchange="onUsrCuadrillaChange(this)">
                                    <option value="">— Sin asignar —</option>
                                    ${optsCuad}
                                    <option value="__manual__" ${esManual ? 'selected' : ''}>
                                        ✏️ Ingreso Manual
                                    </option>
                                </select>
                                <input type="text" id="usr-cuadrilla-manual"
                                    placeholder="Ej: EXT01, TEMP01…"
                                    value="${esManual ? esc(cuadActual) : ''}"
                                    class="${esManual ? '' : 'hidden'}"
                                    oninput="this.value = this.value.toUpperCase()"
                                    style="text-transform:uppercase;font-family:var(--font-mono)" />
                            </div>
                        </div>

                    </div>
                </div><!-- /modal-body -->
                    <div class="modal-foot">
                        <button type="button" class="btn-ghost-sm"
                            onclick="cerrarModal('modal-usuario')">Cancelar</button>
                        <button type="submit" class="btn-cyan">Guardar Usuario</button>
                    </div>
                </form>
            </div>
        </div>`);
}

function onUsrCuadrillaChange(sel) {
    const manual = document.getElementById('usr-cuadrilla-manual');
    if (!manual) return;
    if (sel.value === '__manual__') {
        manual.classList.remove('hidden');
        manual.focus();
    } else {
        manual.classList.add('hidden');
        manual.value = '';
    }
}

async function guardarUsuario(e, id) {
    e.preventDefault();

    const clave          = document.getElementById('usr-clave').value;
    const nombre_completo = document.getElementById('usr-nombre').value.trim();
    const usuario        = document.getElementById('usr-login').value.trim();
    const rol            = document.getElementById('usr-rol').value;
    const estado         = document.getElementById('usr-estado').value;

    // Validaciones básicas
    if (!nombre_completo) { _notificar('El nombre completo es obligatorio.'); return; }
    if (!usuario)         { _notificar('El usuario es obligatorio.'); return; }
    if (!id && !clave)    { _notificar('La contraseña es obligatoria para nuevos usuarios.'); return; }

    // Leer cuadrilla — prioriza manual, siempre en MAYÚSCULAS
    const cuadSel    = document.getElementById('usr-cuadrilla-sel')?.value || '';
    const cuadManual = (document.getElementById('usr-cuadrilla-manual')?.value || '').trim().toUpperCase();
    const cuadrilla  = cuadSel === '__manual__'
        ? (cuadManual || null)
        : (cuadSel || null);

    // Payload
    const payload = {
        usuario,
        nombre_completo,
        rol,
        estado,
        cuadrilla
    };
    // Hashear contraseña SHA-256 antes de guardar
    if (clave) payload.clave = await hashPassword(clave.trim());

    const submitBtn = document.querySelector('#form-usuario button[type="submit"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

    const { error } = id
        ? await window.supabase.from('usuarios').update(payload).eq('id', id)
        : await window.supabase.from('usuarios').insert(payload);

    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar Usuario'; }

    if (error) {
        const msg = error.message.includes('unique') || error.message.includes('duplicate')
            ? 'Ya existe un usuario con ese nombre de usuario.'
            : 'Error al guardar: ' + error.message;
        alert(msg);
        return;
    }

    // Limpiar formulario y cerrar modal
    document.getElementById('form-usuario').reset();
    cerrarModal('modal-usuario');
    cargarUsuarios();
}


// ════════════════════════════════════════════════════════════
//  MÓDULO: REPORTES
// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
//  MÓDULO: REPORTES CON GRÁFICAS (Chart.js)
// ════════════════════════════════════════════════════════════

// Instancias activas de Chart.js para destruir antes de redibujar
const _charts = {};

async function cargarReportes() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>📊 Reportes y Estadísticas</h2>
            <div class="header-actions">
                <button class="btn-nav"        onclick="cargarReportes()">↺ Actualizar</button>
                <button class="btn-outline-sm" onclick="exportarReporteCSV()">⬇ CSV Bodega</button>
                <button class="btn-outline-sm" onclick="exportarReporteFacturas()">⬇ CSV Facturas</button>
            </div>
        </div>

        <!-- KPIs ──────────────────────────────────────────── -->
        <div class="inv-stats" id="rep-kpis">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>

        <!-- Gráficas ───────────────────────────────────────── -->
        <div class="rep-charts-grid">

            <!-- Doughnut: Estado del inventario -->
            <div class="rep-chart-card">
                <div class="rep-chart-title">Estado del Inventario</div>
                <div class="rep-chart-wrap">
                    <canvas id="chart-estados"></canvas>
                </div>
            </div>

            <!-- Bar: Valor por categoría -->
            <div class="rep-chart-card">
                <div class="rep-chart-title">Top Artículos por Precio</div>
                <div class="rep-chart-wrap">
                    <canvas id="chart-precios"></canvas>
                </div>
            </div>

            <!-- Bar: Facturas por estado -->
            <div class="rep-chart-card">
                <div class="rep-chart-title">Facturas por Estado</div>
                <div class="rep-chart-wrap">
                    <canvas id="chart-facturas"></canvas>
                </div>
            </div>

            <!-- Line: Ingresos acumulados (por fecha) -->
            <div class="rep-chart-card rep-chart-wide">
                <div class="rep-chart-title">Ingresos Acumulados</div>
                <div class="rep-chart-wrap rep-chart-wrap-wide">
                    <canvas id="chart-ingresos"></canvas>
                </div>
            </div>

        </div>

        <!-- Tabla top artículos ─────────────────────────────── -->
        <div class="rep-table-section">
            <div class="rep-section-title">🏆 Top 10 Artículos en Bodega</div>
            <div class="table-wrap">
                <table class="data-table" id="tabla-top-articulos">
                    <thead>
                        <tr>
                            <th>#</th><th>Nombre</th><th>Tipo</th>
                            <th>Estado</th><th>Precio</th>
                        </tr>
                    </thead>
                    <tbody id="top-articulos-tbody">
                        <tr><td colspan="5" class="empty-row">⏳ Cargando…</td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;

    try {
        // Fetch paralelo de todas las tablas
        const [rB, rF, rS, rT] = await Promise.all([
            window.supabase.from('bodega').select('nombre,articulo,tipo_material,estado,precio,fecha_ingreso'),
            window.supabase.from('facturas').select('estado,total,created_at'),
            window.supabase.from('registros_salida').select('id,fecha,cantidad'),
            window.supabase.from('transferencias').select('id,estado')
        ]);

        const B = rB.data||[];
        const F = rF.data||[];
        const S = rS.data||[];
        const T = rT.data||[];

        // ── KPIs ────────────────────────────────────────────
        const disp   = B.filter(i=>(i.estado||'').toLowerCase()==='disponible').length;
        const vend   = B.filter(i=>(i.estado||'').toLowerCase()==='vendido').length;
        const valB   = B.reduce((s,i)=>s+parseFloat(i.precio||0),0);
        const fActiv = F.filter(f=>(f.estado||'').toLowerCase()!=='anulada');
        const totF   = fActiv.reduce((s,f)=>s+parseFloat(f.total||0),0);

        document.getElementById('rep-kpis').innerHTML = `
            <div class="istat"><span class="istat-num">${B.length}</span><span class="istat-label">Artículos en bodega</span></div>
            <div class="istat istat-green"><span class="istat-num">${disp}</span><span class="istat-label">Disponibles</span></div>
            <div class="istat istat-warn"><span class="istat-num">${vend}</span><span class="istat-label">Vendidos</span></div>
            <div class="istat istat-cyan"><span class="istat-num">$${valB.toFixed(0)}</span><span class="istat-label">Valor inventario</span></div>
            <div class="istat istat-green"><span class="istat-num">$${totF.toFixed(2)}</span><span class="istat-label">Total facturado</span></div>`;

        // ── Esperar un tick para que el DOM renderice los canvas ──
        await new Promise(r => setTimeout(r, 80));

        const CYAN    = 'rgba(0,200,240,0.85)';
        const GREEN   = 'rgba(0,230,118,0.85)';
        const WARN    = 'rgba(255,179,0,0.85)';
        const DANGER  = 'rgba(255,77,109,0.85)';
        const BLUE    = 'rgba(77,184,255,0.85)';
        const MUTED   = 'rgba(120,140,160,0.85)';
        const GRID    = 'rgba(255,255,255,0.07)';
        const LABEL   = '#8892a4';

        const baseOpts = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { labels: { color: LABEL, font:{ size:11 } } } }
        };

        // ── Gráfica 1: Doughnut estados ──────────────────────
        const estadosCounts = {
            disponible: B.filter(i=>(i.estado||'').toLowerCase()==='disponible').length,
            vendido:    B.filter(i=>(i.estado||'').toLowerCase()==='vendido').length,
            reservado:  B.filter(i=>(i.estado||'').toLowerCase()==='reservado').length,
            dañado:     B.filter(i=>(i.estado||'').toLowerCase()==='dañado').length,
        };
        if (_charts.estados) _charts.estados.destroy();
        _charts.estados = new Chart(document.getElementById('chart-estados'), {
            type: 'doughnut',
            data: {
                labels: ['Disponible','Vendido','Reservado','Dañado'],
                datasets: [{ data: Object.values(estadosCounts),
                    backgroundColor: [GREEN, CYAN, WARN, DANGER],
                    borderColor: 'rgba(0,0,0,0)',
                    hoverOffset: 6 }]
            },
            options: { ...baseOpts, cutout:'65%',
                plugins:{ ...baseOpts.plugins,
                    tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.raw} unidades` } }
                }
            }
        });

        // ── Gráfica 2: Top 10 artículos por precio ───────────
        const topArt = [...B]
            .sort((a,b) => parseFloat(b.precio||0) - parseFloat(a.precio||0))
            .slice(0,10);
        if (_charts.precios) _charts.precios.destroy();
        _charts.precios = new Chart(document.getElementById('chart-precios'), {
            type: 'bar',
            data: {
                labels: topArt.map(i => (i.nombre||i.articulo||'Sin nombre').slice(0,18)),
                datasets: [{
                    label: 'Precio ($)',
                    data:  topArt.map(i => parseFloat(i.precio||0)),
                    backgroundColor: CYAN,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: { ...baseOpts, indexAxis:'y',
                scales: {
                    x: { grid:{ color:GRID }, ticks:{ color:LABEL },
                         title:{ display:true, text:'Precio ($)', color:LABEL } },
                    y: { grid:{ color:GRID }, ticks:{ color:LABEL } }
                },
                plugins: { ...baseOpts.plugins, legend:{ display:false } }
            }
        });

        // ── Gráfica 3: Facturas por estado ───────────────────
        const fEst = {
            emitidas: F.filter(f=>(f.estado||'emitida')==='emitida').length,
            pagadas:  F.filter(f=>f.estado==='pagada').length,
            anuladas: F.filter(f=>f.estado==='anulada').length,
        };
        if (_charts.facturas) _charts.facturas.destroy();
        _charts.facturas = new Chart(document.getElementById('chart-facturas'), {
            type: 'bar',
            data: {
                labels: ['Emitidas','Pagadas','Anuladas'],
                datasets: [{
                    label: 'Facturas',
                    data:  Object.values(fEst),
                    backgroundColor: [BLUE, GREEN, DANGER],
                    borderRadius: 4, borderSkipped: false
                }]
            },
            options: { ...baseOpts,
                scales: {
                    x: { grid:{ color:GRID }, ticks:{ color:LABEL } },
                    y: { grid:{ color:GRID }, ticks:{ color:LABEL, stepSize:1 },
                         beginAtZero:true }
                },
                plugins: { ...baseOpts.plugins, legend:{ display:false } }
            }
        });

        // ── Gráfica 4: Ingresos acumulados por mes ───────────
        const porMes = {};
        fActiv.forEach(f => {
            const fecha = f.created_at ? new Date(f.created_at) : null;
            if (!fecha) return;
            const key = `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,'0')}`;
            porMes[key] = (porMes[key]||0) + parseFloat(f.total||0);
        });
        const meses  = Object.keys(porMes).sort();
        const totAcu = [];
        let acu = 0;
        meses.forEach(m => { acu += porMes[m]; totAcu.push(parseFloat(acu.toFixed(2))); });

        if (_charts.ingresos) _charts.ingresos.destroy();
        _charts.ingresos = new Chart(document.getElementById('chart-ingresos'), {
            type: 'line',
            data: {
                labels: meses,
                datasets: [
                    {
                        label: 'Acumulado ($)',
                        data:  totAcu,
                        borderColor: CYAN,
                        backgroundColor: 'rgba(0,200,240,0.08)',
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: CYAN,
                        pointRadius: 4
                    },
                    {
                        label: 'Por mes ($)',
                        data:  meses.map(m => parseFloat((porMes[m]||0).toFixed(2))),
                        borderColor: GREEN,
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        borderDash: [4,3],
                        pointBackgroundColor: GREEN,
                        pointRadius: 3
                    }
                ]
            },
            options: { ...baseOpts,
                scales: {
                    x: { grid:{ color:GRID }, ticks:{ color:LABEL } },
                    y: { grid:{ color:GRID }, ticks:{ color:LABEL },
                         beginAtZero:true }
                }
            }
        });

        // ── Tabla Top 10 ─────────────────────────────────────
        const top10 = [...B]
            .sort((a,b) => parseFloat(b.precio||0) - parseFloat(a.precio||0))
            .slice(0,10);
        document.getElementById('top-articulos-tbody').innerHTML = top10.map((i,idx) => `
            <tr>
                <td class="row-num">${idx+1}</td>
                <td class="td-bold">${esc(i.nombre||i.articulo||'—')}</td>
                <td><span class="tipo-badge ${(!i.tipo_material||i.tipo_material==='seriado')?'tipo-seriado':'tipo-cantidad'}">
                    ${(!i.tipo_material||i.tipo_material==='seriado')?'SERIADO':'MISC.'}
                </span></td>
                <td><span class="badge badge-${(i.estado||'disponible').toLowerCase()}">${esc(i.estado||'disponible')}</span></td>
                <td class="td-price">$${parseFloat(i.precio||0).toFixed(2)}</td>
            </tr>`).join('');

    } catch(err) {
        content.innerHTML = `<div class="module-header"><h2>📊 Reportes</h2></div><p class="error-msg">❌ ${err.message}</p>`;
    }
}

// ── Exportar CSVs ─────────────────────────────────────────
async function exportarReporteCSV() {
    const { data, error } = await window.supabase.from('bodega').select('*');
    if (error || !data) { alert('Error: ' + (error?.message||'sin datos')); return; }
    const cols = ['serie','articulo','nombre','codigo','tipo_material','estado','precio','cantidad','cuadrilla','ubicacion','fecha_ingreso'];
    const csv  = [cols.join(','), ...data.map(r => cols.map(col => '"' + esc(String(r[col]??'')) + '"').join(','))].join('\n');
    _descargarCSV(csv, 'prointel_bodega_' + new Date().toISOString().slice(0,10) + '.csv');
}

async function exportarReporteFacturas() {
    const { data, error } = await window.supabase.from('facturas').select('*');
    if (error || !data) { alert('Error: ' + (error?.message||'sin datos')); return; }
    const cols = ['numero_factura','cliente','nit','total','subtotal','descuento','estado','created_at','notas'];
    const csv  = [cols.join(','), ...data.map(r => cols.map(col => '"' + esc(String(r[col]??'')) + '"').join(','))].join('\n');
    _descargarCSV(csv, 'prointel_facturas_' + new Date().toISOString().slice(0,10) + '.csv');
}

function _descargarCSV(csv, nombre) {
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),
        download: nombre
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}


// ════════════════════════════════════════════════════════════
//  PERMISOS POR ROL — Técnico = Solo Lectura
// ════════════════════════════════════════════════════════════

/**
 * verificarPermisos — punto único de control de acceso.
 * Se llama tras login exitoso y al restaurar sesión.
 * Oculta/muestra elementos según el rol del usuario.
 */

// ════════════════════════════════════════════════════════════
//  PERMISOS POR ROL — Sistema único de control de acceso
// ════════════════════════════════════════════════════════════

/**
 * verificarPermisos()
 * Punto único de control. Se ejecuta:
 *  - Al hacer login exitoso
 *  - Al restaurar sesión del localStorage
 *  - Después de cada changeTab (con guard de formulario activo)
 */
function verificarPermisos() {
    if (!currentUser) return;
    const rol       = (currentUser.rol || '').toLowerCase();
    const esTecnico = rol === 'tecnico';

    // Marcar body con el rol para que CSS actúe en cascada
    document.body.setAttribute('data-rol', rol);

    // ── Menú lateral ──────────────────────────────────────
    document.querySelectorAll('.menu-admin-only').forEach(el => {
        el.style.display = esTecnico ? 'none' : '';
    });
    document.querySelectorAll('.menu-tecnico-only').forEach(el => {
        el.style.display = esTecnico ? 'flex' : 'none';
    });

    // ── Botón Usuarios (por ID explícito) ─────────────────
    const btnUsr = document.getElementById('btn-usuarios');
    if (btnUsr) btnUsr.style.display = esTecnico ? 'none' : '';

    // ── Card Usuarios en panel de inicio ──────────────────
    const cardUsr = document.getElementById('card-usuarios');
    if (cardUsr) cardUsr.style.display = esTecnico ? 'none' : '';

    // ── Restricciones dentro del contenido ───────────────
    // Solo ocultar si NO hay formulario operativo activo del técnico
    if (esTecnico) {
        const formActivo = document.getElementById('form-instalacion') ||
                           document.getElementById('form-instalacion-panel') ||
                           document.getElementById('form-descargos') ||
                           document.getElementById('btnGuardarDescargo') ||
                           document.getElementById('btn-guardar-inst');
        if (!formActivo) _ocultarBotonesAdmin();
    }
}


/**
 * Oculta botones de gestión global (Nuevo, Editar, Eliminar).
 * NO toca botones operativos del técnico (Guardar Instalación, etc.)
 */
function _ocultarBotonesAdmin() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    // Selectores de gestión admin — nunca incluye .btn-cyan globalmente
    const selectoresAdmin = [
        '.act-btn.act-del',           // Eliminar — nunca permitido al técnico
        '#btn-importar',              // Importar Excel
        '.drop-zone',                 // Drop zone de importar
        'button[onclick*="abrirModalArticulo"]',  // Nuevo artículo en bodega central
        'button[onclick*="abrirModalFactura"]',   // Nueva factura
        'button[onclick*="ejecutarImport"]',      // Ejecutar importación
        'button[onclick*="eliminarArticulo"]',    // Eliminar artículo
        'button[onclick*="eliminarUsuario"]',     // Eliminar usuario
        'button[onclick*="eliminarFactura"]',     // Eliminar factura
        // NOTA: abrirModalSalida NO está aquí — el técnico puede registrar salidas
        // NOTA: act-btn act-edit NO está aquí — el técnico puede ver comprobantes
    ];

    selectoresAdmin.forEach(sel => {
        content.querySelectorAll(sel).forEach(el => {
            el.style.display = 'none';
        });
    });

    // Ocultar solo botones .btn-cyan con texto de gestión admin
    const textosAdmin = [
        '+ Nuevo Artículo', '+ Nueva Factura', '+ Nuevo Usuario',
        '+ Nuevo', '⬇ Exportar', '⬇ CSV', '📤 Importar Excel',
        'Exportar', 'Importar'
    ];
    content.querySelectorAll('.btn-cyan, .btn-outline-sm').forEach(el => {
        // NUNCA ocultar botones operativos del técnico
        if (el.id === 'btn-guardar-inst')   return;
        if (el.id === 'btn-guardar-sal')    return;
        if (el.id === 'btnGuardarDescargo') return;
        if (el.type === 'submit')            return;

        const txt = (el.textContent || '').trim();
        if (textosAdmin.some(t => txt.includes(t))) {
            el.style.display = 'none';
        }
    });
}

// ════════════════════════════════════════════════════════════
//  MI BODEGA — Artículos asignados al técnico
// ════════════════════════════════════════════════════════════

async function cargarMisArticulos() {
    if (!currentUser) return;
    const content = document.getElementById('dashboard-content');

    content.innerHTML = `
        <div class="module-header">
            <h2>🎒 Bodega</h2>
            <div class="header-actions">
                <span class="su-name-badge">${esc(currentUser.nombre_completo || currentUser.usuario)}</span>
                <button class="btn-nav" onclick="cargarMisArticulos()">↺ Actualizar</button>
            </div>
        </div>
        <div class="inv-stats" id="mis-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="mi-bodega-tabs">
            <button class="mb-tab mb-tab-active" id="tab-stock"
                onclick="switchMiBodegaTab('stock')">📋 Mi Inventario</button>
            <button class="mb-tab" id="tab-historial"
                onclick="switchMiBodegaTab('historial')">📦 Historial de Entregas</button>
        </div>

        <!-- Panel: Mi Inventario -->
        <div id="panel-stock" class="mb-panel">
            <div class="inv-toolbar">
                <div class="search-bar" style="flex:1">
                    <input type="text" id="mis-search"
                        placeholder="🔍  Buscar en mi inventario…"
                        oninput="filtrarTabla('mis-search','tabla-mis-art')" />
                </div>
            </div>
            <div class="table-wrap">
                <table class="data-table" id="tabla-mis-art">
                    <thead><tr>
                        <th>#</th><th>ARTÍCULO</th><th>TIPO</th>
                        <th>SERIE</th><th>STOCK</th><th>ESTADO</th>
                    </tr></thead>
                    <tbody id="mis-tbody">
                        <tr><td colspan="6" class="empty-row">⏳ Cargando…</td></tr>
                    </tbody>
                </table>
            </div>
            <p class="table-count" id="mis-count"></p>
        </div>

        <!-- Panel: Historial de Entregas -->
        <div id="panel-historial" class="mb-panel hidden">
            <div class="table-wrap">
                <table class="data-table" id="tabla-historial">
                    <thead><tr>
                        <th>#</th><th>CORRELATIVO</th><th>ARTÍCULO</th>
                        <th>CANTIDAD</th><th>DESPACHADO POR</th><th>FECHA</th><th>REGISTRO</th>
                    </tr></thead>
                    <tbody id="hist-tbody">
                        <tr><td colspan="7" class="empty-row">⏳ Cargando…</td></tr>
                    </tbody>
                </table>
            </div>
            <p class="table-count" id="hist-count"></p>
        </div>`;

    if (!currentUser.id) {
        document.getElementById('mis-tbody').innerHTML =
            '<tr><td colspan="6" class="empty-row error-msg">❌ Sin sesión válida.</td></tr>';
        return;
    }

    try {
        const uid    = currentUser.id;
        const nombre = currentUser.nombre_completo || currentUser.usuario || '';

        // ── Todo el stock del técnico en una sola consulta ────────────────
        const condiciones = [`asignado_a.eq.${uid}`];
        if (nombre) condiciones.push(`responsable.eq.${nombre}`);

        const { data: todoBodega, error: errBodega } = await window.supabase
            .from('bodega')
            .select('id, nombre, articulo, codigo, tipo_material, unidad, cantidad, estado, serie, fecha_ingreso')
            .or(condiciones.join(','))
            .not('estado', 'in', '("vendido","instalado","agotado")');

        if (errBodega) throw errBodega;

        const todos = todoBodega || [];

        // Separar misc / seriado con detección flexible
        const esMiscFn = b => {
            const t = (b.tipo_material || '').toLowerCase().trim();
            return t === 'miscelaneo' || t === 'misceláneos' || t === 'misceláneo'
                || (!t && !b.serie && (b.cantidad || 0) > 0);
        };
        const misc     = todos.filter(b => esMiscFn(b));
        const seriados = todos.filter(b => !esMiscFn(b));

        // ── Historial desde registros_salida ──────────────────────────────
        console.log('PROINTEL — historial uid:', uid);
        const { data: histRaw, error: histErr } = await window.supabase
            .from('registros_salida')
            .select('id, correlativo, articulo_id, cantidad, fecha, nombre_articulo, despachado_por, tecnico_id')
            .eq('tecnico_id', uid)
            .order('correlativo', { ascending: false })
            .limit(50);
        console.log('PROINTEL — historial rows:', histRaw?.length, 'error:', histErr?.message);

        // Enriquecer historial con nombre de artículo desde tabla articulos
        const artIds = [...new Set((histRaw||[]).map(h => h.articulo_id).filter(Boolean))];
        let artMap = {};
        if (artIds.length) {
            const { data: arts } = await window.supabase
                .from('articulos')
                .select('id, nombre, codigo, unidad_medida')
                .in('id', artIds);
            (arts||[]).forEach(a => { artMap[a.id] = a; });
        }
        const hist = (histRaw||[]).map(h => ({ ...h, art: artMap[h.articulo_id] || null }));

        // ── Stats ──────────────────────────────────────────────────────────
        document.getElementById('mis-stats').innerHTML = `
            <div class="istat">
                <span class="istat-num">${todos.length}</span>
                <span class="istat-label">En mi cargo</span>
            </div>
            <div class="istat istat-cyan">
                <span class="istat-num">${seriados.length}</span>
                <span class="istat-label">Seriados</span>
            </div>
            <div class="istat istat-blue">
                <span class="istat-num">${misc.length}</span>
                <span class="istat-label">Misceláneos</span>
            </div>`;

        window._misBodegaItems = { misc, series: seriados };

        // ── Renderizar Mi Inventario ──────────────────────────────────────
        const tbody = document.getElementById('mis-tbody');
        const count = document.getElementById('mis-count');

        if (!todos.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin material asignado actualmente.</td></tr>';
            if (count) count.textContent = '';
        } else {
            // Mostrar misceláneos primero, luego seriados
            const allItems = [
                ...misc.map(b => ({
                    _tipo:  'MISC',
                    nombre: b.nombre || b.articulo || '—',
                    codigo: b.codigo || '—',
                    serie:  null,
                    stock:  b.cantidad || 0,
                    unidad: b.unidad || 'und',
                    estado: b.estado || 'disponible',
                })),
                ...seriados.map(b => ({
                    _tipo:  'SERIADO',
                    nombre: b.nombre || b.articulo || '—',
                    codigo: b.codigo || '—',
                    serie:  b.serie  || '—',
                    stock:  1,
                    unidad: 'und',
                    estado: b.estado || 'entregado',
                })),
            ];

            tbody.innerHTML = allItems.map((item, idx) => {
                const esMisc = item._tipo === 'MISC';
                const crit   = esMisc && item.stock < 5;
                const warn   = esMisc && item.stock < 20 && !crit;
                const color  = crit ? 'var(--danger)' : warn ? '#f39c12' : 'var(--green)';
                const stockCell = esMisc
                    ? `<span style="font-family:var(--font-mono);font-weight:700;color:${color}">
                           ${item.stock.toLocaleString()}
                           <small style="font-size:.75em;color:var(--dim)">${esc(item.unidad)}</small>
                           ${crit ? ' ⚠️' : warn ? ' 〽️' : ''}
                       </span>`
                    : `<span style="color:var(--dim);font-size:.82rem">1 und</span>`;

                return `<tr ${crit ? 'style="background:rgba(255,77,109,.05)"' : ''}>
                    <td class="row-num">${idx+1}</td>
                    <td>
                        <div class="td-bold">${esc(item.nombre)}</div>
                        <div style="font-size:.7rem;color:var(--dim);font-family:var(--font-mono)">${esc(item.codigo)}</div>
                    </td>
                    <td>
                        <span class="tipo-badge ${esMisc ? 'tipo-cantidad' : 'tipo-seriado'}"
                            style="font-size:.65rem">${item._tipo}</span>
                    </td>
                    <td>${item.serie
                        ? `<code class="serie-code" style="font-size:.78rem">${esc(item.serie)}</code>`
                        : `<span style="color:var(--dim)">—</span>`}
                    </td>
                    <td style="text-align:center">${stockCell}</td>
                    <td><span class="badge badge-${(item.estado).toLowerCase() === 'disponible'||item.estado.toLowerCase()==='entregado' ? 'disponible' : 'reservado'}"
                        style="font-size:.72rem">${esc(item.estado)}</span></td>
                </tr>`;
            }).join('');

            if (count) count.textContent =
                `${todos.length} artículo${todos.length!==1?'s':''} — ${misc.length} misc · ${seriados.length} seriado${seriados.length!==1?'s':''}`;
        }

        // ── Renderizar Historial de Entregas ──────────────────────────────
        const histTbody = document.getElementById('hist-tbody');
        const histCount = document.getElementById('hist-count');

        console.log('PROINTEL — renderizando historial, filas:', hist.length);

        // Esperar al DOM — el panel está hidden durante la carga async
        const renderHistorial = () => {
            const hTbody = document.getElementById('hist-tbody');
            const hCount = document.getElementById('hist-count');
            if (!hTbody) { console.warn('hist-tbody no encontrado en DOM'); return; }

            if (!hist.length) {
                hTbody.innerHTML =
                    '<tr><td colspan="7" class="empty-row">No tienes entregas registradas aún.</td></tr>';
            } else {
                hTbody.innerHTML = hist.map((h, idx) => {
                const artNombre = h.art?.nombre || h.nombre_articulo || '—';
                const artCodigo = h.art?.codigo || '';
                const unidad    = h.art?.unidad_medida || 'und';
                const desp      = h.despachado_por || 'Bodega Central';
                const fecha     = h.fecha
                    ? new Date(h.fecha).toLocaleDateString('es-SV')
                    : '—';
                return `<tr>
                    <td class="row-num">${idx+1}</td>
                    <td><code class="sku-code">#${h.correlativo||'—'}</code></td>
                    <td class="td-bold">
                        ${esc(artNombre)}
                        ${artCodigo
                            ? `<br><span style="font-size:.7rem;color:var(--dim)">${esc(artCodigo)}</span>`
                            : ''}
                    </td>
                    <td style="font-family:var(--font-mono)">${h.cantidad||'—'} ${esc(unidad)}</td>
                    <td style="font-size:.82rem">${esc(desp)}</td>
                    <td class="td-date">${fecha}</td>
                    <td>
                        <button class="btn-cyan" style="font-size:.75rem;padding:.3rem .7rem"
                            onclick="verFacturaSalida('${h.id}')">
                            🧾 Ver PDF
                        </button>
                    </td>
                </tr>`;
            }).join('');
            }
            if (hCount) hCount.textContent =
                `${hist.length} entrega${hist.length!==1?'s':''}`;
        };
        // Ejecutar ahora y también después de 200ms por si el DOM tardó
        renderHistorial();
        setTimeout(renderHistorial, 200);

    } catch (err) {
        console.error('PROINTEL — cargarMisArticulos:', err);
        document.getElementById('mis-tbody').innerHTML =
            `<tr><td colspan="6" class="empty-row error-msg">
                ❌ ${esc(err.message)}
            </td></tr>`;
    }
}

// Cambiar entre pestañas de Mi Bodega
function switchMiBodegaTab(tab) {
    const panelStock    = document.getElementById('panel-stock');
    const panelHistorial = document.getElementById('panel-historial');
    const tabStock      = document.getElementById('tab-stock');
    const tabHistorial  = document.getElementById('tab-historial');

    if (tab === 'stock') {
        panelStock?.classList.remove('hidden');
        panelHistorial?.classList.add('hidden');
        tabStock?.classList.add('mb-tab-active');
        tabHistorial?.classList.remove('mb-tab-active');
    } else {
        panelHistorial?.classList.remove('hidden');
        panelStock?.classList.add('hidden');
        tabHistorial?.classList.add('mb-tab-active');
        tabStock?.classList.remove('mb-tab-active');
    }
}


// ════════════════════════════════════════════════════════════
//  DESCARGOS — Registro de material instalado en campo
// ════════════════════════════════════════════════════════════

/**
 * Alias legacy — cualquier llamada a abrirInstalacion() redirige a DESCARGOS
 */
function abrirInstalacion() { abrirDescargos(); }

async function abrirDescargos() {
    window._misBodegaItems = null;
    const content = document.getElementById('dashboard-content');
    // Reiniciar carrito al abrir
    window._listaDescargo = [];

    if (content) {
        content.innerHTML = `
            <div class="module-header">
                <h2>📦 DESCARGOS</h2>
                <button class="btn-nav" onclick="cargarMisArticulos()">← Mi Bodega</button>
            </div>
            <p class="loading-msg">⏳ Cargando tu stock personal…</p>`;
    }

    if (!currentUser?.id) {
        _notificar('Sin sesión válida.');
        return;
    }

    const uid    = currentUser.id;
    const nombre = currentUser.nombre_completo || currentUser.usuario || '';

    // Buscar material asignado al técnico en bodega
    // Se filtra por asignado_a (UUID) o responsable (nombre)
    const condiciones = [`asignado_a.eq.${uid}`];
    if (nombre) condiciones.push(`responsable.eq.${nombre}`);

    const { data: todoBodega } = await window.supabase
        .from('bodega')
        .select('id, nombre, articulo, codigo, tipo_material, unidad, cantidad, estado, serie')
        .or(condiciones.join(','))
        .not('estado', 'in', '("vendido","instalado","agotado")');

    const todos = todoBodega || [];
    // Misceláneo: tipo_material = 'miscelaneo' O null/vacío con cantidad > 0 y sin serie
    // Seriado:    tipo_material = 'seriado' O tiene número de serie
    const misc     = todos.filter(b => {
        const t = (b.tipo_material || '').toLowerCase().trim();
        return t === 'miscelaneo' || t === 'misceláneos' || t === 'misceláneo' ||
               (!t && !b.serie && b.cantidad > 1);
    });
    const seriados = todos.filter(b => {
        const t = (b.tipo_material || '').toLowerCase().trim();
        return t === 'seriado' || b.serie ||
               (t !== 'miscelaneo' && t !== 'misceláneos' && t !== 'misceláneo' && (b.serie || t === 'seriado'));
    }).filter(b => !misc.includes(b)); // evitar duplicados

    window._misBodegaItems = { misc, series: seriados };

    const optsItems = [
        ...misc.map(b => {
            const u = b.unidad || 'und';
            return `<option value="misc-${b.id}"
                data-max="${b.cantidad || 0}"
                data-tipo="misc"
                data-es-misc="true"
                data-inv-id="${b.id}"
                data-art-id="${b.id}"
                data-nombre="${esc(b.nombre || b.articulo || '')}"
                data-unidad="${esc(u)}">
                ${esc(b.nombre || b.articulo || 'Sin nombre')} — Mi stock: ${b.cantidad || 0} ${u}
            </option>`;
        }),
        ...seriados.map(b => {
            return `<option value="ser-${b.id}"
                data-max="1"
                data-tipo="seriado"
                data-serie-id="${b.id}"
                data-art-id="${b.id}"
                data-nombre="${esc(b.nombre || b.articulo || '')}"
                data-serie="${esc(b.serie || '')}"
                data-unidad="und">
                ${esc(b.nombre || b.articulo || 'Sin nombre')} — Serie: ${esc(b.serie || '—')}
            </option>`;
        }),
    ].join('') || '<option value="" disabled>No tienes material en tu bodega personal</option>';

    if (content) {
        content.innerHTML = `
            <div class="module-header">
                <h2>📦 DESCARGOS</h2>
                <button class="btn-nav" onclick="cargarMisArticulos()">← Volver a mi bodega</button>
            </div>
            <form id="form-descargos" onsubmit="guardarDescargo(event)" class="inst-panel-form">
                <div class="form-grid">
                    <div class="field field-full">
                        <label>Nº SOLICITUD / OT <span class="req">*</span></label>
                        <input type="text" id="desc-ot" required
                            placeholder="OT-2025-0001"
                            style="font-family:var(--font-mono);font-size:1rem" autofocus />
                    </div>
                    <div class="field field-full">
                        <label>MATERIAL DESCARGADO <span class="req">*</span>
                            <span id="desc-stock-badge" class="series-count-badge" style="display:none"></span>
                        </label>
                        <select id="desc-item" required onchange="onDescItemChange(this)"
                            class="filter-select" style="width:100%">
                            <option value="">— Seleccionar de mi bodega —</option>
                            ${optsItems}
                        </select>
                        <div id="desc-codigo-wrap" class="sal-codigo-interno hidden">
                            <span class="sal-codigo-label">Serie:</span>
                            <code id="desc-codigo-val" class="serie-code"></code>
                        </div>
                    </div>
                    <div class="field">
                        <label>CANTIDAD DESCARGADA <span class="req">*</span></label>
                        <input type="number" id="desc-cantidad"
                            min="1" max="1" value="1" required
                            oninput="validarCantidadDesc(this)" />
                        <div id="desc-cant-error"
                            style="font-size:.78rem;color:var(--danger);margin-top:.3rem;display:none">
                        </div>
                    </div>
                    <div class="field">
                        <label>CLIENTE / DIRECCIÓN</label>
                        <input type="text" id="desc-destino"
                            placeholder="Dirección de la instalación" />
                    </div>
                    <div class="field field-full">
                        <label>DESCRIPCIÓN DEL TRABAJO</label>
                        <textarea id="desc-notas" rows="3"
                            placeholder="Tipo de instalación, observaciones técnicas…"></textarea>
                    </div>

                    <!-- Botón agregar al carrito -->
                    <div class="field field-full" style="margin-top:.2rem">
                        <button type="button" class="btn-outline-sm"
                            onclick="agregarAlCarritoDescargo()"
                            style="width:100%;justify-content:center;font-size:.88rem;padding:.6rem">
                            ➕ Añadir material a la lista
                        </button>
                    </div>

                    <!-- Lista de materiales del descargo -->
                    <div class="field field-full">
                        <label>MATERIALES A DESCARGAR
                            <span id="desc-carrito-count" class="series-count-badge"
                                style="display:none"></span>
                        </label>
                        <div id="desc-carrito" class="carrito-vacio">
                            Sin materiales agregados aún
                        </div>
                    </div>

                </div>
                <div id="descargo-footer">
                    <button type="button" class="btn-ghost-sm"
                        onclick="cargarMisArticulos()">Cancelar</button>
                    <button type="submit" class="btn-guardar-final" id="btnGuardarDescargo"
                        disabled style="opacity:.5">
                        📦 Finalizar Descargo
                    </button>
                </div>
            </form>`;

        requestAnimationFrame(() => {
            const btn = document.getElementById('btnGuardarDescargo');
            if (btn) btn.style.cssText = 'display:inline-flex !important;visibility:visible !important;opacity:1 !important;';
        });
    }
}

function onDescItemChange(sel) {
    const opt      = sel.options[sel.selectedIndex];
    const maxStock = parseInt(opt.getAttribute('data-max') || 0);
    const codigo   = opt.getAttribute('data-codigo') || '';
    const unidad   = opt.getAttribute('data-unidad') || 'und';
    const esMisc   = opt.getAttribute('data-es-misc') === 'true'
                     || opt.getAttribute('data-tipo') === 'misc';

    const cantEl  = document.getElementById('desc-cantidad');
    const badgeEl = document.getElementById('desc-stock-badge');
    const codWrap = document.getElementById('desc-codigo-wrap');
    const codVal  = document.getElementById('desc-codigo-val');
    const errEl   = document.getElementById('desc-cant-error');
    const btnEl   = document.getElementById('btnGuardarDescargo');

    if (cantEl) {
        if (esMisc) {
            // Misceláneo: permitir cantidad hasta el máximo disponible
            cantEl.readOnly = false;
            cantEl.min      = '1';
            cantEl.max      = String(maxStock);
            cantEl.value    = '1';
        } else {
            // Seriado: solo 1 unidad
            cantEl.readOnly = true;
            cantEl.min      = '1';
            cantEl.max      = '1';
            cantEl.value    = '1';
        }
    }

    if (errEl) errEl.style.display = 'none';
    if (btnEl) btnEl.disabled = (maxStock <= 0);

    if (badgeEl) {
        const ok = maxStock > 0;
        badgeEl.textContent   = ok
            ? `Mi stock: ${maxStock} ${unidad}`
            : 'Sin stock disponible';
        badgeEl.style.display  = 'inline-block';
        badgeEl.style.background = ok ? 'rgba(0,230,118,.15)' : 'rgba(255,77,109,.15)';
        badgeEl.style.color    = ok ? '#00e676' : '#ff4d6d';
        badgeEl.style.border   = ok
            ? '1px solid rgba(0,230,118,.3)' : '1px solid rgba(255,77,109,.3)';
    }

    if (codWrap && codVal) {
        const serie = opt.getAttribute('data-serie') || '';
        if (serie) { codVal.textContent = serie; codWrap.classList.remove('hidden'); }
        else        { codWrap.classList.add('hidden'); }
    }
}

function validarCantidadDesc(input) {
    const max      = parseInt(input.max || 0);
    const val      = parseInt(input.value || 0);
    const invalido = val > max || val < 1;
    const errEl    = document.getElementById('desc-cant-error');
    const btnEl    = document.getElementById('btnGuardarDescargo');

    if (errEl) {
        errEl.style.display = invalido ? 'block' : 'none';
        if (val > max) {
            errEl.textContent = `⚠️ No tienes suficiente material. Tu stock personal: ${max} unidades.`;
        } else if (val < 1) {
            errEl.textContent = '⚠️ La cantidad debe ser al menos 1.';
        }
    }
    if (btnEl) btnEl.disabled = invalido;
}


async function cargarInstaladas() {
    if (!currentUser) return;
    const content = document.getElementById('dashboard-content');

    content.innerHTML = `
        <div class="module-header">
            <h2>✅ Instalaciones Realizadas</h2>
            <div class="header-actions">
                <span class="su-name-badge">${esc(currentUser.nombre_completo || currentUser.usuario)}</span>
                <button class="btn-nav" onclick="cargarInstaladas()">↺ Actualizar</button>
                <button class="btn-outline-sm" onclick="exportarInstaladasExcel()">
                    📊 Exportar Excel
                </button>
            </div>
        </div>
        <div class="inv-stats" id="inst-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="inst-search"
                    placeholder="🔍  Buscar por OT, cliente…"
                    oninput="filtrarTabla('inst-search','tabla-inst')" />
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-inst">
                <thead><tr>
                    <th>#</th>
                    <th>CORRELATIVO</th>
                    <th>OT / SOLICITUD</th>
                    <th>MATERIALES</th>
                    <th>CLIENTE</th>
                    <th>FECHA</th>
                    <th>VER</th>
                </tr></thead>
                <tbody id="inst-tbody">
                    <tr><td colspan="7" class="empty-row">⏳ Cargando…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="inst-count"></p>`;

    try {
        const { data: registros, error } = await window.supabase
            .from('registros_instalaciones')
            .select('id, correlativo_descargo, numero_ot, cliente, articulo_id, cantidad_usada, fecha')
            .eq('tecnico_id', currentUser.id)
            .order('correlativo_descargo', { ascending: false });

        if (error) throw error;
        const rows = registros || [];

        // Enriquecer con nombre de artículo
        const artIds = [...new Set(rows.map(r => r.articulo_id).filter(Boolean))];
        let artMap = {};
        if (artIds.length) {
            const { data: arts } = await window.supabase
                .from('articulos').select('id, nombre, codigo').in('id', artIds);
            (arts||[]).forEach(a => { artMap[a.id] = a; });
        }

        // Enriquecer cada fila con nombre de artículo
        const rowsRich = rows.map(r => ({
            ...r,
            artNombre: artMap[r.articulo_id]?.nombre || '—',
            artCodigo: artMap[r.articulo_id]?.codigo || '',
        }));

        // Guardar en global para exportar y ver detalle
        window._instaladas = rowsRich;

        // Agrupar por OT para mostrar una fila por trabajo
        const porOT = {};
        rowsRich.forEach(r => {
            const key = r.numero_ot || r.correlativo_descargo || r.id;
            if (!porOT[key]) porOT[key] = {
                correlativo: r.correlativo_descargo,
                ot:          r.numero_ot || '—',
                cliente:     r.cliente   || '—',
                fecha:       r.fecha,
                items:       [],
            };
            porOT[key].items.push(r);
        });

        const grupos = Object.values(porOT);

        // Stats
        document.getElementById('inst-stats').innerHTML = `
            <div class="istat">
                <span class="istat-num">${rows.length}</span>
                <span class="istat-label">Materiales descargados</span>
            </div>
            <div class="istat istat-cyan">
                <span class="istat-num">${grupos.length}</span>
                <span class="istat-label">Trabajos realizados</span>
            </div>`;

        const tbody = document.getElementById('inst-tbody');
        const count = document.getElementById('inst-count');

        if (!grupos.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No tienes descargos registrados aún.</td></tr>';
            if (count) count.textContent = '';
            return;
        }

        tbody.innerHTML = grupos.map((g, idx) => {
            const fecha    = g.fecha
                ? new Date(g.fecha).toLocaleDateString('es-SV')
                : '—';
            const nItems   = g.items.length;
            const resumen  = g.items.slice(0,2).map(i => esc(i.artNombre)).join(', ')
                           + (nItems > 2 ? ` +${nItems-2} más` : '');
            const otKey    = encodeURIComponent(g.ot);

            return `<tr>
                <td class="row-num">${idx+1}</td>
                <td><code class="sku-code">#${g.correlativo||'—'}</code></td>
                <td style="font-family:var(--font-mono);font-weight:600">
                    ${esc(g.ot)}
                </td>
                <td style="font-size:.82rem;color:var(--dim)">
                    <span class="series-count-badge" style="margin-right:.3rem">${nItems}</span>
                    ${resumen}
                </td>
                <td style="font-size:.82rem">${esc(g.cliente)}</td>
                <td class="td-date">${fecha}</td>
                <td style="display:flex;gap:.3rem;flex-wrap:wrap">
                    <button class="btn-cyan" style="font-size:.72rem;padding:.3rem .6rem"
                        onclick="verDetalleInstalacion('${otKey}')">
                        👁 Ver
                    </button>
                    <button class="btn-outline-sm" style="font-size:.72rem;padding:.3rem .6rem"
                        onclick="exportarOTExcel('${otKey}')">
                        📊 Excel
                    </button>
                </td>
            </tr>`;
        }).join('');

        if (count) count.textContent =
            `${grupos.length} trabajo${grupos.length!==1?'s':''} · ${rows.length} material${rows.length!==1?'es':''}`;

    } catch (err) {
        console.error('PROINTEL — cargarInstaladas:', err);
        document.getElementById('inst-tbody').innerHTML =
            `<tr><td colspan="7" class="empty-row error-msg">❌ ${esc(err.message)}</td></tr>`;
    }
}
async function verDetalleInstalacion(otEncoded) {
    const ot = decodeURIComponent(otEncoded);

    // Si el array global está vacío, recargar desde BD primero
    if (!window._instaladas || !window._instaladas.length) {
        await cargarInstaladas();
    }

    const rows = (window._instaladas || []).filter(r =>
        (r.numero_ot || String(r.correlativo_descargo)) === ot
    );

    if (!rows.length) { _notificar('No se encontraron detalles para esta OT.'); return; }

    document.getElementById('modal-inst-detalle')?.remove();

    const g     = rows[0];
    const fecha = g.fecha ? new Date(g.fecha).toLocaleDateString('es-SV', {
        weekday:'long', day:'2-digit', month:'long', year:'numeric'
    }) : '—';

    const filasHTML = rows.map((r, i) => `
        <tr>
            <td class="row-num">${i+1}</td>
            <td class="td-bold">${esc(r.artNombre)}</td>
            <td><code style="font-family:var(--font-mono);font-size:.78rem">
                ${esc(r.artCodigo||'—')}
            </code></td>
            <td style="text-align:center;font-family:var(--font-mono);font-weight:700">
                ${r.cantidad_usada||1}
            </td>
        </tr>`).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-inst-detalle" onclick="event.stopPropagation()">
            <div class="modal-content mfs-content" onclick="event.stopPropagation()">
                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">✅</span>
                        <span>Detalle — OT ${esc(g.numero_ot||'—')}</span>
                    </div>
                    <button class="modal-close"
                        onclick="document.getElementById('modal-inst-detalle').remove()">✕</button>
                </div>

                <div class="modal-body">
                    <div id="inst-det-printable">

                        <div class="mfs-head">
                            <div>
                                <div class="mfs-brand">PRO<span>INTEL</span></div>
                                <div class="mfs-brand-sub">Comprobante de Descargo</div>
                            </div>
                            <div class="mfs-head-right">
                                <div class="mfs-tipo-badge">DESCARGO DE MATERIAL</div>
                                <div class="mfs-correlativo">OT: ${esc(g.numero_ot||'—')}</div>
                                <div class="mfs-fecha">${fecha}</div>
                            </div>
                        </div>

                        <div class="mfs-info-grid">
                            <div class="mfs-info-card">
                                <div class="mfs-info-label">Técnico</div>
                                <div class="mfs-info-val">
                                    ${esc(currentUser?.nombre_completo || currentUser?.usuario || '—')}
                                </div>
                            </div>
                            <div class="mfs-info-card">
                                <div class="mfs-info-label">Cliente / Dirección</div>
                                <div class="mfs-info-val">${esc(g.cliente||'—')}</div>
                            </div>
                        </div>

                        <table class="mfs-tabla">
                            <thead><tr>
                                <th>#</th>
                                <th>Artículo / Material</th>
                                <th>Código</th>
                                <th style="text-align:center">Cant. Usada</th>
                            </tr></thead>
                            <tbody>${filasHTML}</tbody>
                        </table>

                        <div class="mfs-footer">
                            <span>PROINTEL 2.0 — Sistema de Gestión Residencial</span>
                            <span>Impreso el ${new Date().toLocaleDateString('es-SV')}</span>
                        </div>
                    </div>
                </div>

                <div class="modal-foot">
                    <button class="btn-ghost-sm"
                        onclick="document.getElementById('modal-inst-detalle').remove()">
                        Cerrar
                    </button>
                    <button class="btn-ghost-sm"
                        onclick="exportarOTExcel('${encodeURIComponent(g.numero_ot||'')}')">
                        📊 Descargar Excel
                    </button>
                    <button class="btn-cyan" onclick="imprimirDetalleInstalacion()">
                        🖨 Imprimir / PDF
                    </button>
                </div>
            </div>
        </div>`);
}

function imprimirDetalleInstalacion() {
    const area = document.getElementById('inst-det-printable');
    if (!area) return;
    const win = window.open('', '_blank', 'width=820,height=700');
    win.document.write(`<!DOCTYPE html><html lang="es"><head>
        <meta charset="UTF-8"><title>Instalación PROINTEL</title>
        <style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{font-family:'Segoe UI',Arial,sans-serif;color:#111;padding:2rem;max-width:760px;margin:0 auto}
            .mfs-brand{font-size:1.8rem;font-weight:900;color:#0d1520}
            .mfs-brand span{color:#00c8f0}
            .mfs-brand-sub{font-size:.72rem;color:#636e72}
            .mfs-head{display:flex;justify-content:space-between;align-items:flex-start;
                      padding-bottom:1.2rem;border-bottom:3px solid #00c8f0;margin-bottom:1.4rem}
            .mfs-tipo-badge{display:inline-block;font-size:.6rem;font-weight:700;letter-spacing:.12em;
                color:#fff;background:#0d1520;padding:.25rem .7rem;border-radius:20px;
                text-transform:uppercase;margin-bottom:.3rem}
            .mfs-correlativo{font-size:1.2rem;font-weight:800;font-family:'Courier New',monospace}
            .mfs-fecha{font-size:.78rem;color:#636e72;margin-top:.2rem}
            .mfs-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:.8rem;margin-bottom:1.4rem}
            .mfs-info-card{background:#f8fafb;border-left:3px solid #00c8f0;border-radius:0 5px 5px 0;padding:.7rem .9rem}
            .mfs-info-label{font-size:.62rem;font-weight:700;letter-spacing:.1em;color:#636e72;
                text-transform:uppercase;margin-bottom:.2rem}
            .mfs-info-val{font-size:.9rem;font-weight:600}
            .mfs-tabla{width:100%;border-collapse:collapse;margin-bottom:1.2rem}
            .mfs-tabla thead tr{background:#0d1520;color:#fff}
            .mfs-tabla th{padding:.6rem .9rem;font-size:.76rem;text-align:left}
            .mfs-tabla td{padding:.6rem .9rem;font-size:.85rem;border-bottom:1px solid #edf2f0}
            .mfs-footer{margin-top:1.8rem;padding-top:.8rem;border-top:1px solid #edf2f0;
                display:flex;justify-content:space-between;font-size:.7rem;color:#b2bec3}
        </style>
    </head><body>${area.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
}

// ── Exportar Excel de una OT específica ──────────────────────────────────────
function exportarOTExcel(otEncoded) {
    const ot   = decodeURIComponent(otEncoded);
    const rows = (window._instaladas || []).filter(r =>
        (r.numero_ot || String(r.correlativo_descargo)) === ot
    );
    if (!rows.length) { _notificar('Sin datos para exportar.'); return; }

    exportarExcelInstalaciones(rows, `OT_${ot}`);
}

// ── Exportar Excel de TODAS las instalaciones ─────────────────────────────────
function exportarInstaladasExcel() {
    const rows = window._instaladas || [];
    if (!rows.length) { _notificar('Sin datos para exportar.'); return; }
    exportarExcelInstalaciones(rows, 'Instalaciones_PROINTEL');
}

function exportarExcelInstalaciones(rows, nombreArchivo) {
    // Construir CSV con BOM para Excel (UTF-8)
    const BOM = '\uFEFF';
    const sep = ',';
    const headers = ['Correlativo','OT/Solicitud','Artículo','Código','Cantidad','Cliente','Fecha'];
    const filas   = rows.map(r => [
        r.correlativo_descargo || '—',
        r.numero_ot            || '—',
        r.artNombre            || '—',
        r.artCodigo            || '—',
        r.cantidad_usada       || 1,
        r.cliente              || '—',
        r.fecha ? new Date(r.fecha).toLocaleDateString('es-SV') : '—',
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep));

    const csv  = BOM + [headers.join(sep), ...filas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${nombreArchivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    _mostrarToastExito(`✅ Exportado: ${nombreArchivo}.csv`);
}
function agregarAlCarritoDescargo() {
    const sel     = document.getElementById('desc-item');
    const cantEl  = document.getElementById('desc-cantidad');
    const opt     = sel?.options[sel?.selectedIndex];

    if (!opt || !opt.value) {
        _notificar('Selecciona un material primero.');
        return;
    }

    const tipo     = opt.getAttribute('data-tipo');
    const esMisc   = tipo === 'misc';
    const maxStock = parseInt(opt.getAttribute('data-max') || 0);
    const nombre   = opt.getAttribute('data-nombre') || opt.text;
    const unidad   = opt.getAttribute('data-unidad') || 'und';
    const invId    = opt.getAttribute('data-inv-id')  || '';
    const artId    = opt.getAttribute('data-art-id')  || '';
    const serieId  = opt.getAttribute('data-serie-id')|| '';
    const serie    = opt.getAttribute('data-serie')   || '';
    const cantidad = esMisc ? (parseInt(cantEl?.value) || 1) : 1;

    if (cantidad < 1) { _notificar('La cantidad debe ser al menos 1.'); return; }
    if (esMisc && cantidad > maxStock) {
        _notificar('⚠️ Stock insuficiente. Disponible: ' + maxStock + ' ' + unidad);
        return;
    }

    // Evitar duplicar el mismo seriado
    window._listaDescargo = window._listaDescargo || [];
    if (!esMisc && window._listaDescargo.some(x => x.invId === invId)) {
        _notificar('Este equipo ya está en la lista.');
        return;
    }

    window._listaDescargo.push({ tipo, esMisc, nombre, unidad, cantidad, maxStock,
                                  invId, artId, serieId, serie });

    // Limpiar selección para el siguiente artículo
    sel.value = '';
    if (cantEl) { cantEl.value = 1; cantEl.max = 1; }
    document.getElementById('desc-stock-badge') &&
        (document.getElementById('desc-stock-badge').style.display = 'none');
    document.getElementById('desc-codigo-wrap')?.classList.add('hidden');

    renderCarritoDescargo();
}

function renderCarritoDescargo() {
    const cont  = document.getElementById('desc-carrito');
    const badge = document.getElementById('desc-carrito-count');
    const lista = window._listaDescargo || [];
    const btn   = document.getElementById('btnGuardarDescargo');

    if (badge) {
        badge.textContent   = lista.length;
        badge.style.display = lista.length ? 'inline-block' : 'none';
        badge.style.background = 'rgba(0,200,240,.15)';
        badge.style.color      = 'var(--cyan)';
        badge.style.border     = '1px solid var(--border-cyan)';
    }
    if (btn) btn.disabled = lista.length === 0;

    if (!lista.length) {
        cont.className   = 'carrito-vacio';
        cont.textContent = 'Sin materiales agregados aún';
        return;
    }

    cont.className = 'carrito-lista';
    cont.innerHTML = lista.map((e, i) => `
        <div class="carrito-item">
            <div class="carrito-info">
                <span class="carrito-nombre">${esc(e.nombre)}</span>
                ${e.serie
                    ? `<code class="serie-code" style="font-size:.72rem">${esc(e.serie)}</code>`
                    : `<span class="td-date">${e.cantidad} ${esc(e.unidad)}</span>`}
            </div>
            <button type="button" class="act-btn act-del"
                onclick="quitarDeCarritoDescargo(${i})" title="Quitar">✕</button>
        </div>`).join('');
}

function quitarDeCarritoDescargo(idx) {
    if (window._listaDescargo) window._listaDescargo.splice(idx, 1);
    renderCarritoDescargo();
}
async function guardarDescargo(e) {
    e.preventDefault();

    const ot      = document.getElementById('desc-ot')?.value.trim();
    const destino = document.getElementById('desc-destino')?.value.trim() || null;
    const notas   = document.getElementById('desc-notas')?.value.trim()   || null;
    const lista   = window._listaDescargo || [];

    if (!ot)           { _notificar('El número de OT es obligatorio.'); return; }
    if (!lista.length) { _notificar('Agrega al menos un material a la lista.'); return; }

    const btn    = document.getElementById('btnGuardarDescargo');
    const btnTxt = btn?.textContent || '📦 Finalizar Descargo';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

    try {
        // Correlativo de descargo — máximo + 1
        const { data: corrData } = await window.supabase
            .from('registros_instalaciones')
            .select('correlativo_descargo')
            .order('correlativo_descargo', { ascending: false })
            .limit(1)
            .maybeSingle();
        const correlativo_descargo = (corrData?.correlativo_descargo || 0) + 1;

        // Insert un registro por cada material de la lista
        for (const item of lista) {
            const payload = {
                correlativo_descargo,
                tecnico_id:    currentUser.id,
                numero_ot:     ot,
                cliente:       destino,
                articulo_id:   parseInt(item.artId) || null,
                cantidad_usada: item.cantidad,
                serie_id:      (item.serieId && !isNaN(parseInt(item.serieId)))
                               ? parseInt(item.serieId) : null,
                fecha:         new Date().toISOString(),
            };

            const { error: errDesc } = await window.supabase
                .from('registros_instalaciones')
                .insert(payload);

            if (errDesc) throw new Error(
                `Error [${errDesc.code||''}]: ${errDesc.message}`
            );

            // Actualizar stock en bodega
            if (item.tipo === 'seriado' && item.serieId) {
                await window.supabase.from('series')
                    .update({ estado: 'INSTALADO', asignado_a: null })
                    .eq('id', item.serieId);
            }

            if (item.invId) {
                const { data: act } = await window.supabase
                    .from('bodega').select('cantidad')
                    .eq('id', item.invId).maybeSingle();
                const nuevo = Math.max(0, (act?.cantidad || 0) - item.cantidad);
                await window.supabase.from('bodega')
                    .update({
                        cantidad: nuevo,
                        estado:   nuevo <= 0 ? 'instalado' : 'disponible',
                    })
                    .eq('id', item.invId);
            }
        }

        // Éxito
        window._listaDescargo  = [];
        window._misBodegaItems = null;
        _mostrarToastExito(
            `✅ Descargo #${correlativo_descargo} — OT ${esc(ot)} · ${lista.length} material${lista.length!==1?'es':''}`
        );
        setTimeout(() => cargarInstaladas(), 600);

    } catch (err) {
        alert('❌ ' + err.message);
        console.error('PROINTEL — guardarDescargo:', err);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btnTxt; }
    }
}

// ── Notificaciones de validación (alternativa a alert) ───────────────────────
// Muestra un toast rojo 3 segundos. Si falla, cae a alert nativo.
function _notificar(msg) {
    try {
        const t = document.createElement('div');
        t.className = 'toast-error';
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('toast-visible'));
        setTimeout(() => {
            t.classList.remove('toast-visible');
            setTimeout(() => t.remove(), 400);
        }, 3500);
    } catch {
        alert(msg);
    }
}

// ── Toasts ───────────────────────────────────────────────
function _mostrarToastExito(msg) {
    _mostrarToast(msg, 'toast-exito');
}

function _notificar(msg) {
    _mostrarToast(msg, 'toast-error');
}

function _mostrarToast(msg, cls) {
    try {
        // Quitar toast anterior del mismo tipo
        document.querySelectorAll('.' + cls).forEach(t => t.remove());
        const t = document.createElement('div');
        t.className = cls;
        t.textContent = msg;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.classList.add('toast-visible'));
        setTimeout(() => {
            t.classList.remove('toast-visible');
            setTimeout(() => t.remove(), 400);
        }, 3500);
    } catch {
        // Fallback nativo si algo falla
        if (cls === 'toast-error') alert(msg);
    }
}

function toggleTheme() {
    const body    = document.body;
    const actual  = body.getAttribute('data-theme') || 'dark';
    const nuevo   = actual === 'dark' ? 'light' : 'dark';

    body.setAttribute('data-theme', nuevo);
    localStorage.setItem('prointel_theme', nuevo);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.textContent = nuevo === 'dark' ? '🌙' : '☀️';
        // Animación rápida
        btn.style.transform = 'rotate(360deg)';
        setTimeout(() => { btn.style.transform = ''; }, 400);
    }
}

// ════════════════════════════════════════════════════════════
//  UTILIDADES MODALES
// ════════════════════════════════════════════════════════════

/**
 * Detecta si el modal tiene datos ingresados para advertir antes de cerrar.
 * Revisa: inputs con texto, series escaneadas, firma dibujada.
 */
function _modalTieneDatos(id) {
    const el = document.getElementById(id);
    if (!el) return false;

    // Revisar carrito de salida — si tiene artículos, hay datos
    if (id === 'modal-salida' && (window._listaSalida || []).length > 0) return true;

    // Revisar inputs de texto con valor
    const inputs = el.querySelectorAll('input[type="text"], input[type="number"], textarea');
    for (const inp of inputs) {
        if (!inp.readOnly && (inp.value || '').trim().length > 0) return true;
    }

    // Revisar series escaneadas
    if (el.querySelectorAll('.serie-chip').length > 0) return true;

    // Revisar firma dibujada
    const canvas = el.querySelector('#firma-canvas');
    if (canvas) {
        try {
            const ctx = canvas.getContext('2d');
            const px  = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            if (Array.from(px).some(v => v !== 0)) return true;
        } catch { /* canvas vacío o CORS */ }
    }

    return false;
}

/**
 * Cierra un modal. Si tiene datos, pide confirmación primero.
 * @param {string} id — ID del modal
 * @param {boolean} forzar — true = cerrar sin confirmar (ej. tras guardar exitoso)
 */
function cerrarModal(id, forzar = false) {
    if (!forzar && _modalTieneDatos(id)) {
        const confirmar = confirm('¿Seguro que quieres cerrar? Perderas los datos introducidos, series escaneadas y la firma.');
        if (!confirmar) return;
    }
    const el = document.getElementById(id);
    if (el) el.remove();
}

// Solo cierra por clic en backdrop si el modal lo permite explícitamente
function cerrarModalClick(e, id) {
    if (e.target.id === id) cerrarModal(id);
}

// Cerrar modales con tecla Escape — con confirmación si hay datos
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // Buscar el último modal abierto
    const modales = document.querySelectorAll('.modal-overlay');
    if (!modales.length) return;
    const ultimo = modales[modales.length - 1];
    // Solo cerrar si NO es un modal protegido (artículo o salida)
    const protegidos = ['modal-articulo', 'modal-salida', 'modal-instalacion-panel'];
    if (protegidos.includes(ultimo.id)) {
        cerrarModal(ultimo.id); // cerrarModal ya pide confirmación si hay datos
    } else {
        cerrarModal(ultimo.id, true); // Modales sin datos importantes: cerrar directo
    }
});


// ════════════════════════════════════════════════════════════
//  DIAGNÓSTICO DEL SISTEMA — runDiagnostic()
// ════════════════════════════════════════════════════════════

/**
 * Abre el panel de diagnóstico y ejecuta las 4 verificaciones:
 *  1. Conexión a Internet
 *  2. Tablas críticas (usuarios, bodega, facturas)
 *  3. Latencia de Supabase
 *  4. Log de errores con código Postgres
 */
async function runDiagnostic() {
    // ── Crear panel ───────────────────────────────────────
    const existing = document.getElementById('diag-panel');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="diag-panel" onclick="cerrarModalClick(event,'diag-panel')">
            <div class="modal-content diag-modal">
                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">🔬</span>
                        <span>Diagnóstico del Sistema</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('diag-panel')">✕</button>
                </div>

                <div class="diag-meta">
                    <span id="diag-timestamp">Ejecutando…</span>
                    <span class="diag-version">PROINTEL v2.0</span>
                </div>

                <div class="diag-checks" id="diag-checks">
                    <!-- Check 1 -->
                    <div class="diag-row" id="chk-internet">
                        <div class="diag-row-left">
                            <span class="diag-spinner">⏳</span>
                            <span class="diag-label">Conexión a Internet</span>
                        </div>
                        <span class="diag-result"></span>
                    </div>
                    <!-- Check 2a -->
                    <div class="diag-row" id="chk-tabla-usuarios">
                        <div class="diag-row-left">
                            <span class="diag-spinner">⏳</span>
                            <span class="diag-label">Tabla <code>usuarios</code></span>
                        </div>
                        <span class="diag-result"></span>
                    </div>
                    <!-- Check 2b -->
                    <div class="diag-row" id="chk-tabla-bodega">
                        <div class="diag-row-left">
                            <span class="diag-spinner">⏳</span>
                            <span class="diag-label">Tabla <code>bodega</code></span>
                        </div>
                        <span class="diag-result"></span>
                    </div>
                    <!-- Check 2c -->
                    <div class="diag-row" id="chk-tabla-facturas">
                        <div class="diag-row-left">
                            <span class="diag-spinner">⏳</span>
                            <span class="diag-label">Tabla <code>facturas</code></span>
                        </div>
                        <span class="diag-result"></span>
                    </div>
                    <!-- Check 3 -->
                    <div class="diag-row" id="chk-latencia">
                        <div class="diag-row-left">
                            <span class="diag-spinner">⏳</span>
                            <span class="diag-label">Latencia Supabase</span>
                        </div>
                        <span class="diag-result"></span>
                    </div>
                </div>

                <!-- Resumen -->
                <div class="diag-summary hidden" id="diag-summary"></div>

                <!-- Log de errores -->
                <div class="diag-log hidden" id="diag-log">
                    <div class="diag-log-title">📋 Log de Errores</div>
                    <pre id="diag-log-body"></pre>
                </div>

                <div class="modal-foot">
                    <button class="btn-ghost-sm" onclick="cerrarModal('diag-panel')">Cerrar</button>
                    <button class="btn-cyan" onclick="runDiagnostic()">↺ Re-ejecutar</button>
                </div>
            </div>
        </div>`);

    // ── Timestamp ─────────────────────────────────────────
    document.getElementById('diag-timestamp').textContent =
        new Date().toLocaleString('es-SV', {
            weekday:'short', day:'2-digit', month:'short',
            hour:'2-digit', minute:'2-digit', second:'2-digit'
        });

    const errores = [];   // Acumula errores para el log
    let todoOk    = true;

    // ── Helpers de UI ─────────────────────────────────────
    function setCheck(id, estado, texto) {
        const row = document.getElementById(id);
        if (!row) return;
        const iconEl   = row.querySelector('.diag-spinner');
        const resultEl = row.querySelector('.diag-result');
        const icons    = { ok:'✅', error:'❌', warn:'⚠️', info:'ℹ️' };
        if (iconEl)   iconEl.textContent   = icons[estado] || '❓';
        if (resultEl) {
            resultEl.textContent  = texto;
            resultEl.className    = `diag-result diag-${estado}`;
        }
        row.classList.add('diag-done');
    }

    function logError(titulo, codigo, mensaje) {
        todoOk = false;
        errores.push({ titulo, codigo, mensaje, ts: new Date().toISOString() });
    }

    // ══════════════════════════════════════════════════════
    // CHECK 1 — Conexión a Internet
    // ══════════════════════════════════════════════════════
    await new Promise(r => setTimeout(r, 200)); // pequeña pausa visual
    if (navigator.onLine) {
        setCheck('chk-internet', 'ok', 'En línea');
    } else {
        setCheck('chk-internet', 'error', 'Sin conexión a Internet');
        logError('Conexión a Internet', 'NET_OFFLINE',
            'navigator.onLine reporta false. El navegador no tiene salida a red.');
    }

    // ══════════════════════════════════════════════════════
    // CHECK 2 + 3 — Tablas críticas y Latencia
    // ══════════════════════════════════════════════════════
    const TABLAS = [
        { id: 'chk-tabla-usuarios', tabla: 'usuarios',  label: 'usuarios'  },
        { id: 'chk-tabla-bodega',   tabla: 'bodega',    label: 'bodega'    },
        { id: 'chk-tabla-facturas', tabla: 'facturas',  label: 'facturas'  },
    ];

    let latencias    = [];
    let latenciaTotal = 0;

    for (const { id, tabla, label } of TABLAS) {
        await new Promise(r => setTimeout(r, 120)); // pausa visual entre checks

        const t0 = performance.now();

        let data, error;
        try {
            const res = await window.supabase
                .from(tabla)
                .select('id', { count: 'exact', head: true });
            data  = res.data;
            error = res.error;
        } catch (e) {
            error = { message: e.message, code: 'JS_EXCEPTION' };
        }

        const ms = Math.round(performance.now() - t0);
        latencias.push(ms);
        latenciaTotal += ms;

        if (error) {
            // Extraer código Postgres si existe
            const pgCode = error.code || error.hint || 'SIN_CÓDIGO';
            const hint   = error.hint  ? ` | Hint: ${error.hint}` : '';

            setCheck(id, 'error', `Error: Tabla ${label} no encontrada`);
            logError(
                `Tabla crítica: ${label}`,
                pgCode,
                `${error.message}${hint}\n` +
                `Código Postgres: ${pgCode}\n` +
                `Tiempo transcurrido: ${ms} ms`
            );
        } else {
            // Indicador de calidad de latencia
            const calidad = ms < 300 ? '🟢' : ms < 800 ? '🟡' : '🔴';
            setCheck(id, 'ok', `Accesible  ${calidad} ${ms} ms`);
        }
    }

    // ── CHECK 3: Latencia promedio ────────────────────────
    await new Promise(r => setTimeout(r, 100));

    if (latencias.length > 0) {
        const prom  = Math.round(latenciaTotal / latencias.length);
        const max   = Math.max(...latencias);
        const min   = Math.min(...latencias);
        const nivel = prom < 300 ? 'ok' : prom < 800 ? 'warn' : 'error';
        const emoji = prom < 300 ? '🟢 Excelente' : prom < 800 ? '🟡 Aceptable' : '🔴 Lenta';

        setCheck('chk-latencia', nivel,
            `Prom: ${prom} ms  |  Min: ${min} ms  |  Max: ${max} ms  —  ${emoji}`);

        if (prom >= 800) {
            logError('Latencia alta', 'LATENCY_HIGH',
                `Latencia promedio de ${prom} ms supera el umbral recomendado de 800 ms.\n` +
                `Mín: ${min} ms | Máx: ${max} ms\n` +
                `Causa posible: conexión lenta o región Supabase lejana.`);
        }
    } else {
        setCheck('chk-latencia', 'warn', 'No se pudo medir (sin respuesta de tablas)');
    }

    // ══════════════════════════════════════════════════════
    // RESUMEN FINAL
    // ══════════════════════════════════════════════════════
    const sumEl = document.getElementById('diag-summary');
    sumEl.classList.remove('hidden');

    if (todoOk) {
        sumEl.className = 'diag-summary diag-summary-ok';
        sumEl.innerHTML = `
            <span class="sum-icon">✅</span>
            <span><strong>Todo en orden.</strong> El sistema PROINTEL está conectado y todas las tablas son accesibles.</span>`;
    } else {
        sumEl.className = 'diag-summary diag-summary-error';
        sumEl.innerHTML = `
            <span class="sum-icon">⚠️</span>
            <span><strong>${errores.length} problema${errores.length > 1 ? 's' : ''} detectado${errores.length > 1 ? 's' : ''}.</strong> Revisa el log a continuación.</span>`;

        // ── Mostrar log de errores ────────────────────────
        const logEl     = document.getElementById('diag-log');
        const logBodyEl = document.getElementById('diag-log-body');
        logEl.classList.remove('hidden');

        logBodyEl.textContent = errores.map((e, i) => {
            return [
                `── ERROR ${i + 1}: ${e.titulo}`,
                `   Código:    ${e.codigo}`,
                `   Detalle:   ${e.mensaje.replace(/\n/g, '\n             ')}`,
                `   Timestamp: ${e.ts}`,
            ].join('\n');
        }).join('\n\n');
    }
}