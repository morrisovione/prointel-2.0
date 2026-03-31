// ══════════════════════════════════════════════
// MÓDULO: BODEGA FILTRADA POR TÉCNICO
// ══════════════════════════════════════════════

// ── Cargar Inventario del Técnico ──────────────
async function cargarBodegaTecnico() {
    if (!currentUser || !currentUser.nombre) {
        console.warn('❌ Usuario no autenticado');
        return;
    }

    try {
        console.log(`📦 Cargando bodega para: ${currentUser.nombre}`);
        
        // 1. Consultar bodega filtrada por responsable (técnico)
        const { data: bodegaData, error: errorBodega } = await supabase
            .from('bodega')
            .select(`
                id,
                cantidad,
                responsable,
                serie,
                articulos:articulo_id (
                    id,
                    nombre,
                    codigo,
                    categoria
                )
            `)
            .eq('responsable', currentUser.nombre)
            .order('articulos(nombre)', { ascending: true });

        if (errorBodega) throw errorBodega;

        console.log(`✅ ${bodegaData.length} artículos encontrados`);
        
        // 2. Renderizar tabla de inventario
        renderizarBodegaTecnico(bodegaData);
        showSection('view-bodega-tecnico');

    } catch (error) {
        console.error('❌ Error cargando bodega:', error.message);
        alert('Error al cargar inventario. Intenta de nuevo.');
    }
}

// ── Renderizar Tabla de Inventario ────────────
function renderizarBodegaTecnico(datos) {
    const contenedor = document.getElementById('bodega-inventario');
    if (!contenedor) return;

    if (datos.length === 0) {
        contenedor.innerHTML = `
            <div class="empty-state">
                <p>📭 No hay artículos asignados</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="tabla-bodega">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Artículo</th>
                    <th>Categoría</th>
                    <th>Cantidad</th>
                    <th>Serie</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    datos.forEach(item => {
        const articulo = item.articulos;
        const { id, cantidad, serie } = item;

        html += `
            <tr>
                <td><code>${articulo?.codigo || 'N/A'}</code></td>
                <td>${articulo?.nombre || 'Desconocido'}</td>
                <td><span class="badge">${articulo?.categoria || 'S/C'}</span></td>
                <td class="cantidad-cell">
                    <strong>${cantidad}</strong>
                </td>
                <td>${serie || '—'}</td>
                <td>
                    <button class="btn-small btn-edit" 
                        onclick="editarBodegaItem(${id})">
                        ✏️ Editar
                    </button>
                    <button class="btn-small btn-danger" 
                        onclick="registrarSalida(${id}, '${articulo?.nombre}')">
                        📤 Salida
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
    cacheInventario = datos; // 💾 Guardar en cache
}

// ── Registrar Salida de Artículo ───────────────
async function registrarSalida(bodegaId, nombreArticulo) {
    const numeroOT = prompt(`Ingresa número de OT para "${nombreArticulo}":`);
    if (!numeroOT) return;

    const cantidadSalida = prompt('¿Cuántos artículos salen?');
    if (!cantidadSalida || isNaN(cantidadSalida)) return;

    try {
        // 1. Obtener datos actuales
        const bodegaItem = cacheInventario.find(b => b.id === bodegaId);
        if (!bodegaItem) throw new Error('Artículo no encontrado');

        const cantidadActual = bodegaItem.cantidad;
        const cantidadNueva = cantidadActual - parseInt(cantidadSalida);

        if (cantidadNueva < 0) {
            alert('❌ No hay cantidad suficiente en bodega');
            return;
        }

        // 2. Registrar salida
        const { error: errorSalida } = await supabase
            .from('registros_salida')
            .insert({
                numero_ot: numeroOT,
                articulo_id: bodegaItem.articulos.id,
                cantidad: parseInt(cantidadSalida),
                tecnico_id: currentUser.id,
                despachado_por: currentUser.nombre
            });

        if (errorSalida) throw errorSalida;

        // 3. Actualizar cantidad en bodega
        const { error: errorUpdate } = await supabase
            .from('bodega')
            .update({ cantidad: cantidadNueva })
            .eq('id', bodegaId);

        if (errorUpdate) throw errorUpdate;

        console.log(`✅ Salida registrada: ${cantidadSalida} unidades`);
        alert(`✅ ${cantidadSalida} artículos despachados (Nueva cantidad: ${cantidadNueva})`);
        
        // 4. Recargar tabla
        cargarBodegaTecnico();

    } catch (error) {
        console.error('❌ Error registrando salida:', error.message);
        alert('Error al registrar salida. Intenta de novo.');
    }
}

// ── Editar Item de Bodega (ejemplo básico) ────
function editarBodegaItem(bodegaId) {
    const item = cacheInventario.find(b => b.id === bodegaId);
    if (!item) return;

    const nuevaCantidad = prompt(
        `Actualizar cantidad de "${item.articulos.nombre}"\nActual: ${item.cantidad}`,
        item.cantidad
    );

    if (nuevaCantidad === null || isNaN(nuevaCantidad)) return;

    actualizarCantidadBodega(bodegaId, parseInt(nuevaCantidad));
}

async function actualizarCantidadBodega(bodegaId, nuevaCantidad) {
    try {
        const { error } = await supabase
            .from('bodega')
            .update({ cantidad: nuevaCantidad })
            .eq('id', bodegaId);

        if (error) throw error;

        console.log(`✅ Cantidad actualizada`);
        cargarBodegaTecnico();

    } catch (error) {
        console.error('❌ Error actualizando:', error.message);
        alert('Error al actualizar cantidad.');
    }
}