# FlowCode MySQL setup / Instalación de MySQL

## English

1. Start MySQL and install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`. Configure the `MYSQL_*` connection
   settings and choose the initial application administrator credentials:

   ```env
   FLOWCODE_BOOTSTRAP_ADMIN_USERNAME=admin
   FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD=your-unique-temporary-password1
   ```

   Replace the example password with your own (at least 8 characters and a
   number). There is no default administrator password.
3. Run `npm run db:setup`. It creates `MYSQL_DATABASE` if necessary, installs
   the tables from `flowcode-mysql.sql`, applies runtime migrations, and creates
   the administrator only when the users table is empty. Existing accounts and
   passwords are preserved on subsequent runs.
4. Start FlowCode and sign in at `/login`. The administrator must replace the
   temporary password at `/change-password` before accessing protected pages.
5. Remove both `FLOWCODE_BOOTSTRAP_ADMIN_*` variables after installation.

The MySQL account needs schema and data permissions, plus `CREATE DATABASE`
only if the database does not exist. On managed hosting, create the database
in the hosting panel first and use its exact name in `MYSQL_DATABASE`.

For a manual phpMyAdmin import, `flowcode-mysql.sql` creates and selects the
`flowcode` database. Adapt those two statements if using another name. Then
run `npm run db:setup` to complete migrations and administrator creation.
The legacy first-login bootstrap also requires the administrator to change
the temporary password. Afterward, manage accounts from `/admin/users`.

## Español

1. Inicia MySQL e instala las dependencias con `npm ci`.
2. Copia `.env.example` como `.env.local`. Configura la conexión `MYSQL_*` y
   elige las credenciales iniciales del administrador de la aplicación:

   ```env
   FLOWCODE_BOOTSTRAP_ADMIN_USERNAME=admin
   FLOWCODE_BOOTSTRAP_ADMIN_PASSWORD=tu-password-temporal-unica1
   ```

   Sustituye la contraseña de ejemplo por una propia (al menos 8 caracteres y
   un número). No existe una contraseña predeterminada del administrador.
3. Ejecuta `npm run db:setup`. Crea `MYSQL_DATABASE` si hace falta, instala
   las tablas de `flowcode-mysql.sql`, aplica las migraciones y crea el
   administrador solo si no hay usuarios. Repetir el comando conserva las
   cuentas y contraseñas existentes.
4. Inicia FlowCode y accede a `/login`. El administrador debe reemplazar la
   contraseña temporal en `/change-password` antes de entrar a las páginas
   protegidas.
5. Elimina ambas variables `FLOWCODE_BOOTSTRAP_ADMIN_*` tras la instalación.

La cuenta MySQL necesita permisos sobre el esquema y los datos, y
`CREATE DATABASE` solo si la base no existe. En un hosting administrado,
crea primero la base desde su panel y usa su nombre exacto en `MYSQL_DATABASE`.

Para importar con phpMyAdmin, `flowcode-mysql.sql` crea y selecciona la base
`flowcode`. Adapta esas dos instrucciones si utilizas otro nombre. Después,
ejecuta `npm run db:setup` para completar las migraciones y crear el admin.
La creación durante el primer login también obliga a cambiar la contraseña
temporal. Luego puedes gestionar las cuentas desde `/admin/users`.
