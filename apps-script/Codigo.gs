/**
 * ===================================================================
 *  PLATAFORMA DE POSTULANTES — Backend (Google Apps Script)
 * ===================================================================
 *
 *  Este script actúa como API para:
 *    - Recibir postulaciones (formulario público) y guardarlas en Sheets.
 *    - Autenticar empresas/consultoras (login por usuario).
 *    - Listar / buscar perfiles y exportarlos.
 *
 *  CÓMO INSTALAR (resumido — ver README.md para el paso a paso):
 *    1. Crea una Hoja de Cálculo de Google (Google Sheet).
 *    2. Menú Extensiones > Apps Script. Borra el contenido y pega este archivo.
 *    3. Guarda. Ejecuta una vez la función setup() (autoriza permisos).
 *    4. Implementar > Nueva implementación > Aplicación web:
 *          - Ejecutar como:  Yo (tu cuenta)
 *          - Quién tiene acceso: Cualquier usuario
 *       Copia la URL /exec y pégala en config.js del frontend.
 *
 * ===================================================================
 */

/* -------------------------------------------------------------------
 *  CONFIGURACIÓN
 * ----------------------------------------------------------------- */

var HOJA_POSTULANTES = 'Postulantes';
var HOJA_USUARIOS    = 'Usuarios';
var HOJA_BUSQUEDAS   = 'Busquedas';
var HOJA_PERFILES    = 'Perfiles';
var HOJA_NOTIFICACIONES_VACANTES = 'NotificacionesVacantes';
var HOJA_EMAILS = 'Emails';

// Carpeta de Google Drive donde se guardan los archivos de CV.
var CARPETA_CV = 'CVs Postulantes';
// Tamaño máximo del CV (en MB).
var CV_MAX_MB = 5;
var URL_PLATAFORMA = 'https://hubtalent.onelabs.pro/';
var URL_LOGO_EMAIL = 'https://hubtalent.onelabs.pro/assets/logo-trim.png';
var MATCH_MINIMO_NOTIFICACION = 55;
var MAX_NOTIFICACIONES_DIARIAS_POSTULANTE = 3;

// URL pública del frontend (para armar los enlaces de recuperación de
// contraseña que se envían por correo). Cambiala si usás un dominio propio.
var URL_APP = 'https://hubtalent.onelabs.pro';
// Duración del enlace de recuperación de contraseña (minutos).
var RESET_MINUTOS = 60;

// Columnas de la hoja Postulantes (el ORDEN define las columnas del Sheet).
var COLUMNAS_POSTULANTES = [
  'ID', 'FechaRegistro',
  // Etapa 1
  'Nombre', 'Apellido', 'Email', 'Telefono', 'PuestoDeseado',
  // Etapa 2
  'FechaNacimiento', 'Identificacion', 'Provincia', 'CodigoPostalCiudad', 'PerfilProfesional',
  // Etapa 3
  'Formacion', 'DescripcionPerfil',
  // Etapa 4
  'DispViajar', 'DispCambioResidencia', 'Idiomas',
  // Etapa 5
  'PrimerEmpleo', 'Experiencias',
  // Archivo del CV
  'CVNombre', 'CVUrl',
  // Firmas
  'FirmaConsentimientoUrl', 'FechaFirmaConsentimiento',
  'FirmaConformidadUrl', 'FechaFirmaConformidad',
  // Vínculo con una búsqueda publicada (si se postuló desde el inicio)
  'BusquedaID', 'BusquedaPuesto',
  // Respuestas a las preguntas de filtrado de esa búsqueda (JSON [{pregunta, respuesta}])
  'RespuestasBusqueda'
];

var COLUMNAS_USUARIOS = [
  'Usuario', 'Password', 'Empresa', 'Token', 'TokenExpira',
  'Email', 'FechaRegistro', 'Rol', 'Estado', 'Cuit', 'Rubro',
  'Nombre', 'Apellido', 'Telefono',
  'Dni', 'EstadoVerificación', 'FechaVerificación', 'ConfianzaVerificación',
  'AceptoTerminos', 'FechaAceptoTerminos',
  'SelfieUrl', 'NombreVerificado',
  'VerificacionLegacyId', 'VerificacionLegacyUrl', 'VerificacionLegacyEstado', 'VerificacionLegacyFecha',
  'DniFrenteUrl', 'DniDorsoUrl',
  'FirmaLegalUrl', 'FechaFirmaLegal',
  // Recuperación de contraseña (enlace temporal)
  'ResetToken', 'ResetExpira'
];

// Columnas de la hoja Busquedas (avisos de empleo publicados por empresas).
// El ORDEN define las columnas del Sheet.
var COLUMNAS_BUSQUEDAS = [
  'ID', 'FechaCreacion', 'FechaActualizacion',
  'UsuarioEmpresa', 'Empresa',
  'Puesto', 'Descripcion',  // Puesto = Título ; Descripcion = Misión/resumen
  'Provincia', 'Localidad', 'Modalidad', 'Jornada', 'Vacantes',
  'Estado',  // borrador | activa | pausada | cerrada
  // Ampliación del aviso (los índices 0..12 se mantienen para no romper nada)
  'Area', 'TipoContrato', 'Zona',
  'Responsabilidades', 'RequisitosExcluyentes', 'RequisitosDeseables',
  'Habilidades', 'IdiomaRequerido', 'NivelIdioma',
  'SalarioMin', 'SalarioMax', 'OcultarSalario',
  'Horario', 'Beneficios', 'BeneficiosOtros',
  'FechaVencimiento', 'Reclutador', 'Pregunta1', 'Pregunta2'
];

// Columnas de la hoja Perfiles (cuenta del postulante; una fila por email).
// El perfil se reutiliza al postularse a distintas búsquedas.
var COLUMNAS_PERFILES = [
  'Email', 'Password', 'Token', 'TokenExpira', 'FechaRegistro', 'FechaActualizacion',
  'Nombre', 'Apellido', 'Telefono', 'PuestoDeseado',
  'FechaNacimiento', 'Identificacion', 'Provincia', 'CodigoPostalCiudad', 'PerfilProfesional',
  'Formacion', 'DescripcionPerfil', 'DispViajar', 'DispCambioResidencia', 'Idiomas',
  'PrimerEmpleo', 'Experiencias', 'CVNombre', 'CVUrl',
  'FirmaConsentimientoUrl', 'FirmaConformidadUrl',
  // Recuperación de contraseña (enlace temporal)
  'ResetToken', 'ResetExpira'
];

var COLUMNAS_NOTIFICACIONES_VACANTES = [
  'Fecha', 'BusquedaID', 'BusquedaPuesto', 'Empresa',
  'EmailPostulante', 'NombrePostulante',
  'Puntaje', 'Motivos', 'Estado', 'Error'
];

var COLUMNAS_EMAILS = [
  'Fecha', 'Contexto', 'Destinatario', 'Asunto', 'Estado', 'Error'
];

// Duración del token de sesión (horas)
var TOKEN_HORAS = 12;

/* -------------------------------------------------------------------
 *  PUNTOS DE ENTRADA HTTP
 * ----------------------------------------------------------------- */

function doGet(e) {
  return manejar(e);
}

function doPost(e) {
  return manejar(e);
}

function manejar(e) {
  try {
    var datos = leerPayload(e);
    var accion = (datos.action || '').toString();

    switch (accion) {
      case 'ping':      return json({ ok: true, mensaje: 'API activa' });
      case 'postular':  return json(guardarPostulante(datos));
      case 'registrar': return json(registrarEmpresa(datos));
      case 'verificarIdentidad': return json(verificarIdentidadDNI(datos));
      case 'login':     return json(login(datos));
      case 'recuperarPassword': return json(recuperarPassword(datos));
      case 'resetearPassword':  return json(resetearPassword(datos));
      case 'miEmpresa': return json(miEmpresa(datos));
      case 'actualizarMiEmpresa': return json(actualizarMiEmpresa(datos));
      case 'listar':    return json(listarPostulantes(datos));
      case 'exportar':  return json(exportarPostulantes(datos));
      case 'listarEmpresas': return json(listarEmpresas(datos));
      case 'aprobarEmpresa': return json(aprobarEmpresa(datos));
      case 'cambiarEstadoVerificacion': return json(cambiarEstadoVerificacion(datos));
      // Búsquedas (avisos de empleo)
      case 'crearBusqueda':         return json(crearBusqueda(datos));
      case 'listarMisBusquedas':    return json(listarMisBusquedas(datos));
      case 'listarBusquedasAdmin':  return json(listarBusquedasAdmin(datos));
      case 'actualizarBusqueda':    return json(actualizarBusqueda(datos));
      case 'cambiarEstadoBusqueda': return json(cambiarEstadoBusqueda(datos));
      case 'eliminarBusqueda':      return json(eliminarBusqueda(datos));
      case 'busquedasPublicas':     return json(busquedasPublicas(datos));
      case 'probarMatchVacante':    return json(probarMatchVacante(datos));
      case 'probarEmail':           return json(probarEmail(datos));
      // Cuenta del postulante (perfil reutilizable)
      case 'registrarPostulante':  return json(registrarPostulante(datos));
      case 'loginPostulante':      return json(loginPostulante(datos));
      case 'miPerfil':             return json(miPerfil(datos));
      case 'actualizarPerfil':     return json(actualizarPerfil(datos));
      case 'postularConPerfil':    return json(postularConPerfil(datos));
      case 'misPostulaciones':     return json(misPostulaciones(datos));
      // Firmas
      case 'firmarPostulacion': return json(firmarPostulacion(datos));
      default:
        return json({ ok: false, error: 'Acción no reconocida: ' + accion });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/**
 * Une los parámetros GET (?action=...) con el cuerpo POST (JSON de texto plano).
 */
function leerPayload(e) {
  var datos = {};
  if (e && e.parameter) {
    for (var k in e.parameter) datos[k] = e.parameter[k];
  }
  if (e && e.postData && e.postData.contents) {
    try {
      var cuerpo = JSON.parse(e.postData.contents);
      for (var j in cuerpo) datos[j] = cuerpo[j];
    } catch (ignore) {}
  }
  return datos;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* -------------------------------------------------------------------
 *  SETUP / UTILIDADES DE HOJAS
 * ----------------------------------------------------------------- */

/**
 * Ejecuta esta función UNA VEZ desde el editor para crear las hojas
 * y un usuario de ejemplo. También puedes volver a ejecutarla sin problema.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var post = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var usu  = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var busq = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var perf = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
  var notif = obtenerHoja(ss, HOJA_NOTIFICACIONES_VACANTES, COLUMNAS_NOTIFICACIONES_VACANTES);
  var emails = obtenerHoja(ss, HOJA_EMAILS, COLUMNAS_EMAILS);

  // Crea un usuario de ejemplo (empresa) si la hoja está vacía.
  if (usu.getLastRow() < 2) {
    usu.appendRow(['empresa1', 'cambiar123', 'Empresa Demo S.A.', '', '', '', new Date(), 'empresa', 'aprobado']);
  }

  // Garantiza que exista un usuario ADMINISTRADOR (cambiar la contraseña luego).
  var valores = usu.getDataRange().getValues();
  var hayAdmin = false;
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][7]).trim().toLowerCase() === 'admin') hayAdmin = true;
  }
  if (!hayAdmin) {
    usu.appendRow(['admin', 'admin123', 'Administración', '', '', '', new Date(), 'admin', 'aprobado']);
    Logger.log('Usuario admin creado -> usuario: admin / contraseña: admin123 (CAMBIAR).');
  }

  aplicarEstiloHoja(post, '#12b981');
  aplicarEstiloHoja(usu, '#d1436f');
  aplicarEstiloHoja(busq, '#6be1e3');
  aplicarEstiloHoja(perf, '#8b5cf6');
  aplicarEstiloHoja(notif, '#b23ca6');
  aplicarEstiloHoja(emails, '#0f766e');

  Logger.log('Setup completo. Hojas listas: %s, %s, %s, %s, %s, %s', HOJA_POSTULANTES, HOJA_USUARIOS, HOJA_BUSQUEDAS, HOJA_PERFILES, HOJA_NOTIFICACIONES_VACANTES, HOJA_EMAILS);
}

/**
 * Devuelve la hoja por nombre; la crea con encabezados si no existe.
 */
function obtenerHoja(ss, nombre, columnas) {
  var hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  }
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(columnas);
    hoja.getRange(1, 1, 1, columnas.length).setFontWeight('bold');
    hoja.setFrozenRows(1);
  } else {
    asegurarColumnas(hoja, columnas);
  }
  return hoja;
}

/**
 * Agrega al encabezado cualquier columna que falte (para hojas ya creadas
 * con una versión anterior del esquema). Idempotente y no destructivo.
 */
function asegurarColumnas(hoja, columnas) {
  var ultimaCol = Math.max(hoja.getLastColumn(), 1);
  var encabezados = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0];
  var faltantes = [];
  columnas.forEach(function (c) {
    if (encabezados.indexOf(c) === -1) faltantes.push(c);
  });
  if (faltantes.length) {
    hoja.getRange(1, encabezados.length + 1, 1, faltantes.length).setValues([faltantes]);
    hoja.getRange(1, 1, 1, encabezados.length + faltantes.length).setFontWeight('bold');
  }
}

/**
 * Aplica formato legible a cada hoja creada por setup().
 * Es seguro volver a ejecutarla: actualiza estilos, filtros y anchos sin borrar datos.
 */
function aplicarEstiloHoja(hoja, color) {
  if (!hoja) return;

  var lastRow = Math.max(hoja.getLastRow(), 1);
  var lastCol = Math.max(hoja.getLastColumn(), 1);

  hoja.setFrozenRows(1);
  hoja.setTabColor(color);

  var header = hoja.getRange(1, 1, 1, lastCol);
  header
    .setBackground(color)
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  hoja.getRange(1, 1, lastRow, lastCol)
    .setVerticalAlignment('middle')
    .setWrap(true);

  hoja.setRowHeight(1, 42);

  for (var c = 1; c <= lastCol; c++) {
    hoja.autoResizeColumn(c);
    var ancho = hoja.getColumnWidth(c);
    hoja.setColumnWidth(c, Math.min(Math.max(ancho, 120), 260));
  }

  ajustarColumnaSiExiste(hoja, 'PerfilProfesional', 360);
  ajustarColumnaSiExiste(hoja, 'DescripcionPerfil', 360);
  ajustarColumnaSiExiste(hoja, 'Descripcion', 360);
  ajustarColumnaSiExiste(hoja, 'Formacion', 320);
  ajustarColumnaSiExiste(hoja, 'Experiencias', 320);
  ajustarColumnaSiExiste(hoja, 'Idiomas', 280);
  ajustarColumnaSiExiste(hoja, 'CVUrl', 280);
  ajustarColumnaSiExiste(hoja, 'SelfieUrl', 280);
  ajustarColumnaSiExiste(hoja, 'DniFrenteUrl', 280);
  ajustarColumnaSiExiste(hoja, 'DniDorsoUrl', 280);
  ajustarColumnaSiExiste(hoja, 'FirmaLegalUrl', 280);

  var filtro = hoja.getFilter();
  if (filtro) filtro.remove();
  hoja.getRange(1, 1, lastRow, lastCol).createFilter();
}

function ajustarColumnaSiExiste(hoja, nombreColumna, ancho) {
  var lastCol = hoja.getLastColumn();
  if (!lastCol) return;
  var encabezados = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = encabezados.indexOf(nombreColumna);
  if (idx !== -1) hoja.setColumnWidth(idx + 1, ancho);
}

/* -------------------------------------------------------------------
 *  GUARDAR POSTULANTE
 * ----------------------------------------------------------------- */

function guardarPostulante(d) {
  // Validación mínima obligatoria (Etapa 1).
  if (!d.nombre || !d.apellido || !d.email) {
    return { ok: false, error: 'Faltan datos obligatorios (nombre, apellido, email).' };
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(d.email))) {
    return { ok: false, error: 'El email no tiene un formato válido.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var existente = buscarPostulacionExistente_(hoja, d.email, d.busquedaId);
  if (existente) return errorPostulacionDuplicada_(existente);

  var id = Utilities.getUuid();
  var ahora = new Date();

  // Los campos repetibles llegan como arrays -> se guardan como JSON.
  var formacion    = normalizarJSON(d.formacion);
  var experiencias = normalizarJSON(d.experiencias);
  var idiomas      = normalizarJSON(d.idiomas);

  // Archivo del CV (opcional): se guarda en Drive y se conserva el enlace.
  var cv = guardarArchivoCV(d.cvBase64, d.cvNombre, d.cvTipo);
  if (cv.error) return { ok: false, error: cv.error };

  // Firmas (opcionales)
  var firmaConsent = guardarArchivoFirma(d.firmaConsentimientoBase64, 'consent_' + id + '.png');
  var firmaConf    = guardarArchivoFirma(d.firmaConformidadBase64, 'conf_' + id + '.png');

  var fila = [
    id,
    ahora,
    limpiar(d.nombre),
    limpiar(d.apellido),
    limpiar(d.email),
    limpiar(d.telefono),
    limpiar(d.puestoDeseado),
    limpiar(d.fechaNacimiento),
    limpiar(d.identificacion),
    limpiar(d.provincia),
    limpiar(d.codigoPostalCiudad),
    limpiar(d.perfilProfesional),
    formacion,
    limpiar(d.descripcionPerfil),
    limpiar(d.dispViajar),
    limpiar(d.dispCambioResidencia),
    idiomas,
    d.primerEmpleo ? 'Sí' : 'No',
    experiencias,
    cv.nombre,
    cv.url,
    // Firmas
    firmaConsent.url,
    d.firmaConsentimientoBase64 ? ahora : '',
    firmaConf.url,
    d.firmaConformidadBase64 ? ahora : '',
    // Vínculo con la búsqueda de origen (si vino desde una publicación)
    limpiar(d.busquedaId),
    limpiar(d.busquedaPuesto),
    // Respuestas a las preguntas de filtrado de la búsqueda
    normalizarJSON(d.respuestasBusqueda)
  ];

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    existente = buscarPostulacionExistente_(hoja, d.email, d.busquedaId);
    if (existente) return errorPostulacionDuplicada_(existente);
    hoja.appendRow(fila);
  } finally {
    lock.releaseLock();
  }
  var emailPostulacion = emailPostulacionExitosa_(d, id);
  return {
    ok: true,
    id: id,
    mensaje: '¡Postulación registrada correctamente!',
    emailPostulacionOk: !!(emailPostulacion && emailPostulacion.ok),
    emailPostulacionError: emailPostulacion && emailPostulacion.error ? emailPostulacion.error : ''
  };
}

/**
 * Guarda el archivo del CV en una carpeta de Drive y devuelve { nombre, url }.
 * Devuelve { nombre:'', url:'' } si no se adjuntó archivo, o { error } si falla.
 */
function guardarArchivoCV(base64, nombre, tipo) {
  if (!base64) return { nombre: '', url: '' };
  try {
    // Quita el prefijo "data:...;base64," si viene incluido.
    var idx = String(base64).indexOf('base64,');
    if (idx !== -1) base64 = String(base64).substring(idx + 7);

    // Control de tamaño (el base64 pesa ~33% más que el binario).
    var maxBase64 = CV_MAX_MB * 1024 * 1024 * 1.4;
    if (base64.length > maxBase64) {
      return { error: 'El CV supera el tamaño máximo de ' + CV_MAX_MB + ' MB.' };
    }

    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, tipo || 'application/octet-stream', limpiar(nombre) || 'cv');

    var carpeta = obtenerCarpetaCV();
    var archivo = carpeta.createFile(blob);
    try {
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { /* algunos dominios restringen el uso compartido público */ }

    return { nombre: archivo.getName(), url: archivo.getUrl() };
  } catch (err) {
    return { error: 'No se pudo guardar el CV: ' + String(err && err.message ? err.message : err) };
  }
}

function obtenerCarpetaCV() {
  var it = DriveApp.getFoldersByName(CARPETA_CV);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_CV);
}

