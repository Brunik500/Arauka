# Pendientes propuestos para ARAUKA v0.9.5

- Incorporar pruebas visuales automatizadas en los tres tamaños y las tres experiencias.
- Completar una auditoría WCAG de contraste, lectura por pantalla, orden de foco y anuncios de estados asíncronos.
- Dividir `App.tsx` por rutas/componentes y cargar paneles bajo demanda para reducir el paquete inicial.
- Evaluar un formulario empresarial por pasos con resumen previo al envío, sin alterar la RPC segura.
- Añadir gestión explícita del ciclo de documentos privados (tipo, estado de revisión y eliminación individual autorizada).
- Diseñar una consola administrativa separada y protegida por autorización real de backend; no publicarla dentro del frontend general.
- Reemplazar listas libres de regiones/comunas por un catálogo validado y accesible.
- Añadir telemetría de errores sanitizada para Staging, sin tokens, documentos ni datos tributarios.
- Ampliar pruebas de compatibilidad a Safari iOS y navegadores Android de gama media.
- Diseñar una activación de Empresa para cuentas existentes. La RPC actual permite activar Cliente, Profesional y Negocio, pero Empresa requiere un alta transaccional específica que cree su experiencia y antecedentes sin permitir autoverificación. Hasta definir ese backend, la interfaz no simula ni concede esta capacidad.
- Evaluar una normalización futura que traslade completamente presentación, servicios, cobertura y nombre comercial de Profesional/Negocio desde las columnas históricas de `profiles` a una estructura comercial por experiencia. v0.9.4 separa correctamente vistas y escrituras sin migrar ni perder datos históricos.
- Decidir si una misma cuenta debe poder mantener simultáneamente Profesional independiente y Negocio independiente. El modelo actual los representa como identidades mutuamente excluyentes de la capacidad `maestro` (`PRIMARY KEY (user_id, experience)` y RPC que rechaza cambiar `profile_kind`). Admitir ambas exigiría diseño y migración explícitos de identidad, RPC, vistas y políticas; no debe resolverse creando rutas o permisos aparentes en frontend.
- Crear una proyección pública mínima y segura de `profile_kind` para que el directorio pueda distinguir explícitamente Profesional independiente, Negocio independiente y Empresa pendiente sin exponer `commercial_profiles`. Mientras no exista, el perfil público usa el rótulo neutral `Perfil de servicios`; las cuentas verificadas siguen identificándose mediante `verified_companies`.
