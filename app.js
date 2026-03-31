// PROINTEL 2.0 — APP LIMPIO
// Configuración Supabase
const SUPABASE_URL = 'https://tqqijdztibhudqeyxgjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcWlqZHp0aWJodWRxZXl4Z2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc5MjkxOTgsImV4cCI6MjA0MzUwNTE5OH0.vt1BkJ3RNJgGfZJKVwQVY56hqzn0dPr8yMQzAKGiCXw';

// Variables globales
let supabase = null;
let currentUser = null;
let userProfile = null;

// Inicializar
window.addEventListener('DOMContentLoaded', function() {
    // Crear cliente Supabase
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase inicializado');
    
    // Iniciar reloj
    updateClock();
    setInterval(updateClock, 1000);
});

// Actualizar reloj
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('es-ES');
    const clockElement = document.getElementById('clock');
    if (clockElement) {
        clockElement.textContent = timeString;
    }
}

// LOGIN
async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMessage');
    
    if (!username || !password) {
        showError(errorMsg, '❌ Completa usuario y contraseña');
        return;
    }

    try {
        // Buscar usuario en BD
        const { data, error } = await supabase
            .from('usuarios')
            .select('id, usuario, clave, rol')
            .eq('usuario', username)
            .single();

        if (error || !data) {
            showError(errorMsg, '❌ Usuario no encontrado');
            return;
        }

        // Validar contraseña
        if (data.clave !== password) {
            showError(errorMsg, '❌ Contraseña incorrecta');
            return;
        }

        // Login exitoso
        currentUser = data.usuario;
        userProfile = data.rol;

        // Mostrar datos en header
        document.getElementById('userName').textContent = data.usuario;
        document.getElementById('userAvatar').textContent = data.usuario.charAt(0).toUpperCase();
        document.getElementById('greeting').textContent = `Bienvenido, ${data.usuario}`;

        // Asignar permisos según rol
        if (data.rol === 'admin') {
            document.getElementById('userRole').textContent = 'Super Usuario';
            document.getElementById('cardCreateUsers').style.display = 'block';
            document.getElementById('cardOT').style.display = 'block';
            document.getElementById('cardReportes').style.display = 'block';
        } else if (data.rol === 'administrativo') {
            document.getElementById('userRole').textContent = 'Administrador';
            document.getElementById('cardCreateUsers').style.display = 'none';
            document.getElementById('cardOT').style.display = 'block';
            document.getElementById('cardReportes').style.display = 'block';
        } else if (data.rol === 'tecnico') {
            document.getElementById('userRole').textContent = 'Técnico';
            document.getElementById('cardCreateUsers').style.display = 'none';
            document.getElementById('cardOT').style.display = 'none';
            document.getElementById('cardReportes').style.display = 'none';
        }

        // Mostrar dashboard
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('header').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'flex';
        document.getElementById('dashboardSection').classList.add('active');
        
        console.log(`✅ Login: ${data.nombre_completo} (${data.rol})`);

    } catch (error) {
        console.error('Error login:', error);
        showError(errorMsg, '❌ Error al conectar');
    }
}

// LOGOUT
function logout() {
    currentUser = null;
    userProfile = null;
    
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('header').style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // Ocultar todas las secciones
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
    console.log('✅ Sesión cerrada');
}

// CREAR USUARIO
function openCreateUserModal() {
    document.getElementById('modalCreateUser').classList.add('active');
}

function closeCreateUserModal() {
    document.getElementById('modalCreateUser').classList.remove('active');
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newUserProfile').value = '';
    document.getElementById('createUserError').style.display = 'none';
}

async function handleCreateUser(event) {
    event.preventDefault();
    
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const rol = document.getElementById('newUserProfile').value;
    const errorDiv = document.getElementById('createUserError');

    if (!username || !password || !rol) {
        showError(errorDiv, '❌ Completa todos los campos');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                usuario: username,
                clave: password,
                rol: rol
            })
            .select();

        if (error) {
            console.error('Error:', error);
            showError(errorDiv, '❌ Error al crear usuario');
            return;
        }

        const rolDisplay = rol === 'administrativo' ? 'Administrador' : 'Técnico';
        alert(`✅ Usuario "${username}" creado como ${rolDisplay}`);
        closeCreateUserModal();
        console.log(`✅ Usuario creado: ${username}`);

    } catch (error) {
        console.error('Error:', error);
        showError(errorDiv, '❌ Error al crear usuario');
    }
}

// NAVEGACIÓN
function navigateTo(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    
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

// CARGAR BODEGA
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
                articulos:articulo_id (nombre, codigo)
            `)
            .eq('responsable', currentUser);

        if (error) throw error;

        const seriados = (data || []).filter(d => d.serie);
        const misc = (data || []).filter(d => !d.serie);

        // Tabla seriados
        let htmlSeriados = '';
        if (seriados.length > 0) {
            seriados.forEach(item => {
                htmlSeriados += `<tr>
                    <td>${item.articulos?.nombre || 'N/A'}</td>
                    <td><code>${item.articulos?.codigo || 'N/A'}</code></td>
                    <td>${item.serie}</td>
                    <td>${item.cantidad}</td>
                </tr>`;
            });
        } else {
            htmlSeriados = '<tr><td colspan="4" style="text-align: center;">Sin equipos asignados</td></tr>';
        }
        document.querySelector('#tablaSeriados tbody').innerHTML = htmlSeriados;

        // Tabla misceláneo
        let htmlMisc = '';
        if (misc.length > 0) {
            misc.forEach(item => {
                htmlMisc += `<tr>
                    <td>${item.articulos?.nombre || 'N/A'}</td>
                    <td><code>${item.articulos?.codigo || 'N/A'}</code></td>
                    <td>${item.cantidad}</td>
                </tr>`;
            });
        } else {
            htmlMisc = '<tr><td colspan="3" style="text-align: center;">Sin material asignado</td></tr>';
        }
        document.querySelector('#tablaMisc tbody').innerHTML = htmlMisc;

    } catch (error) {
        console.error('Error bodega:', error);
    }
}

// UTILIDAD: mostrar error
function showError(element, message) {
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
    }
}

console.log('✅ app.js cargado');