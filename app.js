// ══════════════════════════════════════════════
// MÓDULO: BODEGA FILTRADA v2.0 (CON DEBUGGING)
// ══════════════════════════════════════════════

// ── PASO 0: Validar Usuario ───────────────────
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

// ── PASO 1: Cargar Bodega Técnico (MEJORADO) ──
async function cargarBodegaTecnico() {
    // Validar
    if (!validarUsuarioActivo()) return;

    try {
        const nombreTecnico = currentUser.nombre.trim();
        console.log(`📦 INICIANDO: Cargando bodega para técnico: "${nombreTecnico}"`);
        
        // Mostrar loading
        const contenedor = document.getElementById('bodega-inventario');
        if (contenedor) {
            contenedor.innerHTML = '<p>⏳ Cargando inventario...</p>';
        }
        
        // Mostrar nombre del técnico
        const techDisplay = document.getElementById('tech-name-display');
        if (techDisplay) techDisplay.textContent = nombreTecnico;

        // Consulta a Supabase
        const { data, error, status } = await supabase
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

        console.log(`📊 Response Status: ${status}`);
        console.log(`📊 Datos recibidos:`, data);
        console.log(`❌ Error (si existe):`, error);

        if (error) {
            console.error('🔴 ERROR Supabase:', error.message);
            throw error;
        }

        if (!data) {
            console.warn('⚠️ No se recibieron datos');
            renderizarBodegaTecnico([]);
            return;
        }

        console.log(`✅ ÉXITO: ${data.length} artículos encontrados`);
        
        // Renderizar
        renderizarBodegaTecnico(data);
        showSection('view-bodega-tecnico');

    } catch (error) {
        console.error('💥 ERROR FATAL:', error);
        alert(`❌ Error: ${error.message}`);
        
        // Mostrar error en UI
        const contenedor = document.getElementById('bodega-inventario');
        if (contenedor) {
            contenedor.innerHTML = `
                <div class="error-box">
                    <p>❌ Error al cargar bodega:</p>
                    <code>${error.message}</code>
                    <p style="font-size: 0.85rem; color: #999;">
                        Abre la consola del navegador (F12) para más detalles.
                    </p>
                </div>
            `;
        }
    }
}

// ── PASO 2: Renderizar Tabla (MEJORADO) ───────
function renderizarBodegaTecnico(datos) {
    console.log(`🎨 RENDERIZAR: ${datos.length} items`);
    
    const contenedor = document.getElementById('bodega-inventario');
    if (!contenedor) {
        console.error('❌ No encontré elemento #bodega-inventario');
        return;
    }

    // Validar datos
    if (!datos || datos.length === 0) {
        console.warn('⚠️ Sin datos para mostrar');
        contenedor.innerHTML = `
            <div class="empty-state">
                <p>📭 No hay artículos asignados a este técnico</p>
                <small>Verifica que el nombre en la BD coincida exactamente</small>
            </div>
        `;
        return;
    }

    // Construir tabla
    let html = `
        <div class="bodega-stats">
            <p>📦 Total artículos: <strong>${datos.length}</strong></p>
        </div>
        
        <table class="tabla-bodega">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Artículo</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Serie</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    datos.forEach((item, idx) => {
        const articulo = item.articulos || {};
        const { id, cantidad, serie } = item;

        console.log(`  ├─ Item ${idx}: ID=${id}, Cantidad=${cantidad}`);

        html += `
            <tr>
                <td><code>${articulo.codigo || 'N/A'}</code></td>
                <td>${articulo.nombre || 'Desconocido'}</td>
                <td><span class="badge">${articulo.categoria || 'S/C'}</span></td>
                <td class="cantidad-cell">
                    <span class="stock-badge">${cantidad}</span>
                </td>
                <td><small>${serie || '—'}</small></td>
                <td>
                    <button class="btn-small btn-edit" 
                        onclick="editarBodegaItem(${id})">
                        ✏️
                    </button>
                    <button class="btn-small btn-danger" 
                        onclick="registrarSalida(${id}, '${articulo.nombre || 'Artículo'}')">
                        📤
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    contenedor.innerHTML = html;
    cacheInventario = datos;
    console.log(`✅ Tabla renderizada`);
}

// ── PASO 3: Registrar Salida (MEJORADO) ───────
async function registrarSalida(bodegaId, nombreArticulo) {
    console.log(`📤 SALIDA: bodegaId=${bodegaId}, artículo="${nombreArticulo}"`);
    
    // Obtener datos
    const bodegaItem = cacheInventario.find(b => b.id === bodegaId);
    if (!bodegaItem) {
        console.error('❌ Artículo no encontrado en cache');
        alert('Error: Artículo no encontrado');
        return;
    }

    // Prompts
    const numeroOT = prompt(`📋 Ingresa número de OT para:\n"${nombreArticulo}"`);
    if (!numeroOT) return;

    const cantidadStr = prompt(`🎯 ¿Cuántas unidades salen?\n(Disponible: ${bodegaItem.cantidad})`);
    if (!cantidadStr) return;

    const cantidad = parseInt(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) {
        alert('❌ Cantidad inválida');
        return;
    }

    if (cantidad > bodegaItem.cantidad) {
        alert(`❌ Solo hay ${bodegaItem.cantidad} unidades disponibles`);
        return;
    }

    try {
        console.log(`✍️ Registrando: ${cantidad} unidades, OT: ${numeroOT}`);

        // 1. Registrar salida
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
        console.log('✅ Salida registrada en BD');

        // 2. Actualizar cantidad
        const cantidadNueva = bodegaItem.cantidad - cantidad;
        const { error: errUpdate } = await supabase
            .from('bodega')
            .update({ cantidad: cantidadNueva })
            .eq('id', bodegaId);

        if (errUpdate) throw errUpdate;
        console.log(`✅ Cantidad actualizada: ${bodegaItem.cantidad} → ${cantidadNueva}`);

        alert(`✅ Salida registrada!\n${cantidad} unidades despachadas.\nNuevo stock: ${cantidadNueva}`);
        cargarBodegaTecnico(); // Recargar

    } catch (error) {
        console.error('💥 Error en salida:', error);
        alert(`❌ Error: ${error.message}`);
    }
}

// ── PASO 4: Editar Item ───────────────────────
function editarBodegaItem(bodegaId) {
    const item = cacheInventario.find(b => b.id === bodegaId);
    if (!item) return;

    const nuevaCantidad = prompt(
        `Actualizar: ${item.articulos?.nombre}\nStock actual: ${item.cantidad}`,
        item.cantidad
    );

    if (nuevaCantidad === null || isNaN(nuevaCantidad)) return;
    
    actualizarCantidadBodega(bodegaId, parseInt(nuevaCantidad));
}

async function actualizarCantidadBodega(bodegaId, nuevaCantidad) {
    try {
        console.log(`🔄 Actualizando bodegaId=${bodegaId} → cantidad=${nuevaCantidad}`);

        const { error } = await supabase
            .from('bodega')
            .update({ cantidad: nuevaCantidad })
            .eq('id', bodegaId);

        if (error) throw error;

        console.log('✅ Cantidad actualizada en BD');
        alert('✅ Cantidad actualizada');
        cargarBodegaTecnico();

    } catch (error) {
        console.error('💥 Error:', error);
        alert(`❌ Error: ${error.message}`);
    }
}
function simularLogin() {
    currentUser = { nombre: "Ovidio", nombre_completo: "Ovidio (Técnico)" };
    localStorage.setItem('prointel_session', JSON.stringify(currentUser));
    document.getElementById('user-display').textContent = currentUser.nombre;
    showSection('view-dashboard');
    iniciarReloj();
}