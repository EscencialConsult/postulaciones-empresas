/**
 * ===================================================================
 *  LISTA DE PUESTOS + SELECTOR BUSCABLE
 * ===================================================================
 *
 *  PUESTOS: catálogo único de nombres de puesto. Sirve para que el
 *  postulante elija de una lista en vez de escribir a mano (evita
 *  variantes con/sin acento, mal escritas, etc.).
 *
 *  crearSelectorPuesto(opts): convierte un input en un buscador
 *  desplegable. Si el puesto no está en la lista, la opción
 *  "Otros (especificar)" habilita la carga manual.
 * ===================================================================
 */

var PUESTOS = [
  'Vendedor/a de Salón (Store Associate)',
  'Cajero/a de Sucursal',
  'Repositor/a de Góndola / Salón',
  'Asistente de Probadores y Salón',
  'Asistente de Empaque / Empacador/a',
  'Recepcionista de Tienda (Greet & Guide)',
  'Representante de Atención al Cliente Presencial',
  'Personal de Etiquetado e Inventario',
  'Cajero/a Principal / Tesorero/a de Tienda',
  'Visual Merchandiser de Tienda',
  'Supervisor/a de Turno Retail / Línea de Cajas',
  'Especialista en Experiencia de Cliente (CX Retail)',
  'Subgerente / Asistente de Encargado de Tienda (Assistant Store Manager)',
  'Encargado/a de Local / Store Manager',
  'Supervisor/a Zonal de Tiendas (Area Manager / District Manager)',
  'Operario/a de Limpieza y Maestranza',
  'Peón de Limpieza Industrial',
  'Auxiliar de Limpieza Hospitalaria y Bioseguridad',
  'Limpiador/a de Vidrios y Altura',
  'Operador/a de Maquinaria de Limpieza Industrial',
  'Auxiliar de Mantenimiento Edilicio General',
  'Jardinero / Mantenimiento de Espacios Verdes',
  'Peón de Mantenimiento de Piscina',
  'Cabo / Líder de Grupo de Maestranza',
  'Supervisor/a Zonal de Limpieza',
  'Especialista en Sanitización y Control de Plagas',
  'Técnico de Mantenimiento Edilicio (Polivalente)',
  'Encargado/a General de Maestranza',
  'Coordinador/a de Operaciones de Facility Services',
  'Gerente de Operaciones de Maestranza',
  'Ayudante de Cocina (Commis de Cocina)',
  'Bachero/a / Steward',
  'Mozo / Camarero/a de Salón',
  'Commis de Salón / Runner (Camarero/a Junior)',
  'Barback / Ayudante de Barra',
  'Empleado/a de Mostrador en Comida Rápida (Crew Member)',
  'Host / Hostess (Recepcionista de Restaurante)',
  'Cajero/a Gastronómico',
  'Cocinero/a de Partida (Chef de Partie)',
  'Maestro/a Pizzero/a / Empanadero/a',
  'Maestro/a Panadero/a / Pastelero/a',
  'Bartender / Cantinero/a Profesional',
  'Barista Profesional',
  'Capitán de Mozos / Jefe/a de Rango',
  'Supervisor/a de Turno Gastronómico (Shift Supervisor)',
  'Jefe/a de Cocina / Sous Chef',
  'Chef Ejecutivo/a',
  "Encargado/a de Salón (Maître d'Hôtel)",
  'Gerente de Local Gastronómico (Restaurant Manager)',
  'Gerente de Alimentos y Bebidas (F&B Manager)',
  'Operario de Depósito / Almacén',
  'Operario de Picking y Packing',
  'Operario de Producción / Línea de Montaje',
  'Operario de Mantenimiento General',
  'Operario de Montacargas (Clarkista)',
  'Asistente de Logística y Despacho',
  'Auxiliar de Recepción y Expedición',
  'Chofer de Reparto / Transportista Corporativo',
  'Cajero de Retail / Supermercado',
  'Repositor de Supermercado / Grandes Superficies',
  'Vendedor de Local Comercial (Store Associate)',
  'Asistente de Atención al Cliente (Presencial)',
  'Recepcionista Corporativo / Front Desk',
  'Auxiliar Administrativo',
  'Digitador de Datos (Data Entry)',
  'Operador de Call Center Inbound',
  'Operador de Call Center Outbound',
  'Asistente de Telemarketing',
  'Asistente de Cobranzas y Mora Temprana',
  'Auxiliar de Facturación y Caja',
  'Auxiliar Contable',
  'Asistente de Recursos Humanos',
  'Asistente de Reclutamiento (Sourcing Junior)',
  'Asistente de Compras / Proveeduría',
  'Auxiliar de Archivo y Digitalización',
  'Asistente de Marketing Junior',
  'Community Manager Junior',
  'Asistente de Soporte IT (Help Desk Nivel 1)',
  'Técnico Instalador de Redes y Telecomunicaciones',
  'Técnico Electromecánico Junior',
  'Electricista Industrial / Edilicio',
  'Mecánico de Flota Vehicular',
  'Técnico de Laboratorio de Control de Calidad',
  'Inspector de Calidad en Línea',
  'Ayudante de Cocina Institucional / Industrial',
  'Mozo / Camarero para Eventos Corporativos',
  'Barista / Encargado de Barra Gastronómica',
  'Operador de Monitoreo CCTV / Centro de Control',
  'Vigilador / Guardia de Seguridad Corporativa',
  'Recepcionista de Centro Médico / Clínica',
  'Auxiliar de Enfermería Institucional',
  'Técnico Farmacéutico de Mostrador',
  'Promotor de Punto de Venta (PDV)',
  'Asistente de Ventas y Preventa',
  'Merchandiser / Repositor Externo',
  'Encuestador de Mercado (Field Researcher)',
  'Asistente Legal / Paralegal Junior',
  'Auxiliar de Liquidación de Sueldos',
  'Asistente de Comercio Exterior Junior',
  'Operario de Pañol / Herramental',
  'Analista Administrativo',
  'Analista de Facturación y Cobranzas',
  'Analista Contable',
  'Analista de Tesorería',
  'Analista de Créditos y Riesgo Comercial',
  'Analista de Compras y Contrataciones',
  'Analista de Logística y Distribución',
  'Analista de Inventarios y Control de Stock',
  'Analista de Recursos Humanos (Generalista)',
  'Analista de Reclutamiento y Selección (Talent Acquisition)',
  'Analista de Capacitación y Desarrollo',
  'Analista de Liquidación de Sueldos (Payroll)',
  'Analista de Compensaciones y Beneficios',
  'Técnico en Seguridad e Higiene Laboral (EHS)',
  'Analista de Comunicación Interna',
  'Analista de Marketing Digital',
  'Analista de SEO / SEM',
  'Social Media Manager',
  'Redactor de Contenidos (Copywriter / Content Creator)',
  'Diseñador Gráfico Corporativo',
  'Diseñador Web / Maquetador',
  'Desarrollador de Software Junior (Frontend / Backend)',
  'Técnico en Soporte IT Nivel 2',
  'Analista de Redes y Comunicaciones',
  'Analista de Pruebas / QA Tester',
  'Analista Funcional Junior',
  'Analista de Datos / Data Analyst',
  'Analista de E-commerce',
  'Analista de Comercio Exterior y Aduanas',
  'Ejecutivo de Cuentas B2B (Account Executive)',
  'Representante de Desarrollo de Ventas (SDR / BDR)',
  'Ejecutivo de Ventas Corporativas / Terreno',
  'Asesor Comercial Inmobiliario / Proptech',
  'Asesor de Seguros y Servicios Financieros',
  'Visitador Médico / Agente de Propaganda Médica (APM)',
  'Analista de Planificación y Control de Producción (PCP)',
  'Técnico en Mantenimiento Industrial (Electromecánico)',
  'Técnico en Automatización y Control (PLC)',
  'Analista de Aseguramiento de la Calidad (QA Industrial)',
  'Analista de Medio Ambiente y Gestión de Residuos',
  'Analista de Procesos y Mejora Continua',
  'Analista Legal Corporativo',
  'Enfermero/a Profesional de Planta / Laboral',
  'Técnico Radiólogo / Bioquímico Clínico',
  'Ejecutivo de Atención al Cliente Especializado (Tier 2)',
  'Analista de Experiencia del Cliente (CX Analyst)',
  'Analista de Business Intelligence (BI Junior)',
  'Analista de Licitaciones y Presupuestos',
  'Analista de Asuntos Regulatorios',
  'Especialista en Soporte Técnico de Aplicaciones (ERP/CRM)',
  'Analista Contable Senior',
  'Analista de Planeamiento Financiero (FP&A Senior)',
  'Analista de Impuestos y Fiscalidad Senior',
  'Auditor Interno Senior',
  'Especialista en Costos y Presupuestos',
  'Consultor de Negocios y Estrategia',
  'HR Business Partner (HRBP)',
  'Especialista en Talent Acquisition Senior',
  'Especialista en Desarrollo Organizacional',
  'Coordinador de Administración de Personal y Payroll',
  'Especialista en Relaciones Laborales y Sindicales',
  'Desarrollador de Software Senior (Fullstack / Backend / Frontend)',
  'Desarrollador Mobile Senior (iOS / Android / Flutter / React Native)',
  'Ingeniero DevOps / Site Reliability Engineer (SRE)',
  'Ingeniero de Datos (Data Engineer)',
  'Científico de Datos (Data Scientist)',
  'Analista de Inteligencia de Negocios Senior (BI Lead)',
  'Diseñador UX/UI Senior',
  'Especialista en Ciberseguridad / Seguridad de la Información',
  'Arquitecto de Cloud / Infraestructura',
  'Ingeniero en Inteligencia Artificial / Machine Learning Engineer',
  'Consultor Funcional ERP Senior (SAP / Salesforce / Oracle)',
  'Ingeniero de Calidad de Software (QA Automation Engineer)',
  'Scrum Master / Agile Coach',
  'Product Owner',
  'Especialista en E-commerce y Growth Marketing',
  'Especialista en Performance Marketing (Paid Media Senior)',
  'Product Marketing Manager',
  'Especialista en Trade Marketing',
  'Key Account Manager (KAM Junior / Semi-Senior)',
  'Especialista en Preventa Técnica (Pre-Sales Engineer)',
  'Especialista en Customer Success (CSM Senior)',
  'Coordinador de Compras y Abastecimiento',
  'Coordinador de Logística y Flota',
  'Coordinador de Almacén y Centro de Distribución',
  'Ingeniero de Planificación de la Producción (PCP Senior)',
  'Ingeniero de Calidad y Mejora Continua (Lean / Six Sigma)',
  'Ingeniero de Procesos Industriales',
  'Coordinador de Mantenimiento Industrial',
  'Ingeniero de Proyectos y Obras Civiles',
  'Especialista en Seguridad, Higiene y Medio Ambiente Senior (EHS Lead)',
  'Abogado Senior Societario / Laboral / Tributario',
  'Médico Laboral / Médico de Planta Senior',
  'Farmacéutico Director Técnico',
  'Coordinador de Asuntos Regulatorios y Compliance',
  'BIM Manager (Building Information Modeling)',
  'Especialista en Comercio Exterior y Negociaciones Internacionales',
  'Coordinador de Marketing y Comunicaciones',
  'Coordinador de Experiencia de Cliente (CX Lead)',
  'Especialista en Transformación Digital y Gestión del Cambio',
  'Jefe de Ventas / Comercial',
  'Jefe de Marketing',
  'Jefe de Producto (Product Manager Senior)',
  'Jefe de Recursos Humanos',
  'Jefe de Reclutamiento y Selección (Talent Acquisition Manager)',
  'Jefe de Administración y Finanzas',
  'Jefe de Tesorería',
  'Jefe de Contabilidad / Contador General',
  'Jefe de Cobranzas y Créditos',
  'Jefe de Compras y Contrataciones',
  'Jefe de Logística y Distribución',
  'Jefe de Planta / Producción',
  'Jefe de Mantenimiento Industrial',
  'Jefe de Aseguramiento de Calidad y Control (QA/QC Manager)',
  'Jefe de Sistemas e Infraestructura (IT Manager)',
  'Jefe de Proyectos (PMO Lead)',
  'Jefe de Seguridad, Higiene y Medio Ambiente (EHS Manager)',
  'Jefe de Legales y Contratos',
  'Jefe de Atención al Cliente y Customer Service',
  'Jefe de E-commerce y Canales Digitales',
  'Gerente de Ventas / Gerente Comercial',
  'Gerente de Cuentas Clave (Key Account Manager Senior - KAM Lead)',
  'Gerente de Marketing (Marketing Manager)',
  'Gerente de Producto / Chief Product Officer (CPO)',
  'Gerente de Recursos Humanos (HR Manager)',
  'Gerente de Desarrollo del Talento y Cultura',
  'Gerente de Relaciones Laborales y Sindicales',
  'Gerente de Administración y Finanzas (Finance Manager)',
  'Gerente de Planeamiento Financiero y Control de Gestión (FP&A Manager)',
  'Gerente de Supply Chain',
  'Gerente de Operaciones Logísticas y Transporte',
  'Gerente de Operaciones (COO - Chief Operating Officer)',
  'Gerente de Planta Industrial / Director Industrial',
  'Gerente de Excelencia Operacional y Mejora Continua',
  'Gerente de Tecnología (IT Director / CTO)',
  'Gerente de Desarrollo de Software (Engineering Manager)',
  'Gerente de Datos y Analítica (Head of Data / CDO)',
  'Gerente de Seguridad de la Información (CISO - Chief Information Security Officer)',
  'Gerente de Auditoría Interna y Compliance',
  'Gerente de Innovación y Transformación Digital',
  'Gerente de Experiencia de Cliente (Head of Customer Experience)',
  'Gerente de Relaciones Institucionales y Asuntos Públicos',
  'Gerente de Asuntos Legales (General Counsel)',
  'Gerente de Sustentabilidad y ESG (Environmental, Social and Governance)',
  'Director Comercial (CRO - Chief Revenue Officer)',
  'Director Financiero (CFO - Chief Financial Officer)',
  'Director de Tecnología (CTO - Chief Technology Officer)',
  'Director de Recursos Humanos (CHRO - Chief Human Resources Officer)',
  'Director de Operaciones (COO - Chief Operating Officer)',
  'Director General / CEO (Chief Executive Officer) / Country Manager'
];

