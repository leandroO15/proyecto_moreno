/**
 * app.js — Dirección de Bienestar · Universidad Nacional de Moreno
 *
 * Flujo:
 *  1. Estudiante ingresa Nombre, Apellido, DNI y Email antes de arrancar el wizard.
 *  2. Cada resultado guarda la consulta en Supabase (Autogestión → estado Resuelto).
 *  3. Si escala, la consulta previa se ACTUALIZA a "A resolver" — sin duplicados.
 *  4. Mail via Google Apps Script solo para consultas "A resolver".
 */

/* ============================================================
   CONFIGURACIÓN
   ============================================================ */
const SUPABASE_URL    = 'https://uqksnltvpqmsjtajrfar.supabase.co';
const SUPABASE_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxa3NubHR2cHFtc2p0YWpyZmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTIxNDUsImV4cCI6MjA5NjY4ODE0NX0.Cm3htm58b3X_hQHi8K-jF45HyZK9vSVNBiFGkmjdgyg';
const EMAIL_BIENESTAR = 'proyecto.bienestar.moreno@gmail.com';
const GAS_URL         = 'https://script.google.com/macros/s/AKfycbzJVjaQNgbKoxw-vK5rjbUvkyLhiCXmEmLFLYQEil4hdRfBiXPODqo_NCNI4CZxSYqHkA/exec';

/* ============================================================
   SESIÓN DEL ESTUDIANTE
   ============================================================ */
let sesionEstudiante = null; // { nombre, apellido, dni, email, consultaId? }

/* ============================================================
   UTILIDADES
   ============================================================ */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })
    + ' ' + d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}

function sbHeaders(extra = {}) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer':        'return=representation',
    ...extra
  };
}

/* ============================================================
   SUPABASE — GUARDAR CONSULTA
   Autogestión → estado "Resuelto" (se resolvió solo con la guía)
   A resolver  → estado "Pendiente" (necesita atención del equipo)
   ============================================================ */
async function saveConsulta(data) {
  const esAutogestion = (data.tipo || 'Autogestión') === 'Autogestión';
  const payload = {
    nombre:      (data.nombre      || '').trim(),
    apellido:    (data.apellido    || '').trim(),
    dni:         (data.dni         || '').trim(),
    email:       (data.email       || '').trim(),
    area:        data.area         || '',
    descripcion: (data.descripcion || '').trim(),
    tipo:        data.tipo         || 'Autogestión',
    estado:      esAutogestion ? 'Resuelto' : 'Pendiente',
    archivado:   false
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/consultas`, {
      method:  'POST',
      headers: sbHeaders(),
      body:    JSON.stringify(payload)
    });
    if (!res.ok) { console.error('Supabase POST error:', await res.text()); return payload; }
    const rows = await res.json();
    return rows[0] || payload;
  } catch(e) {
    console.error('Error guardando consulta:', e);
    return payload;
  }
}

/* ============================================================
   SUPABASE — ACTUALIZAR consulta existente a "A resolver"
   ============================================================ */
async function escalarConsulta(id, descripcion) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/consultas?id=eq.${id}`, {
      method:  'PATCH',
      headers: sbHeaders(),
      body:    JSON.stringify({ tipo: 'A resolver', estado: 'Pendiente', descripcion })
    });
    if (!res.ok) console.error('Supabase PATCH error:', await res.text());
  } catch(e) {
    console.error('Error escalando consulta:', e);
  }
}

/* ============================================================
   MAIL VIA GOOGLE APPS SCRIPT
   ============================================================ */
function enviarMail(consulta) {
  fetch(GAS_URL, {
    method:  'POST',
    mode:    'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre:      consulta.nombre,
      apellido:    consulta.apellido,
      dni:         consulta.dni,
      email:       consulta.email || '',
      area:        consulta.area,
      descripcion: consulta.descripcion || '(sin descripción adicional)',
      tipo:        consulta.tipo,
      fecha:       formatDateTime(consulta.timestamp || new Date().toISOString())
    })
  }).catch(() => console.warn('Mail no enviado.'));
}

/* ============================================================
   PANTALLA DE IDENTIFICACIÓN INICIAL
   ============================================================ */
