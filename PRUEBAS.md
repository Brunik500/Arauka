# Comprobaciones de ARAUKA v0.4

## Demo sin Supabase

1. `npm install` y `npm run dev` desde VS Code.
2. Como **Cliente**, publica un trabajo con título de al menos 6 caracteres y descripción de al menos 20.
3. Cambia a **Maestro** y entra a **Oportunidades**. Para que el maestro NOBRO encuentre el trabajo, usa la categoría Portones, Carpintería, Construcción o Muebles y la localidad Villarrica, Pucón o Lican Ray.
4. Abre la solicitud y pulsa **Me interesa este trabajo**.
5. Vuelve a **Cliente → Mis trabajos**, abre la solicitud y selecciona NOBRO.
6. Marca autorización de contacto como cliente. Cambia a Maestro, entra a **Mis postulaciones**, abre el trabajo y autoriza también el contacto.
7. Comprueba que aparezca el estado de contacto habilitado; en demo no se mostrarán números reales.
8. Vuelve a Cliente, marca el trabajo finalizado y publica una evaluación. Verifica que aparezca en el perfil de NOBRO.
9. Recarga el navegador: los datos de demostración deben mantenerse localmente en el mismo navegador.

## Pruebas obligatorias con Supabase conectado

- Crea dos cuentas reales independientes con correos de prueba.
- Como maestro, activa el perfil, selecciona las categorías y localidades, registra un teléfono privado.
- Como cliente, guarda un teléfono privado y publica un trabajo.
- Comprueba desde la cuenta maestra que no puede ver el teléfono del cliente **antes** de la selección y los dos consentimientos.
- Comprueba que el cliente no puede ver el teléfono del maestro antes de ambos consentimientos.
- Verifica que el cliente puede seleccionar **solo** a un profesional que haya manifestado interés.
- Comprueba que una cuenta no puede editar trabajos de otra.
- Comprueba que una cuenta no puede hacerse pasar por una verificación oficial.
- Comprueba que una evaluación requiere trabajo finalizado y profesional seleccionado; un segundo intento de evaluación para el mismo trabajo debe ser rechazado.
- Sube una foto de prueba JPG/PNG/WEBP de menos de 5 MB; comprueba que el portafolio se visualiza.
- Comprueba que una cuenta no puede subir fotos a la carpeta de otra.
- Prueba en Chrome Android y Safari iPhone además de computador.

## Límites de la versión

- Aún no hay moderación ni reporte de contenido.
- No está implementado el flujo de recuperación de contraseña en la interfaz.
- No hay tablero de administración ni notificaciones.
- No se ha creado ni configurado un proyecto remoto de Supabase automáticamente.
- Esta iteración es una base de desarrollo, **no una plataforma aprobada para poner en producción pública**.
