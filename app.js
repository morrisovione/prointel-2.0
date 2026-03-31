// ═════════════════════════════════════════════════════════════════
// PROINTEL 2.0 — LÓGICA DE APLICACIÓN
// ═════════════════════════════════════════════════════════════════

// CONFIGURACIÓN SUPABASE
const SUPABASE_URL = 'https://tqqijdztibhudqeyxgjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcWlqZHp0aWJodWRxZXl4Z2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc5MjkxOTgsImV4cCI6MjA0MzUwNTE5OH0.vt1BkJ3RNJgGfZJKVwQVY56hqzn0dPr8yMQzAKGiCXw';

// CREDENCIALES SUPER USUARIO (HARDCODEADO)
const SUPER_USER = {
    usuario: 'mgvillegas',
    contraseña: 'nohayclave221',
    perfil: 'superuser'
};

// VARIABLES GLOBALES
let supabase = null;
let currentUser = null;
let userProfile = null;

// ═════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═════════════════════════════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    startClock();
});

function initSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase conectado');
    } catch (e) {
        console.error('❌ Error Supabase:', e);
    }
}

// ═════════════════════════════════════════════════════════════════
// RELOJ
// ═════════════════════════════════════════════════════════════════

function startClock() {
    const updateClock = () => {
        const now = new Date();
        document.getElementById('clock').textContent = now.toLocaleTimeString('es-ES');
    };
    updateClock();
    setInterval(updateClock, 1000);
}

// ═════════════════════════════════════════════════════════════════
// LOGIN
// ═════════════════════════════════════════════════════════════════

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMessage');

    if (!username || !password) {
        showError(errorMsg, '❌ Completa todos los campos');
        return;
    }

    try {
        errorMsg.style.display = 'none';
        
        // VALIDAR SUPER USUARIO
        if (username === SUPER_USER.usuario && password === SUPER_USER.contraseña) {
            loginSuccess(SUPER_USER.usuario, SUPER_USER.perfil);
            return;
        }

        // BUSCAR EN SUPABASE
        const { data, error } = await supabase
            .from('usuarios')
            .select('id, usuario, nombre_completo, clave, rol')
            .eq('usuario', username)
            .single();

        if (error || !data) {
            showError(errorMsg, '❌ Usuario no encontrado');
            return;
        }

        if (data.clave !== password) {
            showError(errorMsg, '❌ Contraseña incorrecta');
            return;
        }

        loginSuccess(data.nombre_completo, data.rol);

    } catch (error) {
        console.error('❌ Error login:', error.message);
        showError(errorMsg, '❌ Error al conectar con el servidor');
    }
}

function loginSuccess(nombre, rol) {
    currentUser = nombre;
    userProfile = rol;

    document.getElementById('userName').textContent = nombre;
    document.getElementById('userAvatar').textContent = nombre.charAt(0).toUpperCase();
    document.getElementById('greeting').textContent = `Bienvenido, ${nombre}`;

    // ASIGNAR PERMISOS SEGÚN ROL
    if (rol === 'admin') {
        // Admin = Super Usuario (acceso a todo)
        document.getElementById('userRole').textContent = 'Administrador';
        document.getElementById('cardCreateUsers').style.display = 'block';
        document.getElementById('cardOT').style.display = 'block';
        document.getElementById('cardReportes').style.display = 'block';
    } else if (rol === 'administrativo') {
        // Administrativo (acceso a OT + Reportes, NO crear usuarios)
        document.getElementById('userRole').textContent = 'Administrador';
        document.getElementById('cardCreateUsers').style.display = 'none';
        document.getElementById('cardOT').style.display = 'block';
        document.getElementById('cardReportes').style.display = 'block';
    } else if (rol === 'tecnico') {
        // Técnico (solo Bodega)
        document.getElementById('userRole').textContent = 'Técnico';
        document.getElementById('cardCreateUsers').style.display = 'none';
        document.getElementById('cardOT').style.display = 'none';
        document.getElementById('cardReportes').style.display = 'none';
    }

    showDashboard();
    console.log(`✅ Login exitoso: ${nombre} (${rol})`);
}

// ═════════════════════════════════════════════════════════════════
// CREAR USUARIO
// ═════════════════════════════════════════════════════════════════

function openCreateUserModal() {
    document.getElementById('modalCreateUser').classList.add('active');
}

