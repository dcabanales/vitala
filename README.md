# Vitala para Fly.io

Versión independiente de Vitala para alojar en Fly.io. Mantiene la interfaz, los perfiles de varios pacientes, los tratamientos y el registro por especialidad, junto con la carga y revisión de informes PDF e imágenes. Incluye una pantalla de acceso privada, SQLite en un volumen persistente y lectura opcional con GPT-6 Luna.

## Requisitos

- Fly.io CLI (`fly`) instalada y autenticada con tu propia cuenta.
- Node.js 24 en tu ordenador.
- Un nombre de aplicación disponible en Fly.io.

## Prepararla y desplegarla

Desde esta carpeta, ejecuta:

```sh
npm run setup
```

El asistente te pide el nombre público de la aplicación y el correo de acceso. Crea una contraseña sin mostrarla mientras la escribes y la guarda localmente solo en forma de hash. No sube contraseñas, expedientes ni claves de OpenAI durante este paso.

Después, ejecuta los comandos que te muestra el asistente. El flujo crea la aplicación en Fly, agrega un volumen cifrado de 1 GB en Madrid, envía la configuración privada como secretos y despliega **una sola máquina**. Al finalizar, abre `https://<nombre-de-app>.fly.dev` e inicia sesión con el correo y la contraseña que elegiste.

`OPENAI_API_KEY` se configura por separado, para que nunca se incluya en el repositorio, el Dockerfile ni la imagen de despliegue. Si tienes el archivo local `.dev.vars` de la instalación anterior en `work/vitala/.dev.vars`, sigue el comando `npm run import:openai -- ../../work/vitala/.dev.vars` del asistente. El script transmite la clave por entrada estándar al Fly CLI; no la muestra ni la agrega al repositorio. Si prefieres, carga la clave con el panel de secretos de Fly.io. La lectura usa `gpt-6-luna`.

Para no desplegar todavía, ejecuta solo `npm run setup`; la app de Fly y el volumen se crean en el siguiente paso de los comandos mostrados. `fly launch --no-deploy` crea la aplicación sin ejecutar el despliegue inicial.

## Datos y almacenamiento

Los datos viven en `/data/vitala.sqlite`, dentro de SQLite sobre un volumen Fly persistente. Las contraseñas se derivan con scrypt; las cookies de sesión tienen la marca `HttpOnly`, `Secure` y `SameSite=Strict`. El acceso está limitado a una cuenta propietaria; la aplicación actual no configura usuarios adicionales ni colaboración.

El disco raíz de una máquina es temporal, por eso toda la información de pacientes y documentos se guarda en el volumen. Se configura una sola máquina porque Fly no replica los volúmenes entre máquinas. La máquina se mantiene encendida para conservar un único punto de escritura: Fly factura la máquina y el volumen según tu cuenta. Esta configuración es apropiada para comenzar con una cuenta privada; no ofrece alta disponibilidad. Consulta los [precios vigentes de Fly.io](https://fly.io/docs/about/pricing/) antes de desplegar. Fly recomienda configurar copias propias: el plan del volumen de la cuenta y sus instantáneas no sustituyen a una copia que tú puedas recuperar.

Descargar la base de datos del servidor desde el sitio: **Mi cuenta → Descargar copia de seguridad**. También puedes crear la copia directamente en la máquina Fly por SSH:

```sh
fly ssh console --app NOMBRE-DE-TU-APP -C 'node --experimental-strip-types scripts/backup.mjs'
```

El comando crea una copia en `/data/backups/`. Después, usa Fly SFTP para descargarla a tu ordenador:

```sh
fly sftp get --app NOMBRE-DE-TU-APP /data/backups/NOMBRE-DEL-ARCHIVO.sqlite ./vitala-respaldo.sqlite
```

El archivo contiene los datos médicos y documentos del espacio. Guárdalo cifrado y limita el acceso. Fly crea instantáneas del volumen de forma automática, pero mantén también una copia descargada. `npm run backup` crea una copia de la base local durante el desarrollo; `npm run restore -- /ruta/a/vitala-<fecha>.sqlite` restaura en una carpeta local vacía. La app no sobrescribe intencionalmente una base de datos existente durante la restauración.

La aplicación de Fly tiene un espacio vacío y aislado. **No copia automáticamente expedientes ni documentos de tu Vitala actual en Sites**; ambas instalaciones permanecen independientes.

## Probar localmente

Después de `npm run setup`:

```sh
npm ci
npm run dev
```

Abre `http://localhost:3000`, inicia sesión con los datos que elegiste y comprueba el flujo de pacientes. En el perfil de **Settings > API keys** de Fly.io, configura la clave de OpenAI antes de probar la lectura de archivos. Mantén `.dev.vars`, `.env.local`, `.env.fly`, las copias de seguridad y `data/` fuera de Git.

`/api/health` responde solo con `ok` cuando la configuración y la base de datos están disponibles. Fly lo usa para comprobar el estado de la aplicación.

## Alcance

Vitala organiza los datos introducidos manualmente y extraídos de archivos para su revisión. La lectura se inicia a petición, almacena `store:false` en la solicitud de OpenAI y requiere que el usuario confirme los datos extraídos antes de guardarlos. No diagnostica ni determina tratamientos. Esta aplicación personal no incluye las funciones de autorización clínica, auditoría o conformidad necesarias para un servicio sanitario profesional.
