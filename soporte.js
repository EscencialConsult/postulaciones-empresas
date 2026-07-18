(function () {
  var whatsappOculto = false;
  var MENSAJES_AYUDA = [
    '¿Necesitás ayuda?',
    '¿Tenés dudas?',
    'Te ayudamos',
    '¿Consultas?',
    'Soporte por WhatsApp'
  ];
  var INTERVALO_MS = 10000;
  var TRANSICION_MS = 2000;

  function elegirMensaje(actual) {
    if (MENSAJES_AYUDA.length < 2) return MENSAJES_AYUDA[0] || '';
    var siguiente = actual;
    while (siguiente === actual) {
      siguiente = MENSAJES_AYUDA[Math.floor(Math.random() * MENSAJES_AYUDA.length)];
    }
    return siguiente;
  }

  function iniciarMensajesWhatsApp() {
    document.querySelectorAll('.whatsapp-float').forEach(function (wrap) {
      if (whatsappOculto) {
        wrap.classList.add('is-hidden');
        return;
      }
      if (!wrap.querySelector('.whatsapp-float__close')) {
        var cerrar = document.createElement('button');
        cerrar.type = 'button';
        cerrar.className = 'whatsapp-float__close';
        cerrar.setAttribute('aria-label', 'Ocultar ayuda de WhatsApp');
        cerrar.textContent = '×';
        cerrar.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          whatsappOculto = true;
          wrap.classList.add('is-hidden');
        });
        wrap.appendChild(cerrar);
      }
    });

    if (whatsappOculto) return;

    document.querySelectorAll('.whatsapp-float__bubble').forEach(function (burbuja) {
      var mensaje = elegirMensaje('');
      burbuja.textContent = mensaje;
      setInterval(function () {
        mensaje = elegirMensaje(mensaje);
        burbuja.classList.add('is-changing');
        setTimeout(function () {
          burbuja.textContent = mensaje;
          burbuja.classList.remove('is-changing');
        }, TRANSICION_MS);
      }, INTERVALO_MS);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarMensajesWhatsApp);
  } else {
    iniciarMensajesWhatsApp();
  }
})();
