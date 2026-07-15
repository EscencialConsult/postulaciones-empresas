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
  'FirmaConformidadUrl', 'FechaFirmaConformidad'
];

var COLUMNAS_USUARIOS = [
  'Usuario', 'Password', 'Empresa', 'Token', 'TokenExpira',
  'Email', 'FechaRegistro', 'Rol', 'Estado', 'Cuit', 'Rubro',
  'Nombre', 'Apellido', 'Telefono',
  'Dni', 'EstadoVerificación', 'FechaVerificación', 'ConfianzaVerificación',
  'AceptoTerminos', 'FechaAceptoTerminos'
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

  Logger.log('Setup completo. Hojas listas: %s, %s', HOJA_POSTULANTES, HOJA_USUARIOS);
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
    d.firmaConformidadBase64 ? ahora : ''
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
function verificarIdentidadDNI(d) {
  var dni = limpiar(d.dni).replace(/[^0-9]/g, '');
  if (dni.length !== 8) {
    return { ok: false, error: 'El DNI debe tener 8 dígitos.' };
  }

  if (!d.selfieBase64) {
    return {
      ok: true,
      verificado: false,
      estado: 'pendiente',
      error: 'Falta la selfie para verificación automática.'
    };
  }

  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('DIDIT_API_KEY');
  var verifyUrl = props.getProperty('DIDIT_VERIFY_URL');
  var workflowId = props.getProperty('DIDIT_WORKFLOW_ID') || '';

  if (!apiKey || !verifyUrl) {
    return {
      ok: true,
      verificado: false,
      estado: 'pendiente',
      error: 'Proveedor de verificación no configurado.'
    };
  }

  try {
    var response = UrlFetchApp.fetch(verifyUrl, {
      method: 'post',
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify({
        documentType: 'DNI',
        documentNumber: dni,
        selfieBase64: String(d.selfieBase64),
        workflowId: workflowId
      })
    });

    var code = response.getResponseCode();
    var body = response.getContentText() || '{}';
    var result = JSON.parse(body);
    if (code < 200 || code >= 300) {
      return { ok: false, error: result.error || result.message || ('Error de verificación (' + code + ').') };
    }

    var status = String(result.status || result.decision || '').toLowerCase();
    var aprobado = ['approved', 'aprobado', 'verified', 'success'].indexOf(status) !== -1;
    return {
      ok: true,
      verificado: aprobado,
      estado: aprobado ? 'aprobado' : (status === 'rejected' || status === 'rechazado' ? 'rechazado' : 'pendiente'),
      confianza: result.confidence || result.score || '',
      nombreVerificado: result.fullName || (result.data ? result.data.fullName : '')
    };
  } catch (err) {
    return { ok: false, error: 'Error en verificación: ' + String(err && err.message ? err.message : err) };
  }
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
  if (password.length < 6) {
    return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  var verificacion = verificarIdentidadDNI({ dni: dni, selfieBase64: d.selfieBase64 });
  if (!verificacion.ok) return verificacion;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      return { ok: false, error: 'Ya existe una cuenta registrada con ese email.' };
    }
  }

  // La empresa queda PENDIENTE de aprobación por el administrador (sin token de acceso).
  // Orden: Usuario, Password, Empresa, Token, TokenExpira, Email, FechaRegistro, Rol, Estado, Cuit, Rubro, Nombre, Apellido, Telefono
  hoja.appendRow([
    usuario, password, empresa, '', '', email, new Date(), 'empresa', 'pendiente',
    cuit, rubro, nombre, apellido, telefono,
    dni,
    verificacion.estado || (verificacion.verificado ? 'aprobado' : 'pendiente'),
    new Date(),
    verificacion.confianza || '',
    'Si',
    new Date()
  ]);

  return {
    ok: true, pendiente: true,
    mensaje: 'Tu cuenta fue creada y quedó pendiente de aprobación. Te avisaremos cuando esté habilitada.'
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
    fechaAceptoTerminos: (fila[19] instanceof Date) ? fila[19].toISOString() : fila[19]
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

  var empresa  = limpiar(d.empresa);
  var cuit     = limpiar(d.cuit).replace(/[^0-9]/g, '');
  var rubro    = limpiar(d.rubro);
  var nombre   = limpiar(d.nombre);
  var apellido = limpiar(d.apellido);
  var telefono = limpiar(d.telefono);
  var passwordActual = String(d.passwordActual || '');
  var nuevaPassword = String(d.nuevaPassword || '');

  if (!empresa || !rubro || !nombre || !apellido || !telefono) {
    return { ok: false, error: 'CompletÃ¡ razÃ³n social, rubro y datos de contacto.' };
  }
  if (cuit.length !== 11) {
    return { ok: false, error: 'El CUIT/CUIL debe tener 11 dÃ­gitos.' };
  }
  if (nuevaPassword && nuevaPassword.length < 6) {
    return { ok: false, error: 'La nueva contraseÃ±a debe tener al menos 6 caracteres.' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = obtenerHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  var valores = hoja.getDataRange().getValues();
  var usuario = String(sesion.usuario || '').trim().toLowerCase();

  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]).trim().toLowerCase() === usuario) {
      if (nuevaPassword) {
        if (!passwordActual) return { ok: false, error: 'IngresÃ¡ tu contraseÃ±a actual para cambiarla.' };
        if (String(valores[i][1]) !== passwordActual) return { ok: false, error: 'La contraseÃ±a actual no es correcta.' };
        hoja.getRange(i + 1, 2).setValue(nuevaPassword);
      }
      hoja.getRange(i + 1, 3).setValue(empresa);
      hoja.getRange(i + 1, 10).setValue(cuit);
      hoja.getRange(i + 1, 11).setValue(rubro);
      hoja.getRange(i + 1, 12).setValue(nombre);
      hoja.getRange(i + 1, 13).setValue(apellido);
      hoja.getRange(i + 1, 14).setValue(telefono);

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