function mostrarPantallaIdentificacion(wrapperId, onIdentificado) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  const pantalla = document.createElement('div');
  pantalla.id = 'ident-screen';
  pantalla.className = 'ident-screen';
  pantalla.innerHTML = `
    <div class="ident-screen-card">
      <div class="ident-screen-icon">👤</div>
      <h3>Antes de empezar, ingresá tus datos</h3>
      <p>Necesitamos identificarte para registrar tu consulta.</p>
      <div class="ident-grid">
        <div class="form-group">
          <label for="ident-nombre">Nombre <span class="req">*</span></label>
          <input type="text" id="ident-nombre" placeholder="Tu nombre" autocomplete="given-name" />
          <span class="field-error" id="err-ident-nombre">Ingresá tu nombre.</span>
        </div>
        <div class="form-group">
          <label for="ident-apellido">Apellido <span class="req">*</span></label>
          <input type="text" id="ident-apellido" placeholder="Tu apellido" autocomplete="family-name" />
          <span class="field-error" id="err-ident-apellido">Ingresá tu apellido.</span>
        </div>
        <div class="form-group">
          <label for="ident-dni">DNI <span class="req">*</span></label>
          <input type="text" id="ident-dni" placeholder="Ej: 38123456" inputmode="numeric" maxlength="8" />
          <span class="field-error" id="err-ident-dni">DNI inválido (7 u 8 dígitos).</span>
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label for="ident-email">Email <span class="req">*</span></label>
          <input type="email" id="ident-email" placeholder="tu@email.com" autocomplete="email" />
          <span class="field-error" id="err-ident-email">Ingresá un email válido.</span>
        </div>
      </div>
      <button class="btn btn-primary" id="ident-btn-confirmar"
        style="margin-top:1rem;width:100%;justify-content:center;">
        Comenzar consulta →
      </button>
    </div>`;

  wrapper.parentNode.insertBefore(pantalla, wrapper);
  wrapper.style.display = 'none';
  setTimeout(() => document.getElementById('ident-nombre')?.focus(), 100);

  function confirmar() {
    const nombre   = document.getElementById('ident-nombre').value.trim();
    const apellido = document.getElementById('ident-apellido').value.trim();
    const dni      = document.getElementById('ident-dni').value.trim();
    const email    = document.getElementById('ident-email').value.trim();
    let ok = true;

    [
      { val: nombre,   errId: 'err-ident-nombre',   inputId: 'ident-nombre',   check: v => v.length > 0 },
      { val: apellido, errId: 'err-ident-apellido',  inputId: 'ident-apellido', check: v => v.length > 0 },
      { val: dni,      errId: 'err-ident-dni',       inputId: 'ident-dni',      check: v => /^\d{7,8}$/.test(v) },
      { val: email,    errId: 'err-ident-email',     inputId: 'ident-email',    check: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) }
    ].forEach(({ val, errId, inputId, check }) => {
      const valid = check(val);
      document.getElementById(errId)?.classList.toggle('visible', !valid);
      document.getElementById(inputId)?.classList.toggle('error', !valid);
      if (!valid) ok = false;
    });

    if (!ok) return;

    sesionEstudiante = { nombre, apellido, dni, email, consultaId: null };
    pantalla.style.opacity = '0';
    pantalla.style.transition = 'opacity .25s';
    setTimeout(() => {
      pantalla.remove();
      wrapper.style.display = '';
      onIdentificado(sesionEstudiante);
    }, 250);
  }

  document.getElementById('ident-btn-confirmar').addEventListener('click', confirmar);
  pantalla.querySelectorAll('input').forEach(input =>
    input.addEventListener('keydown', e => { if (e.key === 'Enter') confirmar(); })
  );
}

/* ============================================================
   FORMULARIO DE ESCALADA
   Cuando el estudiante llegó a un resultado (consulta ya guardada),
   actualiza esa consulta a Escalada en vez de crear una nueva.
   Si no hay consultaId (vino del botón libre), crea una nueva.
   ============================================================ */
