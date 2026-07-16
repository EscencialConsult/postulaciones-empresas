/**
 * CONFIGURACIÓN DEL FRONTEND
 * --------------------------------------------------------------
 * Pega aquí la URL de tu Aplicación Web de Google Apps Script.
 * La obtienes en: Apps Script > Implementar > Nueva implementación
 *                 > Aplicación web  (termina en /exec)
 *
 * Ejemplo:
 *   const API_URL = 'https://script.google.com/macros/s/AKfy.../exec';
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbzpd27vDYRIh_coJ82Wde5gek1kX4iTUz5hgEoFRocojiv6KtZGssS7zfeh9_DDEByECw/exec';

/**
 * Envía una acción al backend de Apps Script.
 * Usa text/plain para evitar el "preflight" CORS (petición simple).
 */
async function apiCall(payload) {
  if (!API_URL || API_URL.indexOf('PEGA_AQUI') !== -1) {
    throw new Error('Falta configurar API_URL en config.js');
  }
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
  } catch (err) {
    throw new Error('No se pudo conectar con Apps Script. Revisá que la implementación web permita acceso a "Cualquier usuario" y que API_URL termine en /exec.');
  }
  if (!res.ok) throw new Error('Error de red (' + res.status + ')');
  return res.json();
}