function closeCreateUserModal() {
    document.getElementById('modalCreateUser').classList.remove('active');
    limpiarFormularioUsuario();
}

function limpiarFormularioUsuario() {
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newUserProfile').value = '';
    document.getElementById('createUserError').style.display = 'none';
}

async function handleCreateUser(event) {
    event.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const profile = document.getElementById('newUserProfile').value;
    const errorDiv = document.getElementById('createUserError');

    if (!username || !password || !profile) {
        showError(errorDiv, '❌ Completa todos los campos');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                usuario: username,
                nombre_completo: username,
                rol: profile,
                clave: password
            })
            .select();

        if (error) {
            console.error('Error:', error);
            showError(errorDiv, '❌ ' + (error.message || 'Error al crear usuario'));
            return;
        }

        const rolDisplay = profile === 'administrativo' ? 'Administrador' : 'Técnico';
        alert(`✅ Usuario "${username}" creado con rol "${rolDisplay}"`);
        closeCreateUserModal();

    } catch (error) {
        console.error('❌ Error:', error.message);
        showError(errorDiv, '❌ Error al crear usuario');
    }
}

// ═════════════════════════════════════════════════════════════════
// LOGOUT
// ═════════════════════════════════════════════════════════════════

function logout() {
    currentUser = null;
    userProfile = null;
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('header').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    hideAllSections();
    console.log('✅ Sesión cerrada');
}

// ═════════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═════════════════════════════════════════════════════════════════

function hideAllSections() {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
}

function showDashboard() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('header').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'flex';
    hideAllSections();
    document.getElementById('dashboardSection').classList.add('active');
}

function navigateTo(section) {
    hideAllSections();
    switch(section) {
        case 'dashboard':
            document.getElementById('dashboardSection').classList.add('active');
            break;
        case 'bodega':
            document.getElementById('bodegaSection').classList.add('active');
            loadBodega();
            break;
        case 'ot':
            document.getElementById('otSection').classList.add('active');
            break;
        case 'reportes':
            document.getElementById('reportesSection').classList.add('active');
            break;
    }
}

// ═════════════════════════════════════════════════════════════════
// BODEGA
// ═════════════════════════════════════════════════════════════════

async function loadBodega() {
    if (!supabase || !currentUser) return;

    try {
        const { data, error } = await supabase
            .from('bodega')
            .select(`
                id,
                cantidad,
                responsable,
                serie,
                articulo_id,
                articulos:articulo_id (
                    nombre,
                    codigo
                )
            `)
            .eq('responsable', currentUser);

        if (error) throw error;

        renderBodega(data || []);
    } catch (error) {
        console.error('❌ Error cargando bodega:', error.message);
    }
}

function renderBodega(datos) {
    const seriados = datos.filter(d => d.serie);
    const misc = datos.filter(d => !d.serie);

    // TABLA SERIADOS
    let htmlSeriados = '';
    if (seriados.length > 0) {
        seriados.forEach(item => {
            htmlSeriados += `
                <tr>
                    <td>${item.articulos?.nombre || 'N/A'}</td>
                    <td><code>${item.articulos?.codigo || 'N/A'}</code></td>
                    <td>${item.serie}</td>
                    <td>${item.cantidad}</td>
                </tr>
            `;
        });
    } else {
        htmlSeriados = '<tr><td colspan="4" style="text-align: center;">Sin equipos seriados asignados</td></tr>';
    }
    document.querySelector('#tablaSeriados tbody').innerHTML = htmlSeriados;

    // TABLA MISCELÁNEO
    let htmlMisc = '';
    if (misc.length > 0) {
        misc.forEach(item => {
            htmlMisc += `
                <tr>
                    <td>${item.articulos?.nombre || 'N/A'}</td>
                    <td><code>${item.articulos?.codigo || 'N/A'}</code></td>
                    <td>${item.cantidad}</td>
                </tr>
            `;
        });
    } else {
        htmlMisc = '<tr><td colspan="3" style="text-align: center;">Sin material misceláneo asignado</td></tr>';
    }
    document.querySelector('#tablaMisc tbody').innerHTML = htmlMisc;
}

// ═════════════════════════════════════════════════════════════════
// UTILIDADES
// ═════════════════════════════════════════════════════════════════

function showError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

console.log('✅ PROINTEL 2.0 — App.js cargado');