function initContactForm(formId, areaDefault) {
  const form = document.getElementById(formId);
  if (!form) return;

  if (areaDefault) {
    const sel = form.querySelector('[name="area"]');
    if (sel) sel.value = areaDefault;
  }

  function prefillIdentidad() {
    if (!sesionEstudiante) return;
    ['nombre', 'apellido', 'dni'].forEach(campo => {
      const input = form.querySelector(`[name="${campo}"]`);
      if (input) {
        input.value = sesionEstudiante[campo];
        const group = input.closest('.form-group');
        if (group) group.style.display = 'none';
      }
    });
    if (!form.querySelector('.ident-prefill-banner')) {
      const banner = document.createElement('div');
      banner.className = 'ident-prefill-banner';
      banner.innerHTML = `👤 <strong>${escapeHTML(sesionEstudiante.nombre)} ${escapeHTML(sesionEstudiante.apellido)}</strong> · DNI ${escapeHTML(sesionEstudiante.dni)}`;
      form.querySelector('.form-grid')?.before(banner);
    }
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const descField = form.querySelector('[name="descripcion"]');
    const descErr   = form.querySelector('[data-error="descripcion"]');
    if (!descField?.value.trim()) {
      descField?.classList.add('error');
      descErr?.classList.add('visible');
      return;
    }
    descField.classList.remove('error');
    descErr?.classList.remove('visible');

    const btn = form.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    const ident = sesionEstudiante || {
      nombre:   form.querySelector('[name="nombre"]')?.value  || '',
      apellido: form.querySelector('[name="apellido"]')?.value || '',
      dni:      form.querySelector('[name="dni"]')?.value      || '',
      email:    ''
    };

    let consulta;

    if (sesionEstudiante?.consultaId) {
      // Ya existe una consulta de autogestión → actualizar a "A resolver"
      await escalarConsulta(sesionEstudiante.consultaId, descField.value);
      consulta = {
        nombre:      ident.nombre,
        apellido:    ident.apellido,
        dni:         ident.dni,
        email:       ident.email || '',
        area:        form.querySelector('[name="area"]')?.value || areaDefault || '',
        descripcion: descField.value,
        tipo:        'A resolver',
        timestamp:   new Date().toISOString()
      };
    } else {
      // Sin consulta previa → crear nueva "A resolver"
      consulta = await saveConsulta({
        nombre:      ident.nombre,
        apellido:    ident.apellido,
        dni:         ident.dni,
        email:       ident.email || '',
        area:        form.querySelector('[name="area"]')?.value || areaDefault || '',
        descripcion: descField.value,
        tipo:        'A resolver'
      });
    }

    enviarMail(consulta);
    showFormConfirm(form);
  });

  const observer = new MutationObserver(() => {
    const section = form.closest('.form-section');
    if (section && !section.classList.contains('hidden')) {
      prefillIdentidad();
      observer.disconnect();
    }
  });
  const section = form.closest('.form-section');
  if (section) observer.observe(section, { attributes: true, attributeFilter: ['class'] });
  prefillIdentidad();
}

function showFormConfirm(form) {
  const section = form.closest('.form-section');
  if (!section) return;
  form.style.display = 'none';
  section.querySelector('.form-confirm')?.classList.add('visible');
}

/* ============================================================
   WIZARD ENGINE
   ============================================================ */