function normalizarJSON(valor) {
  if (valor == null) return '[]';
  if (typeof valor === 'string') {
    // Ya viene como string JSON o texto plano
    return valor;
  }
  return JSON.stringify(valor);
}

function limpiar(v) {
  if (v == null) return '';
  return String(v).trim();
}

function normalizarEmail_(email) {
  return limpiar(email).toLowerCase();
}

function buscarPostulacionExistente_(hoja, email, busquedaId) {
  var bid = limpiar(busquedaId);
  var em = normalizarEmail_(email);
  if (!bid || !em) return null;

  var valores = hoja.getDataRange().getValues();
  var idxEmail = COLUMNAS_POSTULANTES.indexOf('Email');
  var idxBusqueda = COLUMNAS_POSTULANTES.indexOf('BusquedaID');
  var idxId = COLUMNAS_POSTULANTES.indexOf('ID');
  for (var i = 1; i < valores.length; i++) {
    if (
      normalizarEmail_(valores[i][idxEmail]) === em &&
      limpiar(valores[i][idxBusqueda]) === bid
    ) {
      return {
        id: valores[i][idxId] || '',
        fila: i + 1
      };
    }
  }
  return null;
}

function errorPostulacionDuplicada_(existente) {
  return {
    ok: false,
    duplicada: true,
    id: existente && existente.id ? existente.id : '',
    error: 'Ya te postulaste a esta vacante. No hace falta enviarla de nuevo.'
  };
}

function emailValido_(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpiar(email));
}

function escaparHtml_(v) {
  return limpiar(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parrafoEmail_(texto) {
  return '<p style="margin:0 0 14px;color:#514d62;font-size:15px;line-height:1.55;">' + escaparHtml_(texto) + '</p>';
}

function datoEmail_(label, valor) {
  if (!limpiar(valor)) return '';
  return '<tr>' +
    '<td style="padding:9px 0;color:#7c788c;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;">' + escaparHtml_(label) + '</td>' +
    '<td style="padding:9px 0;color:#1a181d;font-size:14px;font-weight:700;text-align:right;">' + escaparHtml_(valor) + '</td>' +
  '</tr>';
}

function plantillaEmail_(opts) {
  var titulo = escaparHtml_(opts.titulo || 'ONE Talent Hub');
  var subtitulo = escaparHtml_(opts.subtitulo || '');
  var contenido = opts.contenido || '';
  var ctaTexto = escaparHtml_(opts.ctaTexto || 'Ingresar a la plataforma');
  var ctaUrl = escaparHtml_(opts.ctaUrl || URL_PLATAFORMA);
  var nota = opts.nota ? '<p style="margin:18px 0 0;color:#6f6a7e;font-size:12px;line-height:1.55;">' + escaparHtml_(opts.nota) + '</p>' : '';
  var preheader = escaparHtml_(opts.preheader || subtitulo || titulo);

  return '<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f4f1f8;font-family:Arial,Helvetica,sans-serif;color:#1a181d;">' +
    '<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">' + preheader + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1f8;padding:32px 14px;">' +
      '<tr><td align="center">' +
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e4deec;border-radius:20px;overflow:hidden;box-shadow:0 18px 44px rgba(26,24,29,.10);">' +
          '<tr><td style="padding:0;height:9px;background:linear-gradient(90deg,#b23ca6 0%,#8b7bd9 48%,#6be1e3 100%);"></td></tr>' +
          '<tr><td style="padding:28px 30px 18px;background:#ffffff;">' +
            '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>' +
              '<td style="vertical-align:middle;">' +
                '<img src="' + escaparHtml_(URL_LOGO_EMAIL) + '" alt="ONE" width="104" style="display:block;max-width:104px;height:auto;border:0;outline:none;text-decoration:none;">' +
              '</td>' +
              '<td align="right" style="vertical-align:middle;color:#0f766e;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Talent Hub</td>' +
            '</tr></table>' +
            '<div style="margin-top:24px;padding:18px 18px;border:1px solid #eee8f5;border-radius:14px;background:#fbfafd;">' +
              '<div style="display:inline-block;margin-bottom:10px;padding:5px 10px;border-radius:999px;background:rgba(107,225,227,.18);color:#0f766e;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;">Notificación</div>' +
              '<h1 style="margin:0 0 8px;font-size:26px;line-height:1.18;color:#1a181d;">' + titulo + '</h1>' +
              (subtitulo ? '<p style="margin:0;color:#514d62;font-size:15px;line-height:1.5;">' + subtitulo + '</p>' : '') +
            '</div>' +
          '</td></tr>' +
          '<tr><td style="padding:4px 30px 30px;">' +
            contenido +
            '<div style="margin-top:24px;">' +
              '<a href="' + ctaUrl + '" style="display:inline-block;background:#b23ca6;color:#ffffff;text-decoration:none;font-weight:900;font-size:14px;padding:13px 20px;border-radius:12px;box-shadow:0 8px 18px rgba(178,60,166,.22);">' + ctaTexto + '</a>' +
            '</div>' +
            nota +
          '</td></tr>' +
          '<tr><td style="padding:18px 30px;background:#faf8fd;border-top:1px solid #eee8f5;color:#7c788c;font-size:12px;line-height:1.5;">' +
            '<strong style="color:#1a181d;">ONE Talent Hub</strong><br>' +
            'Plataforma de oportunidades laborales y gestión de postulantes.' +
          '</td></tr>' +
        '</table>' +
        '<p style="max-width:640px;margin:14px 0 0;color:#8a8498;font-size:12px;line-height:1.45;">Este email fue enviado automáticamente. Si no esperabas este mensaje, podés ignorarlo.</p>' +
      '</td></tr>' +
    '</table>' +
  '</body></html>';
}

function enviarEmailSeguro_(opciones, contexto) {
  var destinatario = opciones && opciones.to ? limpiar(opciones.to) : '';
  var asunto = opciones && opciones.subject ? limpiar(opciones.subject) : '';
  try {
    if (!opciones || !emailValido_(opciones.to)) {
      registrarEmail_(contexto, destinatario, asunto, 'error', 'Email inválido.');
      return { ok: false, error: 'Email inválido.' };
    }
    var payload = {
      to: destinatario,
      subject: asunto,
      body: limpiar(opciones.body),
      name: limpiar(opciones.name) || 'ONE Talent Hub'
    };
    if (opciones.htmlBody) payload.htmlBody = opciones.htmlBody;
    MailApp.sendEmail(payload);
    registrarEmail_(contexto, destinatario, asunto, 'enviado', '');
    return { ok: true };
  } catch (err) {
    var error = String(err && err.message ? err.message : err);
    Logger.log('Error enviando email%s: %s', contexto ? ' (' + contexto + ')' : '', error);
    registrarEmail_(contexto, destinatario, asunto, 'error', error);
    return { ok: false, error: error };
  }
}

function registrarEmail_(contexto, destinatario, asunto, estado, error) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var hoja = obtenerHoja(ss, HOJA_EMAILS, COLUMNAS_EMAILS);
    hoja.appendRow([
      new Date(),
      limpiar(contexto),
      limpiar(destinatario),
      limpiar(asunto),
      limpiar(estado),
      limpiar(error)
    ]);
  } catch (logErr) {
    Logger.log('No se pudo registrar auditoría de email: %s', String(logErr && logErr.message ? logErr.message : logErr));
  }
}

function nombreCompleto_(obj) {
  return [obj && obj.nombre, obj && obj.apellido].filter(Boolean).join(' ') ||
         [obj && obj.Nombre, obj && obj.Apellido].filter(Boolean).join(' ') ||
         'Hola';
}

function emailRegistroEmpresa_(d) {
  var nombre = nombreCompleto_(d);
  var body = [
    'Hola ' + nombre + ',',
    '',
    'Recibimos el registro de ' + limpiar(d.empresa) + ' en ONE Talent Hub.',
    '',
    'La cuenta quedó pendiente de revisión. Cuando administración la apruebe, te avisaremos por email.',
    '',
    'Podés ingresar a la plataforma desde:',
    URL_PLATAFORMA,
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].join('\n');
  var html = plantillaEmail_({
    titulo: 'Registro recibido',
    subtitulo: 'Tu cuenta de empresa quedó pendiente de revisión.',
    contenido:
      parrafoEmail_('Hola ' + nombre + ',') +
      parrafoEmail_('Recibimos el registro de ' + limpiar(d.empresa) + ' en ONE Talent Hub.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Empresa', d.empresa) +
        datoEmail_('Estado', 'Pendiente de revisión') +
      '</table>' +
      parrafoEmail_('Cuando administración apruebe la cuenta, te avisaremos por email.'),
    ctaTexto: 'Ir a ONE Talent Hub',
    nota: 'No hace falta que vuelvas a registrarte.'
  });
  return enviarEmailSeguro_({
    to: d.email,
    subject: 'Recibimos el registro de tu empresa',
    body: body,
    htmlBody: html
  }, 'registro empresa');
}

