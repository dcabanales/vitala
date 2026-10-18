# Preparación de Neon para Vitala

Neon aloja PostgreSQL y un bucket privado compatible con S3. Los datos de pacientes van a PostgreSQL; los PDF e imágenes originales van al bucket. La aplicación ya separa las cuentas y permisos por paciente, de modo que empezar con dos o tres familiares no fija un límite técnico de pacientes.

## Crear los recursos

1. En la consola de Neon, crea una cuenta propia y un proyecto nuevo llamado `vitala-v2`. Selecciona la región de Frankfurt (`eu-central-1`), si está disponible para PostgreSQL **y** Object Storage en tu cuenta. Elige el plan Free para la validación inicial; no cargues expedientes reales todavía.
2. Mantén la rama principal vacía y crea un bucket `vitala-documents` con acceso **private**. Comprueba en la consola que no tenga lectura pública. Si Object Storage no se ofrece en esa región, detén la configuración del bucket y elige otro proveedor S3 compatible con región europea; no cambies la ubicación de los datos de salud por comodidad.
3. Obtén la cadena de conexión de PostgreSQL de la rama principal y las variables S3 del bucket. Guárdalas en un gestor de secretos. Nunca las pegues en un chat, las escribas en un comando que quede en el historial ni las confirmes en Git. Neon proporciona `DATABASE_URL` y, para Object Storage, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`.
4. Verifica desde un entorno privado que la conexión usa TLS y que puedes crear y leer un objeto **sintético** del bucket, sin hacerlo público. Prepara una rama de prueba separada antes de migrar el esquema en la rama principal.

## Conectar Vitala

Configura en Fly los secretos `DATABASE_URL`, `SESSION_SECRET`, `APP_ORIGIN`, `OBJECT_BUCKET`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `OPENAI_API_KEY`. `OBJECT_BUCKET` debe ser `vitala-documents`, y `APP_ORIGIN` debe ser la URL HTTPS real del despliegue. La configuración de producción está en `fly.toml` y `fly.v2.toml`; ambos usan PostgreSQL/S3 y ejecutan las migraciones pendientes al desplegar.

Prueba primero la rama de Neon y el bucket con pacientes y documentos ficticios. Ejecuta migraciones, crea el administrador, comprueba acceso y aislamiento entre pacientes, carga/descarga privada, copia y restauración. Luego prueba la extracción con un documento ficticio y revisión humana. El cambio de `vitala.fly.dev` se hace solo cuando estas comprobaciones pasen y se haya guardado la imagen anterior para volver atrás.

Si más adelante se incorporan pacientes ajenos a la familia, no hace falta cambiar la base por el número de pacientes: sí habrá que revisar capacidad, condiciones de tratamiento de datos de salud, contratos con proveedores y operación (copias, recuperación, incidentes y soporte). La versión actual tiene un único administrador; ofrecer cuentas a clínicas o a varios administradores independientes requeriría separar organizaciones, roles y datos entre ellas antes de admitir esos clientes.
