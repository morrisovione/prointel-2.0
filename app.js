// ══════════════════════════════════════════════
// PROINTEL 2.0 - ESTRUCTURA BASE
// ══════════════════════════════════════════════

// ── Variables globales ────────────────────────
let currentUser     = null;
let currentTab      = null;
let clockInterval   = null;
let cacheInventario = [];
let cacheFacturas   = [];

const SUPERUSUARIO = 'mgvillegas';

// ── Arranque del Sistema ──────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log('PROINTEL 2.0 — Sistema Iniciado');

    // 1. Restaurar Tema (Oscuro/Claro)
    const temaGuardado = localStorage.getItem('prointel_theme') || 'dark';
    document.body.setAttribute('data-theme', temaGuardado);
    
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) toggleBtn.textContent = temaGuardado === 'dark' ? '🌙' : '☀️';

    // 2. Restaurar Sesión
    const sesionGuardada = localStorage.getItem('prointel_session');
    if (sesionGuardada) {
        try {
            currentUser = JSON.parse(sesionGuardada);
            const nombre = currentUser.nombre_completo || currentUser.usuario || 'Usuario';
            const userEl = document.getElementById('user-display');
            if (userEl) userEl.textContent = nombre;
            
            showSection('view-dashboard');
            iniciarReloj();
            // Aquí cargaremos los permisos en el siguiente paso
        } catch (e) {
            localStorage.removeItem('prointel_session');
            showSection('view-landing');
        }
    } else {
        showSection('view-landing');
    }
});

// ── Funciones de Navegación Básica ─────────────
function showSection(sectionId) {
    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
}

function iniciarReloj() {
    if (clockInterval) clearInterval(clockInterval);
    const clockEl = document.getElementById('clock-display');
    if (!clockEl) return;
    
    clockInterval = setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString();
    }, 1000);
}