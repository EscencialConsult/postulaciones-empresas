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
El registro de empresas solicita selfie del representante y fotos del frente y dorso del DNI.
Las imágenes se guardan en Drive y la empresa queda con verificación `pendiente` hasta que
administración revise la documentación desde `admin.html`.

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
- **Empresas:** entran a `empresas.html`, inician sesión, buscan/filtran perfiles,
  ven el detalle completo haciendo clic en una fila y exportan a CSV.

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
