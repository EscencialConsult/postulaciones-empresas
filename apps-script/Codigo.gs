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

// Carpeta de Google Drive donde se guardan los archivos de CV.
var CARPETA_CV = 'CVs Postulantes';
// Tamaño máximo del CV (en MB).
var CV_MAX_MB = 5;

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
  'FirmaLegalUrl', 'FechaFirmaLegal'
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
  'FirmaConsentimientoUrl', 'FirmaConformidadUrl'
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
      case 'actualizarBusqueda':    return json(actualizarBusqueda(datos));
      case 'cambiarEstadoBusqueda': return json(cambiarEstadoBusqueda(datos));
      case 'eliminarBusqueda':      return json(eliminarBusqueda(datos));
      case 'busquedasPublicas':     return json(busquedasPublicas(datos));
      // Cuenta del postulante (perfil reutilizable)
      case 'registrarPostulante':  return json(registrarPostulante(datos));
      case 'loginPostulante':      return json(loginPostulante(datos));
      case 'miPerfil':             return json(miPerfil(datos));
      case 'actualizarPerfil':     return json(actualizarPerfil(datos));
      case 'postularConPerfil':    return json(postularConPerfil(datos));
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

  Logger.log('Setup completo. Hojas listas: %s, %s, %s', HOJA_POSTULANTES, HOJA_USUARIOS, HOJA_BUSQUEDAS);
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

  hoja.appendRow(fila);
  return { ok: true, id: id, mensaje: '¡Postulación registrada correctamente!' };
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
      return { ok: true, empresa: empresaDesdeFila(valores[i]) };
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

function listarPostulantes(d) {
  var sesion = validarToken(d.token);
  if (!sesion) return { ok: false, error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_POSTULANTES, COLUMNAS_POSTULANTES);
  var valores = hoja.getDataRange().getValues();

  var registros = [];
  for (var i = 1; i < valores.length; i++) {
    registros.push(filaAObjeto(COLUMNAS_POSTULANTES, valores[i]));
  }

  // Búsqueda por texto libre.
  var q = limpiar(d.q).toLowerCase();
  if (q) {
    registros = registros.filter(function (r) {
      return JSON.stringify(r).toLowerCase().indexOf(q) !== -1;
    });
  }

  // Filtros específicos opcionales.
  if (d.puesto)    registros = filtrarCampo(registros, 'PuestoDeseado', d.puesto);
  if (d.provincia) registros = filtrarCampo(registros, 'Provincia', d.provincia);

  // Más recientes primero.
  registros.reverse();

  return { ok: true, total: registros.length, registros: registros };
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
      hoja.getRange(i + 1, 9).setValue(nuevo);   // columna Estado
      // Si se rechaza o se deja pendiente, invalida su sesión activa.
      if (nuevo !== 'aprobado') {
        hoja.getRange(i + 1, 4).setValue('');    // Token
        hoja.getRange(i + 1, 5).setValue('');    // TokenExpira
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
      hoja.getRange(i + 1, 16).setValue(nuevo);
      hoja.getRange(i + 1, 17).setValue(new Date());
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

  return { ok: true, id: id, mensaje: 'Búsqueda guardada correctamente.' };
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
    if (String(valores[i][3]).trim().toLowerCase() === usuario) {
      lista.push(filaAObjeto(COLUMNAS_BUSQUEDAS, valores[i]));
    }
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
      return { ok: true, mensaje: 'Búsqueda actualizada.', busqueda: filaAObjeto(COLUMNAS_BUSQUEDAS, actualizada) };
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
      return { ok: true, estado: nuevo };
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
      hoja.deleteRow(i + 1);
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
  return { ok: true, token: token, perfil: perfilDesdeFila(fila), mensaje: 'Cuenta creada correctamente.' };
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
      return { ok: true, token: token, perfil: perfilDesdeFila(fila) };
    }
  }
  return { ok: false, error: 'Email o contraseña incorrectos.' };
}

function miPerfil(d) {
  var s = validarTokenPerfil(d.token);
  if (!s) return { ok: false, error: 'Sesión inválida o expirada.' };
  return { ok: true, perfil: perfilDesdeFila(s.fila) };
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
  return { ok: true, mensaje: 'Perfil actualizado.', perfil: perfilDesdeFila(fila) };
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
  var id = Utilities.getUuid();
  var ahora = new Date();

  hoja.appendRow([
    id, ahora,
    p.nombre, p.apellido, p.email, p.telefono, (limpiar(d.puestoDeseado) || p.puestoDeseado),
    p.fechaNacimiento, p.identificacion, p.provincia, p.codigoPostalCiudad, p.perfilProfesional,
    p.formacion, p.descripcionPerfil, p.dispViajar, p.dispCambioResidencia, p.idiomas,
    p.primerEmpleo, p.experiencias, p.cvNombre, p.cvUrl,
    p.firmaConsentimientoUrl, (p.firmaConsentimientoUrl ? ahora : ''),
    p.firmaConformidadUrl, (p.firmaConformidadUrl ? ahora : ''),
    limpiar(d.busquedaId), limpiar(d.busquedaPuesto), normalizarJSON(d.respuestasBusqueda)
  ]);

  return { ok: true, id: id, mensaje: '¡Postulación enviada!' };
}

