# Vitala · experiencia centrada en la persona

## Diagnóstico
La navegación ya conserva el contexto, pero nueve pestañas tienen el mismo peso. El fondo gris verdoso, las cajas repetidas y los metadatos en tablas convierten la lectura en una tarea administrativa. El resumen repite secciones en vez de ofrecer un punto de partida. Las tendencias son tablas, los tratamientos mezclan lectura y edición y los textos largos no tienen niveles de detalle.

## Dirección
Una libreta de salud personal: marfil, tinta verde profunda, superficies blancas, menta para cuidado activo y un acento cálido para información importante. Tipografía editorial solo en títulos principales, texto de interfaz claro. Iconos funcionales, contraste y foco visibles, movimiento reducido respetado.

- Navegación global separada. Cuatro destinos frecuentes del paciente y un menú Más con acceso a todas las demás secciones.
- Inicio: identidad, última consulta, condiciones/alergias, cuidado actual, evolución de mediciones y actividad reciente. Sin puntuaciones ni conclusiones clínicas generadas.
- Lectura: resumen primero; detalles extensos y fuentes desplegables. Historial en registros cronológicos con fecha, categoría y enlace al detalle.
- Resultados: agrupación por tipo, unidad y muestra; gráficos solo de números fechados publicados y comparables. Valores exactos, referencia y origen accesibles. Ninguna clasificación automática normal/anormal.
- Tratamientos: vigencia, motivo, instrucciones y medicación relacionada, con filtros explícitos. Administración secundaria.
- Documentos: vista previa bajo demanda sin cambiar permisos ni duplicar extracción.
- Mantener todos los formularios, rutas, autorizaciones y reportes.

Referencias de principios: Apple Health (resumen y exploración de tendencias) https://support.apple.com/en-euro/guide/iphone/iphe3d379c32/ios ; Oura (prioridades actuales frente a historial) https://ouraring.com/blog/new-oura-app-experience/ . No se reproducen sus interfaces ni métricas.

## Validación del 18 de octubre de 2026
- Compilación de producción completada; comprobación TypeScript incluida. El componente de iconos se llama `health-icon.tsx` para no colisionar con la convención de metadatos `icon.tsx` de Next.js.
- 18 pruebas de dominio e integración aprobadas, sin omisiones, sobre el servidor local de producción y PostgreSQL de prueba. Incluyen separación de series por tipo/unidad/muestra y protección de documentos privados en mediciones.
- Navegación y lectura revisadas en Chrome a 390 px y escritorio: perfil vacío con nombre largo, textos clínicos extensos, múltiples tratamientos, búsqueda, filtros, tendencias por periodo y selección de fecha, fuentes, imagen ampliable y formularios. Sin desbordamiento horizontal en las vistas móviles revisadas. Escape cierra el menú Más.
- Corregida una discrepancia de hidratación del título SVG; consola sin errores en la comprobación final de producción.
- Reporte sintético exportado a PDF y sus tres páginas revisadas visualmente: sin menús ni recortes de texto. Los PDF originales se abren en el visor del navegador; la vista previa integrada con zoom se ofrece para imágenes.
- Datos sintéticos locales únicamente. Esta revisión no agrega dependencias ni migraciones y no realiza llamadas nuevas a OpenAI. No se ha hecho commit, push ni despliegue.

Capturas de revisión guardadas en `/Users/dcabanales/Documents/Codex/2026-10-12/hol/artifacts/vitala-patient-redesign.png` y `vitala-patient-mobile.png`.