function initWizard(steps, containerId, totalSteps, areaForm) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let currentStep = 0;
  let stepNumber  = 1;

  function renderStep(stepIndex, visibleNum) {
    const step = steps[stepIndex];
    container.innerHTML = '';

    const pct         = Math.round(((visibleNum - 1) / totalSteps) * 100);
    const progressHTML = buildProgress(`Paso ${visibleNum} de ${totalSteps}`, pct);
    const optionsHTML  = step.options.map(opt =>
      `<button class="btn btn-outline wizard-opt" data-opt='${JSON.stringify(opt)}'>${escapeHTML(opt.label)}</button>`
    ).join('');

    container.innerHTML = progressHTML + `
      <div class="wizard-card">
        <p class="wizard-question">${escapeHTML(step.question)}</p>
        <div class="wizard-options">${optionsHTML}</div>
        <div class="duda-btn-wrap">
          <span>¿No encontrás lo que buscás?</span>
          <button class="btn btn-sm btn-warning show-form-btn">Mi duda no quedó resuelta</button>
        </div>
      </div>`;

    container.querySelectorAll('.wizard-opt').forEach(btn =>
      btn.addEventListener('click', function() {
        handleOption(JSON.parse(this.getAttribute('data-opt')), visibleNum);
      })
    );
    container.querySelector('.show-form-btn').addEventListener('click', () => showContactForm(areaForm));
  }

  function handleOption(opt, currentVisibleNum) {
    if (opt.result) {
      renderResult(opt.result);
    } else if (typeof opt.next === 'number') {
      currentStep = opt.next;
      stepNumber  = currentVisibleNum + 1;
      renderStep(currentStep, stepNumber);
    }
  }

  async function renderResult(result) {
    container.innerHTML = '';

    const progressHTML = buildProgress('Resultado', 100);
    const iconMap      = { warning: '⚠️', success: '✅', info: 'ℹ️' };
    const icon         = result.icon  || iconMap[result.type] || 'ℹ️';
    const title        = result.title || 'Información';
    const linkBtnHTML  = result.link
      ? `<a href="${result.link}" target="_blank" rel="noopener" class="btn btn-primary">${escapeHTML(result.linkText || 'Más información')}</a>`
      : '';

    const ident = sesionEstudiante;
    const identBanner = ident
      ? `<div class="ident-ok">👤 <strong>${escapeHTML(ident.nombre)} ${escapeHTML(ident.apellido)}</strong> · DNI ${escapeHTML(ident.dni)} · Consulta registrada ✅</div>`
      : '';

    // URL de vuelta al inicio (raíz del sitio)
    const backUrl = window.location.pathname.includes('/proyectomoreno/')
      ? '/proyectomoreno/index.html'
      : 'index.html';

    container.innerHTML = progressHTML + `
      <div class="wizard-result">
        <div class="result-box ${result.type}">
          <span class="result-icon">${icon}</span>
          <div class="result-content">
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(result.text)}</p>
          </div>
        </div>
        ${identBanner}
        <div class="result-actions">
          ${linkBtnHTML}
          <a href="${backUrl}" class="btn btn-ghost">← Volver al inicio</a>
          <button class="btn btn-outline show-form-btn-result">Contactar a Bienestar</button>
        </div>
      </div>`;

    // Guardar consulta Autogestión → estado Resuelto
    if (ident) {
      const consulta = await saveConsulta({
        nombre:      ident.nombre,
        apellido:    ident.apellido,
        dni:         ident.dni,
        email:       ident.email || '',
        area:        areaForm,
        descripcion: result.title || '',
        tipo:        'Autogestión'
      });
      // Guardar el id para poder actualizar a Escalada sin duplicar
      if (consulta.id && sesionEstudiante) {
        sesionEstudiante.consultaId = consulta.id;
      }
      // Mail solo si el resultado requiere acción (success con showForm)
      // Para autogestión no enviamos mail para no saturar la casilla
    }

    container.querySelector('.show-form-btn-result')?.addEventListener('click', () => showContactForm(areaForm));
    if (result.showForm) showContactForm(areaForm);
  }

  function showContactForm(area) {
    const formSection = document.getElementById('contact-form-section');
    if (!formSection) return;
    formSection.classList.remove('hidden');
    setTimeout(() => formSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    const areaSelect = formSection.querySelector('[name="area"]');
    if (areaSelect && area) areaSelect.value = area;
  }

  renderStep(0, 1);
}

/* ============================================================
   HELPER: barra de progreso
   ============================================================ */
function buildProgress(label, pct) {
  return `
    <div class="progress-bar-wrap">
      <div class="progress-label">
        <span>${escapeHTML(label)}</span>
        <span>${pct}% completado</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
    </div>`;
}

/* ============================================================
   HEADER ACTIVE LINK + HAMBURGUESA
   ============================================================ */
function initActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.header-nav a').forEach(link => {
    if (link.getAttribute('href').split('/').pop() === path) link.classList.add('active');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initActiveNav();
  const menuBtn   = document.getElementById('menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function() {
      mobileNav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', mobileNav.classList.contains('open'));
    });
    mobileNav.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => mobileNav.classList.remove('open'))
    );
  }
});