// Ciudades y localidades de Tucumán (solo se puede seleccionar de la lista).
var LOCALIDADES_TUCUMAN = [
  '7 de Abril', 'Aguilares', 'Alpachiri', 'Alto Verde', 'Amaicha del Valle',
  'Arcadia', 'Atahona', 'Banda del Río Salí', 'Bella Vista', 'Benjamín Aráoz',
  'Burruyacú', 'Capitán Cáceres', 'Cevil Redondo', 'Choromoro', 'Colalao del Valle',
  'Colombres', 'Concepción', 'Delfín Gallo', 'El Bracho', 'El Cadillal',
  'El Chañar', 'El Cevilar', 'El Mollar', 'El Mojón', 'El Naranjito',
  'El Naranjo', 'El Puestito', 'El Timbó', 'Escaba', 'Famaillá',
  'Gastona', 'Gobernador Garmendia', 'Gobernador Piedrabuena', 'Graneros', 'Juan Bautista Alberdi',
  'La Cocha', 'La Esperanza', 'La Florida', 'La Ramada', 'La Trinidad',
  'Las Cejas', 'Las Talas', 'Las Talitas', 'Leales', 'Los Bulacio',
  'Los Nogales', 'Los Pérez', 'Los Pereyra', 'Los Ralos', 'Lules',
  'Luisiana', 'Manuel García Fernández', 'Manuela Pedraza', 'Marcos Paz', 'Medinas',
  'Monteros', 'Monteagudo', 'Raco', 'Río Colorado', 'Río Seco',
  'San Andrés', 'San Javier', 'San Miguel de Tucumán', 'San Pablo', 'San Pedro de Colalao',
  'Santa Ana', 'Santa Lucía', 'Simoca', 'Tafí del Valle', 'Tafí Viejo',
  'Tapia', 'Trancas', 'Villa Belgrano', 'Villa Chicligasta', 'Villa de Leales',
  'Villa Mariano Moreno', 'Villa Quinteros', 'Yerba Buena'
];

