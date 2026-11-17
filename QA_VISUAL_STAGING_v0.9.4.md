# Guía de QA visual y manual — ARAUKA v0.9.4

Ejecutar esta guía únicamente con la barra de Staging visible. Usar cuentas ficticias identificables y documentos sin información real.

## Matriz visual base

Repetir los recorridos a 360 px, 768 px y escritorio (al menos 1280 px), y comprobar teclado además de puntero.

| Área | Resultado esperado |
|---|---|
| Entorno | Barra de Staging siempre visible, sin cubrir encabezados ni controles |
| Cliente | Verde, rótulo `Panel Cliente`, acciones de publicación y búsqueda |
| Profesional / Negocio | Azul, rótulo `Panel Profesional`, oportunidades y perfil profesional |
| Empresa | Morado, rótulo `Panel Empresa`, acceso prioritario a antecedentes empresariales |
| Formularios | Etiquetas legibles, foco visible, error junto al campo o formulario y botón ocupado durante el envío |
| Vacíos | Explican qué falta y ofrecen una siguiente acción cuando corresponde |
| Móvil | Sin desplazamiento horizontal; campos y botones cómodos para toque; navegación inferior legible |

## Recorridos guiados

1. En el selector inicial, confirmar que Cliente, Profesional independiente, Negocio independiente y Empresa se entienden como alternativas distintas. Confirmar que NOBRO permanece como negocio independiente.
2. Registrar una cuenta ficticia y luego iniciar/cerrar sesión. Verificar mensajes de carga, éxito y error sin datos técnicos ni secretos.
3. Desde una cuenta que solo tenga Cliente, intentar abrir Profesional. Confirmar que el acceso se bloquea y que `Preparar y activar Profesional o Negocio` conduce a Mi cuenta. Completar nombre, presentación, oficio y localidad; para Negocio completar además nombre comercial. Confirmar que la activación usa la misma cuenta, conserva Cliente y no cambia la experiencia principal. Repetir dejando cada requisito vacío y comprobar que no se activa.
4. Confirmar que el encabezado ofrece una sola acción visible hacia Mi cuenta mediante el control textual de rol. No debe aparecer un segundo avatar circular con apariencia de botón.
5. En Cliente, publicar una solicitud ficticia, revisar `Mis trabajos`, interesados, selección y contacto. Confirmar que nunca se expone contacto antes del flujo autorizado.
6. En Profesional / Negocio, revisar oportunidades, postulación, estado vacío, edición del perfil, zonas, oficios y portafolio. Un perfil no verificado no debe mostrar mensajes estigmatizantes.
7. En Empresa, completar el formulario y probar un RUT válido e inválido. Identificar claramente campos públicos y privados. Verificar que dirección tributaria y documentos no aparezcan en perfiles públicos.
8. Subir solo un PDF/JPG/PNG ficticio menor a 10 MB. Confirmar estado de carga y listado privado; no debe existir URL pública permanente.
9. Con una empresa aprobada por el procedimiento administrativo de ensayo, verificar la etiqueta `Empresa verificada`. Una empresa pendiente o rechazada no debe mostrarla públicamente.
10. Revisar Mi cuenta, notificaciones, preferencias, trabajos, postulaciones/oportunidades y todos los estados vacíos.
11. Abrir un perfil público en una ventana sin sesión. Confirmar nombre público, servicios, zonas y evaluaciones, pero no dirección tributaria, RUT, teléfono privado, documentos ni datos administrativos.

## Separación de datos por experiencia

1. Con una cuenta que tenga Cliente y Profesional o Negocio, abrir `/#/cliente/cuenta`. Deben aparecer nombre personal, contacto privado, notificaciones y gestión de experiencias. No deben aparecer nombre comercial, presentación de servicios, oficios, localidades de cobertura ni portafolio.
2. Cambiar solo el nombre personal en Cliente y guardar. Volver a Profesional: nombre comercial, presentación, oficios, localidades y fotografías deben conservarse sin cambios.
3. En Profesional independiente, comprobar presentación, oficios, localidades y portafolio. El formulario no debe editar el nombre personal ni mostrar un nombre de Empresa.
4. En Negocio independiente, comprobar además el nombre comercial y la etiqueta `Negocio independiente`. Guardar y regresar a Cliente: el nombre personal no debe cambiar.
5. Recargar cada ruta directamente. La experiencia debe recuperarse desde la URL y las capacidades desde `my_account_experiences`, sin combinar formularios.
6. En Empresa, utilizar únicamente el formulario empresarial morado. El formulario profesional heredado no debe aparecer.

## Identidad visible de las cuatro experiencias

