# Vitala

Vitala es una aplicación privada, mobile first, para organizar los expedientes de unos pocos pacientes. Un administrador registra consultas, exámenes, mediciones, condiciones, alergias, tratamientos, medicación y documentos; cada paciente invitado consulta solo los datos publicados de su expediente. Los informes PDF e imágenes pueden proponerse como consultas o exámenes con mediciones mediante OpenAI, siempre con revisión humana antes de incorporarlos. Los reportes se imprimen o guardan como PDF desde el navegador.

Esta versión nueva comienza con una base vacía. **No importa ni modifica la base SQLite, el volumen o las cuentas de la instalación anterior.** `fly.toml` y `fly.v2.toml` describen la arquitectura PostgreSQL/S3 actual e incluyen la ejecución de migraciones pendientes al desplegar.

## Arquitectura

- Next.js 16, TypeScript y Node.js 24 en Fly.io.
- PostgreSQL para cuentas, permisos, historia clínica, metadatos y auditoría.
- Bucket privado compatible con S3 para originales PDF e imágenes; en desarrollo puede usarse un directorio local.
- Sesiones revocables de ocho horas en cookies `HttpOnly`, `Secure` en HTTPS y `SameSite=Strict`. Los pacientes consultan su expediente publicado y pueden subir sus propios documentos para revisión. Cada petición comprueba tanto la cuenta vinculada al paciente como la concesión vigente. Solo el administrador modifica registros clínicos.
- OpenAI Responses API con `store:false`, modelo configurable y confirmación manual. Las pruebas locales de extracción con PDF e imagen ficticios pasan con la clave configurada; la instalación de Fly necesita desplegar la versión actual para usar estos flujos.

## Desarrollo local con datos ficticios

Se necesitan Node.js 24, PostgreSQL y `pg_dump`/`pg_restore`. Crea una base **nueva** y una carpeta privada de objetos. Usa `.env.example` como guía para configurar `DATABASE_URL`, `SESSION_SECRET` aleatorio de 32 caracteres o más, `APP_ORIGIN` y `LOCAL_OBJECT_DIR` en `.env.local`. Si ya existe ese archivo, consérvalo y agrega las variables nuevas sin sobrescribirlo. No guardes claves reales en Git.

```sh
npm ci
createdb vitala_dev
npm run db:migrate
BOOTSTRAP_EMAIL=admin@example.test BOOTSTRAP_PASSWORD='contraseña-larga-de-prueba' npm run db:bootstrap
npm run dev
```

`npm run db:migrate` y `npm run db:bootstrap` necesitan `DATABASE_URL` en el entorno de la terminal; Node no carga `.env.local` para los scripts. Para cargarla sin mostrar su contenido, usa un gestor de secretos o exporta las variables en tu shell. `db:bootstrap` solo crea la primera cuenta administradora y se niega a cambiarla si ya existe. Abre `http://127.0.0.1:3000/login` si ese es tu `APP_ORIGIN`.

Para validar: `npm run typecheck`, `npm run build` y `npm test`. Las pruebas HTTP de integración se activan con `SMOKE_BASE_URL`, `SMOKE_ADMIN_EMAIL`, `SMOKE_ADMIN_PASSWORD` y `SMOKE_DATABASE_URL`, ambos destinos restringidos a localhost. Crean pacientes y cuentas sintéticas y comprueban aislamiento, invitación, recuperación, MFA y revocación.

## Preparación de Fly.io

Para crear Neon desde cero y separar los datos de los archivos privados, sigue [Preparación de Neon](docs/neon-setup.md).

**Validación del 18 de octubre de 2026:** el proyecto `vitala-v2` ya tiene PostgreSQL y el bucket privado `vitala-documents`. La CLI local usa una clave limitada a ese proyecto; la primera clave creada durante la configuración fue revocada y no debe reutilizarse. Las 12 migraciones, una cuenta administradora ficticia y una prueba de subida, lectura y eliminación de un objeto ficticio funcionaron en la rama `vitala-integration-test`, que caduca el 25 de octubre. Una comprobación posterior encontró las migraciones 001–012 y un administrador en production; la imagen de Fly seguía siendo v1. Las migraciones 013–016 están pendientes en producción. También pasaron la compilación, los tests de dominio, las cinco pruebas HTTP de integración con PostgreSQL local y la restauración de una copia cifrada con tres objetos ficticios. Dos extracciones reales con OpenAI leyeron PDF inventados: una consulta y un examen con glucosa y hemoglobina. Ambos resultados quedaron pendientes de revisión, sin crear automáticamente registros clínicos. Falta revisar las condiciones de tratamiento de datos antes de cargar expedientes reales.

