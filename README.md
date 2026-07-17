# Plataforma de Postulantes

Plataforma para que **postulantes carguen su CV** y **empresas/consultoras busquen, vean y exporten perfiles**.

- **Frontend:** archivos HTML estáticos (se suben a cualquier hosting).
- **Backend:** Google Apps Script (Web App), sin servidor propio.
- **Almacenamiento:** Google Sheets.
- **Acceso empresas:** login por usuario con token de sesión.

```
Postulantes/
├── index.html            → Página de inicio (elige postulante o empresa)
├── postular.html         → Formulario del postulante (6 pasos)
├── empresas.html         → Panel de empresas (login + búsqueda + exportar)
├── config.js             → Config: aquí pegás la URL del backend
├── README.md             → Este archivo
└── apps-script/
    └── Codigo.gs         → Backend para Google Apps Script
```

---

## Instalación paso a paso

### 1) Crear la Hoja de Cálculo (Google Sheet)
1. Andá a [sheets.new](https://sheets.new) y creá una hoja nueva.
2. Ponele un nombre, por ejemplo **"Base Postulantes"**.

### 2) Pegar el backend (Apps Script)
1. En la hoja: menú **Extensiones → Apps Script**.
2. Borrá todo el contenido del archivo que aparece.
3. Copiá y pegá **todo** el contenido de `apps-script/Codigo.gs`.
4. Guardá (💾 o `Ctrl+S`).

### 3) Ejecutar `setup()` una vez
1. Arriba, en el selector de funciones, elegí **`setup`**.
2. Clic en **Ejecutar** ▶.
3. Google te pedirá autorizar permisos → **Revisar permisos → tu cuenta → Permitir**.
   - Si aparece "Google no verificó la app": **Configuración avanzada → Ir a (nombre del proyecto)**.
4. Al terminar, en la hoja verás dos pestañas nuevas: **`Postulantes`** y **`Usuarios`**.

Se crea un usuario de ejemplo en la pestaña `Usuarios`:

| Usuario  | Password    | Empresa            |
|----------|-------------|--------------------|
| empresa1 | cambiar123  | Empresa Demo S.A.  |

> **Cambiá la contraseña** y agregá más empresas simplemente añadiendo filas
> (Usuario / Password / Empresa). Las columnas Token y TokenExpira se llenan solas.

### 3.1) Verificación manual de empresas
El registro de empresas solicita una selfie del representante y la firma legal.
La selfie y la firma se guardan en Drive y la empresa queda pendiente para revisión
desde `admin.html`. Administración puede revisar manualmente la evidencia cargada y
aprobar o rechazar la cuenta.
Antes de enviarla al backend, el navegador redimensiona y comprime la selfie hasta
900 px para reducir el espacio ocupado en Drive.
La selfie se valida en el navegador con MediaPipe: se detecta un rostro centrado y
se pide una señal simple de vida, como parpadear o mover apenas la cabeza. No requiere
backend propio ni servicios pagos.

### 4) Publicar como Aplicación Web
1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. Engranaje ⚙ → tipo **Aplicación web**.
3. Configurá:
   - **Descripción:** libre (ej. "API Postulantes").
   - **Ejecutar como:** *Yo* (tu cuenta).
   - **Quién tiene acceso:** **Cualquier usuario**.
4. **Implementar** → copiá la **URL de la aplicación web** (termina en `/exec`).

### 5) Conectar el frontend
1. Abrí `config.js`.
2. Reemplazá el valor de `API_URL` por la URL que copiaste:
   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfy..../exec';
   ```
3. Guardá.

### 6) Publicar el frontend
Subí los archivos `index.html`, `postular.html`, `empresas.html` y `config.js`
a cualquier hosting estático gratuito:
- **Netlify** (arrastrar la carpeta a app.netlify.com/drop)
- **GitHub Pages**
- **Vercel**
- O incluso abrirlos localmente con doble clic (funciona igual).

---

## Uso

- **Postulantes:** entran a `postular.html`, completan los 6 pasos y envían. Cada
  postulación se agrega como una fila en la pestaña `Postulantes`.
  Los pasos son: datos personales, información y ubicación, formación,
  disponibilidad e idiomas, experiencia laboral, y firmas/consentimiento.
- **Empresas:** entran a `empresas.html`, inician sesión y trabajan en un panel con
  **menú lateral** y tres módulos:
  - **Inicio (dashboard):** resumen con métricas (postulantes en la base, búsquedas
    activas, postulaciones recibidas), estado de la cuenta y actividad reciente.
  - **Postulantes (base integral):** base **compartida** con todos los perfiles.
    Buscan/filtran, ven el detalle completo y exportan a CSV.
  - **Búsquedas:** crean avisos de empleo (puesto, localidad, modalidad, jornada,
    vacantes y descripción). Las búsquedas **activas** se publican automáticamente
    en la página de inicio con un botón **Postularme** que abre el formulario con
    el puesto precargado. La empresa puede pausar, reactivar, cerrar o eliminar
    cada búsqueda, y ver **los postulantes que aplicaron a cada búsqueda**. Solo las
    cuentas **aprobadas y con verificación aprobada** pueden publicar.

> **Al agregar el módulo de Búsquedas** se creó una nueva pestaña `Busquedas` en la
> hoja de cálculo (se genera sola en la primera llamada del backend, o ejecutando
> `setup()`). Como cambió `Codigo.gs`, hay que **volver a implementar** el Apps Script
> (ver «Importante sobre cambios» más abajo) para que las nuevas acciones funcionen.

---

## Roadmap: notificaciones de vacantes

### Emails automáticos

El backend envía emails con `MailApp` en estos eventos:

- Registro de empresa recibido: se avisa a la empresa que la cuenta quedó pendiente.
- Postulación exitosa: se confirma al postulante que su registro fue guardado.
- Cuenta de empresa aprobada: se avisa cuando administración cambia la cuenta a `aprobado`.
- Cuenta de empresa rechazada: se avisa cuando administración cambia la cuenta a `rechazado`.
- Verificación rechazada: se avisa cuando administración cambia la verificación a `rechazado`.
- Match vacante/postulante: se avisa a postulantes compatibles cuando una búsqueda queda `activa`.

Los correos usan una plantilla HTML con identidad visual de ONE Talent Hub, logo
cargado desde `hubtalent.onelabs.pro/assets/logo-trim.png` y una versión de texto
plano como respaldo para clientes de email que no rendericen HTML.

### Notificaciones de vacantes

Implementado en primera versión:

1. Se crea la hoja `NotificacionesVacantes` para registrar fecha, búsqueda,
   postulante, puntaje, motivos, estado y error.
2. Se calcula una coincidencia por reglas entre postulante y vacante usando puesto,
   ubicación, habilidades, formación, idioma y experiencia relacionada.
3. Se envían emails automáticamente cuando una empresa crea, actualiza o activa una
   búsqueda en estado `activa`.
4. Se evitan duplicados por búsqueda/postulante y se limita la cantidad diaria de
   emails por postulante.

> Esta función usa `MailApp`, por lo que Apps Script puede pedir una autorización
> adicional para enviar emails desde la cuenta que ejecuta la aplicación web.

Pendiente para una segunda etapa:

1. Agregar preferencia del postulante para recibir o no oportunidades por email.
2. Mostrar en el panel cantidad de candidatos compatibles y emails enviados.
3. Agregar acción manual para notificar candidatos compatibles.
4. Mejorar sinónimos y reglas de equivalencia entre puestos relacionados.

---

## Importante sobre cambios

Cada vez que **modifiques el archivo `Codigo.gs`**, tenés que volver a implementar:
**Implementar → Gestionar implementaciones → editar (lápiz) → Versión: Nueva → Implementar.**
Así la URL sigue siendo la misma pero con el código actualizado.

## Notas de seguridad

- Las contraseñas se guardan en texto plano en la hoja `Usuarios` (uso interno).
  Para mayor seguridad se pueden hashear más adelante.
- El token de sesión dura 12 h (configurable en `TOKEN_HORAS` dentro de `Codigo.gs`).
- La hoja de Google es privada; solo el backend (que corre como tu cuenta) la lee/escribe.