1. Cliente debe mostrar `Panel Cliente`, botón `Cliente` y color verde.
2. Una cuenta `profile_kind=professional` debe mostrar `Panel Profesional independiente`, botón `Profesional independiente`, `Mi perfil` y color azul.
3. Una cuenta `profile_kind=business` debe mostrar `Panel Negocio independiente`, botón `Negocio independiente`, `Mi negocio` y color azul. No debe aparecer `Panel Profesional` como sustituto.
4. Empresa debe mostrar `Panel Empresa`, botón `Empresa`, formulario empresarial y color morado.
5. Recargar `/#/maestro/inicio` y `/#/maestro/cuenta`. La ruta histórica debe seguir funcionando y recuperar el nombre visible correcto desde `my_account_experiences`.
6. Confirmar que intentar otra ruta no crea capacidades y que cambiar de panel no modifica la experiencia principal.

## Selector único «Mis experiencias»

1. Abrir Mi cuenta y confirmar que existe una sola sección para cambiar de experiencia; no debe aparecer la antigua tarjeta `Experiencia de navegación`.
2. La experiencia activa debe aparecer resaltada y deshabilitada. Cada botón debe usar el nombre derivado de `profile_kind`.
3. Cambiar entre dos experiencias activadas y confirmar que no se ejecuta ninguna acción para cambiar la principal.
4. En una experiencia secundaria, usar la acción separada `Usar … como experiencia principal`; no confundirla con el cambio de panel.
5. En una cuenta que solo tenga Cliente, comprobar la acción diferenciada `Activar nueva experiencia`. Debe exigir elegir Profesional independiente o Negocio independiente, sin presentar ambas como experiencias ya activadas.
6. En una cuenta sin alternativas activadas, el texto debe indicar que es la única experiencia. No debe prometer un cambio inexistente.
7. Repetir a 360 px: los botones deben ocupar el ancho disponible y no producir desplazamiento horizontal.

## Confirmación de correo

1. Registrar una cuenta ficticia de cada identidad visible con confirmación de correo habilitada. Si Supabase no entrega sesión, debe aparecer `¡Tu cuenta está casi lista!`, el correo ingresado y la instrucción de revisar Spam.
2. Pulsar `Volver a Iniciar sesión` e intentar ingresar antes de confirmar. Debe mostrarse el mensaje en español que indica que el correo aún no está confirmado, nunca `Email not confirmed`.
3. Usar `Reenviar correo de confirmación` una vez. Confirmar el estado de envío, el bloqueo de 60 segundos y que los clics repetidos no generan solicitudes adicionales.
4. Abrir el enlace recibido y luego iniciar sesión normalmente. La experiencia elegida durante el registro debe mantenerse.
5. Repetir un registro con un correo ya utilizado. La interfaz no debe afirmar si esa dirección pertenece o no a una cuenta.
6. Con confirmación desactivada en un proyecto local aislado o cuando Supabase entregue sesión inmediatamente, confirmar que no aparece la pantalla pendiente.
7. Repetir a 360 px y comprobar que ambos botones ocupan el ancho disponible.
8. Provocar de forma controlada un rechazo HTTP 429 en un entorno aislado. El registro debe permanecer en el formulario y mostrar `No pudimos completar tu registro. En este momento no fue posible enviar el correo de confirmación. Por favor, inténtalo nuevamente más tarde`, sin indicar proveedor, cuota o límite técnico.
9. Provocar el mismo rechazo durante un reenvío. Debe mostrarse `No fue posible procesar el reenvío del correo de confirmación. Por favor, inténtalo nuevamente más tarde`; no debe aparecer el mensaje de solicitud procesada ni producirse un reintento automático.
10. En desarrollo, revisar la consola: el diagnóstico puede incluir operación, categoría, estado HTTP y código normalizado, pero nunca correo, contraseña, token ni el mensaje original del proveedor.
11. En Crear cuenta, comprobar que aparecen `Contraseña` y `Confirmar contraseña`, ambos ocultos inicialmente y con controles de visibilidad independientes. Un valor diferente debe mostrar `Las contraseñas no coinciden` sin enviar el registro.
12. Cambiar a Ingresar: la confirmación debe desaparecer y reiniciarse. Cerrar y volver a abrir el formulario debe limpiar ambos secretos y ocultar nuevamente sus contenidos.
13. A 360 px, comprobar que los íconos no cubren el texto, tienen un área táctil cómoda, admiten foco de teclado y el formulario puede desplazarse verticalmente sin cortar el botón de envío.

## Criterios de salida

- Ninguna pantalla pierde la indicación de Staging.
- El panel activo se reconoce sin depender solo del color.
- Empresa y negocio independiente no comparten denominación ni estado de verificación.
- La etiqueta de verificación aparece solo tras aprobación real.
- No hay texto cortado, superposición, foco invisible ni acciones sin respuesta visible.
- Los datos privados permanecen ausentes de vistas públicas y del registro de consola.

Registrar cada incidencia con pantalla, experiencia, ancho, navegador, pasos y captura sin datos sensibles.
