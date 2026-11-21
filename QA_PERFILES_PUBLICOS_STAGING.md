# Cierre de QA — Perfiles públicos Fase 2

Entorno revisado: `arauka-staging` (`qviiiomipsulvjpstyzw`). Esta evidencia no autoriza despliegues ni cambios en producción.

## Pruebas automatizadas

La validación local cubre:

- Contrato tipado de los siete campos de `list_public_providers()`.
- Identidades `professional`, `business` y `company` derivadas únicamente de la RPC.
- Exclusión de Cliente puro.
- Empresa pendiente sin insignia y Empresa aprobada con una sola insignia.
- Privacidad de la proyección y ausencia de credenciales administrativas en frontend.
- Estados de error, reintento, directorio vacío, filtros sin resultados y perfil inexistente.
- Navegación, persistencia de filtros, fallback de imágenes y reglas móviles.
- Etiqueta visible **Prestadores** sin cambiar la ruta `buscar`.
- Presentación vacía específica para Profesional, Negocio y Empresa, preservando biografías reales.

Resultado local de cierre: **113/113 pruebas aprobadas**, `typecheck` aprobado, build aprobado con escaneo de secretos correcto y `git diff --check` aprobado. La advertencia de Vite por un chunk superior a 500 kB permanece como optimización no bloqueante.

## QA visual comprobado en Staging

- El directorio mostró 5 prestadores y 5 identidades reales distintas.
- Distribución observada: 1 Profesional independiente, 3 Negocios independientes y 1 Empresa.
- No apareció ninguna insignia **Empresa verificada**, de acuerdo con los datos actuales.
- El directorio fue revisado correctamente en escritorio.
- El perfil de Empresa fue revisado correctamente en escritorio y a 360 px.
- La acción **Solicitar servicio** permaneció visible en móvil.
- Cliente puro no apareció entre los cinco resultados observados.

## Error y recuperación comprobados

- Se bloqueó intencionalmente la petición a `list_public_providers` mediante DevTools.
- La interfaz mostró el estado controlado de error, sin reconstruir identidades mediante heurísticas.
- Después de retirar el bloqueo se utilizó **Reintentar**.
- La petición respondió HTTP 200 y se recuperaron los cinco prestadores.
- La regla de bloqueo de DevTools fue eliminada al finalizar la prueba.

## Pruebas aún no ejecutadas o sin evidencia suficiente

- Visualización de fotografías reales y fallo real de una fotografía remota.
- Presentación de una Empresa realmente verificada; actualmente existen cero.
- Directorio remoto realmente vacío; el estado está cubierto por pruebas automatizadas, no por datos actuales de Staging.
- Revisión visual exhaustiva en todos los anchos, navegadores y sistemas operativos. Solo constan escritorio y el perfil de Empresa a 360 px.
- Revisión manual completa de cada uno de los cinco perfiles en todos los tamaños.
- Pruebas con tecnologías de asistencia reales; existen controles automatizados y atributos accesibles, pero no una auditoría manual completa con lector de pantalla.

## Revalidación visual breve

1. Ejecutar `npm.cmd run dev:staging` desde la rama `feature/public-provider-discovery`.
2. Confirmar **STAGING · MODO DE PRUEBA**.
3. Verificar que escritorio y navegación inferior muestran **Prestadores** y conservan `/#/{experiencia}/buscar`.
4. Abrir perfiles sin biografía de cada identidad disponible y comprobar el texto correspondiente.
5. Confirmar que una biografía real se muestra sin modificaciones.
6. Verificar que RUT, dirección tributaria, representante, correo, teléfono, documentos y datos administrativos no aparecen.

## Criterio de cierre

La Fase 2 puede respaldarse cuando las validaciones locales estén en PASS y la revisión breve no detecte regresiones. La ausencia de evidencia para fotografías reales, Empresa verificada y otros tamaños debe conservarse como pendiente, no como caso aprobado.