function emailEmpresaAprobada_(empresa) {
  var nombre = nombreCompleto_(empresa);
  var body = [
    'Hola ' + nombre + ',',
    '',
    'Tu cuenta de empresa en ONE Talent Hub fue aprobada.',
    '',
    'Ya podés ingresar al panel para revisar postulantes y publicar búsquedas:',
    URL_PLATAFORMA,
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].join('\n');
  var html = plantillaEmail_({
    titulo: 'Cuenta aprobada',
    subtitulo: 'Ya podés ingresar al panel de empresas.',
    contenido:
      parrafoEmail_('Hola ' + nombre + ',') +
      parrafoEmail_('Tu cuenta de empresa en ONE Talent Hub fue aprobada.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Empresa', empresa.empresa || empresa.Empresa) +
        datoEmail_('Estado', 'Aprobada') +
      '</table>' +
      parrafoEmail_('Ya podés revisar postulantes, publicar búsquedas y gestionar tus procesos desde el panel.'),
    ctaTexto: 'Ingresar al panel'
  });
  return enviarEmailSeguro_({
    to: empresa.email || empresa.usuario,
    subject: 'Tu cuenta de empresa fue aprobada',
    body: body,
    htmlBody: html
  }, 'empresa aprobada');
}

function emailEmpresaRechazada_(empresa) {
  var nombre = nombreCompleto_(empresa);
  var empresaNombre = empresa.empresa || empresa.Empresa || '';
  var body = [
    'Hola ' + nombre + ',',
    '',
    'Tu cuenta de empresa en ONE Talent Hub no fue aprobada por el momento.',
    '',
    'Empresa: ' + limpiar(empresaNombre),
    '',
    'Podés comunicarte con administración para revisar la información enviada.',
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].join('\n');
  var html = plantillaEmail_({
    titulo: 'Cuenta no aprobada',
    subtitulo: 'Necesitamos revisar la información de tu cuenta.',
    contenido:
      parrafoEmail_('Hola ' + nombre + ',') +
      parrafoEmail_('Tu cuenta de empresa en ONE Talent Hub no fue aprobada por el momento.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Empresa', empresaNombre) +
        datoEmail_('Estado', 'No aprobada') +
      '</table>' +
      parrafoEmail_('Podés comunicarte con administración para revisar la información enviada.'),
    ctaTexto: 'Ir a ONE Talent Hub',
    nota: 'Este mensaje no elimina tu cuenta; solo informa el estado actual de revisión.'
  });
  return enviarEmailSeguro_({
    to: empresa.email || empresa.usuario,
    subject: 'Tu cuenta de empresa no fue aprobada',
    body: body,
    htmlBody: html
  }, 'empresa rechazada');
}

function emailVerificacionRechazada_(empresa) {
  var nombre = nombreCompleto_(empresa);
  var body = [
    'Hola ' + nombre + ',',
    '',
    'La verificación de identidad de tu cuenta no fue aprobada por el momento.',
    '',
    'Podés comunicarte con administración para revisar la selfie o la firma registrada.',
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].join('\n');
  var html = plantillaEmail_({
    titulo: 'Verificación no aprobada',
    subtitulo: 'Administración necesita revisar la evidencia enviada.',
    contenido:
      parrafoEmail_('Hola ' + nombre + ',') +
      parrafoEmail_('La verificación de identidad de tu cuenta no fue aprobada por el momento.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Empresa', empresa.empresa || empresa.Empresa) +
        datoEmail_('Verificación', 'No aprobada') +
      '</table>' +
      parrafoEmail_('Podés comunicarte con administración para revisar la selfie o la firma registrada.'),
    ctaTexto: 'Ir a ONE Talent Hub'
  });
  return enviarEmailSeguro_({
    to: empresa.email || empresa.usuario,
    subject: 'Tu verificación de identidad no fue aprobada',
    body: body,
    htmlBody: html
  }, 'verificación rechazada');
}

function emailRegistroPostulante_(d) {
  var nombre = nombreCompleto_(d);
  var puesto = limpiar(d.puestoDeseado) || 'Perfil general';
  var body = [
    'Hola ' + nombre + ',',
    '',
    'Tu cuenta de postulante en ONE Talent Hub fue creada correctamente.',
    '',
    'Perfil/interés: ' + puesto,
    '',
    'Ya podés ingresar, actualizar tu CV y postularte a las oportunidades disponibles:',
    URL_PLATAFORMA,
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].join('\n');
  var html = plantillaEmail_({
    titulo: 'Cuenta creada',
    subtitulo: 'Tu perfil de postulante ya está listo.',
    contenido:
      parrafoEmail_('Hola ' + nombre + ',') +
      parrafoEmail_('Tu cuenta de postulante en ONE Talent Hub fue creada correctamente.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Perfil/interés', puesto) +
        datoEmail_('Email de acceso', d.email) +
      '</table>' +
      parrafoEmail_('Ya podés ingresar, actualizar tu CV y postularte a las oportunidades disponibles. Si una vacante coincide con tu perfil, podremos avisarte por email.'),
    ctaTexto: 'Ver oportunidades',
    nota: 'Guardá este email como constancia de tu registro.'
  });
  return enviarEmailSeguro_({
    to: d.email,
    subject: 'Tu cuenta de postulante fue creada',
    body: body,
    htmlBody: html
  }, 'registro postulante');
}

function emailPostulacionExitosa_(d, id) {
  var puesto = limpiar(d.busquedaPuesto) || limpiar(d.puestoDeseado) || 'tu postulación';
  var body = [
    'Hola ' + nombreCompleto_(d) + ',',
    '',
    'Completaste tu postulación correctamente.',
    '',
    'Puesto/interés: ' + puesto,
    'Código de registro: ' + id,
    '',
    'La empresa ya puede revisar tu perfil. Si hay novedades o nuevas coincidencias, podremos avisarte por email.',
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].join('\n');
  var html = plantillaEmail_({
    titulo: 'Postulación completada',
    subtitulo: 'La empresa ya puede revisar tu perfil.',
    contenido:
      parrafoEmail_('Hola ' + nombreCompleto_(d) + ',') +
      parrafoEmail_('Completaste tu postulación correctamente.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Puesto/interés', puesto) +
        datoEmail_('Código', id) +
      '</table>' +
      parrafoEmail_('La empresa ya puede revisar tu perfil. Si hay novedades o nuevas coincidencias, podremos avisarte por email.'),
    ctaTexto: 'Ver oportunidades'
  });
  return enviarEmailSeguro_({
    to: d.email,
    subject: 'Postulación completada correctamente',
    body: body,
    htmlBody: html
  }, 'postulación exitosa');
}

function probarEmail(d) {
  if (!requireAdmin(d.token)) return { ok: false, error: 'Acceso exclusivo del administrador.' };
  var email = limpiar(d.email);
  if (!emailValido_(email)) return { ok: false, error: 'Indicá un email válido para la prueba.' };

  var html = plantillaEmail_({
    titulo: 'Email de prueba',
    subtitulo: 'El sistema de correos de ONE Talent Hub está funcionando.',
    contenido:
      parrafoEmail_('Este mensaje confirma que Apps Script pudo enviar emails desde la cuenta configurada.') +
      parrafoEmail_('Si este correo llegó, los permisos de MailApp están activos.'),
    ctaTexto: 'Abrir plataforma'
  });
  var resultado = enviarEmailSeguro_({
    to: email,
    subject: 'Prueba de email - ONE Talent Hub',
    body: 'Email de prueba enviado desde ONE Talent Hub.',
    htmlBody: html
  }, 'prueba manual');

  if (!resultado.ok) return { ok: false, error: resultado.error || 'No se pudo enviar el email de prueba.' };
  return { ok: true, mensaje: 'Email de prueba enviado.' };
}

/* -------------------------------------------------------------------
 *  AUTENTICACIÓN
 * ----------------------------------------------------------------- */

/**
 * Registro de una nueva empresa/consultora. Crea el usuario y devuelve
 * un token para entrar directamente al panel.
 */
/**
 * Guarda una imagen de verificación en Drive y devuelve { url }.
 */
