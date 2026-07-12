// ══════════════════════════════════════════════
//  PROINTEL 2.0 — app.js  (versión limpia)
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

    const form = document.getElementById('login-form');
    if (form) {
        form.addEventListener('submit', handleLogin);
    } else {
        console.error('PROINTEL — No se encontró #login-form en el DOM');
    }

    // ── Cargar datos guardados en localStorage ────────────
    cargarDatosRecordados();

    showSection('view-landing');
});

// ── Navegación ────────────────────────────────
function showSection(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
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
        const { data, error } = await window.supabase
            .from('usuarios')
            .select('*');

        if (error) {
            console.error('PROINTEL — Error Supabase:', error);
            errorEl.textContent = 'Error de conexión: ' + error.message;
            return;
        }

        console.log('PROINTEL — Filas recibidas:', data ? data.length : 0);
        if (data && data.length > 0) {
            console.log('PROINTEL — Columnas:', Object.keys(data[0]));
        }

        if (!data || data.length === 0) {
            errorEl.textContent = '⚠ Tabla vacía. Verifica que existan usuarios en Supabase.';
            return;
        }

        // Detectar nombres de columna automáticamente
        const cols      = Object.keys(data[0]);
        const colUser   = ['usuario','user','username','login'].find(c => cols.includes(c));
        const colPass   = ['clave','contraseña','contrasena','password','pass','contra'].find(c => cols.includes(c));

        console.log('PROINTEL — Columna usuario:', colUser, '| Columna clave:', colPass);

        if (!colUser || !colPass) {
            errorEl.textContent = 'Columnas no reconocidas: ' + cols.join(', ');
            return;
        }

        const encontrado = data.find(u =>
            String(u[colUser] ?? '').trim() === usuario &&
            String(u[colPass] ?? '').trim() === clave
        );

        if (!encontrado) {
            console.warn('PROINTEL — No coincide. Usuarios en BD:',
                data.map(u => u[colUser]));
            errorEl.textContent = '⚠ Usuario o contraseña incorrectos.';
            return;
        }

        // ── Éxito ──
        currentUser = encontrado;
        const nombre = encontrado.nombre_completo || encontrado.nombre || encontrado.usuario || 'Usuario';
        const userEl = document.getElementById('user-display');
        if (userEl) userEl.textContent = nombre;

        // ── Guardar en localStorage ───────────────────────
        guardarDatosRecordados(usuario, clave);

        showSection('view-dashboard');
        iniciarReloj();
        aplicarPermisosTecnico(); // Restringe UI si el rol es Técnico
        changeTab('servicios');

    } catch (err) {
        console.error('PROINTEL — Excepción:', err);
        errorEl.textContent = 'Error inesperado: ' + err.message;
    } finally {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'INGRESAR';
    }
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
 * Al cargar la página: rellena los campos con los datos guardados.
 */
function cargarDatosRecordados() {
    const usuarioGuardado  = localStorage.getItem(LS_USUARIO);
    const claveGuardada    = localStorage.getItem(LS_CLAVE);
    const recordarGuardado = localStorage.getItem(LS_RECORDAR);

    const campoUsuario = document.getElementById('login-user');
    const campoClave   = document.getElementById('login-pass');
    const chkRecordar  = document.getElementById('chk-recordar');

    if (campoUsuario && usuarioGuardado) {
        campoUsuario.value = usuarioGuardado;
    }

    if (recordarGuardado === '1' && claveGuardada) {
        try {
            if (campoClave) campoClave.value = decodeURIComponent(escape(atob(claveGuardada)));
            if (chkRecordar) chkRecordar.checked = true;
        } catch (e) {
            // Si la clave guardada está corrupta, la borramos
            localStorage.removeItem(LS_CLAVE);
            localStorage.removeItem(LS_RECORDAR);
        }
    }
}

