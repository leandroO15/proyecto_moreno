/**
 * admin.js — Panel de seguimiento · Dirección de Bienestar · UNM
 *
 * - Login con contraseña
 * - Tabla con tipo de consulta diferenciado (Autogestión / Escalada)
 * - Exportación a XLSX via SheetJS
 * - Filtros por área, estado y tipo
 * - Limpiar resueltos
 */

/* ============================================================
   CONSTANTES
   ============================================================ */
var STORAGE_KEY = 'bienestar_consultas';
var ADMIN_PASS  = 'bienestar2024';

/* ============================================================
   UTILIDADES
   ============================================================ */

function formatDateTime(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  }) + ' ' + d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit'
  });
}

function escapeHTML(str) {
  if (!str) return '';
  var d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/* ============================================================
   STORAGE
   ============================================================ */

function getConsultas() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveConsultas(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/* ============================================================
   AUTENTICACIÓN
   ============================================================ */

var loginSection = document.getElementById('admin-login');
var adminPanel   = document.getElementById('admin-panel');
var loginForm    = document.getElementById('login-form');
var loginError   = document.getElementById('login-error');
var passInput    = document.getElementById('admin-pass');

loginForm.addEventListener('submit', function (e) {
  e.preventDefault();
  if (passInput.value === ADMIN_PASS) {
    loginSection.style.display = 'none';
    adminPanel.classList.add('visible');
    renderPanel();
  } else {
    loginError.textContent = 'Contraseña incorrecta. Intentá de nuevo.';
    loginError.classList.add('visible');
    passInput.value = '';
    passInput.focus();
  }
});

passInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') loginForm.dispatchEvent(new Event('submit'));
});

/* ============================================================
   RENDER
   ============================================================ */

function renderPanel() {
  aplicarFiltros();
}

function renderStats(consultas) {
  var total     = consultas.length;
  var pendiente = consultas.filter(function (c) { return c.estado === 'Pendiente'; }).length;
  var proceso   = consultas.filter(function (c) { return c.estado === 'En proceso'; }).length;
  var resuelto  = consultas.filter(function (c) { return c.estado === 'Resuelto'; }).length;
  var escaladas = consultas.filter(function (c) { return c.tipo === 'Escalada'; }).length;

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-pendiente').textContent = pendiente;
  document.getElementById('stat-proceso').textContent   = proceso;
  document.getElementById('stat-resuelto').textContent  = resuelto;
  var statEscaladas = document.getElementById('stat-escaladas');
  if (statEscaladas) statEscaladas.textContent = escaladas;
}

/* ============================================================
   ACCIONES
   ============================================================ */

function updateEstado(id, nuevoEstado) {
  var consultas = getConsultas().map(function (c) {
    if (c.id === id) c.estado = nuevoEstado;
    return c;
  });
  saveConsultas(consultas);
  renderStats(consultas);
}

function deleteConsulta(id) {
  saveConsultas(getConsultas().filter(function (c) { return c.id !== id; }));
  aplicarFiltros();
}

/* ---- Exportar XLSX via SheetJS ---- */
function exportarXLSX() {
  var consultas = getConsultas();
  if (consultas.length === 0) {
    alert('No hay consultas para exportar.');
    return;
  }

  // Verificar que SheetJS esté cargado
  if (typeof XLSX === 'undefined') {
    alert('Error: librería de Excel no disponible. Revisá la conexión a internet.');
    return;
  }

  var rows = consultas
    .slice()
    .sort(function (a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })
    .map(function (c) {
      return {
        'Fecha y Hora': formatDateTime(c.timestamp),
        'Nombre':       c.nombre,
        'Apellido':     c.apellido,
        'DNI':          c.dni,
        'Área':         c.area,
        'Tipo':         c.tipo || 'Autogestión',
        'Descripción':  c.descripcion || '',
        'Estado':       c.estado
      };
    });

  var ws   = XLSX.utils.json_to_sheet(rows);
  var wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consultas');

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 18 }, // Fecha
    { wch: 16 }, // Nombre
    { wch: 16 }, // Apellido
    { wch: 12 }, // DNI
    { wch: 20 }, // Área
    { wch: 14 }, // Tipo
    { wch: 50 }, // Descripción
    { wch: 14 }  // Estado
  ];

  var fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, 'consultas_bienestar_' + fecha + '.xlsx');
}

function limpiarResueltos() {
  var consultas = getConsultas();
  var resueltos = consultas.filter(function (c) { return c.estado === 'Resuelto'; });
  if (resueltos.length === 0) {
    alert('No hay consultas resueltas para limpiar.');
    return;
  }
  if (!confirm('¿Eliminar las ' + resueltos.length + ' consulta(s) con estado "Resuelto"? Esta acción no se puede deshacer.')) return;
  saveConsultas(consultas.filter(function (c) { return c.estado !== 'Resuelto'; }));
  aplicarFiltros();
}