function guardarImagenVerificacion(base64, tipo, usuario) {
  if (!base64) return { error: 'Falta la imagen de ' + tipo + '.' };
  try {
    var idx = String(base64).indexOf('base64,');
    if (idx !== -1) base64 = String(base64).substring(idx + 7);
    var bytes = Utilities.base64Decode(base64);
    var nombre = tipo + '_' + limpiar(usuario || 'empresa').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Utilities.getUuid() + '.jpg';
    var blob = Utilities.newBlob(bytes, 'image/jpeg', nombre);
    var carpeta = obtenerCarpetaCV();
    var archivo = carpeta.createFile(blob);
    try {
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { /* algunos dominios restringen el uso compartido público */ }
    return { url: archivo.getUrl() };
  } catch (err) {
    return { error: 'No se pudo guardar la imagen de ' + tipo + ': ' + String(err && err.message ? err.message : err) };
  }
}

function verificarIdentidadDNI(d) {
  var dni = limpiar(d.dni).replace(/[^0-9]/g, '');
  if (dni.length !== 8) return { ok: false, error: 'El DNI debe tener 8 dígitos.' };
  if (!d.selfieBase64) return { ok: false, error: 'Falta la selfie del representante.' };
  if (!d.firmaLegalBase64) return { ok: false, error: 'Falta la firma legal del representante.' };
  return {
    ok: true,
    estado: 'pendiente',
    confianza: 'revision_manual',
    observacion: 'Revisar manualmente la selfie y la firma legal registrada.'
  };
}

function registrarEmpresa(d) {
  var empresa  = limpiar(d.empresa);
  var password = String(d.password || '');
  var email    = limpiar(d.email).toLowerCase();
  var usuario  = email; // el email es el usuario de acceso, para que sea fácil de recordar
  var cuit     = limpiar(d.cuit).replace(/[^0-9]/g, '');
  var dni      = limpiar(d.dni).replace(/[^0-9]/g, '');
  var rubro    = limpiar(d.rubro);
  var nombre   = limpiar(d.nombre);
  var apellido = limpiar(d.apellido);
  var telefono = limpiar(d.telefono);

  if (!empresa || !password) {
    return { ok: false, error: 'Completá razón social y contraseña.' };
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Ingresá un email válido (será tu usuario de acceso).' };
  }
  if (!rubro || !nombre || !apellido || !telefono) {
    return { ok: false, error: 'Completá rubro, nombre, apellido y teléfono del contacto.' };
  }
  if (cuit.length !== 11) {
    return { ok: false, error: 'El CUIT/CUIL debe tener 11 dígitos.' };
  }
  if (dni.length !== 8) {
    return { ok: false, error: 'El DNI del representante debe tener 8 dígitos.' };
  }
  if (!d.aceptoTerminos) {
    return { ok: false, error: 'Debés aceptar los Términos y Condiciones.' };
  }
  if (!d.firmaLegalBase64) {
    return { ok: false, error: 'Debés firmar la aceptación legal del representante.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      return { ok: false, error: 'Ya existe una cuenta registrada con ese email.' };
    }
  }

  var verificacion = verificarIdentidadDNI({
    dni: dni,
    selfieBase64: d.selfieBase64,
    firmaLegalBase64: d.firmaLegalBase64
  });
  if (!verificacion.ok) return verificacion;

  var selfieGuardada = guardarImagenVerificacion(d.selfieBase64, 'selfie', usuario);
  if (selfieGuardada.error) return { ok: false, error: selfieGuardada.error };
  var firmaLegal = guardarArchivoFirma(d.firmaLegalBase64, 'empresa_legal_' + usuario + '.png');
  if (firmaLegal.error) return { ok: false, error: firmaLegal.error };

  var estadoVerificacion = verificacion.estado || 'pendiente';
  var estadoCuenta = estadoVerificacion === 'aprobado' ? 'aprobado' : 'pendiente';
  var detalleVerificacion = [verificacion.confianza, verificacion.observacion].filter(Boolean).join(' - ');
  var selfieLivenessEstado = limpiar(d.selfieLivenessEstado);
  var selfieLivenessMetodo = limpiar(d.selfieLivenessMetodo);
  var selfieLivenessFecha = limpiar(d.selfieLivenessFecha);
  if (selfieLivenessEstado) {
    detalleVerificacion = [detalleVerificacion, 'Selfie validada con MediaPipe' + (selfieLivenessMetodo ? ' (' + selfieLivenessMetodo + ')' : '')].filter(Boolean).join(' - ');
  }

  // La selfie y la firma registrada quedan para revisión manual del administrador.
  hoja.appendRow([
    usuario, password, empresa, '', '', email, new Date(), 'empresa', estadoCuenta,
    cuit, rubro, nombre, apellido, telefono,
    dni,
    estadoVerificacion,
    new Date(),
    detalleVerificacion,
    'Si',
    new Date(),
    selfieGuardada.url,
    [nombre, apellido].filter(Boolean).join(' '),
    selfieLivenessMetodo,
    '',
    selfieLivenessEstado || '',
    selfieLivenessFecha || '',
    '',
    '',
    firmaLegal.url,
    new Date()
  ]);
  emailRegistroEmpresa_({
    empresa: empresa,
    email: email,
    nombre: nombre,
    apellido: apellido
  });

  return {
    ok: true,
    pendiente: estadoCuenta !== 'aprobado',
    verificacion: estadoVerificacion,
    mensaje: 'Tu cuenta fue creada y quedó pendiente de revisión. Administración revisará la selfie y la firma registrada.'
  };
}

function login(d) {
  var usuario  = limpiar(d.usuario).toLowerCase();
  var password = String(d.password || '');

  if (!usuario || !password) {
    return { ok: false, error: 'Ingresa usuario y contraseña.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();

  for (var i = 1; i < valores.length; i++) {
    var fila = valores[i];
    var u = String(fila[0]).trim().toLowerCase();
    var p = String(fila[1]);
    if (u === usuario && p === password) {
      var rol = String(fila[7] || 'empresa').toLowerCase();
      var estado = String(fila[8] || 'aprobado').toLowerCase();
      if (rol !== 'admin') {
        if (estado === 'pendiente') return { ok: false, error: 'Tu cuenta está pendiente de aprobación por el administrador.' };
        if (estado === 'rechazado') return { ok: false, error: 'Tu cuenta fue rechazada. Contactá al administrador.' };
      }
      var token = Utilities.getUuid();
      var expira = new Date().getTime() + TOKEN_HORAS * 3600 * 1000;
      hoja.getRange(i + 1, 4).setValue(token);      // columna Token
      hoja.getRange(i + 1, 5).setValue(expira);     // columna TokenExpira
      return { ok: true, token: token, empresa: String(fila[2] || usuario), rol: rol };
    }
  }
  return { ok: false, error: 'Usuario o contraseña incorrectos.' };
}

/* -------------------------------------------------------------------
 *  RECUPERACIÓN DE CONTRASEÑA (enlace temporal por correo)
 * ----------------------------------------------------------------- */

// Devuelve la columna (1-based) de un encabezado en la hoja, o -1.
function columnaPorNombre(hoja, nombre) {
  var lastCol = Math.max(hoja.getLastColumn(), 1);
  var encabezados = hoja.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = encabezados.indexOf(nombre);
  return idx === -1 ? -1 : idx + 1;
}

// Envía el correo con el enlace para restablecer la contraseña.
function enviarMailReset(email, token, tipo) {
  var link = URL_APP + '/recuperar.html?token=' + encodeURIComponent(token) + '&tipo=' + tipo;
  var asunto = 'Restablecé tu contraseña — ONE Talent Hub';
  var cuerpo = 'Hola,\n\n' +
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta en ONE Talent Hub.\n\n' +
    'Ingresá a este enlace para crear una nueva contraseña (válido por ' + RESET_MINUTOS + ' minutos):\n' +
    link + '\n\n' +
    'Si no solicitaste este cambio, ignorá este correo; tu contraseña seguirá siendo la misma.\n\n' +
    'ONE Talent Hub';
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a181d;line-height:1.55">' +
    '<p>Hola,</p>' +
    '<p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>ONE Talent Hub</strong>.</p>' +
    '<p>Hacé clic en el botón para crear una nueva contraseña (el enlace es válido por ' + RESET_MINUTOS + ' minutos):</p>' +
    '<p style="margin:22px 0"><a href="' + link + '" style="background:#b23ca6;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">Restablecer contraseña</a></p>' +
    '<p style="font-size:13px;color:#6b7280">O copiá y pegá este enlace en tu navegador:<br>' + link + '</p>' +
    '<p style="font-size:13px;color:#6b7280">Si no solicitaste este cambio, ignorá este correo.</p>' +
    '</div>';
  MailApp.sendEmail({ to: email, subject: asunto, body: cuerpo, htmlBody: html });
}

// Paso 1: la persona pide recuperar su contraseña. Se genera un token temporal
// y se envía el enlace por correo. Respuesta genérica: no revela si el email existe.
function recuperarPassword(d) {
  var tipo = limpiar(d.tipo).toLowerCase() === 'postulante' ? 'postulante' : 'empresa';
  var email = limpiar(d.email).toLowerCase();
  var generico = { ok: true, mensaje: 'Si el email está registrado, te enviamos un enlace para restablecer la contraseña. Revisá tu casilla (y la carpeta de spam).' };
  if (!email) return { ok: false, error: 'Ingresá tu email.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var token = Utilities.getUuid();
  var expira = new Date().getTime() + RESET_MINUTOS * 60 * 1000;

  if (tipo === 'empresa') {
    var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
    var valores = hoja.getDataRange().getValues();
    var cReset = columnaPorNombre(hoja, 'ResetToken');
    var cExp = columnaPorNombre(hoja, 'ResetExpira');
    for (var i = 1; i < valores.length; i++) {
      // Columna 0 = Usuario (suele ser el email), columna 5 = Email.
      if (String(valores[i][0]).trim().toLowerCase() === email ||
          String(valores[i][5]).trim().toLowerCase() === email) {
        // No se permite recuperar cuentas de administrador por este medio.
        if (String(valores[i][7] || 'empresa').toLowerCase() === 'admin') return generico;
        hoja.getRange(i + 1, cReset).setValue(token);
        hoja.getRange(i + 1, cExp).setValue(expira);
        enviarMailReset(String(valores[i][5] || email), token, 'empresa');
        return generico;
      }
    }
    return generico;
  } else {
    var hojaP = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
    var valP = hojaP.getDataRange().getValues();
    var cResetP = columnaPorNombre(hojaP, 'ResetToken');
    var cExpP = columnaPorNombre(hojaP, 'ResetExpira');
    for (var j = 1; j < valP.length; j++) {
      if (String(valP[j][0]).trim().toLowerCase() === email) { // columna 0 = Email
        hojaP.getRange(j + 1, cResetP).setValue(token);
        hojaP.getRange(j + 1, cExpP).setValue(expira);
        enviarMailReset(email, token, 'postulante');
        return generico;
      }
    }
    return generico;
  }
}

// Paso 2: con el token del enlace, se guarda la nueva contraseña.
function resetearPassword(d) {
  var tipo = limpiar(d.tipo).toLowerCase() === 'postulante' ? 'postulante' : 'empresa';
  var token = limpiar(d.token);
  var nueva = String(d.nuevaPassword || '');
  if (!token) return { ok: false, error: 'Enlace inválido.' };
  if (nueva.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ahora = new Date().getTime();

  if (tipo === 'empresa') {
    var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
    var valores = hoja.getDataRange().getValues();
    var cReset = columnaPorNombre(hoja, 'ResetToken');
    var cExp = columnaPorNombre(hoja, 'ResetExpira');
    for (var i = 1; i < valores.length; i++) {
      if (String(valores[i][cReset - 1]) === token) {
        var expira = Number(valores[i][cExp - 1] || 0);
        if (!expira || expira < ahora) return { ok: false, error: 'El enlace expiró. Solicitá uno nuevo.' };
        hoja.getRange(i + 1, 2).setValue(nueva);     // Password
        hoja.getRange(i + 1, cReset).setValue('');   // limpia el token de reseteo
        hoja.getRange(i + 1, cExp).setValue('');
        hoja.getRange(i + 1, 4).setValue('');        // invalida la sesión activa (Token)
        hoja.getRange(i + 1, 5).setValue('');        // TokenExpira
        return { ok: true, mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' };
      }
    }
    return { ok: false, error: 'El enlace no es válido o ya fue utilizado.' };
  } else {
    var hojaP = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
    var valP = hojaP.getDataRange().getValues();
    var cResetP = columnaPorNombre(hojaP, 'ResetToken');
    var cExpP = columnaPorNombre(hojaP, 'ResetExpira');
    for (var j = 1; j < valP.length; j++) {
      if (String(valP[j][cResetP - 1]) === token) {
        var expiraP = Number(valP[j][cExpP - 1] || 0);
        if (!expiraP || expiraP < ahora) return { ok: false, error: 'El enlace expiró. Solicitá uno nuevo.' };
        hojaP.getRange(j + 1, 2).setValue(nueva);    // Password
        hojaP.getRange(j + 1, cResetP).setValue('');
        hojaP.getRange(j + 1, cExpP).setValue('');
        hojaP.getRange(j + 1, 3).setValue('');       // invalida la sesión (Token)
        hojaP.getRange(j + 1, 4).setValue('');       // TokenExpira
        return { ok: true, mensaje: 'Contraseña actualizada. Ya podés iniciar sesión.' };
      }
    }
    return { ok: false, error: 'El enlace no es válido o ya fue utilizado.' };
  }
}

/**
 * Valida un token y devuelve la fila del usuario, o null.
 */
function validarToken(token) {
  if (!token) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();
  var ahora = new Date().getTime();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][3]) === String(token)) {
      var expira = Number(valores[i][4] || 0);
      if (expira && expira < ahora) return null; // expirado
      return {
        usuario: valores[i][0], empresa: valores[i][2],
        rol: String(valores[i][7] || 'empresa').toLowerCase(),
        estado: String(valores[i][8] || 'aprobado').toLowerCase()
      };
    }
  }
  return null;
}

function empresaDesdeFila(fila) {
  return {
    usuario: fila[0],
    empresa: fila[2],
    email: fila[5],
    fecha: (fila[6] instanceof Date) ? fila[6].toISOString() : fila[6],
    estado: String(fila[8] || 'aprobado').toLowerCase(),
    cuit: fila[9] || '',
    rubro: fila[10] || '',
    nombre: fila[11] || '',
    apellido: fila[12] || '',
    telefono: fila[13] || '',
    dni: fila[14] || '',
    estadoVerificacion: String(fila[15] || 'pendiente').toLowerCase(),
    fechaVerificacion: (fila[16] instanceof Date) ? fila[16].toISOString() : fila[16],
    confianzaVerificacion: fila[17] || '',
    aceptoTerminos: fila[18] || '',
    fechaAceptoTerminos: (fila[19] instanceof Date) ? fila[19].toISOString() : fila[19],
    selfieUrl: fila[20] || '',
    nombreVerificado: fila[21] || '',
    selfieLivenessMetodo: fila[22] || '',
    selfieLivenessUrl: fila[23] || '',
    selfieLivenessEstado: fila[24] || '',
    selfieLivenessFecha: (fila[25] instanceof Date) ? fila[25].toISOString() : fila[25],
    dniFrenteUrl: fila[26] || '',
    dniDorsoUrl: fila[27] || '',
    firmaLegalUrl: fila[28] || '',
    fechaFirmaLegal: (fila[29] instanceof Date) ? fila[29].toISOString() : fila[29]
  };
}

function empresaParaCuenta_(empresa) {
  var salida = Object.assign({}, empresa);
  delete salida.selfieUrl;
  delete salida.selfieLivenessUrl;
  delete salida.dniFrenteUrl;
  delete salida.dniDorsoUrl;
  delete salida.firmaLegalUrl;
  return salida;
}

function miEmpresa(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'SesiÃ³n invÃ¡lida o expirada.' };
  if (sesion.rol === 'admin') return { ok: false, error: 'Esta acciÃ³n corresponde a cuentas de empresa.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      return { ok: true, empresa: empresaParaCuenta_(empresaDesdeFila(valores[i])) };
    }
  }
  return { ok: false, error: 'Empresa no encontrada.' };
}

function actualizarMiEmpresa(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'SesiÃ³n invÃ¡lida o expirada.' };
  if (sesion.rol === 'admin') return { ok: false, error: 'Esta acciÃ³n corresponde a cuentas de empresa.' };

  // Solo se puede editar el responsable (nombre, apellido, teléfono) y la
  // contraseña. La razón social y el CUIT/CUIL NO se modifican por seguridad.
  var nombre   = limpiar(d.nombre);
  var apellido = limpiar(d.apellido);
  var telefono = limpiar(d.telefono);
  var passwordActual = String(d.passwordActual || '');
  var nuevaPassword = String(d.nuevaPassword || '');

  if (!nombre || !apellido || !telefono) {
    return { ok: false, error: 'Completá nombre, apellido y teléfono del responsable.' };
  }
  if (nuevaPassword && nuevaPassword.length < 6) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      if (nuevaPassword) {
        if (!passwordActual) return { ok: false, error: 'Ingresá tu contraseña actual para cambiarla.' };
        if (String(valores[i][1]) !== passwordActual) return { ok: false, error: 'La contraseña actual no es correcta.' };
        hoja.getRange(i + 1, 2).setValue(nuevaPassword);
      }
      hoja.getRange(i + 1, 12).setValue(nombre);    // Nombre del responsable
      hoja.getRange(i + 1, 13).setValue(apellido);  // Apellido del responsable
      hoja.getRange(i + 1, 14).setValue(telefono);  // Teléfono

      var filaActualizada = hoja.getRange(i + 1, 1, 1, COLUMNAS_USUARIOS.length).getValues()[0];
      return { ok: true, mensaje: 'Datos actualizados correctamente.', empresa: empresaDesdeFila(filaActualizada) };
    }
  }
  return { ok: false, error: 'Empresa no encontrada.' };
}

/* -------------------------------------------------------------------
 *  LISTAR / BUSCAR
 * ----------------------------------------------------------------- */

// Devuelve un mapa { BusquedaID: true } con las búsquedas publicadas por una
// empresa (identificada por su usuario). Se usa para decidir qué postulantes
// puede ver esa empresa.
function busquedaIdsDeEmpresa(ss, usuario) {
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();
  var u = String(usuario || '').trim().toLowerCase();
  var ids = {};
  for (var i = 1; i < valores.length; i++) {
    // Columna 3 = UsuarioEmpresa (dueño), columna 0 = ID de la búsqueda.
    if (String(valores[i][3]).trim().toLowerCase() === u) {
      ids[String(valores[i][0]).trim()] = true;
    }
  }
  return ids;
}

// Convierte una fila de la hoja Perfiles (cuenta registrada) al mismo formato
// que un postulante de la hoja Postulantes, como "general" (sin BusquedaID).
// Así la base de talento y las postulaciones se muestran en un único listado.
function perfilComoPostulante(fila) {
  return {
    ID: 'perfil:' + String(fila[0] || ''),
    FechaRegistro: (fila[4] instanceof Date) ? fila[4].toISOString() : fila[4],
    Nombre: fila[6] || '', Apellido: fila[7] || '', Email: fila[0] || '',
    Telefono: fila[8] || '', PuestoDeseado: fila[9] || '',
    FechaNacimiento: fila[10] || '', Identificacion: fila[11] || '',
    Provincia: fila[12] || '', CodigoPostalCiudad: fila[13] || '',
    PerfilProfesional: fila[14] || '', Formacion: fila[15] || '[]',
    DescripcionPerfil: fila[16] || '', DispViajar: fila[17] || '',
    DispCambioResidencia: fila[18] || '', Idiomas: fila[19] || '[]',
    PrimerEmpleo: fila[20] || '', Experiencias: fila[21] || '[]',
    CVNombre: fila[22] || '', CVUrl: fila[23] || '',
    FirmaConsentimientoUrl: fila[24] || '', FechaFirmaConsentimiento: '',
    FirmaConformidadUrl: fila[25] || '', FechaFirmaConformidad: '',
    BusquedaID: '', BusquedaPuesto: '', RespuestasBusqueda: '[]'
  };
}