// ── Logout ────────────────────────────────────
function logout() {
    currentUser     = null;
    cacheInventario = [];
    cacheFacturas   = [];
    detenerReloj();
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
    if (tab === 'bodega')        cargarInventarioBodega();
    if (tab === 'salidas')       cargarSalidas();
    if (tab === 'transferencia') cargarTransferencias();
    if (tab === 'reportes')      cargarReportes();
    if (tab === 'usuarios')      cargarUsuarios();
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
            <div class="summary-card" onclick="changeTab('usuarios')">
                <div class="card-icon">👤</div>
                <div class="card-label">Usuarios</div>
                <div class="card-sub">Gestión de accesos</div>
            </div>
        </div>`;
}

// ── Módulo: Bodega ────────────────────────────

async function cargarFacturas() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>Módulo de Facturación</h2>
            <button class="btn-nav" onclick="cargarFacturas()">↺ Actualizar</button>
        </div>
        <p class="loading-msg">⏳ Cargando facturas...</p>`;
    try {
        const { data, error } = await window.supabase
            .from('facturas').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        cacheFacturas = data || [];
        if (!cacheFacturas.length) {
            content.querySelector('.loading-msg').textContent = 'No hay facturas registradas.';
            return;
        }
        const filas = cacheFacturas.map(f => `
            <tr>
                <td><code>${esc(f.numero_factura ?? String(f.id ?? '—'))}</code></td>
                <td>${esc(f.cliente ?? '—')}</td>
                <td style="text-align:right;font-family:var(--font-mono)">$${parseFloat(f.total ?? 0).toFixed(2)}</td>
                <td><span class="badge badge-${(f.estado||'emitida').toLowerCase()}">${esc(f.estado ?? '—')}</span></td>
                <td class="text-dim">${formatFecha(f.created_at)}</td>
            </tr>`).join('');
        content.innerHTML = `
            <div class="module-header">
                <h2>Módulo de Facturación</h2>
                <button class="btn-nav" onclick="cargarFacturas()">↺ Actualizar</button>
            </div>
            <div class="search-bar">
                <input type="text" id="fact-search"
                    placeholder="Buscar por número, cliente, estado…"
                    oninput="filtrarTabla('fact-search','tabla-facturas')"/>
            </div>
            <div class="table-wrap">
                <table class="data-table" id="tabla-facturas">
                    <thead><tr>
                        <th>Nº Factura</th><th>Cliente</th><th>Total</th>
                        <th>Estado</th><th>Fecha</th>
                    </tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            <p class="table-count">${cacheFacturas.length} facturas.</p>`;
    } catch (err) {
        content.innerHTML = `
            <div class="module-header"><h2>Módulo de Facturación</h2></div>
            <p class="error-msg">❌ ${err.message}</p>`;
    }
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

const COLS_RECONOCIDAS = ['nombre','codigo','serie','numero_serie','modelo','unidad','categoria','cantidad','precio','estado','notas'];
let datosImportados = [];
let archivoActivo   = null;


// ════════════════════════════════════════════════════════════
//  MÓDULO: IMPORTAR ARCHIVO (Excel / CSV → bodega)
// ════════════════════════════════════════════════════════════
function cargarImportar() {
    document.getElementById('dashboard-content').innerHTML = `
        <div class="module-header">
            <h2>📤 Importar Archivo</h2>
            <span class="mod-sub">Cargue un archivo Excel (.xlsx) o CSV con artículos de inventario</span>
        </div>
        <div class="drop-zone" id="drop-zone"
             ondragover="event.preventDefault();this.classList.add('drag-over')"
             ondragleave="this.classList.remove('drag-over')"
             ondrop="onFileDrop(event)">
            <div class="drop-icon">📁</div>
            <div class="drop-title">Arrastra tu archivo aquí</div>
            <div class="drop-sub">Formatos soportados: .xlsx &nbsp;·&nbsp; .csv</div>
            <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none" onchange="onFileSelect(event)" />
            <button class="btn-cyan" style="margin-top:1.2rem" onclick="document.getElementById('file-input').click()">
                Seleccionar archivo
            </button>
        </div>
        <div class="cols-info">
            <div class="cols-title">COLUMNAS RECONOCIDAS EN EL ARCHIVO</div>
            <div class="cols-tags">
                <span class="col-tag required">NOMBRE *</span>
                <span class="col-tag required">SERIE / NUMERO_SERIE *</span>
                <span class="col-tag">MODELO</span><span class="col-tag">CODIGO</span>
                <span class="col-tag">CATEGORIA</span><span class="col-tag">UNIDAD</span>
                <span class="col-tag required">PRECIO *</span><span class="col-tag">CANTIDAD</span>
                <span class="col-tag">ESTADO</span><span class="col-tag">CUADRILLA</span>
                <span class="col-tag">UBICACION</span><span class="col-tag">NOTAS</span>
            </div>
        </div>
        <div id="import-preview" style="display:none">
            <div class="import-file-bar">
                <span id="import-filename">—</span>
                <span id="import-rowcount" class="badge badge-disponible">0 filas</span>
                <button class="btn-danger-sm" onclick="limpiarImport()">✕ Limpiar</button>
            </div>
            <div class="table-wrap" style="max-height:280px;overflow-y:auto">
                <table class="data-table" id="tabla-preview">
                    <thead id="preview-thead"></thead>
                    <tbody id="preview-tbody"></tbody>
                </table>
            </div>
            <div class="import-actions">
                <div id="import-status" class="import-status"></div>
                <button class="btn-cyan btn-lg" id="btn-importar" onclick="ejecutarImport()">⬆ Importar a Bodega</button>
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

function renderPreview(rows) {
    if (!rows || !rows.length) { setImportStatus('❌ Sin filas válidas','error'); return; }
    datosImportados = rows;
    const cols = Object.keys(rows[0]);
    document.getElementById('preview-thead').innerHTML = '<tr>' +
        cols.map(c => `<th style="${COLS_RECONOCIDAS.includes(c.toLowerCase())?'color:var(--cyan)':''}">${esc(c)}${COLS_RECONOCIDAS.includes(c.toLowerCase())?' ✓':''}</th>`).join('') + '</tr>';
    document.getElementById('preview-tbody').innerHTML = rows.slice(0,50).map(row =>
        '<tr>' + cols.map(c => `<td>${esc(String(row[c]??''))}</td>`).join('') + '</tr>').join('');
    document.getElementById('import-filename').textContent  = archivoActivo;
    document.getElementById('import-rowcount').textContent  = rows.length + ' filas';
    document.getElementById('import-preview').style.display = 'block';
    document.getElementById('drop-zone').style.display      = 'none';
    setImportStatus('✓ ' + rows.length + ' filas listas para importar.','ok');
}

function limpiarImport() {
    datosImportados = []; archivoActivo = null;
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('drop-zone').style.display      = 'block';
    document.getElementById('file-input').value             = '';
    setImportStatus('','');
}

async function ejecutarImport() {
    if (!datosImportados.length) return;
    const btn = document.getElementById('btn-importar');
    btn.disabled = true; btn.textContent = '⏳ Importando...';
    const registros = datosImportados.map(row => {
        const k = key => { const f = Object.keys(row).find(c => c.toLowerCase()===key); return f ? String(row[f]||'').trim() : ''; };
        return {
            serie:    k('serie')||k('numero_serie')||k('codigo')||'',
            articulo: k('articulo')||k('modelo')||k('nombre')||'',
            categoria:    k('categoria')||k('unidad')||'',
            estado:       k('estado')||'disponible',
            precio:       parseFloat(k('precio'))||0,
            cantidad:     parseInt(k('cantidad'))||1,
            cuadrilla:    k('cuadrilla')||'',
            ubicacion:    k('ubicacion')||'',
            notas:        k('notas')||''
        };
    }).filter(r => r.serie || r.articulo);
    if (!registros.length) { setImportStatus('❌ Sin datos válidos.','error'); btn.disabled=false; btn.textContent='⬆ Importar a Bodega'; return; }
    const { error } = await window.supabase.from('bodega').insert(registros);
    btn.disabled = false; btn.textContent = '⬆ Importar a Bodega';
    if (error) { setImportStatus('❌ Error: ' + error.message,'error'); return; }
    setImportStatus('✅ ' + registros.length + ' registros importados correctamente.','ok');
    cacheInventario = [];
    setTimeout(limpiarImport, 3000);
}

function setImportStatus(msg, tipo) {
    const el = document.getElementById('import-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'import-status' + (tipo==='error' ? ' import-error' : tipo==='ok' ? ' import-ok' : '');
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
                            <input type="text" id="art-nombre"
                                placeholder="Ej: Módem Dual Band, Cable UTP Cat6…"
                                value="${esc(item?.nombre || item?.articulo || '')}" required />
                        </div>
                        <div class="field">
                            <label>
                                CÓDIGO / SKU
                                <button type="button" class="btn-autogen"
                                    onclick="generarCodigoAuto()">⚡ Auto</button>
                            </label>
                            <input type="text" id="art-codigo"
                                placeholder="PRO-00001"
                                value="${esc(item?.codigo || '')}" />
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

    // Payload base — solo columnas que existen en bodega
    // Columnas reales: id, serie, articulo, estado, fecha_ingreso,
    //                  cuadrilla, ubicacion, cantidad, updated_at,
    //                  nombre, codigo, precio, tipo_material, unidad, notas
    const payloadBase = {
        nombre,
        articulo: nombre,
        codigo,
        precio,
        estado,
        notas,
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

async function cargarSalidas() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>📤 Salida de Inventario</h2>
            <div style="display:flex;gap:.6rem">
                <button class="btn-nav" onclick="cargarSalidas()">↺ Actualizar</button>
                <button class="btn-cyan" onclick="abrirModalSalida()">+ Registrar Salida</button>
            </div>
        </div>
        <div class="inv-stats" id="salidas-stats">
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
            <div class="istat loading-placeholder"></div>
        </div>
        <div class="inv-toolbar">
            <div class="search-bar" style="flex:1">
                <input type="text" id="sal-search" placeholder="🔍  Buscar por serie, destino, responsable…" oninput="filtrarTabla('sal-search','tabla-salidas')" />
            </div>
        </div>
        <div class="table-wrap">
            <table class="data-table" id="tabla-salidas">
                <thead><tr>
                    <th>#</th><th>Nº SERIE</th><th>MODELO</th><th>MOTIVO</th>
                    <th>DESTINO</th><th>RESPONSABLE</th><th>CANT.</th><th>FECHA</th>
                </tr></thead>
                <tbody id="salidas-tbody">
                    <tr><td colspan="8" class="empty-row">⏳ Cargando salidas...</td></tr>
                </tbody>
            </table>
        </div>
        <p class="table-count" id="salidas-count"></p>`;

    try {
        const { data, error } = await window.supabase.from('salidas').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        cacheSalidas = data || [];

        document.getElementById('salidas-stats').innerHTML = `
            <div class="istat"><span class="istat-num">${cacheSalidas.length}</span><span class="istat-label">Total salidas</span></div>
            <div class="istat istat-warn"><span class="istat-num">${cacheSalidas.filter(s=>(s.motivo||'').toLowerCase().includes('venta')).length}</span><span class="istat-label">Por venta</span></div>
            <div class="istat istat-blue"><span class="istat-num">${cacheSalidas.filter(s=>(s.motivo||'').toLowerCase().includes('instalación')||s.motivo?.toLowerCase().includes('instalacion')).length}</span><span class="istat-label">Instalaciones</span></div>`;

        const tbody = document.getElementById('salidas-tbody');
        const count = document.getElementById('salidas-count');
        if (!cacheSalidas.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No hay salidas registradas.</td></tr>'; return; }
        tbody.innerHTML = cacheSalidas.map((s, idx) => `
            <tr>
                <td class="row-num">${idx+1}</td>
                <td><code>${esc(s.numero_serie||'—')}</code></td>
                <td class="td-bold">${esc(s.articulo||s.modelo||'—')}</td>
                <td><span class="cat-pill">${esc(s.motivo||'—')}</span></td>
                <td>${esc(s.destino||'—')}</td>
                <td style="font-size:.82rem;color:var(--dim)">${esc(s.responsable||'—')}</td>
                <td style="text-align:center;font-family:var(--font-mono)">${s.cantidad||1}</td>
                <td class="td-date">${formatFecha(s.created_at)}</td>
            </tr>`).join('');
        if (count) count.textContent = cacheSalidas.length + ' registros';
    } catch(err) {
        document.getElementById('salidas-tbody').innerHTML = `<tr><td colspan="8" class="empty-row error-msg">❌ ${err.message}</td></tr>`;
    }
}

function abrirModalSalida() {
    // Poblar selector con series disponibles
    const series = cacheInventario.filter(i => (i.estado||'').toLowerCase() !== 'vendido');
    const optsDisp = series.length
        ? series.map(i => `<option value="${i.id}" data-serie="${esc(i.serie||'')}" data-modelo="${esc(i.articulo||'')}">${esc(i.serie||i.articulo||'Sin serie')}</option>`).join('')
        : '<option value="">— Sin series disponibles —</option>';

    document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="modal-salida" onclick="cerrarModalClick(event,'modal-salida')">
            <div class="modal-content">
                <div class="modal-head">
                    <span>📤 Registrar Salida</span>
                    <button class="modal-close" onclick="cerrarModal('modal-salida')">✕</button>
                </div>
                <form id="form-salida" onsubmit="guardarSalida(event)">
                    <div class="form-grid">
                        <div class="field field-full"><label>ARTÍCULO (SERIE) *</label>
                            <select id="sal-bodega-id" required onchange="autoFillSalida(this)">
                                <option value="">— Selecciona un artículo —</option>
                                ${optsDisp}
                            </select>
                        </div>
                        <div class="field"><label>Nº SERIE</label>
                            <input type="text" id="sal-serie" placeholder="Auto-completado" /></div>
                        <div class="field"><label>MODELO</label>
                            <input type="text" id="sal-modelo" placeholder="Auto-completado" /></div>
                        <div class="field"><label>MOTIVO *</label>
                            <select id="sal-motivo" required>
                                <option value="venta">Venta</option>
                                <option value="instalación">Instalación</option>
                                <option value="préstamo">Préstamo</option>
                                <option value="traslado">Traslado</option>
                                <option value="daño">Daño / Baja</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div class="field"><label>CANTIDAD</label>
                            <input type="number" id="sal-cantidad" value="1" min="1" /></div>
                        <div class="field"><label>DESTINO / CLIENTE</label>
                            <input type="text" id="sal-destino" placeholder="Cliente o cuadrilla destino" /></div>
                        <div class="field"><label>RESPONSABLE</label>
                            <input type="text" id="sal-resp" placeholder="Nombre del técnico" /></div>
                        <div class="field field-full"><label>NOTAS</label>
                            <textarea id="sal-notas" rows="2" placeholder="Observaciones…"></textarea></div>
                    </div>
                    <div class="modal-foot">
                        <button type="button" class="btn-ghost-sm" onclick="cerrarModal('modal-salida')">Cancelar</button>
                        <button type="submit" class="btn-cyan">Registrar Salida</button>
                    </div>
                </form>
            </div>
        </div>`);
}

function autoFillSalida(sel) {
    const opt = sel.options[sel.selectedIndex];
    const sf  = document.getElementById('sal-serie');
    const mf  = document.getElementById('sal-modelo');
    if (sf) sf.value = opt.getAttribute('data-serie') || '';
    if (mf) mf.value = opt.getAttribute('data-modelo') || '';
}

async function guardarSalida(e) {
    e.preventDefault();
    const bid = document.getElementById('sal-bodega-id').value;
    const payload = {
        bodega_id:    bid ? parseInt(bid) : null,
        numero_serie: document.getElementById('sal-serie').value.trim(),
        modelo:       document.getElementById('sal-modelo').value.trim(),
        motivo:       document.getElementById('sal-motivo').value,
        cantidad:     parseInt(document.getElementById('sal-cantidad').value)||1,
        destino:      document.getElementById('sal-destino').value.trim()||null,
        responsable:  document.getElementById('sal-resp').value.trim()||null,
        notas:        document.getElementById('sal-notas').value.trim()||null
    };
    const { error } = await window.supabase.from('salidas').insert(payload);
    if (error) { alert('Error: ' + error.message); return; }

    // Actualizar estado del artículo en bodega si aplica
    if (bid) {
        const nuevoEstado = payload.motivo === 'venta' ? 'vendido' : payload.motivo === 'daño' ? 'dañado' : 'reservado';
        await window.supabase.from('bodega').update({ estado: nuevoEstado }).eq('id', bid);
        cacheInventario = [];
    }
    cerrarModal('modal-salida');
    cargarSalidas();
}


// ════════════════════════════════════════════════════════════
//  MÓDULO: TRANSFERENCIA DE INVENTARIO
// ════════════════════════════════════════════════════════════

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
    if (clave) payload.clave = clave;

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
async function cargarReportes() {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = `
        <div class="module-header">
            <h2>📋 Reportes</h2>
            <div style="display:flex;gap:.6rem">
                <button class="btn-nav" onclick="cargarReportes()">↺ Actualizar</button>
                <button class="btn-nav" onclick="exportarReporteCSV()">⬇ CSV Bodega</button>
            </div>
        </div>
        <p class="loading-msg">⏳ Calculando estadísticas...</p>`;
    try {
        const [rB, rF, rS, rT] = await Promise.all([
            window.supabase.from('bodega').select('estado, precio'),
            window.supabase.from('facturas').select('estado, total'),
            window.supabase.from('salidas').select('id, motivo'),
            window.supabase.from('transferencias').select('id, estado')
        ]);
        const B = rB.data||[]; const F = rF.data||[];
        const S = rS.data||[]; const T = rT.data||[];
        const fA = F.filter(f => (f.estado||'').toLowerCase() !== 'anulada');
        content.innerHTML = `
            <div class="module-header">
                <h2>📋 Reportes</h2>
                <div style="display:flex;gap:.6rem">
                    <button class="btn-nav" onclick="cargarReportes()">↺ Actualizar</button>
                    <button class="btn-nav" onclick="exportarReporteCSV()">⬇ CSV Bodega</button>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.8rem;margin-bottom:1.5rem">
                <div class="istat"><span class="istat-num">${B.length}</span><span class="istat-label">Total bodega</span></div>
                <div class="istat istat-green"><span class="istat-num">${B.filter(i=>(i.estado||'').toLowerCase()==='disponible').length}</span><span class="istat-label">Disponibles</span></div>
                <div class="istat istat-blue"><span class="istat-num">${B.filter(i=>(i.estado||'').toLowerCase()==='reservado').length}</span><span class="istat-label">Reservados</span></div>
                <div class="istat istat-warn"><span class="istat-num">${B.filter(i=>(i.estado||'').toLowerCase()==='vendido').length}</span><span class="istat-label">Vendidos</span></div>
                <div class="istat istat-cyan"><span class="istat-num">$${B.reduce((s,i)=>s+parseFloat(i.precio||0),0).toFixed(0)}</span><span class="istat-label">Valor bodega</span></div>
                <div class="istat"><span class="istat-num">${S.length}</span><span class="istat-label">Salidas</span></div>
                <div class="istat istat-warn"><span class="istat-num">${T.filter(t=>(t.estado||'')==='pendiente').length}</span><span class="istat-label">Trans. pendientes</span></div>
                <div class="istat istat-green"><span class="istat-num">${fA.length}</span><span class="istat-label">Facturas</span></div>
                <div class="istat istat-cyan"><span class="istat-num">$${fA.reduce((s,f)=>s+parseFloat(f.total||0),0).toFixed(2)}</span><span class="istat-label">Facturado</span></div>
            </div>`;
    } catch(err) {
        content.innerHTML = `<div class="module-header"><h2>📋 Reportes</h2></div><p class="error-msg">❌ ${err.message}</p>`;
    }
}

async function exportarReporteCSV() {
    const { data, error } = await window.supabase.from('bodega').select('*');
    if (error || !data) { alert('Error: ' + (error?.message||'sin datos')); return; }
    const cols = ['serie','articulo','nombre','codigo','tipo_material','estado','precio','cantidad','cuadrilla','ubicacion','fecha_ingreso'];
    const csv  = [cols.join(','), ...data.map(r => cols.map(c => '"' + esc(String(r[c]??'')) + '"').join(','))].join('\n');
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'})),
        download: 'prointel_bodega_' + new Date().toISOString().slice(0,10) + '.csv'
    });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}


// ════════════════════════════════════════════════════════════
//  PERMISOS POR ROL — Técnico = Solo Lectura
// ════════════════════════════════════════════════════════════

/**
 * Si el usuario tiene rol 'tecnico', oculta todos los botones
 * de acción (Nuevo, Editar, Eliminar, Guardar) del dashboard.
 * Se aplica una vez al iniciar sesión y de nuevo al cambiar de tab
 * (los tabs re-inyectan el HTML, así que hay que re-aplicar).
 */
function aplicarPermisosTecnico() {
    if (!currentUser) return;
    const rol = (currentUser.rol || '').toLowerCase();
    if (rol !== 'tecnico') return; // Admin y Bodega tienen acceso total

    // Marcar el body para que el CSS también pueda actuar
    document.body.setAttribute('data-rol', 'tecnico');

    // Ocultar botones de acción del dashboard en tiempo real
    _ocultarBotonesTecnico();
}

/**
 * Aplica restricciones visuales: oculta/deshabilita todos los
 * elementos de escritura en el dashboard-content.
 * Se llama desde changeTab() después de renderizar cada módulo.
 */
function _ocultarBotonesTecnico() {
    if (!currentUser) return;
    const rol = (currentUser.rol || '').toLowerCase();
    if (rol !== 'tecnico') return;

    const content = document.getElementById('dashboard-content');
    if (!content) return;

    // Selectores de elementos de escritura
    const selectores = [
        '.btn-cyan',           // Botones primarios (+ Nuevo, Guardar, Importar…)
        '.act-btn.act-edit',   // Botón Editar en tablas
        '.act-btn.act-del',    // Botón Eliminar en tablas
        '#btn-importar',       // Botón Importar archivo
        '.drop-zone',          // Zona de drop de archivos
        'button[onclick*="abrirModal"]',       // Cualquier botón que abra modal
        'button[onclick*="ejecutarImport"]',   // Importar
        'button[onclick*="guardar"]',          // Guardar directo
        'button[onclick*="completar"]',        // Completar transferencia
        'button[onclick*="cancelar"]',         // Cancelar transferencia
        'button[onclick*="eliminar"]',         // Eliminar
    ];

    selectores.forEach(sel => {
        content.querySelectorAll(sel).forEach(el => {
            el.style.display = 'none';
        });
    });

    // Deshabilitar también selects de filtro de estado para evitar edición
    // (Los selects de solo FILTRO los dejamos activos — son de lectura)

    // Agregar banner informativo si no existe aún
    if (!content.querySelector('.tecnico-banner')) {
        const banner = document.createElement('div');
        banner.className = 'tecnico-banner';
        banner.innerHTML = '🔒 Modo Solo Lectura — Perfil Técnico. Contacta a un administrador para realizar cambios.';
        content.prepend(banner);
    }
}

/**
 * Wrapper que intercepta changeTab para re-aplicar restricciones
 * después de que cada módulo inyecta su HTML.
 * Se inicializa una sola vez al cargar.
 */
(function parchearChangeTabParaTecnico() {
    const _original = window.changeTab;
    if (!_original || window._changeTabParcheado) return;
    window._changeTabParcheado = true;
    window.changeTab = function(tab) {
        _original(tab);
        // Esperar un tick para que el módulo termine de renderizar
        setTimeout(_ocultarBotonesTecnico, 50);
    };
})();

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