1. Crea una **base PostgreSQL nueva y vacía** y un **bucket privado nuevo**. No reutilices el volumen `/data` anterior. La app y los recursos deben estar en regiones compatibles. Comprueba el acceso desde tu cuenta antes de cargar datos reales.
2. Configura en Fly los secretos `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN=https://vitala.fly.dev`, `OBJECT_BUCKET`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`. Conserva `OPENAI_API_KEY` como secreto; `OPENAI_MODEL` tiene por defecto `gpt-6-luna` en `fly.v2.toml`. No introduzcas secretos en el repositorio ni en argumentos de terminal que queden en el historial.
3. Ejecuta las migraciones en la base nueva. El despliegue con `fly.v2.toml` incluye `release_command = 'node scripts/migrate.mjs'`, que aplica solo migraciones pendientes.
4. Crea el primer administrador **una sola vez** con `npm run db:bootstrap` desde un entorno privado que tenga acceso a esa base. Usa un correo tuyo y una contraseña nueva de al menos 14 caracteres. Retira `BOOTSTRAP_PASSWORD` del entorno después. Después del primer inicio de sesión, abre **Cuenta → Seguridad** y activa la verificación en dos pasos. Guarda los códigos de recuperación fuera del servidor.
5. Valida `fly config validate -c fly.v2.toml` y despliega con `fly deploy --config fly.v2.toml --app vitala --ha=false`. Este paso reemplaza el código servido por la app `vitala`; ejecútalo solo cuando la base, bucket, respaldo y cuenta nueva estén listos.
6. Comprueba `/api/health`, inicio de sesión, creación de un paciente ficticio, carga/descarga privada y reporte. Después prueba la extracción con un documento **sintético** y confirma el resultado manualmente.

El `fly.toml.example` también refleja la configuración v2. Para volver al código anterior se requiere redeplegar su imagen/configuración previa; la nueva base no es compatible con la aplicación SQLite. Guarda el identificador de la imagen anterior antes de cambiar de versión.

`SESSION_SECRET` debe permanecer estable: además de proteger los tokens, cifra la clave del autenticador. Si la cambias sin un procedimiento de rotación, las sesiones y la verificación en dos pasos dejarán de funcionar.

## Cuentas y recuperación

Desde la ficha de un paciente con cuenta, el administrador puede generar un enlace de recuperación válido 30 minutos. Debe confirmar su propia contraseña para crearlo y entregarlo al paciente por un canal privado. El enlace solo se usa una vez; al cambiar la contraseña se revocan las sesiones anteriores. La recuperación genera un enlace para compartir manualmente.

Para recuperar la cuenta administradora cuando se pierde la contraseña, `npm run admin:reset-password` funciona desde un entorno con acceso directo a PostgreSQL y requiere `DATABASE_URL`, `ADMIN_RESET_EMAIL` y `ADMIN_RESET_PASSWORD`. Introduce la nueva contraseña mediante tu gestor de secretos o una variable leída en silencio por la terminal, y retírala del entorno después. Esta operación revoca las sesiones y conserva MFA. Si también se perdieron el autenticador y todos los códigos de recuperación, ejecuta la misma operación con `ADMIN_RESET_MFA=1`; quedará auditada y debes activar MFA de nuevo antes de usar expedientes reales.

## Archivos, IA y reportes

Los originales se guardan privados y asociados a un paciente. Se validan tipo, firma y tamaño (máximo 10 MB), y se evita cargar el mismo hash dos veces para el mismo paciente. El administrador puede iniciar una extracción de consulta o examen, revisar campos, mediciones y fuente, y decidir qué guardar. Los tipos de medición nuevos se crean en **Catálogos → Tipos de medición** y pueden seleccionarse desde la revisión. Una discrepancia de identidad bloquea la confirmación. Fechas y datos ausentes permanecen como desconocidos. La IA no diagnostica ni prescribe. El cupo inicial es de 20 lecturas por 24 horas y dos lecturas simultáneas, compartido por toda la instalación.

El resumen visible se deriva de registros estructurados. En el reporte de cada paciente se pueden filtrar fechas y especialidades y usar **Imprimir → Guardar como PDF**. El navegador genera el PDF; el sistema no almacena automáticamente una copia del reporte.

## Copias y recuperación

`npm run backup` crea un archivo cifrado AES-256-GCM con un dump de PostgreSQL y los objetos listos, verificando el SHA-256 de cada original. Requiere `DATABASE_URL`, configuración del bucket (o adaptador local), `BACKUP_OUTPUT` (ruta nueva) y `BACKUP_PASSPHRASE` (20 caracteres o más). Haz la copia en una ventana sin cambios clínicos concurrentes, descárgala a un lugar privado y conserva la frase aparte. No hay endpoint web de backup.

`npm run restore` requiere `RESTORE_INPUT`, `BACKUP_PASSPHRASE`, `DATABASE_URL` de una **base vacía** y configuración de un **bucket vacío**. Se niega a sobrescribir una base o un objeto existentes. La restauración se probó con pacientes y documentos sintéticos, incluido el hash de un archivo.

## Límites actuales

Sin proveedor configurado, las invitaciones y recuperaciones generan enlaces privados para compartir. El envío opcional de invitaciones usa RESEND_API_KEY e INVITATION_FROM; no está activado ni se ha probado la entrega de correos. No hay recuperación autoservicio. La IA propone consultas y exámenes con mediciones para revisión humana. El bucket privado y ambos tipos de extracción con OpenAI ya pasaron pruebas de extremo a extremo con datos ficticios. El plan actual de Neon no permite activar su opción de soporte HIPAA. Antes de cargar expedientes reales, revisa las condiciones de tratamiento de datos de salud, ubicación, acuerdos y controles aplicables a todos los proveedores.

## Acceso por rol y revisión de documentos

El administrador entra en Pacientes; el paciente entra directamente en su resumen y conserva ese contexto al recargar. Una cuenta sin perfil o sin permiso vigente ve una explicación y la opción de cerrar sesión. La navegación personal agrupa medicamentos, antecedentes, documentos y reportes bajo Más.

En Perfil → Acceso se crean, renuevan y revocan invitaciones; se ve si la cuenta ya se activó. El paciente elige su contraseña. Sin proveedor, se muestra el enlace y nunca se afirma haber enviado correo. Revocar el acceso invalida las sesiones; restaurarlo conserva la cuenta.

Revisar documentos reúne las cargas y permite filtrar por paciente, fecha, tipo y estado. Los borradores de IA se pueden corregir, guardar y retomar; se conserva la extracción original. La confirmación es idempotente y comprueba versiones para impedir que una revisión antigua sobrescriba otra. Los errores de proveedor, cuota, archivo y tiempo de espera son explícitos.

Las correcciones y archivos clínicos requieren motivo y conservan la versión anterior. Los catálogos se desactivan sin romper sus referencias. Doctor, centro, especialidad y medicamento pueden crearse desde el formulario clínico sin perder su contenido.

### Resultados de laboratorio y explicación de IA

La migración `017_lab_result_names.sql` conserva el nombre documentado de cada análisis, independiente del tipo del catálogo. Recupera nombres de extracciones confirmadas solo si hay una coincidencia exacta y única y el resultado no fue corregido. Los resultados pueden corregirse desde el detalle del examen; las revisiones conservan los valores anteriores. Las gráficas separan nombres distintos aunque compartan categoría.

Cuando faltan textos del informe, el administrador puede generar una explicación orientativa con OpenAI desde el examen. Se muestra separada y etiquetada como IA, sin rellenar los campos del médico. Se envían los datos del examen y sus resultados publicados, sin adjuntar la identidad ni el PDF. Se reutiliza una explicación existente para los mismos datos; cambios posteriores la ocultan hasta regenerarla. El límite es de 20 solicitudes por 24 horas y dos simultáneas, independiente del límite de extracción documental.

### Lectura general de documentos

La lectura desde Consultas o Exámenes recorre el documento completo. El punto de entrada elige el registro principal; las propuestas adicionales incluyen alergias, condiciones documentadas, antecedentes, tratamientos, medicación, pruebas y mediciones, con evidencia y revisión humana. Los resultados no requieren crear previamente un tipo de catálogo. Un tratamiento administrado durante la atención queda completado; las recomendaciones históricas al alta no se consideran automáticamente activas hoy.

La migración `018_consultation_records.sql` conserva la procedencia y evita repetir propuestas del mismo documento. «Completar datos del documento» permite releer archivos confirmados para añadir información omitida, preservando el registro principal y sus correcciones. No actualiza automáticamente expedientes existentes: las nuevas propuestas deben revisarse y confirmarse.

«Quitar documento» está disponible en la biblioteca y la revisión. Retira el archivo de la biblioteca y permite volver a cargarlo, conservando la fuente de registros clínicos confirmados. Las lecturas atascadas durante más de tres minutos se marcan interrumpidas para permitir la retirada; una lectura reciente sigue protegida.