function listarPostulantes(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var registros = obtenerPostulantesConsolidados_(ss);
  var postulaciones = obtenerPostulaciones_(ss);

  // Visibilidad (base abierta): los "generales" (sin BusquedaID) son visibles
  // para TODAS las empresas. Las postulaciones a una búsqueda (con BusquedaID)
  // solo las ve la empresa dueña (junto con las respuestas). El SuperAdmin ve todo.
  if (String(sesion.rol) !== 'admin') {
    var misBusquedas = busquedaIdsDeEmpresa(ss, sesion.usuario);
    registros = registros.filter(function (r) {
      var bid = String(r.BusquedaID || '').trim();
      return !bid || misBusquedas[bid];
    });
    postulaciones = postulaciones.filter(function (r) {
      var bid = String(r.BusquedaID || '').trim();
      return !bid || misBusquedas[bid];
    });
  }

  // Búsqueda por texto libre.
  var q = limpiar(d.q).toLowerCase();
  if (q) {
    registros = registros.filter(function (r) {
      return JSON.stringify(r).toLowerCase().indexOf(q) !== -1;
    });
    postulaciones = postulaciones.filter(function (r) {
      return JSON.stringify(r).toLowerCase().indexOf(q) !== -1;
    });
  }

  // Filtros específicos opcionales.
  if (d.puesto)    registros = filtrarCampo(registros, 'PuestoDeseado', d.puesto);
  if (d.provincia) registros = filtrarCampo(registros, 'Provincia', d.provincia);
  if (d.puesto)    postulaciones = filtrarCampo(postulaciones, 'PuestoDeseado', d.puesto);
  if (d.provincia) postulaciones = filtrarCampo(postulaciones, 'Provincia', d.provincia);

  // Más recientes primero.
  registros.sort(function (a, b) { return fechaValor_(b.FechaActualizacion || b.FechaRegistro) - fechaValor_(a.FechaActualizacion || a.FechaRegistro); });
  postulaciones.sort(function (a, b) { return fechaValor_(b.FechaRegistro) - fechaValor_(a.FechaRegistro); });

  return {
    ok: true,
    total: registros.length,
    totalPostulaciones: postulaciones.length,
    registros: registros,
    postulaciones: postulaciones
  };
}

function filtrarCampo(registros, campo, valor) {
  var v = String(valor).toLowerCase();
  return registros.filter(function (r) {
    return String(r[campo] || '').toLowerCase().indexOf(v) !== -1;
  });
}

function filaAObjeto(columnas, fila) {
  var obj = {};
  for (var i = 0; i < columnas.length; i++) {
    var valor = fila[i];
    if (valor instanceof Date) valor = valor.toISOString();
    obj[columnas[i]] = valor;
  }
  return obj;
}

function normalizarTextoMatch(v) {
  return limpiar(v)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensMatch(v) {
  var stop = {
    de: true, del: true, la: true, el: true, los: true, las: true, y: true, en: true,
    para: true, con: true, sin: true, por: true, un: true, una: true, al: true
  };
  var txt = normalizarTextoMatch(v);
  if (!txt) return [];
  var partes = txt.split(' ');
  var out = [];
  for (var i = 0; i < partes.length; i++) {
    var t = partes[i];
    if (t.length >= 3 && !stop[t] && out.indexOf(t) === -1) out.push(t);
  }
  return out;
}

function parseJSONSeguro(valor, fallback) {
  if (!valor) return fallback || [];
  if (typeof valor !== 'string') return valor;
  try {
    return JSON.parse(valor);
  } catch (e) {
    return fallback || [];
  }
}

function textoDesdeJSON(valor) {
  var data = parseJSONSeguro(valor, []);
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (!Array.isArray(data)) data = [data];
  return data.map(function (item) {
    if (!item) return '';
    if (typeof item === 'string') return item;
    var partes = [];
    Object.keys(item).forEach(function (k) {
      var v = item[k];
      if (v != null && typeof v !== 'object') partes.push(v);
    });
    return partes.join(' ');
  }).join(' ');
}

function recortarTexto_(texto, max) {
  var t = limpiar(texto);
  if (!t || t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).replace(/\s+\S*$/, '') + '…';
}

function interseccionTokens(a, b) {
  var setB = {};
  b.forEach(function (x) { setB[x] = true; });
  return a.filter(function (x) { return setB[x]; });
}

function sumarMotivoMatch_(motivos, texto, detalle) {
  if (motivos.indexOf(texto) === -1) motivos.push(texto);
  return detalle ? texto + ': ' + detalle : texto;
}

function nivelIdiomaValor_(nivel) {
  var n = normalizarTextoMatch(nivel);
  if (!n) return 0;
  if (n.indexOf('nativo') !== -1 || n.indexOf('bilingue') !== -1) return 4;
  if (n.indexOf('avanzado') !== -1) return 3;
  if (n.indexOf('intermedio') !== -1) return 2;
  if (n.indexOf('basico') !== -1) return 1;
  return 0;
}

function extraerNivelIdiomaPostulante_(idiomas, idiomaBuscado) {
  var buscado = normalizarTextoMatch(idiomaBuscado);
  var data = parseJSONSeguro(idiomas, []);
  if (!Array.isArray(data)) return '';
  for (var i = 0; i < data.length; i++) {
    var item = data[i] || {};
    if (normalizarTextoMatch(item.idioma || item.Idioma).indexOf(buscado) !== -1) {
      return item.nivel || item.Nivel || '';
    }
  }
  return '';
}

function extraerAniosRequeridos_(vacante) {
  var texto = normalizarTextoMatch([
    vacante.RequisitosExcluyentes,
    vacante.RequisitosDeseables,
    vacante.Descripcion
  ].join(' '));
  var m = texto.match(/(\d+)\s*(anios|anos|years)/);
  return m ? Number(m[1]) : 0;
}

function calcularCoincidenciaVacante(postulante, vacante) {
  var puntaje = 0;
  var motivos = [];
  var detalles = [];
  var claves = [];

  var tokensPuesto = interseccionTokens(
    tokensMatch(postulante.PuestoDeseado),
    tokensMatch([vacante.Puesto, vacante.Area].join(' '))
  );
  if (tokensPuesto.length) {
    puntaje += Math.min(32, 18 + tokensPuesto.length * 7);
    detalles.push(sumarMotivoMatch_(motivos, 'Puesto relacionado', tokensPuesto.slice(0, 4).join(', ')));
    claves = claves.concat(tokensPuesto);
  }

  var provinciaPost = normalizarTextoMatch(postulante.Provincia);
  var provinciaVac = normalizarTextoMatch(vacante.Provincia);
  var localidadPost = normalizarTextoMatch(postulante.CodigoPostalCiudad);
  var localidadVac = normalizarTextoMatch(vacante.Localidad);
  var modalidadVac = normalizarTextoMatch(vacante.Modalidad);
  if (modalidadVac.indexOf('remoto') !== -1) {
    puntaje += 12;
    detalles.push(sumarMotivoMatch_(motivos, 'Modalidad remota', 'apta para perfiles de distintas localidades'));
  } else {
    if (provinciaPost && provinciaVac && provinciaPost.indexOf(provinciaVac) !== -1) {
      puntaje += 14;
      detalles.push(sumarMotivoMatch_(motivos, 'Coincide provincia', vacante.Provincia));
    }
    if (localidadPost && localidadVac && localidadPost.indexOf(localidadVac) !== -1) {
      puntaje += 8;
      detalles.push(sumarMotivoMatch_(motivos, 'Coincide localidad', vacante.Localidad));
    }
  }

  var habilidadesVac = tokensMatch([vacante.Habilidades, vacante.RequisitosExcluyentes, vacante.RequisitosDeseables].join(' '));
  var textoPost = [
    postulante.PuestoDeseado,
    postulante.PerfilProfesional,
    postulante.DescripcionPerfil,
    textoDesdeJSON(postulante.Experiencias),
    textoDesdeJSON(postulante.Formacion),
    textoDesdeJSON(postulante.Idiomas)
  ].join(' ');
  var habilidadesMatch = interseccionTokens(tokensMatch(textoPost), habilidadesVac);
  if (habilidadesMatch.length) {
    puntaje += Math.min(24, habilidadesMatch.length * 6);
    detalles.push(sumarMotivoMatch_(motivos, 'Coinciden habilidades o experiencia', habilidadesMatch.slice(0, 6).join(', ')));
    claves = claves.concat(habilidadesMatch);
  }

  var tokensFormacion = interseccionTokens(
    tokensMatch(textoDesdeJSON(postulante.Formacion)),
    tokensMatch([vacante.RequisitosExcluyentes, vacante.RequisitosDeseables].join(' '))
  );
  if (tokensFormacion.length) {
    puntaje += 10;
    detalles.push(sumarMotivoMatch_(motivos, 'Formación relacionada', tokensFormacion.slice(0, 4).join(', ')));
    claves = claves.concat(tokensFormacion);
  }

  var idiomaVac = normalizarTextoMatch(vacante.IdiomaRequerido);
  var idiomasPost = normalizarTextoMatch(textoDesdeJSON(postulante.Idiomas));
  if (idiomaVac && idiomaVac !== 'sin requisito de idioma' && idiomasPost.indexOf(idiomaVac) !== -1) {
    var nivelPost = extraerNivelIdiomaPostulante_(postulante.Idiomas, vacante.IdiomaRequerido);
    var nivelReq = vacante.NivelIdioma || '';
    var valorPost = nivelIdiomaValor_(nivelPost);
    var valorReq = nivelIdiomaValor_(nivelReq);
    if (!valorReq || valorPost >= valorReq) {
      puntaje += 10;
      detalles.push(sumarMotivoMatch_(motivos, 'Coincide idioma', [vacante.IdiomaRequerido, nivelPost].filter(Boolean).join(' ')));
    } else {
      puntaje += 4;
      detalles.push(sumarMotivoMatch_(motivos, 'Idioma relacionado', [vacante.IdiomaRequerido, 'nivel del perfil: ' + nivelPost].filter(Boolean).join(' ')));
    }
  }

  var expTexto = normalizarTextoMatch(textoDesdeJSON(postulante.Experiencias));
  var primerEmpleo = normalizarTextoMatch(postulante.PrimerEmpleo).indexOf('si') !== -1;
  var aniosReq = extraerAniosRequeridos_(vacante);
  if (aniosReq > 0 && primerEmpleo) {
    puntaje -= Math.min(18, aniosReq * 4);
    detalles.push(sumarMotivoMatch_(motivos, 'Revisar experiencia requerida', 'la vacante pide ' + aniosReq + ' año(s) y el perfil indica primer empleo'));
  } else if (expTexto) {
    puntaje += 6;
    detalles.push(sumarMotivoMatch_(motivos, 'Tiene experiencia cargada', 'tu perfil incluye antecedentes laborales'));
  }

  var clavesUnicas = [];
  claves.forEach(function (k) {
    if (k && clavesUnicas.indexOf(k) === -1) clavesUnicas.push(k);
  });

  return {
    puntaje: Math.max(0, Math.min(100, puntaje)),
    motivos: motivos,
    detalles: detalles,
    claves: clavesUnicas.slice(0, 8)
  };
}

function yaSeNotificoVacante(mapa, busquedaId, email) {
  return !!mapa[String(busquedaId) + '|' + String(email).toLowerCase()];
}

function urlPostulacionVacante_(vacante) {
  return URL_PLATAFORMA.replace(/\/?$/, '/') +
    'postular.html?busqueda=' + encodeURIComponent(limpiar(vacante.ID)) +
    '&puesto=' + encodeURIComponent(limpiar(vacante.Puesto));
}

function listaEmail_(items) {
  if (!items || !items.length) return '';
  return '<ul style="margin:12px 0 0;padding:0;list-style:none;">' +
    items.map(function (item) {
      return '<li style="margin:0 0 8px;padding:10px 12px;border-radius:12px;background:#fbfafd;border:1px solid #eee8f5;color:#514d62;font-size:14px;line-height:1.45;">' +
        escaparHtml_(item) +
      '</li>';
    }).join('') +
  '</ul>';
}

function etiquetaMatch_(puntaje) {
  if (puntaje >= 82) return 'Coincidencia alta';
  if (puntaje >= 68) return 'Muy buen match';
  return 'Posible match';
}

function enviarEmailVacante(postulante, vacante, match) {
  var nombre = [postulante.Nombre, postulante.Apellido].filter(Boolean).join(' ') || 'Hola';
  var motivos = match.detalles && match.detalles.length
    ? match.detalles
    : (match.motivos && match.motivos.length ? match.motivos : ['Tu perfil tiene datos relacionados con la búsqueda.']);
  var ubicacion = [vacante.Localidad, vacante.Provincia].filter(Boolean).join(', ');
  var url = urlPostulacionVacante_(vacante);
  var etiqueta = etiquetaMatch_(match.puntaje);
  var resumen = recortarTexto_(vacante.Descripcion || vacante.Responsabilidades || vacante.RequisitosExcluyentes, 220);
  var cuerpo = [
    'Hola ' + nombre + ',',
    '',
    'Encontramos una vacante que puede coincidir con tu perfil.',
    '',
    'Puesto: ' + limpiar(vacante.Puesto),
    'Empresa: ' + limpiar(vacante.Empresa),
    'Ubicación: ' + ubicacion,
    'Modalidad: ' + limpiar(vacante.Modalidad),
    'Coincidencia: ' + etiqueta + ' (' + match.puntaje + '/100)',
    resumen ? 'Resumen: ' + resumen : '',
    '',
    'Por qué te la recomendamos:',
    '- ' + motivos.join('\n- '),
    '',
    'Revisá la oportunidad y postulate desde:',
    url,
    '',
    'Saludos,',
    'ONE Talent Hub'
  ].filter(function (x) { return x !== ''; }).join('\n');
  var html = plantillaEmail_({
    titulo: 'Vacante recomendada para vos',
    subtitulo: etiqueta + ': encontramos una búsqueda alineada a tu perfil.',
    contenido:
      parrafoEmail_('Hola ' + nombre + ',') +
      parrafoEmail_('Encontramos una vacante que puede coincidir con tu perfil. Revisá los detalles y, si te interesa, podés postularte con tu CV ya cargado.') +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0;border-top:1px solid #eee8f5;border-bottom:1px solid #eee8f5;">' +
        datoEmail_('Puesto', vacante.Puesto) +
        datoEmail_('Empresa', vacante.Empresa) +
        datoEmail_('Ubicación', ubicacion) +
        datoEmail_('Modalidad', vacante.Modalidad) +
        datoEmail_('Coincidencia', etiqueta + ' · ' + match.puntaje + '/100') +
      '</table>' +
      (resumen ? parrafoEmail_('Resumen: ' + resumen) : '') +
      '<p style="margin:16px 0 0;color:#1a181d;font-size:15px;font-weight:800;">Por qué te la recomendamos</p>' +
      listaEmail_(motivos) +
      (match.claves && match.claves.length ? parrafoEmail_('Coincidencias detectadas: ' + match.claves.join(', ')) : ''),
    ctaTexto: 'Ver vacante y postularme',
    ctaUrl: url,
    nota: 'Te enviamos esta recomendación porque tu perfil cargado tiene coincidencias con una búsqueda activa.'
  });

  var enviado = enviarEmailSeguro_({
    to: limpiar(postulante.Email),
    subject: etiqueta + ': ' + limpiar(vacante.Puesto),
    body: cuerpo,
    htmlBody: html
  }, 'match vacante');
  if (!enviado.ok) throw new Error(enviado.error || 'No se pudo enviar el email.');
}

function perfilComoPostulante_(perfil) {
  return {
    ID: 'perfil:' + normalizarEmail_(perfil.Email),
    FuenteRegistro: 'perfil',
    Aplicaciones: 0,
    Nombre: perfil.Nombre || '',
    Apellido: perfil.Apellido || '',
    Email: perfil.Email || '',
    Telefono: perfil.Telefono || '',
    PuestoDeseado: perfil.PuestoDeseado || '',
    FechaNacimiento: perfil.FechaNacimiento || '',
    Identificacion: perfil.Identificacion || '',
    Provincia: perfil.Provincia || '',
    CodigoPostalCiudad: perfil.CodigoPostalCiudad || '',
    PerfilProfesional: perfil.PerfilProfesional || '',
    Formacion: perfil.Formacion || '[]',
    DescripcionPerfil: perfil.DescripcionPerfil || '',
    DispViajar: perfil.DispViajar || '',
    DispCambioResidencia: perfil.DispCambioResidencia || '',
    Idiomas: perfil.Idiomas || '[]',
    PrimerEmpleo: perfil.PrimerEmpleo || '',
    Experiencias: perfil.Experiencias || '[]',
    CVNombre: perfil.CVNombre || '',
    CVUrl: perfil.CVUrl || '',
    FirmaConsentimientoUrl: perfil.FirmaConsentimientoUrl || '',
    FechaFirmaConsentimiento: perfil.FirmaConsentimientoUrl ? (perfil.FechaActualizacion || perfil.FechaRegistro || '') : '',
    FirmaConformidadUrl: perfil.FirmaConformidadUrl || '',
    FechaFirmaConformidad: perfil.FirmaConformidadUrl ? (perfil.FechaActualizacion || perfil.FechaRegistro || '') : '',
    BusquedaID: '',
    BusquedaPuesto: '',
    RespuestasBusqueda: '',
    FechaRegistro: perfil.FechaRegistro || '',
    FechaActualizacion: perfil.FechaActualizacion || ''
  };
}

function fechaValor_(valor) {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return valor;
  var t = Date.parse(valor);
  if (isNaN(t) && typeof valor === 'string') {
    var m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      t = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)).getTime();
    }
  }
  return isNaN(t) ? 0 : t;
}

