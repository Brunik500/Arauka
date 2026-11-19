# QA visual — Perfiles públicos Fase 1

Esta guía valida el frontend contra `arauka-staging`. No autoriza cambios SQL, despliegues ni el uso de claves administrativas.

## Preparación

1. Confirmar que `.env.staging.local` contiene únicamente la URL de Staging y una clave pública compatible con navegador.
2. Ejecutar `npm.cmd run dev:staging` y abrir la URL local indicada por Vite.
3. Confirmar la señal visual **STAGING · MODO DE PRUEBA** antes de iniciar sesión o usar datos ficticios autorizados.
4. Probar a 360 px de ancho y en escritorio. No usar datos personales reales en filtros, trabajos ni perfiles.

## Directorio

- Abrir **Profesionales/Directorio** desde Cliente, Profesional/Negocio y Empresa.
- Confirmar que cada tarjeta muestra solamente nombre público, servicios, zona, presentación, fotografías públicas y evaluaciones reales.
- Un perfil sin identidad pública verificable debe decir **Prestador**. El nombre comercial nunca debe convertirlo visualmente en Empresa.
- **Empresa verificada** debe aparecer solamente para un `user_id` devuelto por `verified_companies`.
- Una empresa pendiente no debe mostrar insignia ni mensajes negativos sobre su verificación.
- Probar búsqueda por nombre/oficio, filtro de especialidad y filtro de localidad; limpiar filtros y comprobar que reaparecen los resultados.
- Forzar una combinación sin coincidencias y comprobar el estado **No encontramos perfiles con estos filtros**.

## Detalle y navegación

- Abrir una tarjeta, verificar que la URL conserva `/#/{experiencia}/pro/{id}` y volver con **Volver al directorio**.
- Confirmar que filtros y resultados permanecen al regresar dentro de la misma sesión.
- Abrir manualmente un ID inexistente y comprobar el estado **Perfil inexistente**, sin confundirlo con un fallo de red.
- Desde el detalle, usar **Solicitar servicio** y verificar que prepara la categoría sin revelar contactos.
- Confirmar que teléfonos, correos, RUT, dirección tributaria, representante, documentos y datos administrativos nunca aparecen.

## Fotografías y evaluaciones

- Revisar un perfil con fotografía válida y otro sin fotografías.
- Simular una URL de imagen rota mediante las herramientas del navegador y confirmar el fallback **Imagen no disponible**.
- Un perfil sin evaluaciones no debe mostrar promedio, conteo ni evaluaciones inventadas.
- Un perfil con evaluaciones debe mostrar exclusivamente registros existentes, su puntuación y fecha.

## Móvil y accesibilidad

- A 360 px, confirmar que no existe desplazamiento horizontal y que nombre, insignia, zonas y botones no se superponen.
- Navegar con teclado por filtros, tarjetas, regreso y solicitud de servicio; verificar foco y etiquetas accesibles.
- Confirmar que los botones principales mantienen un área táctil cómoda y que las imágenes poseen texto alternativo.

## Criterio de aprobación

PASS requiere cero datos privados visibles, cero identidades inferidas, navegación ida/vuelta funcional, estados diferenciados y ausencia de desbordamiento a 360 px. Cualquier insignia empresarial sin evidencia de `verified_companies` bloquea la revisión.
