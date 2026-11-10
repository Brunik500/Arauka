# ARAUKA v0.4 — Proyecto de VS Code

**Objetivo:** web móvil primero, con archivos estáticos desplegables y una base de datos real cuando se configure Supabase.

## Qué incluye

- React + TypeScript + Vite; interfaz responsive con modo **Cliente / Maestro**.
- Búsqueda por oficio y localidad: Villarrica, Pucón, Lican Ray, Panguipulli, Coñaripe.
- Publicación de trabajos, postulaciones, elección de profesional y estados de trabajo.
- Consentimiento bilateral para compartir teléfonos (solo en producción con la función SQL autorizada).
- Evaluaciones ligadas a trabajos finalizados.
- Perfiles profesionales, múltiples zonas de cobertura y portafolio fotográfico.
- **Modo demo** en el navegador hasta configurar las variables de Supabase.
- Esquema PostgreSQL con autenticación, políticas RLS y fotos en Storage.

La interfaz no requiere Next.js ni un servidor Node.js en producción: Vite genera `dist/` con archivos estáticos. **Supabase sí es un servicio externo necesario** para el registro, los datos compartidos y los teléfonos.

## Instalación en Windows / VS Code

1. Instala **Node.js LTS** y **VS Code**.
2. Descomprime el ZIP y abre la carpeta `ARAUKA_v0.4_VSCode` con **Archivo → Abrir carpeta**.
3. En **Terminal → Nuevo terminal**, ejecuta:

   ```bash
   npm install
   npm run dev
   ```

4. Abre la URL local que aparece en la terminal (normalmente `http://localhost:5173`).
5. Prueba el modo demo. NOBRO aparece como ejemplo y la empresa de limpieza es **ficticia** hasta recibir autorización de sus propietarios.

> Importante: a diferencia del HTML anterior, no se abre el archivo `index.html` haciendo doble clic. En desarrollo usa `npm run dev`; para hosting usa `npm run build`.

## Conectar Supabase para tener datos reales

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Abre **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo **en un proyecto nuevo**.
3. Ve a la configuración de API de Supabase y obtén la URL y la **publishable key** (o clave pública `anon`).
4. Duplica `.env.example` como `.env` y reemplaza las dos variables reales:

   ```dotenv
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
   ```

5. Reinicia `npm run dev`. La app pasa de modo demo a modo Supabase.
6. En **Authentication → Providers**, habilita Email; configura confirmación por correo y URL de redireccionamiento del sitio antes del lanzamiento.
7. Registra dos cuentas distintas de prueba (cliente y maestro) y verifica publicación, respuesta, selección, ambos consentimientos, contacto y evaluación.

**Nunca pongas `service_role`, `secret key`, contraseña de la base de datos ni otras claves secretas en `.env` con prefijo `VITE_`, HTML o GitHub.** El cliente solo usa la clave pública; la seguridad viene de RLS y de la función protegida `get_shared_contact`.

Las tablas creadas no contienen perfiles reales predefinidos. Los perfiles reales deben inscribirse con su autorización.

## Compilar una web estática para hosting

```bash
npm run build
npm run preview
```

La carpeta **`dist/`** resultante puede subirse a un hosting estático con HTTPS. No es necesario Next.js para atender las páginas. **No basta con subir los archivos fuente; hay que compilar.**

Por ahora el sitio utiliza navegación interna sin rutas de navegador; por ello no requiere reglas especiales de reescritura. Más adelante, si incorporamos páginas individuales indexables, habrá que evaluar enrutamiento, SEO y renderizado.

## Estructura

```text
src/
  App.tsx           Vistas, flujos, demo y conexión Supabase
  styles.css        Diseño responsive
  lib/
    supabase.ts      Cliente Supabase
    types.ts         Tipos de datos, oficios y localidades
supabase/
  schema.sql         Tablas, disparadores, políticas de seguridad, Storage y RPC
public/
  favicon.svg
.env.example
package.json
vite.config.ts
```

## Qué falta para un lanzamiento público seguro

- Conectar y probar el proyecto Supabase de producción; definir backups y recuperación.
- Pruebas con varias cuentas reales y autorización de datos; revisión independiente de las políticas RLS.
- Moderación, reportes, control de contenido, verificación de identidad y credenciales, limitación de abuso/spam.
- Aviso de privacidad, términos de uso y política de manejo de datos conforme a normativa aplicable en Chile.
- Panel administrativo y métricas de adquisición/conversiones.
- Actualización de reglas de negocio y UX basadas en las pruebas locales.
- Instalación como PWA si se desea; posible app nativa (Expo/React Native) reutilizando Supabase y lógica, **no convirtiendo el sitio web automáticamente en app nativa**.

## Notas de diseño y seguridad

- Las localidades Lican Ray (comuna Villarrica) y Coñaripe (comuna Panguipulli) se presentan por separado para mejorar búsqueda local.
- Los usuarios pueden alternar entre cliente y maestro; en modo real es una única cuenta que habilita perfil profesional.
- No se simulan pagos ni comisiones.
- No se generan evaluaciones falsas, ni verificaciones automáticas.
- La autorización para compartir teléfonos es individual y revocable; una vez visto un teléfono, no es posible impedir que alguien lo conserve.
- **Las imágenes de portafolio son públicas**; no subas fotos con direcciones, patentes o datos personales sin consentimiento.
- El modo demo usa `localStorage`: su contenido no se sincroniza entre dispositivos ni migra automáticamente a Supabase.