function obtenerPostulantesConsolidados_(ss) {
  var mapa = {};
  var hojaPerf = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
  var filasPerf = hojaPerf.getDataRange().getValues();
  for (var p = 1; p < filasPerf.length; p++) {
    var perfil = filaAObjeto(COLUMNAS_PERFILES, filasPerf[p]);
    var emailPerfil = normalizarEmail_(perfil.Email);
    if (emailPerfil && emailValido_(emailPerfil)) {
      var candidatoPerfil = perfilComoPostulante_(perfil);
      candidatoPerfil._fuente = 'Perfiles';
      candidatoPerfil._fechaPerfil = fechaValor_(perfil.FechaActualizacion || perfil.FechaRegistro);
      mapa[emailPerfil] = candidatoPerfil;
    }
  }

  var hojaPost = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var filasPost = hojaPost.getDataRange().getValues();
  for (var i = 1; i < filasPost.length; i++) {
    var postulante = filaAObjeto(COLUMNAS_POSTULANTES, filasPost[i]);
    var email = normalizarEmail_(postulante.Email);
    if (!email || !emailValido_(email)) continue;
    var fechaPost = fechaValor_(postulante.FechaRegistro);
    if (!mapa[email]) {
      postulante._fuente = 'Postulantes';
      postulante._fechaPerfil = fechaPost;
      postulante.FuenteRegistro = 'postulacion';
      postulante.Aplicaciones = 1;
      mapa[email] = postulante;
    } else {
      mapa[email].Aplicaciones = Number(mapa[email].Aplicaciones || 0) + 1;
      if (postulante.BusquedaID) {
        mapa[email].BusquedaID = postulante.BusquedaID;
        mapa[email].BusquedaPuesto = postulante.BusquedaPuesto;
        mapa[email].RespuestasBusqueda = postulante.RespuestasBusqueda;
      }
      if (fechaPost > (mapa[email]._ultimaAplicacionFecha || 0)) {
        mapa[email]._ultimaAplicacionFecha = fechaPost;
        mapa[email].UltimaPostulacionFecha = postulante.FechaRegistro;
        mapa[email].UltimaBusquedaID = postulante.BusquedaID || '';
        mapa[email].UltimaBusquedaPuesto = postulante.BusquedaPuesto || '';
        if (!mapa[email].CVUrl && postulante.CVUrl) mapa[email].CVUrl = postulante.CVUrl;
        if (!mapa[email].FirmaConsentimientoUrl && postulante.FirmaConsentimientoUrl) mapa[email].FirmaConsentimientoUrl = postulante.FirmaConsentimientoUrl;
        if (!mapa[email].FirmaConformidadUrl && postulante.FirmaConformidadUrl) mapa[email].FirmaConformidadUrl = postulante.FirmaConformidadUrl;
      }
    }
  }

  var salida = [];
  Object.keys(mapa).forEach(function (email) { salida.push(mapa[email]); });
  return salida;
}

function obtenerCandidatosParaNotificar_(ss) {
  return obtenerPostulantesConsolidados_(ss);
}

function obtenerPostulaciones_(ss) {
  var hoja = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var valores = hoja.getDataRange().getValues();
  var salida = [];
  for (var i = 1; i < valores.length; i++) {
    var postulacion = filaAObjeto(COLUMNAS_POSTULANTES, valores[i]);
    postulacion.FuenteRegistro = 'postulacion';
    postulacion.Aplicaciones = 1;
    salida.push(postulacion);
  }
  return salida;
}

function probarMatchVacante(d) {
  var email = normalizarEmail_(d.email);
  var busquedaId = limpiar(d.busquedaId);
  if (!email || !busquedaId) return { ok: false, error: 'Indicá email y busquedaId.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var candidatos = obtenerCandidatosParaNotificar_(ss);
  var candidato = null;
  for (var i = 0; i < candidatos.length; i++) {
    if (normalizarEmail_(candidatos[i].Email) === email) {
      candidato = candidatos[i];
      break;
    }
  }
  if (!candidato) return { ok: false, error: 'No encontré un perfil/postulante con ese email.' };

  var hojaBusq = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var filasBusq = hojaBusq.getDataRange().getValues();
  var vacante = null;
  for (var b = 1; b < filasBusq.length; b++) {
    if (limpiar(filasBusq[b][0]) === busquedaId) {
      vacante = filaAObjeto(COLUMNAS_BUSQUEDAS, filasBusq[b]);
      break;
    }
  }
  if (!vacante) return { ok: false, error: 'No encontré la vacante indicada.' };

  var match = calcularCoincidenciaVacante(candidato, vacante);
  return {
    ok: true,
    email: email,
    busquedaId: busquedaId,
    puesto: vacante.Puesto,
    puntaje: match.puntaje,
    etiqueta: etiquetaMatch_(match.puntaje),
    superaMinimo: match.puntaje >= MATCH_MINIMO_NOTIFICACION,
    motivos: match.motivos,
    detalles: match.detalles,
    claves: match.claves,
    yaPostulado: !!buscarPostulacionExistente_(obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES), email, busquedaId)
  };
}

function notificarPostulantesCompatibles(vacante) {
  if (normalizarTextoMatch(vacante.Estado) !== 'activa') return { enviados: 0, candidatos: 0 };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojaPost = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var hojaNotif = obtenerHoja(ss, HOJA_NOTIFICACIONES_VACANTES, COLUMNAS_NOTIFICACIONES_VACANTES);
  var filasNotif = hojaNotif.getDataRange().getValues();
  var candidatosDisponibles = obtenerCandidatosParaNotificar_(ss);
  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var notificados = {};
  var conteoDia = {};
  for (var n = 1; n < filasNotif.length; n++) {
    var filaN = filaAObjeto(COLUMNAS_NOTIFICACIONES_VACANTES, filasNotif[n]);
    var emailN = String(filaN.EmailPostulante || '').toLowerCase();
    if (filaN.BusquedaID && emailN && String(filaN.Estado || '').toLowerCase() === 'enviado') {
      notificados[String(filaN.BusquedaID) + '|' + emailN] = true;
    }
    if (emailN && filaN.Fecha) {
      var fechaN = filasNotif[n][0] instanceof Date
        ? Utilities.formatDate(filasNotif[n][0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(filaN.Fecha).slice(0, 10);
      if (fechaN === hoy && String(filaN.Estado || '').toLowerCase() === 'enviado') {
        conteoDia[emailN] = (conteoDia[emailN] || 0) + 1;
      }
    }
  }

  var registros = [];
  var enviados = 0;
  var candidatos = 0;
  for (var i = 0; i < candidatosDisponibles.length; i++) {
    var postulante = candidatosDisponibles[i];
    var email = normalizarEmail_(postulante.Email);
    if (!email || !emailValido_(email)) continue;
    if (yaSeNotificoVacante(notificados, vacante.ID, email)) continue;
    if (buscarPostulacionExistente_(hojaPost, email, vacante.ID)) continue;
    if ((conteoDia[email] || 0) >= MAX_NOTIFICACIONES_DIARIAS_POSTULANTE) continue;

    var match = calcularCoincidenciaVacante(postulante, vacante);
    if (match.puntaje < MATCH_MINIMO_NOTIFICACION) continue;
    candidatos++;

    var estado = 'enviado';
    var error = '';
    try {
      enviarEmailVacante(postulante, vacante, match);
      enviados++;
      conteoDia[email] = (conteoDia[email] || 0) + 1;
      notificados[String(vacante.ID) + '|' + email] = true;
    } catch (e) {
      estado = 'error';
      error = String(e && e.message ? e.message : e);
    }

    registros.push([
      new Date(),
      vacante.ID,
      vacante.Puesto,
      vacante.Empresa,
      email,
      [postulante.Nombre, postulante.Apellido].filter(Boolean).join(' '),
      match.puntaje,
      (match.detalles && match.detalles.length ? match.detalles : match.motivos).join(' | '),
      estado,
      error
    ]);
  }

  if (registros.length) {
    hojaNotif.getRange(hojaNotif.getLastRow() + 1, 1, registros.length, COLUMNAS_NOTIFICACIONES_VACANTES.length).setValues(registros);
  }
  return { enviados: enviados, candidatos: candidatos };
}

/* -------------------------------------------------------------------
 *  EXPORTAR (CSV plano)
 * ----------------------------------------------------------------- */

function exportarPostulantes(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada.' };

  var resultado = listarPostulantes(d);
  if (!resultado.ok) return resultado;

  return { ok: true, registros: resultado.registros };
}

/* -------------------------------------------------------------------
 *  ADMINISTRACIÓN (solo rol admin)
 * ----------------------------------------------------------------- */

function requireAdmin(token) {
  var sesion = validarToken(token);
  if (!sesion) return null;
  if (String(sesion.rol) !== 'admin') return null;
  return sesion;
}

/**
 * Lista todas las empresas registradas (para el panel de administración).
 */
function listarEmpresas(d) {
  if (!requireAdmin(d.token)) return { ok: false, error: 'Acceso exclusivo del administrador.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();

  var empresas = [];
  for (var i = 1; i < valores.length; i++) {
    var fila = valores[i];
    var rol = String(fila[7] || 'empresa').toLowerCase();
    if (rol === 'admin') continue; // no listar administradores
    empresas.push(empresaDesdeFila(fila));
  }
  // Pendientes primero.
  empresas.sort(function (a, b) {
    var orden = { pendiente: 0, aprobado: 1, rechazado: 2 };
    return (orden[a.estado] || 9) - (orden[b.estado] || 9);
  });

  return { ok: true, total: empresas.length, empresas: empresas };
}

/**
 * Cambia el estado de una empresa: aprobado | rechazado | pendiente.
 */
function aprobarEmpresa(d) {
  if (!requireAdmin(d.token)) return { ok: false, error: 'Acceso exclusivo del administrador.' };

  var usuario = limpiar(d.usuario).toLowerCase();
  var nuevo = limpiar(d.estado).toLowerCase();
  if (['aprobado', 'rechazado', 'pendiente'].indexOf(nuevo) === -1) {
    return { ok: false, error: 'Estado inválido.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      if (String(valores[i][7] || 'empresa').toLowerCase() === 'admin') {
        return { ok: false, error: 'No se puede modificar una cuenta de administrador.' };
      }
      var estadoAnterior = String(valores[i][8] || '').toLowerCase();
      hoja.getRange(i + 1, 9).setValue(nuevo);   // columna Estado
      // Si se rechaza o se deja pendiente, invalida su sesión activa.
      if (nuevo !== 'aprobado') {
        hoja.getRange(i + 1, 4).setValue('');    // Token
        hoja.getRange(i + 1, 5).setValue('');    // TokenExpira
      }
      if (nuevo === 'aprobado' && estadoAnterior !== 'aprobado') {
        emailEmpresaAprobada_(empresaDesdeFila(hoja.getRange(i + 1, 1, 1, COLUMNAS_USUARIOS.length).getValues()[0]));
      }
      if (nuevo === 'rechazado' && estadoAnterior !== 'rechazado') {
        emailEmpresaRechazada_(empresaDesdeFila(hoja.getRange(i + 1, 1, 1, COLUMNAS_USUARIOS.length).getValues()[0]));
      }
      return { ok: true, estado: nuevo };
    }
  }
  return { ok: false, error: 'Empresa no encontrada.' };
}

/* -------------------------------------------------------------------
 *  FIRMAS
 * ----------------------------------------------------------------- */

/**
 * Guarda una imagen de firma en Drive dentro de la carpeta de CVs.
 * @param {string} base64 - Imagen en base64 (sin prefijo data:)
 * @param {string} nombre - Nombre del archivo
 * @returns {{ url: string, nombre: string } | { error: string }}
 */
function guardarArchivoFirma(base64, nombre) {
  if (!base64) return { nombre: '', url: '' };
  try {
    var bytes = Utilities.base64Decode(base64);
    var blob = Utilities.newBlob(bytes, 'image/png', limpiar(nombre) || 'firma.png');

    var carpeta = obtenerCarpetaCV();
    var archivo = carpeta.createFile(blob);
    try {
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) { /* algunos dominios restringen el uso compartido público */ }

    return { nombre: archivo.getName(), url: archivo.getUrl() };
  } catch (err) {
    return { error: 'No se pudo guardar la firma: ' + String(err && err.message ? err.message : err) };
  }
}

/**
 * Actualiza las firmas de un postulante existente (consentimiento y/o conformidad).
 * Se busca al postulante por email.
 */
function firmarPostulacion(d) {
  var email = limpiar(d.email).toLowerCase();
  if (!email) return { ok: false, error: 'Falta el email del postulante.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var valores = hoja.getDataRange().getValues();

  // Buscar la columna Email (índice 4)
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][ 4 ]).trim().toLowerCase() === email) {
      var ahora = new Date();
      var filaNum = i + 1;

      if (d.tipo === 'consentimiento' && d.firmaBase64) {
        var firma = guardarArchivoFirma(d.firmaBase64, 'consent_' + valores[i][0] + '.png');
        if (firma.error) return { ok: false, error: firma.error };
        // Columna 22: FirmaConsentimientoUrl, 23: FechaFirmaConsentimiento
        hoja.getRange(filaNum, 23).setValue(firma.url);
        hoja.getRange(filaNum, 24).setValue(ahora);
      }

      if (d.tipo === 'conformidad' && d.firmaBase64) {
        var firma2 = guardarArchivoFirma(d.firmaBase64, 'conf_' + valores[i][0] + '.png');
        if (firma2.error) return { ok: false, error: firma2.error };
        // Columna 24: FirmaConformidadUrl, 25: FechaFirmaConformidad
        hoja.getRange(filaNum, 24).setValue(firma2.url);
        hoja.getRange(filaNum, 25).setValue(ahora);
      }

      return { ok: true, mensaje: 'Firma registrada correctamente.' };
    }
  }
  return { ok: false, error: 'Postulante no encontrado con ese email.' };
}

