// ══════════════════════════════════════════════════════════════
// PROINTEL 2.0 — SISTEMA COMPLETO DE INVENTARIO
// ══════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. CONFIGURACIÓN SUPABASE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const SUPABASE_URL = 'https://tqqijdztibhudqeyxgjn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxcWlqZHp0aWJodWRxZXl4Z2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc5MjkxOTgsImV4cCI6MjA0MzUwNTE5OH0.vt1BkJ3RNJgGfZJKVwQVY56hqzn0dPr8yMQzAKGiCXw';

let supabase = null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. VARIABLES GLOBALES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let currentUser = null;
let currentTab = null;
let clockInterval = null;
let cacheInventario = [];
let cacheFacturas = [];
const SUPERUSUARIO = 'mgvillegas';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. INICIALIZACIÓN DEL SISTEMA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ PROINTEL 2.0 — Sistema Iniciado');

    // Inicializar Supabase
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase conectado');
    } catch (e) {
        console.error('❌ Error inicializando Supabase:', e);
        alert('⚠️ Error de conexión a Supabase. Verifica las credenciales.');
    }

    // Restaurar tema (si la implementamos después)
    const temaGuardado = localStorage.getItem('prointel_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', temaGuardado);

    // Restaurar sesión
    const sesionGuardada = localStorage.getItem('prointel_session');
    if (sesionGuardada) {
        try {
            currentUser = JSON.parse(sesionGuardada);
            console.log('✅ Sesión restaurada:', currentUser.nombre);
            document.getElementById('user-display').textContent = currentUser.nombre;
            showSection('view-dashboard');
            iniciarReloj();
        } catch (e) {
            console.warn('⚠️ Sesión inválida, limpiando...');
            localStorage.removeItem('prointel_session');
            showSection('view-landing');
        }
    } else {
        showSection('view-landing');
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. FUNCIONES DE NAVEGACIÓN BÁSICA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Muestra una sección y oculta las demás
 * @param {string} sectionId - ID de la sección a mostrar
 */
function showSection(sectionId) {
    console.log(`📂 Mostrando sección: ${sectionId}`);
    
    // Ocultar todas las secciones
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Mostrar la sección solicitada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    } else {
        console.error(`❌ Sección no encontrada: ${sectionId}`);
    }
}

/**
 * Inicia el reloj digital que actualiza cada segundo
 */
function iniciarReloj() {
    if (clockInterval) clearInterval(clockInterval);
    
    const clockEl = document.getElementById('clock-display');
    if (!clockEl) {
        console.warn('⚠️ No encontré elemento #clock-display');
        return;
    }
    
    clockInterval = setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('es-ES');
    }, 1000);
    
    console.log('✅ Reloj iniciado');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. AUTENTICACIÓN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Simula login del técnico (demo)
 * En producción, se conectaría a Supabase Auth
 */
function simularLogin() {
    currentUser = {
        nombre: 'Ovidio',
        nombre_completo: 'Ovidio (Técnico)',
        id: 'tech_001',
        usuario: 'ovidio'
    };
    
    localStorage.setItem('prointel_session', JSON.stringify(currentUser));
    document.getElementById('user-display').textContent = currentUser.nombre;
    
    console.log('✅ Login simulado:', currentUser.nombre);
    
    showSection('view-dashboard');
    iniciarReloj();
}

/**
 * Cierra la sesión actual
 */
