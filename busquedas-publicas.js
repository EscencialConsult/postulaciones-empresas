(function () {
  var seccion = document.getElementById('busquedasInicio');
  var estado = document.getElementById('busqInicioEstado');
  var grid = document.getElementById('busqInicioGrid');
  var overlay = document.getElementById('bdOverlay');
  var modal = document.getElementById('bdModal');
  var resumen = document.getElementById('busqResumen');
  var filtros = {
    texto: document.getElementById('filtroTexto'),
    ubicacion: document.getElementById('filtroUbicacion'),
    modalidad: document.getElementById('filtroModalidad'),
    area: document.getElementById('filtroArea'),
    contrato: document.getElementById('filtroContrato'),
    idioma: document.getElementById('filtroIdioma'),
    salario: document.getElementById('filtroSalario'),
    orden: document.getElementById('filtroOrden')
  };
  var btnLimpiar = document.getElementById('busqLimpiar');
  var lista = [];
  var listaFiltrada = [];

  if (!seccion || !estado || !grid || !overlay || !modal) return;

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function norm(s) {
    return (s == null ? '' : String(s))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function numero(v) {
    var n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function fechaMs(v) {
    if (!v) return 0;
    if (v instanceof Date) return v.getTime();
    var d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.getTime();
    return numero(v);
  }

  function valor(el) {
    return el ? el.value.trim() : '';
  }

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }

  var ICON_PIN = svg('<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>');
  var ICON_RELOJ = svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
  var ICON_LINK = svg('<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>');

  function textoBusqueda(b) {
    return norm([
      b.Puesto, b.Empresa, b.Area, b.Modalidad, b.TipoContrato, b.Provincia,
      b.Localidad, b.Descripcion, b.Responsabilidades, b.RequisitosExcluyentes,
      b.RequisitosDeseables, b.Habilidades, b.IdiomaRequerido
    ].filter(Boolean).join(' '));
  }

  function setOpciones(select, valores, textoVacio) {
    if (!select) return;
    var actual = select.value;
    var unicos = Array.from(new Set(valores.filter(Boolean).map(function (x) { return String(x).trim(); })))
      .sort(function (a, b) { return a.localeCompare(b, 'es'); });
    select.innerHTML = '<option value="">' + textoVacio + '</option>' +
      unicos.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
    if (unicos.indexOf(actual) >= 0) select.value = actual;
  }

  function prepararFiltros() {
    setOpciones(filtros.modalidad, lista.map(function (b) { return b.Modalidad; }), 'Todas');
    setOpciones(filtros.area, lista.map(function (b) { return b.Area; }), 'Todas');
    setOpciones(filtros.contrato, lista.map(function (b) { return b.TipoContrato; }), 'Todos');
    setOpciones(filtros.idioma, lista.map(function (b) { return b.IdiomaRequerido; }), 'Todos');

    Object.keys(filtros).forEach(function (k) {
      if (filtros[k]) filtros[k].addEventListener('input', aplicarFiltros);
    });
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFiltros);
  }

  function limpiarFiltros() {
    Object.keys(filtros).forEach(function (k) {
      if (filtros[k]) filtros[k].value = k === 'orden' ? 'recientes' : '';
    });
    aplicarFiltros();
  }

  function coincideSelect(valorFiltro, valorBusqueda) {
    return !valorFiltro || norm(valorFiltro) === norm(valorBusqueda);
  }

  function aplicarFiltros() {
    var texto = norm(valor(filtros.texto));
    var ubicacion = norm(valor(filtros.ubicacion));
    var modalidad = valor(filtros.modalidad);
    var area = valor(filtros.area);
    var contrato = valor(filtros.contrato);
    var idioma = valor(filtros.idioma);
    var salarioMin = numero(valor(filtros.salario));
    var orden = valor(filtros.orden) || 'recientes';

    listaFiltrada = lista.filter(function (b) {
      var ubic = norm([b.Provincia, b.Localidad].filter(Boolean).join(' '));
      var maxSalario = Math.max(numero(b.SalarioMax), numero(b.SalarioMin));
      return (!texto || textoBusqueda(b).indexOf(texto) >= 0) &&
        (!ubicacion || ubic.indexOf(ubicacion) >= 0) &&
        coincideSelect(modalidad, b.Modalidad) &&
        coincideSelect(area, b.Area) &&
        coincideSelect(contrato, b.TipoContrato) &&
        coincideSelect(idioma, b.IdiomaRequerido) &&
        (!salarioMin || maxSalario >= salarioMin);
    });

    listaFiltrada.sort(function (a, b) {
      if (orden === 'puesto') return String(a.Puesto || '').localeCompare(String(b.Puesto || ''), 'es');
      if (orden === 'empresa') return String(a.Empresa || '').localeCompare(String(b.Empresa || ''), 'es');
      if (orden === 'salario') return Math.max(numero(b.SalarioMax), numero(b.SalarioMin)) - Math.max(numero(a.SalarioMax), numero(a.SalarioMin));
      return fechaMs(b.FechaActualizacion || b.FechaCreacion || b.Fecha) - fechaMs(a.FechaActualizacion || a.FechaCreacion || a.Fecha);
    });

    renderizarLista();
  }

  async function cargarBusquedasPublicas() {
    estado.textContent = 'Cargando búsquedas...';
    estado.style.display = 'block';
    grid.innerHTML = '';
    if (resumen) resumen.textContent = 'Cargando búsquedas...';

    try {
      var r = await apiCall({ action: 'busquedasPublicas' });
      lista = (r && r.ok && Array.isArray(r.busquedas)) ? r.busquedas : [];
      if (!lista.length) {
        estado.textContent = 'Todavía no hay búsquedas activas publicadas.';
        if (resumen) resumen.textContent = '0 búsquedas disponibles';
        return;
      }

      prepararFiltros();
      aplicarFiltros();

      var idURL = new URLSearchParams(location.search).get('busqueda');
      if (idURL) {
        var bURL = lista.find(function (x) { return String(x.ID) === String(idURL); });
        if (bURL) abrirDetalleBusqueda(bURL, false);
      }
    } catch (e) {
      estado.textContent = 'No pudimos cargar las búsquedas. Probá de nuevo en unos segundos.';
      estado.style.display = 'block';
      if (resumen) resumen.textContent = 'No se pudieron cargar las búsquedas';
    }
  }

  function renderizarLista() {
    if (resumen) {
      resumen.textContent = listaFiltrada.length === 1
        ? '1 búsqueda encontrada'
        : listaFiltrada.length + ' búsquedas encontradas';
    }

    if (!listaFiltrada.length) {
      estado.textContent = 'No encontramos búsquedas con esos filtros.';
      estado.style.display = 'block';
      grid.innerHTML = '';
      return;
    }

    estado.style.display = 'none';
    grid.innerHTML = listaFiltrada.map(function (b, i) {
      var ubic = [esc(b.Localidad || b.Provincia), b.Modalidad ? '(' + esc(b.Modalidad) + ')' : ''].filter(Boolean).join(' ');
      return '<div class="card busq-card2" data-i="' + i + '" role="button" tabindex="0">' +
        '<div class="busq-card2-top"></div>' +
        '<div class="busq-card2-body">' +
          (b.Area ? '<span class="busq-badge2">' + esc(b.Area) + '</span>' : '') +
          '<h3>' + esc(b.Puesto) + '</h3>' +
          '<p class="busq-card2-empresa">' + (esc(b.Empresa) || 'Empresa') + '</p>' +
          '<div class="busq-card2-meta">' +
            (ubic ? '<span>' + ICON_PIN + ' ' + ubic + '</span>' : '') +
            (b.TipoContrato ? '<span>' + ICON_RELOJ + ' ' + esc(b.TipoContrato) + '</span>' : '') +
          '</div>' +
          '<p class="busq-card2-desc">' + esc(b.Descripcion || b.Responsabilidades || '') + '</p>' +
          '<span class="btn btn-prim busq-card2-cta">Ver detalle y postularme</span>' +
        '</div>' +
      '</div>';
    }).join('');

    grid.querySelectorAll('.busq-card2').forEach(function (el) {
      var b = listaFiltrada[Number(el.dataset.i)];
      el.addEventListener('click', function () { abrirDetalleBusqueda(b); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          abrirDetalleBusqueda(b);
        }
      });
    });
  }

  function abrirDetalleBusqueda(b, pushUrl) {
    var href = 'postular.html?busqueda=' + encodeURIComponent(b.ID || '') +
      '&puesto=' + encodeURIComponent(b.Puesto || '');
    var linkBusqueda = location.origin + location.pathname + '?busqueda=' + encodeURIComponent(b.ID || '');

    if (pushUrl !== false) {
      try { history.pushState({ busqueda: b.ID }, '', '?busqueda=' + encodeURIComponent(b.ID || '')); } catch (e) {}
    }

    var chips = [b.Modalidad, b.TipoContrato, b.Localidad || b.Provincia].filter(Boolean)
      .map(function (x) { return '<span class="bd-chip">' + esc(x) + '</span>'; }).join('');
    var salario = (b.SalarioMin || b.SalarioMax)
      ? ('$' + esc(b.SalarioMin || '') + (b.SalarioMax ? ' - $' + esc(b.SalarioMax) : '')).replace('$ - ', '') : '';
    var idioma = (b.IdiomaRequerido && b.IdiomaRequerido !== 'Sin requisito de idioma')
      ? (esc(b.IdiomaRequerido) + (b.NivelIdioma ? ' - ' + esc(b.NivelIdioma) : '')) : '';
    var habil = String(b.Habilidades || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var benef = String(b.Beneficios || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var tags = function (arr) {
      return '<div class="bd-tags">' + arr.map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</div>';
    };
    var sec = function (t, c) {
      return c ? '<div class="bd-sec"><h4>' + t + '</h4><p>' + c + '</p></div>' : '';
    };

    modal.innerHTML = '<button class="bd-close" aria-label="Cerrar">×</button>' +
      '<div class="bd-cover"></div>' +
      '<div class="bd-body">' +
        (b.Area ? '<span class="busq-badge2">' + esc(b.Area) + '</span>' : '') +
        '<h2>' + esc(b.Puesto) + '</h2>' +
        '<p class="bd-empresa">' + (esc(b.Empresa) || 'Empresa') + '</p>' +
        (chips ? '<div class="bd-chips">' + chips + '</div>' : '') +
        sec('Descripción', esc(b.Descripcion)) +
        sec('Responsabilidades', esc(b.Responsabilidades)) +
        sec('Requisitos excluyentes', esc(b.RequisitosExcluyentes)) +
        sec('Requisitos deseables', esc(b.RequisitosDeseables)) +
        (habil.length ? '<div class="bd-sec"><h4>Habilidades clave</h4>' + tags(habil) + '</div>' : '') +
        sec('Idioma requerido', idioma) +
        sec('Salario', salario) +
        sec('Horario y jornada', esc(b.Horario)) +
        (benef.length ? '<div class="bd-sec"><h4>Beneficios</h4>' + tags(benef) + '</div>' : '') +
        '<div class="bd-acciones">' +
          '<a class="btn btn-prim bd-cta" href="' + href + '">Postularme ahora</a>' +
          '<button type="button" class="btn btn-sec bd-copiar">' + ICON_LINK + ' Copiar link</button>' +
          '<span class="bd-copiado" style="display:none">Link copiado</span>' +
        '</div>' +
      '</div>';

    modal.querySelector('.bd-close').onclick = cerrarDetalleBusqueda;
    var btnCopiar = modal.querySelector('.bd-copiar');
    if (btnCopiar) btnCopiar.onclick = async function () {
      try {
        await navigator.clipboard.writeText(linkBusqueda);
      } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = linkBusqueda;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(ta);
      }
      var ok = modal.querySelector('.bd-copiado');
      if (ok) {
        ok.style.display = 'inline';
        setTimeout(function () { ok.style.display = 'none'; }, 2500);
      }
    };

    overlay.classList.remove('oculto');
  }

  function cerrarDetalleBusqueda() {
    overlay.classList.add('oculto');
    if (location.search) {
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
    }
  }

  overlay.addEventListener('click', function (e) {
    if (e.target.id === 'bdOverlay') cerrarDetalleBusqueda();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') cerrarDetalleBusqueda();
  });
  window.addEventListener('popstate', function () {
    var id = new URLSearchParams(location.search).get('busqueda');
    var b = id ? lista.find(function (x) { return String(x.ID) === String(id); }) : null;
    if (b) abrirDetalleBusqueda(b, false);
    else overlay.classList.add('oculto');
  });

  cargarBusquedasPublicas();
})();