/* -------------------------------------------------------------------
 *  VERIFICACIÓN — ACCIONES ADICIONALES
 * ----------------------------------------------------------------- */

function cambiarEstadoVerificacion(d) {
  if (!requireAdmin(d.token)) return { ok: false, error: 'Acceso exclusivo del administrador.' };

  var usuario = limpiar(d.usuario).toLowerCase();
  var nuevo = limpiar(d.estado).toLowerCase();
  if (['aprobado', 'rechazado', 'pendiente'].indexOf(nuevo) === -1) {
    return { ok: false, error: 'Estado de verificación inválido.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      var estadoAnterior = String(valores[i][15] || 'pendiente').toLowerCase();
      hoja.getRange(i + 1, 16).setValue(nuevo);
      hoja.getRange(i + 1, 17).setValue(new Date());
      if (nuevo === 'rechazado' && estadoAnterior !== 'rechazado') {
        emailVerificacionRechazada_(empresaDesdeFila(hoja.getRange(i + 1, 1, 1, COLUMNAS_USUARIOS.length).getValues()[0]));
      }
      return { ok: true, estadoVerificacion: nuevo };
    }
  }
  return { ok: false, error: 'Empresa no encontrada.' };
}

/* -------------------------------------------------------------------
 *  BÚSQUEDAS (avisos de empleo publicados por las empresas)
 * ----------------------------------------------------------------- */

/**
 * Devuelve la fila (array) de la empresa de la sesión, o null.
 */
function filaEmpresaDeSesion(sesion) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) return valores[i];
  }
  return null;
}

/**
 * Valida la sesión de una empresa aprobada + verificada. Devuelve
 * { sesion, fila } o { error } listo para responder.
 */
function empresaHabilitadaParaBuscar(token) {
  var sesion = validarToken(token);
  if (!sesion) return { error: 'Sesión inválida o expirada. Volvé a iniciar sesión.' };
  if (sesion.rol === 'admin') return { error: 'Esta acción corresponde a cuentas de empresa.' };

  var fila = filaEmpresaDeSesion(sesion);
  if (!fila) return { error: 'Empresa no encontrada.' };

  var estadoCuenta = String(fila[8] || '').toLowerCase();
  var estadoVerif = String(fila[15] || 'pendiente').toLowerCase();
  if (estadoCuenta !== 'aprobado') {
    return { error: 'Tu cuenta debe estar aprobada para publicar búsquedas.' };
  }
  if (estadoVerif !== 'aprobado') {
    return { error: 'Tu verificación de identidad debe estar aprobada para publicar búsquedas.' };
  }
  return { sesion: sesion, fila: fila };
}

/**
 * Arma los valores de las columnas 6..32 (Puesto..Pregunta2) de una búsqueda
 * a partir del payload. Se usa tanto al crear como al actualizar.
 */
function valoresBusqueda(d, titulo, estado) {
  return [
    titulo,                                    // Puesto (Título)
    limpiar(d.mision),                         // Descripcion (Misión / resumen)
    limpiar(d.provincia) || 'Tucumán',         // Provincia
    limpiar(d.localidad),                      // Localidad
    limpiar(d.modalidad),                      // Modalidad
    '',                                        // Jornada (obsoleto, se conserva la columna)
    limpiar(d.vacantes),                       // Vacantes
    estado,                                    // Estado
    limpiar(d.area),                           // Area
    limpiar(d.tipoContrato),                   // TipoContrato
    limpiar(d.zona),                           // Zona
    limpiar(d.responsabilidades),              // Responsabilidades
    limpiar(d.requisitosExcluyentes),          // RequisitosExcluyentes
    limpiar(d.requisitosDeseables),            // RequisitosDeseables
    limpiar(d.habilidades),                    // Habilidades
    limpiar(d.idiomaRequerido),                // IdiomaRequerido
    limpiar(d.nivelIdioma),                    // NivelIdioma
    limpiar(d.salarioMin),                     // SalarioMin
    limpiar(d.salarioMax),                     // SalarioMax
    (d.ocultarSalario ? 'Sí' : 'No'),          // OcultarSalario
    limpiar(d.horario),                        // Horario
    limpiar(d.beneficios),                     // Beneficios
    limpiar(d.beneficiosOtros),                // BeneficiosOtros
    limpiar(d.fechaVencimiento),               // FechaVencimiento
    limpiar(d.reclutador),                     // Reclutador
    limpiar(d.pregunta1),                      // Pregunta1
    limpiar(d.pregunta2)                       // Pregunta2
  ];
}

function estadoBusquedaValido(v, porDefecto) {
  var e = limpiar(v).toLowerCase();
  return ['borrador', 'activa', 'pausada', 'cerrada'].indexOf(e) !== -1 ? e : (porDefecto || 'activa');
}

function crearBusqueda(d) {
  var hab = empresaHabilitadaParaBuscar(d.token);
  if (hab.error) return { ok: false, error: hab.error };

  var titulo = limpiar(d.puesto); // "Puesto" = Título de la búsqueda
  var responsabilidades = limpiar(d.responsabilidades);
  var reqExcluyentes = limpiar(d.requisitosExcluyentes);
  if (!titulo) return { ok: false, error: 'Indicá el título de la búsqueda.' };
  if (!responsabilidades) return { ok: false, error: 'Detallá las responsabilidades principales.' };
  if (!reqExcluyentes) return { ok: false, error: 'Detallá los requisitos excluyentes.' };

  var estado = estadoBusquedaValido(d.estado, 'activa');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var id = Utilities.getUuid();
  var ahora = new Date();

  var fila = [id, ahora, ahora, hab.sesion.usuario, hab.fila[2]].concat(valoresBusqueda(d, titulo, estado));
  hoja.appendRow(fila);
  var busqueda = filaAObjeto(COLUMNAS_BUSQUEDAS, fila);
  var notificaciones = notificarPostulantesCompatibles(busqueda);

  return { ok: true, id: id, mensaje: 'Búsqueda guardada correctamente.', notificaciones: notificaciones };
}

function listarMisBusquedas(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada.' };
  if (sesion.rol === 'admin') return { ok: false, error: 'Esta acción corresponde a cuentas de empresa.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    // Se omiten las eliminadas: siguen archivadas para el SuperAdmin, no para la empresa.
    if (String(valores[i][3]).trim().toLowerCase() === usuario &&
        String(valores[i][12] || '').toLowerCase() !== 'eliminada') {
      lista.push(filaAObjeto(COLUMNAS_BUSQUEDAS, valores[i]));
    }
  }
  lista.reverse(); // más recientes primero
  return { ok: true, total: lista.length, busquedas: lista };
}

/**
 * Lista TODAS las búsquedas de todas las empresas para el panel de SuperAdmin,
 * incluidas las que la empresa marcó como eliminadas (quedan archivadas acá).
 * Incluye el nombre y el usuario de la empresa que la publicó.
 */
function listarBusquedasAdmin(d) {
  if (!requireAdmin(d.token)) return { ok: false, error: 'Acceso exclusivo del administrador.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();

  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    lista.push(filaAObjeto(COLUMNAS_BUSQUEDAS, valores[i]));
  }
  lista.reverse(); // más recientes primero
  return { ok: true, total: lista.length, busquedas: lista };
}

function actualizarBusqueda(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada.' };

  var id = limpiar(d.id);
  if (!id) return { ok: false, error: 'Falta el identificador de la búsqueda.' };
  var titulo = limpiar(d.puesto);
  var responsabilidades = limpiar(d.responsabilidades);
  var reqExcluyentes = limpiar(d.requisitosExcluyentes);
  if (!titulo) return { ok: false, error: 'Indicá el título de la búsqueda.' };
  if (!responsabilidades) return { ok: false, error: 'Detallá las responsabilidades principales.' };
  if (!reqExcluyentes) return { ok: false, error: 'Detallá los requisitos excluyentes.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === id) {
      if (String(valores[i][3]).trim().toLowerCase() !== usuario) {
        return { ok: false, error: 'No podés modificar esta búsqueda.' };
      }
      var filaNum = i + 1;
      var estado = estadoBusquedaValido(d.estado, String(valores[i][12] || 'activa').toLowerCase());
      hoja.getRange(filaNum, 3).setValue(new Date());               // FechaActualizacion
      // Columnas 6..32 (Puesto..Pregunta2)
      hoja.getRange(filaNum, 6, 1, 27).setValues([valoresBusqueda(d, titulo, estado)]);
      var actualizada = hoja.getRange(filaNum, 1, 1, COLUMNAS_BUSQUEDAS.length).getValues()[0];
      var busquedaActualizada = filaAObjeto(COLUMNAS_BUSQUEDAS, actualizada);
      var notificaciones = notificarPostulantesCompatibles(busquedaActualizada);
      return { ok: true, mensaje: 'Búsqueda actualizada.', busqueda: busquedaActualizada, notificaciones: notificaciones };
    }
  }
  return { ok: false, error: 'Búsqueda no encontrada.' };
}

function cambiarEstadoBusqueda(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada.' };

  var id = limpiar(d.id);
  var nuevo = limpiar(d.estado).toLowerCase();
  if (['borrador', 'activa', 'pausada', 'cerrada'].indexOf(nuevo) === -1) {
    return { ok: false, error: 'Estado inválido.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === id) {
      if (String(valores[i][3]).trim().toLowerCase() !== usuario) {
        return { ok: false, error: 'No podés modificar esta búsqueda.' };
      }
      hoja.getRange(i + 1, 13).setValue(nuevo);        // Estado
      hoja.getRange(i + 1, 3).setValue(new Date());    // FechaActualizacion
      var actualizada = hoja.getRange(i + 1, 1, 1, COLUMNAS_BUSQUEDAS.length).getValues()[0];
      var notificaciones = nuevo === 'activa'
        ? notificarPostulantesCompatibles(filaAObjeto(COLUMNAS_BUSQUEDAS, actualizada))
        : { enviados: 0, candidatos: 0 };
      return { ok: true, estado: nuevo, notificaciones: notificaciones };
    }
  }
  return { ok: false, error: 'Búsqueda no encontrada.' };
}