function logout() {
    console.log('🚪 Cerrando sesión...');
    localStorage.removeItem('prointel_session');
    currentUser = null;
    cacheInventario = [];
    
    if (clockInterval) clearInterval(clockInterval);
    
    showSection('view-landing');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. MÓDULO: BODEGA FILTRADA POR TÉCNICO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Valida que haya usuario activo
 */
function validarUsuarioActivo() {
    console.log('🔍 Validando usuario...', currentUser);
    
    if (!currentUser) {
        console.error('❌ NO hay usuario en sesión');
        alert('⚠️ Sesión expirada. Por favor, inicia sesión de nuevo.');
        showSection('view-landing');
        return false;
    }
    
    if (!currentUser.nombre) {
        console.error('❌ Usuario sin propiedad "nombre"', currentUser);
        alert('⚠️ Datos de usuario incompletos.');
        return false;
    }
    
    console.log(`✅ Usuario válido: ${currentUser.nombre}`);
    return true;
}

/**
 * Carga la bodega del técnico actual filtrando por responsable
 */
async function cargarMiBodega() {
    // Validar
    if (!validarUsuarioActivo()) return;
    if (!supabase) {
        alert('⚠️ Supabase no está inicializado');
        return;
    }

    try {
        const nombreTecnico = currentUser.nombre.trim();
        console.log(`📦 CARGANDO: Bodega para técnico: "${nombreTecnico}"`);
        
        // Mostrar loading
        const contenedor = document.getElementById('tabla-seriados-body');
        const contenedorMisc = document.getElementById('tabla-misc-body');
        if (contenedor) contenedor.innerHTML = '<tr><td colspan="4" style="text-align: center;">⏳ Cargando...</td></tr>';
        if (contenedorMisc) contenedorMisc.innerHTML = '<tr><td colspan="3" style="text-align: center;">⏳ Cargando...</td></tr>';

        // Consultar Supabase
        const { data, error } = await supabase
            .from('bodega')
            .select(`
                id,
                cantidad,
                responsable,
                serie,
                articulo_id,
                articulos:articulo_id (
                    id,
                    nombre,
                    codigo,
                    categoria
                )
            `)
            .eq('responsable', nombreTecnico);

        if (error) {
            console.error('🔴 ERROR Supabase:', error.message);
            throw error;
        }

        console.log(`✅ ÉXITO: ${data?.length || 0} artículos encontrados`);
        
        // Renderizar
        if (data && data.length > 0) {
            renderizarBodegaTecnico(data);
        } else {
            console.warn('⚠️ Sin datos para mostrar');
            if (contenedor) contenedor.innerHTML = '<tr><td colspan="4" style="text-align: center;">📭 Sin inventario asignado</td></tr>';
        }
        
        showSection('view-bodega');

    } catch (error) {
        console.error('💥 ERROR FATAL:', error.message);
        alert(`❌ Error: ${error.message}`);
        
        const contenedor = document.getElementById('tabla-seriados-body');
        if (contenedor) {
            contenedor.innerHTML = `<tr><td colspan="4" style="color: red;">❌ ${error.message}</td></tr>`;
        }
    }
}

/**
 * Renderiza la tabla de bodega del técnico
 * Separa en "Seriados" y "Misceláneo"
 */
function renderizarBodegaTecnico(datos) {
    console.log(`🎨 RENDERIZANDO: ${datos.length} items`);
    
    const contenedorSeriados = document.getElementById('tabla-seriados-body');
    const contenedorMisc = document.getElementById('tabla-misc-body');
    
    if (!contenedorSeriados || !contenedorMisc) {
        console.error('❌ No encontré los contenedores de tabla');
        return;
    }

    // Separar por categoría
    const seriados = datos.filter(item => item.articulos?.serie);
    const misc = datos.filter(item => !item.articulos?.serie);

    // Renderizar seriados
    let htmlSeriados = '';
    if (seriados.length > 0) {
        seriados.forEach(item => {
            const articulo = item.articulos || {};
            htmlSeriados += `
                <tr>
                    <td>${articulo.nombre || 'N/A'}</td>
                    <td><code>${articulo.codigo || 'N/A'}</code></td>
                    <td>${item.serie || '—'}</td>
                    <td>${item.cantidad}</td>
                </tr>
            `;
        });
    } else {
        htmlSeriados = '<tr><td colspan="4" style="text-align: center; color: #666;">Sin artículos seriados</td></tr>';
    }
    contenedorSeriados.innerHTML = htmlSeriados;

    // Renderizar misceláneo
    let htmlMisc = '';
    if (misc.length > 0) {
        misc.forEach(item => {
            const articulo = item.articulos || {};
            htmlMisc += `
                <tr>
                    <td>${articulo.nombre || 'N/A'}</td>
                    <td><code>${articulo.codigo || 'N/A'}</code></td>
                    <td>${item.cantidad}</td>
                </tr>
            `;
        });
    } else {
        htmlMisc = '<tr><td colspan="3" style="text-align: center; color: #666;">Sin material misceláneo</td></tr>';
    }
    contenedorMisc.innerHTML = htmlMisc;

    cacheInventario = datos;
    console.log(`✅ Tabla renderizada: ${seriados.length} seriados + ${misc.length} misc`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. REGISTRO DE SALIDAS (FUTURO)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Registra una salida de artículo (próximamente con formulario modal)
 */
async function registrarSalida(bodegaId, nombreArticulo) {
    const bodegaItem = cacheInventario.find(b => b.id === bodegaId);
    if (!bodegaItem) {
        console.error('❌ Artículo no encontrado');
        return;
    }

    const numeroOT = prompt(`📋 Número de OT para:\n"${nombreArticulo}"`);
    if (!numeroOT) return;

    const cantidadStr = prompt(`🎯 ¿Cuántos artículos?\n(Disponible: ${bodegaItem.cantidad})`);
    if (!cantidadStr) return;

    const cantidad = parseInt(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0 || cantidad > bodegaItem.cantidad) {
        alert('❌ Cantidad inválida');
        return;
    }

    try {
        console.log(`✍️ Registrando: ${cantidad} unidades, OT: ${numeroOT}`);

        // Registrar salida
        const { error: errSalida } = await supabase
            .from('registros_salida')
            .insert({
                numero_ot: numeroOT,
                articulo_id: bodegaItem.articulo_id,
                cantidad: cantidad,
                tecnico_id: currentUser.id || currentUser.usuario,
                despachado_por: currentUser.nombre
            });

        if (errSalida) throw errSalida;
        console.log('✅ Salida registrada');

        // Actualizar cantidad en bodega
        const cantidadNueva = bodegaItem.cantidad - cantidad;
        const { error: errUpdate } = await supabase
            .from('bodega')
            .update({ cantidad: cantidadNueva })
            .eq('id', bodegaId);

        if (errUpdate) throw errUpdate;
        console.log(`✅ Stock actualizado: ${bodegaItem.cantidad} → ${cantidadNueva}`);

        alert(`✅ Salida registrada!\n${cantidad} artículos despachados.\nNuevo stock: ${cantidadNueva}`);
        cargarMiBodega();

    } catch (error) {
        console.error('💥 Error:', error.message);
        alert(`❌ Error: ${error.message}`);
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. UTILIDADES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Log para debugging (útil para seguimiento)
 */
function log(mensaje, datos = null) {
    console.log(`[PROINTEL] ${mensaje}`, datos || '');
}

console.log('✅ app.js cargado correctamente');