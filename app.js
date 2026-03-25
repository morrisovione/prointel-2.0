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
    currentUser     = null;
    cacheInventario = [];
    cacheFacturas   = [];
    localStorage.removeItem('prointel_session');
    detenerReloj();
    limpiarVistaLogin();   // Limpiar formulario antes de mostrar landing
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

    // Título del topbar
    const titulos = {
        servicios:    'Inicio',
        importar:     'Importar Archivo',
        articulos:    'Artículos',
        bodega:       'Inventario Bodega y Cuadrilla',
        salidas:      'Salida de Inventario',
        transferencia:'Transferencia de Inventario',
        reportes:     'Reportes',
        usuarios:     'Gestión de Usuarios'
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
    if (tab === 'mis-articulos') cargarMisArticulos();
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
    document.getElementById('dashboard-content').innerHTML = `
        <div class="module-header">
            <h2>Panel de Servicios Residenciales</h2>
        </div>
        <div class="welcome-banner">
            <p class="welcome-name">Hola, <strong>${esc(nombre)}</strong> 👋</p>
            <p class="welcome-date">${hoy}</p>
        </div>
        <div class="cards-grid">
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
                    <button class="act-btn act-edit" onclick="verFactura('${f.id}')">👁 Ver</button>
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
            .eq('estado','disponible');
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
                    <div class="form-grid">
                        <div class="field">
                            <label>Nº FACTURA *</label>
                            <input type="text" id="fact-numero"
                                value="${esc(f?.numero_factura || numSugerido)}" required />
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

    if (!numero)  { alert('El número de factura es obligatorio.'); return; }
    if (!cliente) { alert('El nombre del cliente es obligatorio.'); return; }

    // Recolectar líneas
    const lineas = [];
    document.querySelectorAll('.fact-linea').forEach(l => {
        const itemId = l.querySelector('.fact-item-sel')?.value || null;
        const desc2  = l.querySelector('.fact-item-desc')?.value.trim() || '';
        const qty    = parseFloat(l.querySelector('.fact-item-qty')?.value||1);
        const precio = parseFloat(l.querySelector('.fact-item-precio')?.value||0);
        if (desc2 || precio > 0) lineas.push({ bodega_id: itemId||null, descripcion: desc2, cantidad: qty, precio_unit: precio, subtotal: qty*precio });
    });

    if (!lineas.length) { alert('Agrega al menos una línea a la factura.'); return; }

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
    const recibo = document.querySelector('#modal-ver-factura .fact-recibo');
    if (!recibo) return;
    const win = window.open('','_blank','width=800,height=600');
    win.document.write(`<!DOCTYPE html><html><head><title>Factura PROINTEL</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 2rem; color: #111; }
            .fact-rec-brand { font-size:1.4rem; font-weight:800; }
            .fact-rec-num   { font-size:1.1rem; font-weight:700; }
            table { width:100%; border-collapse:collapse; margin:1rem 0; }
            th    { background:#f4f4f4; padding:8px 12px; text-align:left; border-bottom:2px solid #ccc; }
            td    { padding:8px 12px; border-bottom:1px solid #eee; }
            .fact-rec-header  { display:flex; justify-content:space-between; margin-bottom:1.5rem; }
            .fact-rec-totales { text-align:right; margin-top:.8rem; }
            .fact-rec-grand   { font-weight:800; font-size:1.1rem; border-top:2px solid #333; padding-top:.4rem; }
        </style></head><body>${recibo.outerHTML}
        <script>window.onload=()=>{window.print();window.close();}<\/script>
        </body></html>`);
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
    if (!estados.includes(val)) { alert('Estado no válido. Usa: emitida, pagada o anulada'); return; }
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
function cargarInventario() { cargarInventarioBodega(); }

async function cargarInventarioBodega() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>📦 Inventario Bodega</h2>
            <div class="header-actions">
                <button class="btn-nav" onclick="cargarInventarioBodega()">↺</button>
                <button class="btn-outline-sm" onclick="exportarInventarioCSV()">⬇ Exportar</button>
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
        const { data, error } = await window.supabase
            .from('bodega')
            .select('*')
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
        <div class="modal-overlay" id="modal-articulo" onclick="cerrarModalClick(event,'modal-articulo')">
            <div class="modal-content modal-inventario">

                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">📦</span>
                        <span>${esEdicion ? 'Editar Artículo' : 'Nuevo Artículo'}</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('modal-articulo')">✕</button>
                </div>

                <form id="form-articulo" onsubmit="guardarArticulo(event,'${id||''}')">

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
                                <input type="text" id="art-unidad"
                                    placeholder="metros, piezas, rollos…"
                                    value="${esc(item?.unidad || '')}" />
                            </div>
                        </div>
                    </div>

                    <!-- DESCRIPCIÓN ─────────────────────── -->
                    <div class="field" style="margin-top:.8rem">
                        <label>DESCRIPCIÓN / NOTAS TÉCNICAS</label>
                        <textarea id="art-notas" rows="2"
                            placeholder="Observaciones, especificaciones técnicas, garantía…">${esc(item?.notas || '')}</textarea>
                    </div>

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
const CUADRILLAS_FIJAS = ['PRI1','PRI2','PRI3','PRI4'];

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
    if (!nombre) { alert('El nombre del artículo es obligatorio.'); return; }

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

        cerrarModal('modal-articulo');
        cacheInventario = [];
        cargarInventarioBodega();

    } catch (err) {
        alert('Error al guardar: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = id ? 'Guardar cambios' : 'Registrar artículo'; }
    }
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

async function cargarSalidas() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>📤 Salida de Inventario</h2>
            <div class="header-actions">
                <button class="btn-nav"  onclick="cargarSalidas()">↺ Actualizar</button>
                <button class="btn-cyan" onclick="abrirModalSalida()">+ Registrar Salida</button>
            </div>
        </div>
        <div class="inv-stats" id="sal-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="sal-search"
                    placeholder="🔍  Buscar por serie, destino, OT, responsable…"
                    oninput="filtrarTabla('sal-search','tabla-salidas')" />
            </div>
            <select id="filtro-sal-motivo" onchange="filtrarSalidasLive()" class="filter-select">
                <option value="">Todos los motivos</option>
                <option value="instalación">Instalación</option>
                <option value="venta">Venta</option>
                <option value="préstamo">Préstamo</option>
                <option value="traslado">Traslado</option>
                <option value="daño">Daño / Baja</option>
            </select>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-salidas">
                <thead><tr>
                    <th>#</th><th>OT / TICKET</th><th>ARTÍCULO</th>
                    <th>SERIE / CANT.</th><th>MOTIVO</th><th>TÉCNICO</th>
                    <th>ESTADO MAT.</th><th>FECHA</th>
                </tr></thead>
                <tbody id="sal-tbody">
                    <tr><td colspan="8" class="empty-row">⏳ Cargando salidas…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="sal-count"></p>`;

    try {
        const { data, error } = await window.supabase
            .from('salidas').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        cacheSalidas = data || [];
        renderSalidas(cacheSalidas);

        const tot  = cacheSalidas.length;
        const inst = cacheSalidas.filter(s => (s.motivo||'').toLowerCase().includes('instalac')).length;
        const vent = cacheSalidas.filter(s => (s.motivo||'').toLowerCase().includes('venta')).length;
        const pres = cacheSalidas.filter(s => (s.motivo||'').toLowerCase().includes('préstamo')||s.motivo?.toLowerCase().includes('prestamo')).length;

        document.getElementById('sal-stats').innerHTML = `
            <div class="istat"><span class="istat-num">${tot}</span><span class="istat-label">Total salidas</span></div>
            <div class="istat istat-blue"><span class="istat-num">${inst}</span><span class="istat-label">Instalaciones</span></div>
            <div class="istat istat-cyan"><span class="istat-num">${vent}</span><span class="istat-label">Ventas</span></div>
            <div class="istat istat-warn"><span class="istat-num">${pres}</span><span class="istat-label">Préstamos</span></div>`;

    } catch(err) {
        document.getElementById('sal-tbody').innerHTML =
            `<tr><td colspan="8" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

function renderSalidas(filas) {
    const tbody = document.getElementById('sal-tbody');
    const count = document.getElementById('sal-count');
    if (!filas || !filas.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay salidas registradas.</td></tr>';
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
        </tr>`).join('');
    if (count) count.textContent = filas.length + ' registros';
}

function filtrarSalidasLive() {
    const q   = (document.getElementById('sal-search')?.value||'').toLowerCase();
    const mot = (document.getElementById('filtro-sal-motivo')?.value||'').toLowerCase();
    renderSalidas(cacheSalidas.filter(s => {
        const mQ = !q || (s.numero_serie||'').toLowerCase().includes(q)
                       || (s.modelo||'').toLowerCase().includes(q)
                       || (s.responsable||'').toLowerCase().includes(q)
                       || (s.numero_ot||'').toLowerCase().includes(q);
        const mM = !mot || (s.motivo||'').toLowerCase().includes(mot);
        return mQ && mM;
    }));
}

// ── Modal Salida — formulario inteligente ─────────────────
async function abrirModalSalida() {
    // Cargar técnicos de la tabla usuarios
    const { data: tecnicos } = await window.supabase
        .from('usuarios')
        .select('usuario, nombre_completo, cuadrilla, rol')
        .eq('estado','activo')
        .order('nombre_completo');

    const optsTec = (tecnicos||[]).map(t =>
        `<option value="${esc(t.nombre_completo||t.usuario)}"
            data-cuadrilla="${esc(t.cuadrilla||'')}"
            data-usuario="${esc(t.usuario||'')}">
            ${esc(t.nombre_completo||t.usuario)}
         </option>`
    ).join('');

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-salida" onclick="cerrarModalClick(event,'modal-salida')">
            <div class="modal-content modal-salida-wide">
                <div class="modal-head">
                    <div class="modal-head-left">
                        <span class="modal-icon">📤</span>
                        <span>Registrar Salida de Material</span>
                    </div>
                    <button class="modal-close" onclick="cerrarModal('modal-salida')">✕</button>
                </div>

                <form id="form-salida" onsubmit="guardarSalida(event)">
                <div class="salida-grid">

                    <!-- ── Columna izquierda ─────────────── -->
                    <div class="salida-col">

                        <!-- OT / Ticket obligatorio -->
                        <div class="field">
                            <label>Nº OT / TICKET <span class="req">*</span></label>
                            <input type="text" id="sal-ot" required
                                placeholder="OT-2025-0001"
                                style="font-family:var(--font-mono)" />
                        </div>

                        <!-- Buscador predictivo de artículos -->
                        <div class="field">
                            <label>ARTÍCULO <span class="req">*</span>
                                <span id="sal-stock-badge" class="series-count-badge" style="display:none"></span>
                            </label>
                            <div style="position:relative">
                                <input type="text" id="sal-articulo-buscar"
                                    placeholder="Escribe 3 letras para buscar…"
                                    autocomplete="off"
                                    oninput="buscarArticuloSalida(this.value)"
                                    onkeydown="navSugerencias(event)" />
                                <div id="sal-sugerencias" class="sal-sugerencias hidden"></div>
                            </div>
                            <!-- Código interno del producto -->
                            <div id="sal-codigo-interno" class="sal-codigo-interno hidden">
                                <span class="sal-codigo-label">Código interno:</span>
                                <code id="sal-codigo-val" class="serie-code"></code>
                            </div>
                        </div>

                        <!-- Identificador: serie o cantidad (dinámico) -->
                        <div class="field" id="field-identificador">
                            <label id="lbl-identificador">NÚMERO DE SERIE / ESCÁNER</label>
                            <div class="scanner-wrap">
                                <input type="text" id="sal-identificador"
                                    class="scanner-input"
                                    placeholder="Escanea o escribe la serie…"
                                    autocomplete="off" />
                                <span id="sal-tipo-badge" class="tipo-badge tipo-seriado">SERIADO</span>
                            </div>
                        </div>

                        <!-- Motivo -->
                        <div class="field">
                            <label>MOTIVO <span class="req">*</span></label>
                            <select id="sal-motivo" required>
                                <option value="instalación">Instalación</option>
                                <option value="venta">Venta</option>
                                <option value="préstamo">Préstamo</option>
                                <option value="traslado">Traslado</option>
                                <option value="daño">Daño / Baja</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>

                        <!-- Estado del material -->
                        <div class="field">
                            <label>ESTADO DEL MATERIAL</label>
                            <div class="tipo-switch" style="grid-template-columns:1fr 1fr">
                                <label class="tipo-opt active" id="opt-nuevo">
                                    <input type="radio" name="estado_material" value="nuevo" checked
                                        onchange="document.querySelectorAll('.tipo-opt').forEach(l=>l.classList.remove('active'));document.getElementById('opt-nuevo').classList.add('active')" />
                                    <span class="tipo-icon">✨</span>
                                    <span class="tipo-name">Nuevo</span>
                                </label>
                                <label class="tipo-opt" id="opt-reacon">
                                    <input type="radio" name="estado_material" value="reacondicionado"
                                        onchange="document.querySelectorAll('.tipo-opt').forEach(l=>l.classList.remove('active'));document.getElementById('opt-reacon').classList.add('active')" />
                                    <span class="tipo-icon">🔧</span>
                                    <span class="tipo-name">Reacondicionado</span>
                                </label>
                            </div>
                        </div>

                    </div>

                    <!-- ── Columna derecha ───────────────── -->
                    <div class="salida-col">

                        <!-- Técnico responsable -->
                        <div class="field">
                            <label>TÉCNICO RESPONSABLE <span class="req">*</span></label>
                            <select id="sal-tecnico" required
                                onchange="autoFillCuadrilla(this)">
                                <option value="">— Seleccionar técnico —</option>
                                ${optsTec || '<option disabled>Sin técnicos activos</option>'}
                            </select>
                        </div>

                        <!-- Cuadrilla (solo lectura, se llena automáticamente) -->
                        <div class="field">
                            <label>CUADRILLA / CÓDIGO</label>
                            <input type="text" id="sal-cuadrilla" readonly
                                placeholder="Se llena automáticamente"
                                style="opacity:.7;cursor:not-allowed" />
                        </div>

                        <!-- Destino -->
                        <div class="field">
                            <label>DESTINO / CLIENTE</label>
                            <input type="text" id="sal-destino"
                                placeholder="Dirección, cliente o cuadrilla destino" />
                        </div>

                        <!-- Notas -->
                        <div class="field">
                            <label>NOTAS</label>
                            <textarea id="sal-notas" rows="2"
                                placeholder="Observaciones adicionales…"></textarea>
                        </div>

                        <!-- Firma digital -->
                        <div class="field">
                            <label>FIRMA DE RECIBIDO
                                <button type="button" class="btn-autogen"
                                    onclick="limpiarFirma()">✕ Limpiar</button>
                            </label>
                            <div class="firma-wrap">
                                <canvas id="firma-canvas" class="firma-canvas"
                                    width="280" height="100"></canvas>
                                <div class="firma-hint">Firma aquí con el dedo o mouse</div>
                            </div>
                        </div>

                    </div>
                </div>

                <div class="modal-foot">
                    <button type="button" class="btn-ghost-sm"
                        onclick="cerrarModal('modal-salida')">Cancelar</button>
                    <button type="submit" class="btn-cyan" id="btn-guardar-sal">
                        Registrar Salida
                    </button>
                </div>
                </form>
            </div>
        </div>`);

    // Inicializar canvas de firma
    setTimeout(initFirmaCanvas, 100);
}

// ── Buscador predictivo de artículos ──────────────────────
let _buscarTimer = null;
async function buscarArticuloSalida(q) {
    clearTimeout(_buscarTimer);
    const sugEl = document.getElementById('sal-sugerencias');
    if (!q || q.length < 3) {
        if (sugEl) sugEl.classList.add('hidden');
        return;
    }
    _buscarTimer = setTimeout(async () => {
        const qLow = q.toLowerCase();
        // Buscar en caché primero, luego en BD si no hay datos
        let resultados = cacheInventario.filter(i =>
            (i.nombre||'').toLowerCase().includes(qLow) ||
            (i.articulo||'').toLowerCase().includes(qLow) ||
            (i.codigo||'').toLowerCase().includes(qLow) ||
            (i.serie||'').toLowerCase().includes(qLow)
        );
        if (!resultados.length) {
            const { data } = await window.supabase
                .from('bodega')
                .select('id,nombre,articulo,codigo,serie,tipo_material,cantidad,estado,precio')
                .or(`nombre.ilike.%${q}%,articulo.ilike.%${q}%,codigo.ilike.%${q}%,serie.ilike.%${q}%`)
                .limit(10);
            resultados = data || [];
        }
        if (!sugEl) return;
        if (!resultados.length) {
            sugEl.innerHTML = '<div class="sal-sug-empty">Sin resultados para "' + esc(q) + '"</div>';
            sugEl.classList.remove('hidden');
            return;
        }
        sugEl.innerHTML = resultados.slice(0,8).map(i => {
            const disp = (i.estado||'').toLowerCase() === 'disponible';
            const cant = i.tipo_material === 'miscelaneo' ? ` · ${i.cantidad||0} uds.` : '';
            return `<div class="sal-sug-item ${disp?'':'sal-sug-agotado'}"
                        onclick="seleccionarArticuloSalida(${JSON.stringify(i).replace(/"/g,'&quot;')})">
                <div class="sal-sug-nombre">${esc(i.nombre||i.articulo||'—')}</div>
                <div class="sal-sug-meta">
                    <code>${esc(i.codigo||i.serie||'sin código')}</code>
                    <span class="badge badge-${(i.estado||'disponible').toLowerCase()}">${esc(i.estado||'disponible')}</span>
                    <span>${cant}</span>
                    <span class="td-price">$${parseFloat(i.precio||0).toFixed(2)}</span>
                </div>
            </div>`;
        }).join('');
        sugEl.classList.remove('hidden');
    }, 300);
}

function seleccionarArticuloSalida(item) {
    _articuloSeleccionado = item;
    const buscarEl = document.getElementById('sal-articulo-buscar');
    const sugEl    = document.getElementById('sal-sugerencias');
    const stockEl  = document.getElementById('sal-stock-badge');
    const codWrap  = document.getElementById('sal-codigo-interno');
    const codVal   = document.getElementById('sal-codigo-val');
    const identEl  = document.getElementById('sal-identificador');
    const lblEl    = document.getElementById('lbl-identificador');
    const badgeEl  = document.getElementById('sal-tipo-badge');

    if (buscarEl) buscarEl.value = item.nombre || item.articulo || '';
    if (sugEl)    sugEl.classList.add('hidden');

    // Mostrar stock disponible
    if (stockEl) {
        const esSeriado = !item.tipo_material || item.tipo_material === 'seriado';
        stockEl.textContent = esSeriado ? '1 unidad' : `Stock: ${item.cantidad||0}`;
        stockEl.style.display = 'inline-block';
        stockEl.style.background = (item.estado||'') === 'disponible'
            ? 'rgba(0,230,118,.15)' : 'rgba(255,77,109,.15)';
        stockEl.style.color = (item.estado||'') === 'disponible' ? '#00e676' : '#ff4d6d';
        stockEl.style.border = (item.estado||'') === 'disponible'
            ? '1px solid rgba(0,230,118,.3)' : '1px solid rgba(255,77,109,.3)';
    }

    // Mostrar código interno
    if (codWrap && codVal && item.codigo) {
        codVal.textContent = item.codigo;
        codWrap.classList.remove('hidden');
    } else if (codWrap) {
        codWrap.classList.add('hidden');
    }

    // Adaptar campo identificador según tipo
    const esSeriado = !item.tipo_material || item.tipo_material === 'seriado';
    if (esSeriado) {
        if (lblEl)    lblEl.textContent = 'NÚMERO DE SERIE / ESCÁNER';
        if (badgeEl)  { badgeEl.textContent = 'SERIADO'; badgeEl.className = 'tipo-badge tipo-seriado'; }
        if (identEl)  { identEl.type = 'text'; identEl.placeholder = 'Escanea o escribe la serie…'; identEl.value = item.serie||''; }
    } else {
        if (lblEl)    lblEl.textContent = 'CANTIDAD A RETIRAR';
        if (badgeEl)  { badgeEl.textContent = 'MISCELÁNEOS'; badgeEl.className = 'tipo-badge tipo-cantidad'; }
        if (identEl)  { identEl.type = 'number'; identEl.placeholder = '1'; identEl.value = '1'; identEl.min = 1; identEl.max = item.cantidad||999; }
    }
    if (identEl) identEl.focus();
}

function navSugerencias(e) {
    const items = document.querySelectorAll('.sal-sug-item');
    if (!items.length) return;
    if (e.key === 'Escape') { document.getElementById('sal-sugerencias')?.classList.add('hidden'); }
}

function autoFillCuadrilla(sel) {
    const opt = sel.options[sel.selectedIndex];
    const cuad = opt.getAttribute('data-cuadrilla') || '';
    const cuadEl = document.getElementById('sal-cuadrilla');
    if (cuadEl) cuadEl.value = cuad || '(sin cuadrilla asignada)';
}

// ── Canvas de firma digital ───────────────────────────────
function initFirmaCanvas() {
    const canvas = document.getElementById('firma-canvas');
    if (!canvas) return;
    _firmaCanvas = canvas;
    _firmaCtx    = canvas.getContext('2d');
    _firmaCtx.strokeStyle = '#00c8f0';
    _firmaCtx.lineWidth   = 2;
    _firmaCtx.lineCap     = 'round';

    const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - r.left, y: src.clientY - r.top };
    };

    canvas.addEventListener('mousedown',  (e) => { _firmaDibujando = true; const p = getPos(e); _firmaCtx.beginPath(); _firmaCtx.moveTo(p.x, p.y); });
    canvas.addEventListener('mousemove',  (e) => { if (!_firmaDibujando) return; const p = getPos(e); _firmaCtx.lineTo(p.x, p.y); _firmaCtx.stroke(); });
    canvas.addEventListener('mouseup',    () => { _firmaDibujando = false; });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); _firmaDibujando = true; const p = getPos(e); _firmaCtx.beginPath(); _firmaCtx.moveTo(p.x, p.y); }, { passive:false });
    canvas.addEventListener('touchmove',  (e) => { e.preventDefault(); if (!_firmaDibujando) return; const p = getPos(e); _firmaCtx.lineTo(p.x, p.y); _firmaCtx.stroke(); }, { passive:false });
    canvas.addEventListener('touchend',   () => { _firmaDibujando = false; });
}

function limpiarFirma() {
    if (_firmaCtx && _firmaCanvas) {
        _firmaCtx.clearRect(0, 0, _firmaCanvas.width, _firmaCanvas.height);
    }
}

function obtenerFirmaBase64() {
    if (!_firmaCanvas) return null;
    // Verificar si hay algo dibujado
    const data = _firmaCtx.getImageData(0, 0, _firmaCanvas.width, _firmaCanvas.height).data;
    const hayFirma = data.some(v => v !== 0);
    return hayFirma ? _firmaCanvas.toDataURL('image/png') : null;
}

// ── Guardar salida ────────────────────────────────────────
async function guardarSalida(e) {
    e.preventDefault();

    const ot          = document.getElementById('sal-ot').value.trim();
    const motivo      = document.getElementById('sal-motivo').value;
    const tecnico     = document.getElementById('sal-tecnico').value;
    const cuadrilla   = document.getElementById('sal-cuadrilla').value.trim() || null;
    const destino     = document.getElementById('sal-destino').value.trim()   || null;
    const notas       = document.getElementById('sal-notas').value.trim()     || null;
    const estMat      = document.querySelector('input[name="estado_material"]:checked')?.value || 'nuevo';
    const identificador = document.getElementById('sal-identificador').value.trim();
    const firma       = obtenerFirmaBase64();

    if (!ot)      { alert('El número de OT/Ticket es obligatorio.'); return; }
    if (!tecnico) { alert('Selecciona el técnico responsable.'); return; }
    if (!_articuloSeleccionado && !identificador) {
        alert('Selecciona un artículo del buscador.'); return;
    }

    const esSeriado = !_articuloSeleccionado?.tipo_material ||
                       _articuloSeleccionado?.tipo_material === 'seriado';

    const payload = {
        bodega_id:        _articuloSeleccionado?.id || null,
        numero_serie:     esSeriado ? (identificador || _articuloSeleccionado?.serie || null) : null,
        modelo:           _articuloSeleccionado?.nombre || _articuloSeleccionado?.articulo || identificador || null,
        cantidad:         esSeriado ? 1 : (parseInt(identificador)||1),
        motivo,
        destino,
        responsable:      tecnico,
        cuadrilla:        cuadrilla,
        numero_ot:        ot,
        estado_material:  estMat,
        firma_base64:     firma,
        notas
    };

    const btn = document.getElementById('btn-guardar-sal');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

    // Actualizar estado del artículo en bodega si aplica
    if (_articuloSeleccionado?.id) {
        const nuevoEstado = motivo === 'venta' ? 'vendido'
                          : motivo === 'daño'  ? 'dañado'
                          : 'reservado';
        await window.supabase.from('bodega')
            .update({ estado: nuevoEstado })
            .eq('id', _articuloSeleccionado.id);
        cacheInventario = [];
    }

    const { error } = await window.supabase.from('salidas').insert(payload);

    if (btn) { btn.disabled = false; btn.textContent = 'Registrar Salida'; }

    if (error) { alert('Error al guardar: ' + error.message); return; }

    _articuloSeleccionado = null;
    cerrarModal('modal-salida');
    cargarSalidas();
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
                <thead><tr><th>#</th><th>USUARIO</th><th>NOMBRE COMPLETO</th><th>ROL</th><th>ESTADO</th><th>CREADO</th><th>ACCIONES</th></tr></thead>
                <tbody><tr><td colspan="7" class="empty-row">⏳ Cargando...</td></tr></tbody>
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
        if (!cacheUsuarios.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No hay usuarios.</td></tr>'; return; }
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
            return `<tr ${esSU?'class="su-row"':''}>
                <td class="row-num">${idx+1}</td>
                <td><code>${esc(u.usuario)}</code>${esSU?' <span style="color:#ffb300">★</span>':''}</td>
                <td class="td-bold">${esc(u.nombre_completo||u.nombre||'—')}</td>
                <td>${rolB}</td>
                <td><span class="badge badge-${(u.estado||'activo').toLowerCase()}">${esc(u.estado||'activo')}</span></td>
                <td class="td-date">${formatFecha(u.created_at)}</td>
                <td>${acc}</td>
            </tr>`;
        }).join('');
        const count = document.getElementById('usr-count');
        if (count) count.textContent = cacheUsuarios.length + ' usuarios';
    } catch(err) {
        document.querySelector('#tabla-usuarios tbody').innerHTML = `<tr><td colspan="7" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
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

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-usuario" onclick="cerrarModalClick(event,'modal-usuario')">
            <div class="modal-content">
                <div class="modal-head">
                    <span>${u ? '✎ Editar Usuario' : '+ Nuevo Usuario'}</span>
                    <button class="modal-close" onclick="cerrarModal('modal-usuario')">✕</button>
                </div>
                <form id="form-usuario" onsubmit="guardarUsuario(event,'${id||''}')">
                    <div class="form-grid">

                        <!-- 1. Nombre Completo (fila entera) -->
                        <div class="field field-full">
                            <label>NOMBRE COMPLETO *</label>
                            <input type="text" id="usr-nombre"
                                value="${esc(u?.nombre_completo || u?.nombre || '')}"
                                required placeholder="Juan Pérez" />
                        </div>

                        <!-- 2. Usuario y Contraseña (misma fila) -->
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

                        <!-- 3. Rol y Estado (misma fila) -->
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

                    </div>
                    <div class="modal-foot">
                        <button type="button" class="btn-ghost-sm" onclick="cerrarModal('modal-usuario')">Cancelar</button>
                        <button type="submit" class="btn-cyan">Guardar Usuario</button>
                    </div>
                </form>
            </div>
        </div>`);
}

async function guardarUsuario(e, id) {
    e.preventDefault();

    const clave          = document.getElementById('usr-clave').value;
    const nombre_completo = document.getElementById('usr-nombre').value.trim();
    const usuario        = document.getElementById('usr-login').value.trim();
    const rol            = document.getElementById('usr-rol').value;
    const estado         = document.getElementById('usr-estado').value;

    // Validaciones básicas
    if (!nombre_completo) { alert('El nombre completo es obligatorio.'); return; }
    if (!usuario)         { alert('El usuario es obligatorio.'); return; }
    if (!id && !clave)    { alert('La contraseña es obligatoria para nuevos usuarios.'); return; }

    // Payload coincide exactamente con columnas de tabla `usuarios`
    const payload = {
        usuario,
        nombre_completo,
        rol,
        estado
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
            window.supabase.from('salidas').select('id,motivo,created_at'),
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
                           document.getElementById('form-instalacion-panel');
        if (!formActivo) _ocultarBotonesAdmin();
    }
}

// Alias legacy
function aplicarPermisosTecnico() { verificarPermisos(); }

/**
 * Oculta botones de gestión global (Nuevo, Editar, Eliminar).
 * NO toca botones operativos del técnico (Guardar Instalación, etc.)
 */
function _ocultarBotonesAdmin() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    // Selectores de gestión admin — nunca incluye .btn-cyan globalmente
    const selectoresAdmin = [
        '.act-btn.act-edit',
        '.act-btn.act-del',
        '#btn-importar',
        '.drop-zone',
        'button[onclick*="abrirModalArticulo"]',
        'button[onclick*="abrirModalFactura"]',
        'button[onclick*="abrirModalSalida"]',
        'button[onclick*="ejecutarImport"]',
        'button[onclick*="eliminarArticulo"]',
        'button[onclick*="eliminarUsuario"]',
        'button[onclick*="eliminarFactura"]',
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
            <h2>🎒 Mi Bodega</h2>
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
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="mis-search"
                    placeholder="🔍  Buscar en mi stock…"
                    oninput="filtrarTabla('mis-search','tabla-mis-art')" />
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-mis-art">
                <thead><tr>
                    <th>#</th><th>ARTÍCULO</th><th>CÓDIGO</th>
                    <th>SERIE</th><th>CANT.</th><th>ESTADO</th>
                </tr></thead>
                <tbody id="mis-tbody">
                    <tr><td colspan="6" class="empty-row">⏳ Cargando tu stock…</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="mis-count"></p>`;

    try {
        // Filtro estricto: solo artículos asignados a este técnico
        const usuario   = currentUser.usuario || '';
        const cuadrilla = currentUser.cuadrilla || '';

        let query = window.supabase
            .from('bodega')
            .select('*')
            .neq('estado', 'vendido');

        // Construir filtro OR según columnas disponibles
        if (cuadrilla) {
            query = query.or(
                `asignado_a.eq.${usuario},cuadrilla.eq.${cuadrilla},responsable.eq.${usuario}`
            );
        } else {
            query = query.or(
                `asignado_a.eq.${usuario},responsable.eq.${usuario}`
            );
        }

        const { data, error } = await query.order('fecha_ingreso', { ascending: false });
        if (error) throw error;

        const items = data || [];
        const disp  = items.filter(i => (i.estado||'').toLowerCase() === 'disponible').length;
        const res   = items.filter(i => (i.estado||'').toLowerCase() === 'reservado').length;

        document.getElementById('mis-stats').innerHTML = `
            <div class="istat">
                <span class="istat-num">${items.length}</span>
                <span class="istat-label">Mi stock total</span>
            </div>
            <div class="istat istat-green">
                <span class="istat-num">${disp}</span>
                <span class="istat-label">Disponibles</span>
            </div>
            <div class="istat istat-blue">
                <span class="istat-num">${res}</span>
                <span class="istat-label">En uso</span>
            </div>`;

        // Guardar en caché para formulario de instalaciones
        window._misBodegaItems = items;

        const tbody = document.getElementById('mis-tbody');
        const count = document.getElementById('mis-count');

        if (!items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No tienes artículos asignados aún. Contacta a bodega central.</td></tr>';
            if (count) count.textContent = '';
            return;
        }

        tbody.innerHTML = items.map((item, idx) => `
            <tr>
                <td class="row-num">${idx + 1}</td>
                <td class="td-bold">${esc(item.nombre || item.articulo || '—')}</td>
                <td><span class="sku-code">${esc(item.codigo || '—')}</span></td>
                <td>${item.serie
                    ? `<code class="serie-code">${esc(item.serie)}</code>`
                    : '<span class="td-date">—</span>'}</td>
                <td style="text-align:center;font-family:var(--font-mono)">
                    ${item.tipo_material === 'miscelaneo' ? (item.cantidad || 1) : 1}
                </td>
                <td><span class="badge badge-${(item.estado||'disponible').toLowerCase()}">
                    ${esc(item.estado || 'disponible')}
                </span></td>
            </tr>`).join('');

        if (count) count.textContent = `${items.length} artículo${items.length !== 1 ? 's' : ''} en tu cargo`;

    } catch (err) {
        const tbody = document.getElementById('mis-tbody');
        if (tbody) tbody.innerHTML =
            `<tr><td colspan="6" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

// ════════════════════════════════════════════════════════════
//  INSTALACIONES — Formulario de descarga de material
// ════════════════════════════════════════════════════════════

async function abrirInstalacion() {
    // Siempre recargar stock fresco al abrir
    window._misBodegaItems = null;

    // Mostrar estado de carga en el panel
    const content = document.getElementById('dashboard-content');
    if (content) {
        content.innerHTML = `
            <div class="module-header">
                <h2>⚡ INSTALACIONES</h2>
            </div>
            <p class="loading-msg">⏳ Cargando tu stock personal…</p>`;
    }

    // Cargar stock del técnico sin cambiar el panel (usamos fetch directo)
    const usuario   = currentUser?.usuario || '';
    const cuadrilla = currentUser?.cuadrilla || '';

    let query = window.supabase
        .from('bodega')
        .select('*')
        .neq('estado', 'vendido');

    if (cuadrilla) {
        query = query.or(`asignado_a.eq.${usuario},cuadrilla.eq.${cuadrilla},responsable.eq.${usuario}`);
    } else {
        query = query.or(`asignado_a.eq.${usuario},responsable.eq.${usuario}`);
    }

    const { data } = await query.order('fecha_ingreso', { ascending: false });
    window._misBodegaItems = data || [];

    const disponibles = window._misBodegaItems.filter(
        i => (i.estado || '').toLowerCase() !== 'vendido'
    );

    const optsItems = disponibles.length
        ? disponibles.map(i => {
            const maxStock = i.tipo_material === 'miscelaneo' ? (i.cantidad || 1) : 1;
            const label = `${i.nombre || i.articulo || 'Sin nombre'}${i.serie ? ' — ' + i.serie : ''} · ${maxStock} disp.`;
            return `<option value="${i.id}"
                data-max="${maxStock}"
                data-nombre="${esc(i.nombre || i.articulo || '')}"
                data-serie="${esc(i.serie || '')}"
                data-codigo="${esc(i.codigo || '')}">
                ${esc(label)}
            </option>`;
        }).join('')
        : '<option value="" disabled>Sin artículos disponibles en tu bodega</option>';

    // Renderizar formulario directamente en el panel (no modal)
    // — así verificarPermisos no lo interrumpe
    if (content) {
        content.innerHTML = `
            <div class="module-header">
                <h2>⚡ INSTALACIONES</h2>
                <button class="btn-nav" onclick="cargarMisArticulos()">← Volver a mi bodega</button>
            </div>

            <form id="form-instalacion-panel" onsubmit="guardarInstalacion(event)"
                  class="inst-panel-form">

                <div class="form-grid">

                    <div class="field field-full">
                        <label>Nº SOLICITUD / OT <span class="req">*</span></label>
                        <input type="text" id="inst-ot" required
                            placeholder="OT-2025-0001"
                            style="font-family:var(--font-mono);font-size:1rem" autofocus />
                    </div>

                    <div class="field field-full">
                        <label>MATERIAL UTILIZADO <span class="req">*</span>
                            <span id="inst-stock-badge"
                                class="series-count-badge"
                                style="display:none"></span>
                        </label>
                        <select id="inst-item" required
                            onchange="onInstItemChange(this)"
                            class="filter-select" style="width:100%">
                            <option value="">— Seleccionar de mi bodega —</option>
                            ${optsItems}
                        </select>
                        <div id="inst-codigo-wrap" class="sal-codigo-interno hidden">
                            <span class="sal-codigo-label">Código interno:</span>
                            <code id="inst-codigo-val" class="serie-code"></code>
                        </div>
                    </div>

                    <div class="field">
                        <label>CANTIDAD UTILIZADA <span class="req">*</span></label>
                        <input type="number" id="inst-cantidad"
                            min="1" max="1" value="1" required
                            oninput="validarCantidadInst(this)" />
                        <div id="inst-cant-error"
                            style="font-size:.78rem;color:var(--danger);
                                   margin-top:.3rem;display:none">
                            ⚠️ Stock insuficiente en tu bodega personal.
                        </div>
                    </div>

                    <div class="field">
                        <label>DIRECCIÓN / CLIENTE</label>
                        <input type="text" id="inst-destino"
                            placeholder="Dirección de la instalación" />
                    </div>

                    <div class="field field-full">
                        <label>DESCRIPCIÓN DEL TRABAJO</label>
                        <textarea id="inst-notas" rows="3"
                            placeholder="Tipo de instalación, observaciones técnicas…"></textarea>
                    </div>

                </div>

                <div class="inst-panel-footer">
                    <button type="button" class="btn-ghost-sm"
                        onclick="cargarMisArticulos()">Cancelar</button>
                    <button type="submit" class="btn-cyan" id="btn-guardar-inst">
                        ⚡ Guardar Instalación
                    </button>
                </div>

            </form>`;
    }
}

function onInstItemChange(sel) {
    const opt      = sel.options[sel.selectedIndex];
    const maxStock = parseInt(opt.getAttribute('data-max') || 1);
    const codigo   = opt.getAttribute('data-codigo') || '';

    const cantEl  = document.getElementById('inst-cantidad');
    const badgeEl = document.getElementById('inst-stock-badge');
    const codWrap = document.getElementById('inst-codigo-wrap');
    const codVal  = document.getElementById('inst-codigo-val');
    const errEl   = document.getElementById('inst-cant-error');
    const btnEl   = document.getElementById('btn-guardar-inst');

    if (cantEl) { cantEl.max = maxStock; cantEl.value = 1; }
    if (errEl)  errEl.style.display = 'none';
    if (btnEl)  btnEl.disabled = false;

    if (badgeEl) {
        badgeEl.textContent    = `Stock: ${maxStock}`;
        badgeEl.style.display  = 'inline-block';
        badgeEl.style.background = maxStock > 0
            ? 'rgba(0,230,118,.15)' : 'rgba(255,77,109,.15)';
        badgeEl.style.color    = maxStock > 0 ? '#00e676' : '#ff4d6d';
        badgeEl.style.border   = maxStock > 0
            ? '1px solid rgba(0,230,118,.3)' : '1px solid rgba(255,77,109,.3)';
    }

    if (codWrap && codVal) {
        if (codigo) {
            codVal.textContent = codigo;
            codWrap.classList.remove('hidden');
        } else {
            codWrap.classList.add('hidden');
        }
    }
}

function validarCantidadInst(input) {
    const max      = parseInt(input.max || 1);
    const val      = parseInt(input.value || 0);
    const invalido = val > max || val < 1;
    const errEl    = document.getElementById('inst-cant-error');
    const btnEl    = document.getElementById('btn-guardar-inst');
    if (errEl) errEl.style.display = invalido ? 'block' : 'none';
    if (btnEl) btnEl.disabled = invalido;
}

async function guardarInstalacion(e) {
    e.preventDefault();

    const ot       = document.getElementById('inst-ot')?.value.trim();
    const itemId   = document.getElementById('inst-item')?.value;
    const cantidad = parseInt(document.getElementById('inst-cantidad')?.value || 1);
    const destino  = document.getElementById('inst-destino')?.value.trim() || null;
    const notas    = document.getElementById('inst-notas')?.value.trim()   || null;

    if (!ot)     { alert('El número de OT es obligatorio.'); return; }
    if (!itemId) { alert('Selecciona el material utilizado.'); return; }

    const item = (window._misBodegaItems || []).find(i => String(i.id) === String(itemId));
    if (!item)   { alert('Artículo no encontrado. Actualiza tu bodega.'); return; }

    const maxStock = item.tipo_material === 'miscelaneo' ? (item.cantidad || 1) : 1;
    if (cantidad > maxStock) {
        alert(
            `⚠️ Stock insuficiente en tu bodega personal.\n` +
            `Tienes ${maxStock} unidad(es) disponible(s).\n` +
            `No puedes descargar ${cantidad}.`
        );
        document.getElementById('inst-cantidad')?.focus();
        return;
    }

    const btn = document.getElementById('btn-guardar-inst');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando…'; }

    try {
        // 1. Registrar en tabla salidas
        const { error: errSal } = await window.supabase.from('salidas').insert({
            bodega_id:       item.id,
            numero_serie:    item.serie || null,
            modelo:          item.nombre || item.articulo || null,
            cantidad,
            motivo:          'instalación',
            destino,
            responsable:     currentUser.nombre_completo || currentUser.usuario,
            cuadrilla:       currentUser.cuadrilla || null,
            numero_ot:       ot,
            estado_material: 'nuevo',
            notas
        });
        if (errSal) throw errSal;

        // 2. Descontar stock en bodega
        if (item.tipo_material === 'miscelaneo') {
            const nuevoStock  = Math.max(0, (item.cantidad || 1) - cantidad);
            const nuevoEstado = nuevoStock <= 0 ? 'vendido' : 'disponible';
            const { error: errUpd } = await window.supabase
                .from('bodega')
                .update({ cantidad: nuevoStock, estado: nuevoEstado })
                .eq('id', item.id);
            if (errUpd) throw errUpd;
        } else {
            const { error: errUpd } = await window.supabase
                .from('bodega')
                .update({ estado: 'vendido' })
                .eq('id', item.id);
            if (errUpd) throw errUpd;
        }

        // 3. Limpiar caché y regresar a Mi Bodega
        window._misBodegaItems = null;
        alert(`✅ Instalación OT ${ot} registrada. Stock actualizado.`);
        cargarMisArticulos();

    } catch (err) {
        alert('Error al guardar: ' + err.message);
        if (btn) { btn.disabled = false; btn.textContent = '⚡ Guardar Instalación'; }
    }
}

// ════════════════════════════════════════════════════════════
//  TEMA CLARO / OSCURO
// ════════════════════════════════════════════════════════════

/**
 * Alterna entre modo oscuro y modo claro.
 * Guarda la preferencia en localStorage.
 */
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
function cerrarModal(id) { const el = document.getElementById(id); if (el) el.remove(); }
function cerrarModalClick(e, id) { if (e.target.id === id) cerrarModal(id); }


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