function eliminarBusqueda(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada.' };

  var id = limpiar(d.id);
  if (!id) return { ok: false, error: 'Falta el identificador de la búsqueda.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === id) {
      if (String(valores[i][3]).trim().toLowerCase() !== usuario) {
        return { ok: false, error: 'No podés eliminar esta búsqueda.' };
      }
      // Borrado "suave": la búsqueda desaparece para la empresa y del sitio
      // público, pero la fila se conserva para el panel de SuperAdmin.
      hoja.getRange(i + 1, 13).setValue('eliminada');   // Estado
      hoja.getRange(i + 1, 3).setValue(new Date());     // FechaActualizacion
      return { ok: true, mensaje: 'Búsqueda eliminada.' };
    }
  }
  return { ok: false, error: 'Búsqueda no encontrada.' };
}

/**
 * Devuelve las búsquedas ACTIVAS para publicarlas en la página de inicio.
 * Es PÚBLICA (no requiere token) y no expone el usuario/email de la empresa.
 */
function busquedasPublicas(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var valores = hoja.getDataRange().getValues();

  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][12]).toLowerCase() === 'activa') {
      var o = filaAObjeto(COLUMNAS_BUSQUEDAS, valores[i]);
      // No exponer datos internos/sensibles al público.
      // Pregunta1/Pregunta2 SÍ se exponen: el postulante debe poder responderlas.
      delete o.UsuarioEmpresa;
      delete o.Reclutador;
      delete o.FechaVencimiento;
      var oculto = String(o.OcultarSalario || '').toLowerCase();
      if (oculto === 'sí' || oculto === 'si') {
        delete o.SalarioMin;
        delete o.SalarioMax;
      }
      lista.push(o);
    }
  }
  lista.reverse(); // más recientes primero
  return { ok: true, total: lista.length, busquedas: lista };
}

/* -------------------------------------------------------------------
 *  CUENTA DEL POSTULANTE (perfil reutilizable)
 * ----------------------------------------------------------------- */

// Convierte una fila de Perfiles en objeto (sin password ni token).
function perfilDesdeFila(fila) {
  return {
    email: fila[0],
    fechaRegistro: (fila[4] instanceof Date) ? fila[4].toISOString() : fila[4],
    fechaActualizacion: (fila[5] instanceof Date) ? fila[5].toISOString() : fila[5],
    nombre: fila[6] || '', apellido: fila[7] || '', telefono: fila[8] || '',
    puestoDeseado: fila[9] || '', fechaNacimiento: fila[10] || '', identificacion: fila[11] || '',
    provincia: fila[12] || '', codigoPostalCiudad: fila[13] || '', perfilProfesional: fila[14] || '',
    formacion: fila[15] || '[]', descripcionPerfil: fila[16] || '',
    dispViajar: fila[17] || '', dispCambioResidencia: fila[18] || '', idiomas: fila[19] || '[]',
    primerEmpleo: fila[20] || '', experiencias: fila[21] || '[]',
    cvNombre: fila[22] || '', cvUrl: fila[23] || '',
    firmaConsentimientoUrl: fila[24] || '', firmaConformidadUrl: fila[25] || ''
  };
}

function perfilParaPostulante_(perfil) {
  var salida = Object.assign({}, perfil);
  delete salida.firmaConsentimientoUrl;
  delete salida.firmaConformidadUrl;
  return salida;
}

// Valida el token del perfil y devuelve { hoja, filaNum, fila, email } o null.
function validarTokenPerfil(token) {
  if (!token) return null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
  var valores = hoja.getDataRange().getValues();
  var ahora = new Date().getTime();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][2]) === String(token)) {
      var expira = Number(valores[i][3] || 0);
      if (expira && expira < ahora) return null;
      return { hoja: hoja, filaNum: i + 1, fila: valores[i], email: String(valores[i][0]) };
    }
  }
  return null;
}

function registrarPostulante(d) {
  var email = limpiar(d.email).toLowerCase();
  var password = String(d.password || '');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Ingresá un email válido.' };
  if (password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  if (!limpiar(d.nombre) || !limpiar(d.apellido)) return { ok: false, error: 'Completá nombre y apellido.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
  var valores = hoja.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === email) {
      return { ok: false, error: 'Ya existe una cuenta con ese email. Iniciá sesión.' };
    }
  }

  var cv = guardarArchivoCV(d.cvBase64, d.cvNombre, d.cvTipo);
  if (cv.error) return { ok: false, error: cv.error };
  var firmaConsent = guardarArchivoFirma(d.firmaConsentimientoBase64, 'consent_perfil_' + email + '.png');
  var firmaConf = guardarArchivoFirma(d.firmaConformidadBase64, 'conf_perfil_' + email + '.png');

  var ahora = new Date();
  var token = Utilities.getUuid();
  var expira = ahora.getTime() + TOKEN_HORAS * 3600 * 1000;

  hoja.appendRow([
    email, password, token, expira, ahora, ahora,
    limpiar(d.nombre), limpiar(d.apellido), limpiar(d.telefono), limpiar(d.puestoDeseado),
    limpiar(d.fechaNacimiento), limpiar(d.identificacion), limpiar(d.provincia), limpiar(d.codigoPostalCiudad), limpiar(d.perfilProfesional),
    normalizarJSON(d.formacion), limpiar(d.descripcionPerfil), limpiar(d.dispViajar), limpiar(d.dispCambioResidencia), normalizarJSON(d.idiomas),
    d.primerEmpleo ? 'Sí' : 'No', normalizarJSON(d.experiencias), cv.nombre, cv.url,
    firmaConsent.url, firmaConf.url
  ]);

  var fila = hoja.getRange(hoja.getLastRow(), 1, 1, COLUMNAS_PERFILES.length).getValues()[0];
  var emailRegistro = emailRegistroPostulante_(d);
  return {
    ok: true,
    token: token,
    perfil: perfilParaPostulante_(perfilDesdeFila(fila)),
    mensaje: 'Cuenta creada correctamente.',
    emailRegistroOk: !!(emailRegistro && emailRegistro.ok),
    emailRegistroError: emailRegistro && emailRegistro.error ? emailRegistro.error : ''
  };
}

function loginPostulante(d) {
  var email = limpiar(d.email).toLowerCase();
  var password = String(d.password || '');
  if (!email || !password) return { ok: false, error: 'Ingresá email y contraseña.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_PERFILES, COLUMNAS_PERFILES);
  var valores = hoja.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === email && String(valores[i][1]) === password) {
      var token = Utilities.getUuid();
      var expira = new Date().getTime() + TOKEN_HORAS * 3600 * 1000;
      hoja.getRange(i + 1, 3).setValue(token);
      hoja.getRange(i + 1, 4).setValue(expira);
      var fila = hoja.getRange(i + 1, 1, 1, COLUMNAS_PERFILES.length).getValues()[0];
      fila[2] = token; fila[3] = expira;
      return { ok: true, token: token, perfil: perfilParaPostulante_(perfilDesdeFila(fila)) };
    }
  }
  return { ok: false, error: 'Email o contraseña incorrectos.' };
}

function miPerfil(d) {
  var s = validarTokenPerfil(d.token);
  if (!s) return { ok: false, error: 'Sesión inválida o expirada.' };
  return { ok: true, perfil: perfilParaPostulante_(perfilDesdeFila(s.fila)) };
}

function actualizarPerfil(d) {
  var s = validarTokenPerfil(d.token);
  if (!s) return { ok: false, error: 'Sesión inválida o expirada.' };
  if (!limpiar(d.nombre) || !limpiar(d.apellido)) return { ok: false, error: 'Completá nombre y apellido.' };
  var hoja = s.hoja, filaNum = s.filaNum;

  var cvNombre = s.fila[22], cvUrl = s.fila[23];
  if (d.cvBase64) {
    var cv = guardarArchivoCV(d.cvBase64, d.cvNombre, d.cvTipo);
    if (cv.error) return { ok: false, error: cv.error };
    cvNombre = cv.nombre; cvUrl = cv.url;
  }
  var firmaConsentUrl = s.fila[24], firmaConfUrl = s.fila[25];
  if (d.firmaConsentimientoBase64) { var fc = guardarArchivoFirma(d.firmaConsentimientoBase64, 'consent_perfil_' + s.email + '.png'); if (fc.url) firmaConsentUrl = fc.url; }
  if (d.firmaConformidadBase64) { var ff = guardarArchivoFirma(d.firmaConformidadBase64, 'conf_perfil_' + s.email + '.png'); if (ff.url) firmaConfUrl = ff.url; }

  if (d.nuevaPassword) {
    if (String(d.nuevaPassword).length < 6) return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    hoja.getRange(filaNum, 2).setValue(String(d.nuevaPassword));
  }

  hoja.getRange(filaNum, 6).setValue(new Date()); // FechaActualizacion
  // Columnas 7..26 (Nombre..FirmaConformidadUrl)
  hoja.getRange(filaNum, 7, 1, 20).setValues([[
    limpiar(d.nombre), limpiar(d.apellido), limpiar(d.telefono), limpiar(d.puestoDeseado),
    limpiar(d.fechaNacimiento), limpiar(d.identificacion), limpiar(d.provincia), limpiar(d.codigoPostalCiudad), limpiar(d.perfilProfesional),
    normalizarJSON(d.formacion), limpiar(d.descripcionPerfil), limpiar(d.dispViajar), limpiar(d.dispCambioResidencia), normalizarJSON(d.idiomas),
    d.primerEmpleo ? 'Sí' : 'No', normalizarJSON(d.experiencias), cvNombre, cvUrl,
    firmaConsentUrl, firmaConfUrl
  ]]);

  var fila = hoja.getRange(filaNum, 1, 1, COLUMNAS_PERFILES.length).getValues()[0];
  return { ok: true, mensaje: 'Perfil actualizado.', perfil: perfilParaPostulante_(perfilDesdeFila(fila)) };
}

// Crea una postulación (fila en Postulantes) copiando el perfil del postulante
// logueado, sin volver a cargar los datos. Guarda el vínculo con la búsqueda.
function postularConPerfil(d) {
  var s = validarTokenPerfil(d.token);
  if (!s) return { ok: false, error: 'Sesión inválida o expirada.' };
  var p = perfilDesdeFila(s.fila);
  if (!p.nombre || !p.apellido || !p.email) return { ok: false, error: 'Tu perfil está incompleto. Completá tus datos antes de postularte.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var existente = buscarPostulacionExistente_(hoja, p.email, d.busquedaId);
  if (existente) return errorPostulacionDuplicada_(existente);

  var id = Utilities.getUuid();
  var ahora = new Date();

  var fila = [
    id, ahora,
    p.nombre, p.apellido, p.email, p.telefono, (limpiar(d.puestoDeseado) || p.puestoDeseado),
    p.fechaNacimiento, p.identificacion, p.provincia, p.codigoPostalCiudad, p.perfilProfesional,
    p.formacion, p.descripcionPerfil, p.dispViajar, p.dispCambioResidencia, p.idiomas,
    p.primerEmpleo, p.experiencias, p.cvNombre, p.cvUrl,
    p.firmaConsentimientoUrl, (p.firmaConsentimientoUrl ? ahora : ''),
    p.firmaConformidadUrl, (p.firmaConformidadUrl ? ahora : ''),
    limpiar(d.busquedaId), limpiar(d.busquedaPuesto), normalizarJSON(d.respuestasBusqueda)
  ];

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    existente = buscarPostulacionExistente_(hoja, p.email, d.busquedaId);
    if (existente) return errorPostulacionDuplicada_(existente);
    hoja.appendRow(fila);
  } finally {
    lock.releaseLock();
  }

  var emailPostulacion = emailPostulacionExitosa_({
    nombre: p.nombre,
    apellido: p.apellido,
    email: p.email,
    puestoDeseado: p.puestoDeseado,
    busquedaPuesto: d.busquedaPuesto
  }, id);

  return {
    ok: true,
    id: id,
    mensaje: '¡Postulación enviada!',
    emailPostulacionOk: !!(emailPostulacion && emailPostulacion.ok),
    emailPostulacionError: emailPostulacion && emailPostulacion.error ? emailPostulacion.error : ''
  };
}

// Devuelve las búsquedas a las que se postuló el postulante logueado.
// Cruza sus filas en Postulantes (por email) con la hoja de Búsquedas para
// sumar el nombre de la empresa y el estado actual de cada búsqueda.
function misPostulaciones(d) {
  var s = validarTokenPerfil(d.token);
  if (!s) return { ok: false, error: 'Sesión inválida o expirada.' };
  var email = String(s.email || '').trim().toLowerCase();

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Mapa de búsquedas: ID -> { empresa, estado, puesto }.
  var hb = obtenerHoja(ss, HOJA_BUSQUEDAS, COLUMNAS_BUSQUEDAS);
  var vb = hb.getDataRange().getValues();
  var mapa = {};
  for (var i = 1; i < vb.length; i++) {
    mapa[String(vb[i][0]).trim()] = { empresa: vb[i][4], estado: vb[i][12], puesto: vb[i][5] };
  }

  var hp = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var vp = hp.getDataRange().getValues();
  var cEmail = COLUMNAS_POSTULANTES.indexOf('Email');
  var cFecha = COLUMNAS_POSTULANTES.indexOf('FechaRegistro');
  var cBid = COLUMNAS_POSTULANTES.indexOf('BusquedaID');
  var cBpuesto = COLUMNAS_POSTULANTES.indexOf('BusquedaPuesto');

  var lista = [];
  for (var j = 1; j < vp.length; j++) {
    if (String(vp[j][cEmail]).trim().toLowerCase() !== email) continue;
    var bid = String(vp[j][cBid] || '').trim();
    if (!bid) continue; // solo postulaciones vinculadas a una búsqueda
    var info = mapa[bid] || {};
    var f = vp[j][cFecha];
    lista.push({
      busquedaId: bid,
      puesto: vp[j][cBpuesto] || info.puesto || '',
      empresa: info.empresa || '',
      estado: info.estado || '',
      fecha: (f instanceof Date) ? f.toISOString() : f
    });
  }
  lista.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  return { ok: true, total: lista.length, postulaciones: lista };
}

