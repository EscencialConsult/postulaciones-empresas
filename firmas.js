/**
 * MÓDULO DE FIRMAS — ONE Talent Hub
 * --------------------------------------------------------------
 * Librería reutilizable para captura de firmas manuscritas digitales.
 * Requiere: signature_pad (CDN)
 *
 * Uso:
 *   const mgr = new FirmaManager('canvas-id', { penColor: '#1a181d' });
 *   mgr.toBase64()  → string base64 (para enviar al backend)
 *   mgr.toDataURL() → data URL completa (para previsualizar)
 *   mgr.isEmpty()   → boolean
 *   mgr.clear()     → limpiar canvas
 */

/* global SignaturePad */

class FirmaManager {
  /**
   * @param {string} canvasId  - ID del elemento <canvas>
   * @param {object} [opts]    - Opciones opcionales
   * @param {string} [opts.penColor='#1a181d']
   * @param {number} [opts.minWidth=1]
   * @param {number} [opts.maxWidth=3]
   * @param {string} [opts.backgroundColor='white']
   */
  constructor(canvasId, opts = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) throw new Error('Canvas no encontrado: ' + canvasId);

    this.signaturePad = new SignaturePad(this.canvas, {
      minWidth: opts.minWidth || 1,
      maxWidth: opts.maxWidth || 3,
      penColor: opts.penColor || '#1a181d',
      backgroundColor: opts.backgroundColor || 'white'
    });

    this._ajustarTamanio();
    window.addEventListener('resize', () => this._ajustarTamanio());
  }

  /* ---- Métodos públicos ---- */

  isEmpty() {
    return this.signaturePad.isEmpty();
  }

  hasMinStrokes(minCount) {
    const data = this.signaturePad.toData();
    return data && data.length >= minCount;
  }

  clear() {
    this.signaturePad.clear();
  }

  /** Devuelve la firma como data URL (data:image/png;base64,...). */
  toDataURL() {
    return this.signaturePad.toDataURL('image/png');
  }

  /** Devuelve solo el string base64 (sin prefijo). */
  toBase64() {
    return this.toDataURL().split(',')[1] || '';
  }

  /** Devuelve los datos de los trazos (para serializar). */
  toData() {
    return this.signaturePad.toData();
  }

  /** Restaura trazos previamente guardados con toData(). */
  fromData(data) {
    this.signaturePad.fromData(data);
  }

  /** Deshabilitar / habilitar escritura. */
  off() { this.signaturePad.off(); }
  on()  { this.signaturePad.on();  }

  /* ---- Métodos privados ---- */

  _ajustarTamanio() {
    if (!this.canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * ratio;
    this.canvas.height = rect.height * ratio;
    const ctx = this.canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    // Repintar fondo blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }
}


/**
 * Helper: crea el HTML de una sección de firma (canvas + controles).
 *
 * @param {object} cfg
 * @param {string} cfg.id          - Sufijo para IDs únicos (ej: 'consentimiento')
 * @param {string} cfg.titulo      - Título de la sección
 * @param {string} cfg.descripcion - Texto descriptivo
 * @param {string} cfg.checkboxLabel - Label del checkbox de aceptación
 * @returns {string} HTML
 */
function crearHTMLFirma(cfg) {
  return `
    <div class="firma-seccion" id="firma-${cfg.id}">
      <h3 class="firma-titulo">${cfg.titulo}</h3>
      <p class="firma-desc">${cfg.descripcion}</p>
      <div class="firma-canvas-wrap">
        <canvas id="canvas-${cfg.id}" class="firma-canvas"></canvas>
        <div class="firma-placeholder" id="placeholder-${cfg.id}">
          Firmá aquí con el dedo o el mouse
        </div>
      </div>
      <div class="firma-controles">
        <button type="button" class="btn btn-sec btn-firma-limpiar" id="limpiar-${cfg.id}">
          Borrar firma
        </button>
        <span class="firma-estado" id="estado-${cfg.id}"></span>
      </div>
      <div class="check" style="margin-top:14px">
        <input type="checkbox" id="check-${cfg.id}" required>
        <label for="check-${cfg.id}">${cfg.checkboxLabel}</label>
      </div>
    </div>`;
}


/**
 * Inicializa un FirmaManager y conecta los controles (botón borrar, placeholder, checkbox).
 *
 * @param {string} id        - Sufijo (mismo que en crearHTMLFirma)
 * @param {object} [opts]    - Opciones para FirmaManager
 * @returns {FirmaManager}
 */
function initFirma(id, opts = {}) {
  const mgr = new FirmaManager('canvas-' + id, opts);

  // Botón borrar
  const btnLimpiar = document.getElementById('limpiar-' + id);
  if (btnLimpiar) {
    btnLimpiar.addEventListener('click', () => {
      mgr.clear();
      const placeholder = document.getElementById('placeholder-' + id);
      if (placeholder) placeholder.style.display = 'flex';
      actualizarEstadoFirma(id, false);
    });
  }

  // Placeholder: se oculta al empezar a firmar
  const placeholder = document.getElementById('placeholder-' + id);
  if (placeholder) {
    mgr.signaturePad.addEventListener('beginStroke', () => {
      placeholder.style.display = 'none';
    });
    mgr.signaturePad.addEventListener('endStroke', () => {
      actualizarEstadoFirma(id, !mgr.isEmpty());
    });
  }

  return mgr;
}

function actualizarEstadoFirma(id, firmado) {
  const el = document.getElementById('estado-' + id);
  if (!el) return;
  if (firmado) {
    el.textContent = 'Firma capturada';
    el.classList.add('firma-ok');
    el.classList.remove('firma-vacia', 'firma-error');
  } else {
    el.textContent = '';
    el.classList.remove('firma-ok', 'firma-error');
  }
}