// Idiomas más habituales. "Otros (especificar)" permite cargar uno manual.
var IDIOMAS = ['Inglés', 'Francés', 'Portugués', 'Italiano', 'Ninguno'];

/**
 * Convierte un input de texto en un buscador desplegable filtrable.
 * El usuario escribe para filtrar y elige una opción de la lista; el
 * valor guardado es siempre EXACTO (normalizado). Si conOtros es true,
 * al final aparece "Otros (especificar)" que habilita la carga manual.
 *
 * @param {Object} opts
 * @param {string[]} opts.opciones   - lista de valores seleccionables
 * @param {string} opts.inputId      - id del input visible (buscador)
 * @param {string} opts.listaId      - id del contenedor del desplegable
 * @param {string} opts.hiddenId     - id del input hidden que viaja en el form
 * @param {boolean} [opts.conOtros]  - agrega la opción "Otros (especificar)"
 * @param {string} [opts.otroWrapId] - id del contenedor del campo manual
 * @param {string} [opts.otroInputId]- id del input manual ("Otros")
 */
function crearSelectorBuscable(opts) {
  var input = document.getElementById(opts.inputId);
  var lista = document.getElementById(opts.listaId);
  var hidden = document.getElementById(opts.hiddenId);
  var otroWrap = opts.otroWrapId ? document.getElementById(opts.otroWrapId) : null;
  var otroInput = opts.otroInputId ? document.getElementById(opts.otroInputId) : null;
  if (!input || !lista || !hidden) return;

  var opciones = opts.opciones || [];
  var conOtros = !!opts.conOtros && !!otroInput;
  var OTROS = 'Otros (especificar)';
  var seleccion = ''; // texto mostrado válido (opción elegida u "Otros…")

  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function render(filtro) {
    var f = (filtro || '').trim().toLowerCase();
    var html = '';
    for (var i = 0; i < opciones.length; i++) {
      if (!f || opciones[i].toLowerCase().indexOf(f) !== -1) {
        html += '<div class="puesto-opcion" data-v="' + escAttr(opciones[i]) + '">' + escAttr(opciones[i]) + '</div>';
      }
    }
    if (conOtros) {
      html += '<div class="puesto-opcion puesto-otros" data-v="__otros__">➕ ' + OTROS + '</div>';
    }
    lista.innerHTML = html;
  }

  function abrir(filtro) { render(filtro); lista.classList.remove('oculto'); }
  function cerrar() { lista.classList.add('oculto'); }

  function elegir(valor) {
    if (valor === '__otros__') {
      seleccion = OTROS;
      input.value = OTROS;
      if (otroWrap) otroWrap.classList.remove('oculto');
      hidden.value = otroInput ? otroInput.value.trim() : '';
      cerrar();
      if (otroInput) otroInput.focus();
    } else {
      seleccion = valor;
      input.value = valor;
      hidden.value = valor;
      if (otroWrap) otroWrap.classList.add('oculto');
      if (otroInput) otroInput.value = '';
      cerrar();
    }
  }

  // Fija (o limpia con '') el valor del selector de forma programática.
  // Útil para precargar desde la URL o al editar una búsqueda existente.
  function aplicarValor(valor) {
    var vi = String(valor == null ? '' : valor).trim();
    if (!vi) {
      seleccion = '';
      input.value = '';
      hidden.value = '';
      if (otroWrap) otroWrap.classList.add('oculto');
      if (otroInput) otroInput.value = '';
      cerrar();
      return;
    }
    if (opciones.indexOf(vi) !== -1) {
      seleccion = vi; input.value = vi; hidden.value = vi;
      if (otroWrap) otroWrap.classList.add('oculto');
      if (otroInput) otroInput.value = '';
    } else if (conOtros) {
      seleccion = OTROS; input.value = OTROS;
      if (otroWrap) otroWrap.classList.remove('oculto');
      if (otroInput) otroInput.value = vi;
      hidden.value = vi;
    } else {
      seleccion = vi; input.value = vi; hidden.value = vi;
    }
    cerrar();
  }

  if (opts.valorInicial) aplicarValor(opts.valorInicial);

  input.addEventListener('focus', function () { abrir(''); });
  input.addEventListener('input', function () { abrir(input.value); });
  input.addEventListener('blur', function () {
    // Se retrasa para permitir el mousedown de una opción antes de cerrar.
    setTimeout(function () {
      cerrar();
      input.value = seleccion; // descarta texto libre no seleccionado (evita typos)
    }, 150);
  });

  // mousedown (no click) para no perder el foco antes de procesar la elección.
  lista.addEventListener('mousedown', function (e) {
    var op = e.target.closest ? e.target.closest('.puesto-opcion') : null;
    if (!op) return;
    e.preventDefault();
    elegir(op.getAttribute('data-v'));
  });

  if (otroInput) {
    otroInput.addEventListener('input', function () {
      if (seleccion === OTROS) hidden.value = otroInput.value.trim();
    });
  }

  // API para manejar el selector desde afuera (precargar / editar / limpiar).
  return {
    set: aplicarValor,
    reset: function () { aplicarValor(''); },
    get: function () { return hidden.value; }
  };
}

/** Selector de puestos: buscador con opción "Otros" para carga manual. */
function crearSelectorPuesto(opts) {
  return crearSelectorBuscable({
    opciones: PUESTOS,
    inputId: opts.inputId,
    listaId: opts.listaId,
    hiddenId: opts.hiddenId,
    conOtros: true,
    otroWrapId: opts.otroWrapId,
    otroInputId: opts.otroInputId,
    valorInicial: opts.valorInicial
  });
}
