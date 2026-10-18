# Revisión de experiencia · Vitala

## Auditoría (18 octubre 2026)
- Referencia: `52089cc:app/dashboard.tsx` y su CSS. Recuperar la paleta blanca/verde, contexto del paciente y acciones bajo demanda, no el dashboard monolítico.
- Navegación: cada página repite AppShell; las pestañas solo existen en el resumen y no hay estado activo. Los detalles pierden el contexto.
- Resumen: cinco widgets desplazan el contenido, alergias y condiciones aparecen dos veces; no muestra medicación. Perfil y gestión de accesos compiten con información clínica.
- Condiciones: catálogo vacío sin posibilidad de crear desde el formulario; respuestas fallidas se convierten en listas vacías. No existe actualización de condiciones.
- Documentos: carga aislada del flujo de consulta/examen. Edición de campos existe, pero una advertencia desactiva guardar; el servidor también rechaza toda diferencia de nombre.
- Formularios: acciones, lectura y administración se intercalan, faltan cancelación y estados de carga/error. Campos largos ocupan excesivo espacio.
- Reportes: vista previa poco diferenciada de controles; impresión debe excluir el nuevo contexto de navegación.
- CSS: conviven reglas completas de la app anterior con las nuevas, incluidas reglas globales `main`, y tamaños/contrastes inconsistentes.

## Plan
1. Layout compartido de paciente, identidad y pestañas persistentes con estado activo; menú global sobrio y accesible.
2. Condiciones: selección/creación en catálogo, edición con control de versión, auditoría y errores explícitos.
3. Carga contextual compartida; revisión editable, confirmación explícita de discrepancias de identidad y registro de esa decisión.
4. Resumen orientado a lectura: condiciones, alergias, tratamiento, medicación, consultas, exámenes, antecedentes y observaciones. Perfil y accesos en sección propia.
5. Formularios consistentes bajo acciones claras, reportes con controles, vista previa e impresión.
6. Validar con datos sintéticos locales: aislamiento, guardado/edición, importación corregida, navegación, móvil/escritorio y reporte. No modificar expedientes reales.

## Implementado
- Contexto persistente del paciente y navegación activa en todas las secciones y detalles.
- Resumen de lectura sin widgets decorativos. Perfil y gestión de acceso separados.
- Alta y edición de condiciones, alergias y antecedentes, con revisiones y control de concurrencia. Catálogo vacío y entradas archivadas contemplados.
- Un único componente de carga contextual para consultas, exámenes y documentos. Formularios manuales y extraídos comparten campos.
- Revisión editable de extracción; diferencias de nombre, nacimiento e identificador requieren verificación explícita y motivo. Se conservan original, correcciones y auditoría.
- Corrección de la versión ausente en la edición de exámenes; estados de carga, errores y cancelación en formularios.
- Reporte con vista previa y exportación mediante impresión, sin navegación en el PDF ni unidades concatenadas dos veces.

## Validación
- Compilación de producción y TypeScript correctos.
- 17 pruebas automáticas aprobadas (dominio e integración contra PostgreSQL local): permisos, aislamiento, edición, concurrencia, persistencia, confirmación de identidad y asociación al original.
- Navegador: creación/edición de condiciones, consulta manual, examen manual y corrección de su conclusión, revisión de consulta extraída, navegación entre secciones y retorno a pacientes.
- Lectura real de un PDF sintético con OpenAI: examen, resultado y evidencia extraídos; discrepancia de nacimiento detectada; conclusión corregida, examen y medición publicados con enlace al documento. El perfil no se modifica automáticamente.
- Resumen y reporte a 390 px, sin desbordamiento de página. Navegación móvil y contexto persistente comprobados.
- Reporte exportado desde Chrome a PDF de dos páginas y revisado visualmente; sin menú ni formularios impresos.
- Limitación de la prueba: la extensión de Chrome no tiene acceso a archivos locales. La subida del PDF se verificó mediante la API local autenticada; lectura, revisión, edición y confirmación se probaron desde la interfaz.

## Publicación
Los cambios están en local. No se han modificado datos clínicos ni desplegado cambios en producción durante esta revisión. La migración `013_clinical_review.sql` se aplicó a la base de pruebas. En Fly, `fly.v2.toml` ejecuta las migraciones antes de publicar:

```sh
fly deploy --config fly.v2.toml --app vitala --ha=false
```
- Comprobación final adicional: la fecha de nacimiento corregida en el formulario persiste al editar otros campos y al confirmar; la fecha extraída original queda intacta. Se verificó contra PostgreSQL local.
- La última ejecución también pasó las 17 pruebas con el servidor standalone compilado (el formato usado en despliegue).