function cerrarSesion() {
  loginSection.style.display = 'flex';
  adminPanel.classList.remove('visible');
  passInput.value = '';
  loginError.classList.remove('visible');
}

/* ============================================================
   EVENTOS TOOLBAR
   ============================================================ */
document.getElementById('btn-exportar').addEventListener('click', exportarXLSX);
document.getElementById('btn-limpiar').addEventListener('click', limpiarResueltos);
document.getElementById('btn-recargar').addEventListener('click', function () { aplicarFiltros(); });
document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

/* ============================================================
   FILTROS
   ============================================================ */
document.getElementById('filtro-area').addEventListener('change',   aplicarFiltros);
document.getElementById('filtro-estado').addEventListener('change', aplicarFiltros);
document.getElementById('filtro-tipo').addEventListener('change',   aplicarFiltros);

function aplicarFiltros() {
  var areaFiltro   = document.getElementById('filtro-area').value;
  var estadoFiltro = document.getElementById('filtro-estado').value;
  var tipoFiltro   = document.getElementById('filtro-tipo').value;
  var consultas    = getConsultas();

  var filtradas = consultas.filter(function (c) {
    var matchArea   = !areaFiltro   || c.area   === areaFiltro;
    var matchEstado = !estadoFiltro || c.estado  === estadoFiltro;
    var matchTipo   = !tipoFiltro   || (c.tipo || 'Autogestión') === tipoFiltro;
    return matchArea && matchEstado && matchTipo;
  });

  renderStats(consultas);
  renderTableWithData(filtradas);
}

/* ============================================================
   TABLA
   ============================================================ */
function renderTableWithData(consultas) {
  var tbody = document.getElementById('tabla-body');
  tbody.innerHTML = '';

  if (consultas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">' +
      '<div class="empty-icon">🔍</div>' +
      '<p>No hay consultas que coincidan con los filtros.</p>' +
      '</td></tr>';
    return;
  }

  var sorted = consultas.slice().sort(function (a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  sorted.forEach(function (c) {
    var tr = document.createElement('tr');

    // Badge de estado
    var badgeEstado = 'badge-pendiente';
    if (c.estado === 'En proceso') badgeEstado = 'badge-proceso';
    if (c.estado === 'Resuelto')   badgeEstado = 'badge-resuelto';

    // Badge de tipo — diferenciación visual
    var tipo = c.tipo || 'Autogestión';
    var badgeTipo = tipo === 'Escalada'
      ? '<span class="badge badge-escalada">🔴 Escalada</span>'
      : '<span class="badge badge-autogestion">🟢 Autogestión</span>';

    var desc = c.descripcion
      ? escapeHTML(c.descripcion)
      : '<em style="color:#94a3b8;">Sin descripción (autogestión)</em>';

    tr.innerHTML =
      '<td>' + escapeHTML(formatDateTime(c.timestamp)) + '</td>' +
      '<td>' + escapeHTML(c.nombre)   + '</td>' +
      '<td>' + escapeHTML(c.apellido) + '</td>' +
      '<td>' + escapeHTML(c.dni)      + '</td>' +
      '<td><span class="badge ' + badgeEstado + '">' + escapeHTML(c.area) + '</span></td>' +
      '<td>' + badgeTipo + '</td>' +
      '<td class="desc-cell">' + desc + '</td>' +
      '<td>' +
        '<select class="status-select" data-id="' + c.id + '" aria-label="Estado">' +
          '<option value="Pendiente"'  + (c.estado === 'Pendiente'  ? ' selected' : '') + '>Pendiente</option>'  +
          '<option value="En proceso"' + (c.estado === 'En proceso' ? ' selected' : '') + '>En proceso</option>' +
          '<option value="Resuelto"'   + (c.estado === 'Resuelto'   ? ' selected' : '') + '>Resuelto</option>'   +
        '</select>' +
      '</td>' +
      '<td>' +
        '<button class="btn btn-sm btn-danger delete-btn" data-id="' + c.id + '" title="Eliminar">🗑️</button>' +
      '</td>';

    tbody.appendChild(tr);
  });

  // Eventos de cambio de estado
  tbody.querySelectorAll('.status-select').forEach(function (sel) {
    sel.addEventListener('change', function () {
      updateEstado(this.getAttribute('data-id'), this.value);
      aplicarFiltros();
    });
  });

  // Eventos de eliminar
  tbody.querySelectorAll('.delete-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (confirm('¿Eliminar esta consulta?')) {
        deleteConsulta(this.getAttribute('data-id'));
      }
    });
  });
}
