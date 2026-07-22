# FlowCode

## English

FlowCode is an educational visual programming environment for building,
understanding, importing, executing, and exporting flowchart-style programs.
It is designed for learners who need to see how a program moves through
decisions, loops, functions, inputs, outputs, variables, and return values,
while still keeping a close relationship with real JavaScript.

The project is built with Next.js, React, React Flow, TypeScript, and a safe
custom execution layer for the JavaScript-like expressions used inside the
diagram.

### What FlowCode Is For

FlowCode helps users:

- Build algorithms as diagrams instead of starting directly with text code.
- Step through execution and see the active block, visited path, variables,
  outputs, and execution history.
- Learn how common JavaScript concepts map to visual control flow.
- Import JavaScript starter code and convert it into a diagram.
- Generate readable JavaScript from a diagram.
- Practice with guided exercises.
- Experiment with functions and reusable subflows.

It works best for educational algorithms, classroom exercises, debugging
mental models, and visualizing control flow. It is not intended to run
arbitrary browser, DOM, network, or system-level JavaScript.

See [docs/javascript-support.md](docs/javascript-support.md) for the tested
JavaScript subset, partial support, unsupported syntax, and APIs blocked by the
safe runtime.

### Main Features

- Visual flow editor with draggable blocks and connectable ports.
- Blocks for Start, End, Process, Input, Output, Decision, Function Call, and
  Return.
- Function/subflow editor with parameters.
- Step-by-step execution and automatic execution.
- Input and function-parameter modals during execution.
- Variables, outputs, validation, and execution history panels.
- JavaScript import panel for supported code.
- JavaScript generation panel for diagrams.
- Exercise mode with predefined challenges.
- Fullscreen diagram mode with edge drawers for execution tools, functions,
  validation, variables, outputs, history, and blocks.
- Mini map with collapse/expand control.
- Safe expression runtime with a whitelist of supported JavaScript helpers.

### Interface Overview

The main workspace is organized around the diagram canvas:

- **Exercise mode**: choose a challenge and load its starter code or starter
  diagram.
- **Validation**: shows structural problems, blocked connections, and loop
  information.
- **Functions**: manage the main flow and reusable functions. Function names
  can be edited with the pencil button, and parameters appear under the
  selected function.
- **Blocks**: insert visual blocks into the canvas.
- **Diagram canvas**: move blocks, connect ports, edit block text, inspect the
  mini map, and enter fullscreen.
- **Execution controls**: step, auto-run/pause, and reset execution.
- **Variables**: shows the current runtime variables.
- **Outputs**: shows values produced by output blocks.
- **History**: shows the executed path, newest step first.
- **JavaScript code**: generates JavaScript from the current diagram.
- **JavaScript import**: imports supported JavaScript into FlowCode diagrams.

### Canvas, Mouse, and Keyboard Controls

- Drag a block to move it.
- Drag from one block handle/port to another to create a connection.
- Click a block to select it and reveal its port controls.
- Select a block or connection and press **Backspace** to delete it.
- Edit a block's text directly in its textarea-like content.
- Use the mouse wheel to zoom.
- Use pinch gestures to zoom on supported devices.
- Drag the empty canvas to pan.
- Hold **Space** while interacting with the canvas to use the configured pan
  activation behavior.
- **Shift** is reserved as the selection modifier key by the canvas engine.
- Use the bottom-left canvas controls to zoom, fit the diagram, and toggle
  interaction controls exposed by React Flow.
- Use the top-right fullscreen button to enter or leave fullscreen diagram
  mode.
- In fullscreen, move near the left, right, or bottom edge to reveal drawer
  buttons for hidden panels.
- Use the minimap button to collapse or expand the mini map.
- Press **Escape** to cancel FlowCode confirmation modals.
- In function-name editing, **Enter** or **Escape** closes the inline name
  input.

### Execution Controls

FlowCode can execute a diagram one block at a time or automatically:

- **Step** runs the next executable block.
- **Run** starts automatic execution.
- **Pause** stops automatic execution.
- **Reset** restarts execution for the active diagram.

During execution, the current node and active edge are highlighted. If an input
block is reached, FlowCode opens a modal to collect the value. If a function
call requires parameters, FlowCode opens a parameter modal. Outputs, variables,
and history update as execution progresses.

### Supported Diagram Blocks

- **Start**: entry point of a diagram.
- **End**: termination point of a diagram.
- **Process**: textual JavaScript-like instructions such as declarations,
  assignments, method calls, and supported expressions.
- **Input**: asks the user for a value and stores it in a variable.
- **Output**: evaluates and prints an expression.
- **Decision**: branches through yes/no style conditions.
- **Function Call**: calls a reusable FlowCode function/subflow.
- **Return**: returns a value from a function/subflow.

### JavaScript and Expression Support

Process blocks and equivalent textual fields run through a controlled
JavaScript-like expression/runtime layer. Supported syntax includes:

- Variable declarations and assignments.
- Property access with `obj.prop` and dynamic access with `obj["prop"]`.
- Property assignment where supported by the runtime.
- Array and object literals.
- String, number, boolean, null, and undefined values.
- Template literals.
- Arithmetic, comparison, logical, unary, update, and conditional expressions.
- Function calls allowed by the safe runtime whitelist.
- Inline callbacks for supported array helpers.
- Functions with parameters and return values in imported/supported code paths.
- Control flow such as if/else, loops, switch, break, continue, and return
  where the parser/runtime architecture supports them.

### Supported Helpers

Math and numbers:

- `Math.abs`
- `Math.max`
- `Math.min`
- `Math.floor`
- `Math.ceil`
- `Math.round`
- `Math.trunc`
- `Math.random`
- `Math.pow`
- `Math.sqrt`
- `Math.sin`
- `Math.cos`
- `Math.tan`
- `Math.PI`

Strings:

- `.length`
- `.toUpperCase()`
- `.toLowerCase()`
- `.trim()`
- `.includes(...)`
- `.startsWith(...)`
- `.endsWith(...)`
- `.slice(...)`
- `.substring(...)`
- `.replace(...)`
- `.split(...)`
- index access such as `text[0]`

Arrays:

- `.length`
- `.push(...)`
- `.pop()`
- `.shift()`
- `.unshift(...)`
- `.includes(...)`
- `.indexOf(...)`
- `.slice(...)`
- `.join(...)`
- `.map(...)`
- `.filter(...)`
- `.find(...)`
- `.some(...)`
- `.every(...)`
- `.reduce(...)`
- `.sort(...)`

Objects:

- `obj.prop`
- `obj["prop"]`
- property assignment
- `Object.keys(obj)`
- `Object.values(obj)`
- `Object.entries(obj)`

Characters and Unicode:

- `charAt(text, index)`
- `charToCode(character)`
- `codeToChar(number)`
- `charCodeAt(text, index)`
- `codePointAt(text, index)`
- `fromCharCode(number)`
- `fromCodePoint(number)`

### Safety Model

FlowCode intentionally runs a safe subset instead of arbitrary JavaScript.
Unsupported unsafe APIs include:

- `eval`
- `Function`
- arbitrary `window`
- arbitrary `document`
- DOM access
- `innerHTML`
- APIs that bypass the controlled runtime model

The runtime favors predictable educational execution, clear validation
messages, and compatibility with existing diagrams.

### Exercises

Exercise mode provides guided challenges with a title, difficulty, description,
objective, tags, and optional starter code or starter diagram. Selecting an
exercise can load starter content into the workspace. If the current workspace
would be replaced, FlowCode asks for confirmation using an in-app modal.

### Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Available scripts:

```bash
npm run dev      # start the local Next.js development server
npm run build    # create a production build
npm run start    # start the production server after building
npm run email:worker # continuously deliver queued email
npm run lint     # run ESLint
npm test         # run the FlowCode test suite
```

### Database, email, and bulk users

Copy `.env.example` to `.env.local` and configure MySQL plus an SMTP account.
`EMAIL_QUEUE_SECRET` encrypts queued welcome, verification, and password-reset
messages, so it must remain stable and private. Port 465 normally uses
`SMTP_SECURE=true`; port 587 normally uses `SMTP_SECURE=false` and STARTTLS.

Public personal registration requires email verification and Cloudflare
Turnstile. Development falls back to Cloudflare's official test keys;
production requires real `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and
`TURNSTILE_SECRET_KEY` values.

Run `npm run email:worker` as a long-lived process to retry queued messages. As
an alternative, schedule `POST /api/cron/email-outbox` with the header
`Authorization: Bearer <CRON_SECRET>`. The outbox claims work transactionally
so concurrent processors do not select the same message.

Administrators and teachers can create users from a UTF-8 CSV with these
headers: `nombre, usuario, contraseña, correo, tipo_de_usuario, organizacion`.
The password may be empty. Every managed account must replace its initial or
server-generated password on first sign-in. Teachers can only create students
inside their own organization, and each organization has a maximum of 60
students. Contact `contacto@igfri.dev` to request a larger capacity.

Exercises created by a platform administrator belong to one global catalog and
are available to every organization without duplicated rows. Exercises created
by teachers belong only to the teacher's organization. Teachers may view the
global catalog but can only edit or delete their organization's exercises.

### Project Notes

- The app uses the Next.js App Router and client components for interactive
  editor behavior.
- The diagram editor is powered by React Flow.
- The parser/importer uses Babel parser utilities.
- Runtime support, validation, import, execution, and code generation live
  under `src/features/flow`.
- Exercises live under `src/features/exercises`.

---

## Español

FlowCode es un entorno educativo de programación visual para construir,
entender, importar, ejecutar y exportar programas con estilo de diagrama de
flujo. Está diseñado para estudiantes que necesitan ver cómo un programa avanza
por decisiones, ciclos, funciones, entradas, salidas, variables y valores de
retorno, sin perder la relación con JavaScript real.

El proyecto está construido con Next.js, React, React Flow, TypeScript y una
capa de ejecución segura para las expresiones tipo JavaScript usadas dentro del
diagrama.

### Para Qué Sirve FlowCode

FlowCode ayuda a:

- Construir algoritmos como diagramas antes de pasar directamente al código.
- Ejecutar paso a paso y ver el bloque activo, el recorrido visitado, las
  variables, las salidas y el historial de ejecución.
- Aprender cómo conceptos comunes de JavaScript se representan como flujo
  visual.
- Importar código JavaScript inicial y convertirlo en un diagrama.
- Generar JavaScript legible desde un diagrama.
- Practicar con ejercicios guiados.
- Experimentar con funciones y subflujos reutilizables.

Funciona mejor para algoritmos educativos, ejercicios de clase, depurar modelos
mentales y visualizar flujo de control. No está pensado para ejecutar
JavaScript arbitrario del navegador, DOM, red o sistema.

### Funciones Principales

- Editor visual de flujo con bloques movibles y puertos conectables.
- Bloques de Inicio, Fin, Proceso, Entrada, Salida, Decisión, Llamada a función
  y Retorno.
- Editor de funciones/subflujos con parámetros.
- Ejecución paso a paso y ejecución automática.
- Modales de entrada y parámetros durante la ejecución.
- Paneles de variables, salidas, validación e historial de ejecución.
- Panel para importar JavaScript soportado.
- Panel para generar JavaScript desde diagramas.
- Modo ejercicios con desafíos predefinidos.
- Modo fullscreen del diagrama con menús laterales para ejecución, funciones,
  validación, variables, salidas, historial y bloques.
- Minimapa con control para minimizar y expandir.
- Runtime seguro de expresiones con una lista blanca de helpers JavaScript.

### Resumen de la Interfaz

El espacio principal se organiza alrededor del lienzo del diagrama:

- **Modo ejercicios**: permite elegir un desafío y cargar su código o diagrama
  inicial.
- **Validación**: muestra problemas estructurales, conexiones bloqueadas e
  información de ciclos.
- **Funciones**: administra el flujo principal y las funciones reutilizables.
  Los nombres se editan con el botón de lápiz y los parámetros aparecen debajo
  de la función seleccionada.
- **Bloques**: inserta bloques visuales en el lienzo.
- **Lienzo del diagrama**: permite mover bloques, conectar puertos, editar texto,
  ver el minimapa y entrar en fullscreen.
- **Controles de ejecución**: paso, ejecución automática/pausa y reinicio.
- **Variables**: muestra las variables actuales del runtime.
- **Salidas**: muestra los valores producidos por los bloques de salida.
- **Historial**: muestra el recorrido ejecutado, con el paso más reciente
  primero.
- **Código JavaScript**: genera JavaScript desde el diagrama actual.
- **Importar JavaScript**: importa JavaScript soportado a diagramas FlowCode.

### Controles de Lienzo, Mouse y Teclado

- Arrastra un bloque para moverlo.
- Arrastra desde un handle/puerto de un bloque hacia otro para crear una
  conexión.
- Haz clic en un bloque para seleccionarlo y mostrar sus controles de puertos.
- Selecciona un bloque o una conexión y presiona **Backspace** para eliminarlo.
- Edita el texto de un bloque directamente en su contenido editable.
- Usa la rueda del mouse para hacer zoom.
- Usa gestos de pellizco para hacer zoom en dispositivos compatibles.
- Arrastra el espacio vacío del lienzo para desplazar la vista.
- Mantén **Space** mientras interactúas con el lienzo para usar el
  comportamiento configurado de activación de paneo.
- **Shift** queda reservado como modificador de selección por el motor del
  lienzo.
- Usa los controles inferiores izquierdos del lienzo para hacer zoom, ajustar el
  diagrama y usar los controles de interacción expuestos por React Flow.
- Usa el botón superior derecho para entrar o salir del fullscreen del diagrama.
- En fullscreen, acerca el cursor a los bordes izquierdo, derecho o inferior
  para revelar los botones de los menús ocultos.
- Usa el botón del minimapa para minimizarlo o expandirlo.
- Presiona **Escape** para cancelar los modales de confirmación de FlowCode.
- Al editar el nombre de una función, **Enter** o **Escape** cierra el input
  inline del nombre.

### Controles de Ejecución

FlowCode puede ejecutar un diagrama bloque por bloque o automáticamente:

- **Step/Paso** ejecuta el siguiente bloque.
- **Run/Ejecutar** inicia la ejecución automática.
- **Pause/Pausar** detiene la ejecución automática.
- **Reset/Reiniciar** reinicia la ejecución del diagrama activo.

Durante la ejecución se resaltan el nodo actual y la conexión activa. Si se
llega a un bloque de entrada, FlowCode abre un modal para pedir el valor. Si una
llamada a función requiere parámetros, FlowCode abre un modal de parámetros.
Las salidas, variables e historial se actualizan a medida que avanza la
ejecución.

### Bloques Soportados

- **Inicio**: punto de entrada de un diagrama.
- **Fin**: punto de término de un diagrama.
- **Proceso**: instrucciones textuales tipo JavaScript como declaraciones,
  asignaciones, llamadas a métodos y expresiones soportadas.
- **Entrada**: pide un valor al usuario y lo guarda en una variable.
- **Salida**: evalúa e imprime una expresión.
- **Decisión**: divide el flujo con condiciones de tipo sí/no.
- **Llamada a función**: llama a una función/subflujo reutilizable de FlowCode.
- **Retorno**: devuelve un valor desde una función/subflujo.

### Soporte de JavaScript y Expresiones

Los bloques de proceso y campos textuales equivalentes pasan por una capa
controlada de expresiones/runtime tipo JavaScript. La sintaxis soportada
incluye:

- Declaraciones y asignaciones de variables.
- Acceso a propiedades con `obj.prop` y acceso dinámico con `obj["prop"]`.
- Asignación de propiedades donde el runtime lo permite.
- Literales de arreglos y objetos.
- Valores string, number, boolean, null y undefined.
- Template literals.
- Expresiones aritméticas, comparaciones, lógicas, unarias, de actualización y
  condicionales.
- Llamadas a funciones permitidas por la lista blanca del runtime seguro.
- Callbacks inline para helpers de arreglos soportados.
- Funciones con parámetros y valores de retorno en rutas soportadas por el
  importador/runtime.
- Flujo de control como if/else, ciclos, switch, break, continue y return donde
  la arquitectura del parser/runtime lo soporta.

### Helpers Soportados

Matemáticas y números:

- `Math.abs`
- `Math.max`
- `Math.min`
- `Math.floor`
- `Math.ceil`
- `Math.round`
- `Math.trunc`
- `Math.random`
- `Math.pow`
- `Math.sqrt`
- `Math.sin`
- `Math.cos`
- `Math.tan`
- `Math.PI`

Strings/texto:

- `.length`
- `.toUpperCase()`
- `.toLowerCase()`
- `.trim()`
- `.includes(...)`
- `.startsWith(...)`
- `.endsWith(...)`
- `.slice(...)`
- `.substring(...)`
- `.replace(...)`
- `.split(...)`
- acceso por índice como `texto[0]`

Arrays/listas:

- `.length`
- `.push(...)`
- `.pop()`
- `.shift()`
- `.unshift(...)`
- `.includes(...)`
- `.indexOf(...)`
- `.slice(...)`
- `.join(...)`
- `.map(...)`
- `.filter(...)`
- `.find(...)`
- `.some(...)`
- `.every(...)`
- `.reduce(...)`
- `.sort(...)`

Objetos:

- `obj.prop`
- `obj["prop"]`
- asignación de propiedades
- `Object.keys(obj)`
- `Object.values(obj)`
- `Object.entries(obj)`

Caracteres y Unicode:

- `charAt(texto, indice)`
- `charToCode(caracter)`
- `codeToChar(numero)`
- `charCodeAt(texto, indice)`
- `codePointAt(texto, indice)`
- `fromCharCode(numero)`
- `fromCodePoint(numero)`

### Modelo de Seguridad

FlowCode ejecuta intencionalmente un subconjunto seguro en vez de JavaScript
arbitrario. Las APIs inseguras no soportadas incluyen:

- `eval`
- `Function`
- `window` libre
- `document` libre
- acceso al DOM
- `innerHTML`
- APIs que salten el modelo controlado del runtime

El runtime prioriza una ejecución educativa predecible, mensajes de validación
claros y compatibilidad con diagramas existentes.

### Ejercicios

El modo ejercicios ofrece desafíos guiados con título, dificultad, descripción,
objetivo, tags y, opcionalmente, código inicial o diagrama inicial. Al
seleccionar un ejercicio se puede cargar contenido inicial en el workspace. Si
el contenido actual sería reemplazado, FlowCode pide confirmación mediante un
modal dentro de la app.

### Desarrollo

Instala dependencias:

```bash
npm install
```

Ejecuta el servidor de desarrollo:

```bash
npm run dev
```

Abre:

```text
http://localhost:3000
```

Scripts disponibles:

```bash
npm run dev      # inicia el servidor local de desarrollo de Next.js
npm run build    # crea una build de producción
npm run start    # inicia el servidor de producción después de compilar
npm run email:worker # envía y reintenta los correos pendientes
npm run lint     # ejecuta ESLint
npm test         # ejecuta la suite de tests de FlowCode
```

### Base de datos, correo y usuarios masivos

Copia `.env.example` como `.env.local` y configura MySQL y una cuenta SMTP.
`EMAIL_QUEUE_SECRET` cifra el contenido sensible de los correos pendientes y
debe conservarse estable y privado. El puerto 465 normalmente usa
`SMTP_SECURE=true`; el 587 usa `SMTP_SECURE=false` con STARTTLS.

El registro personal público exige verificar el correo y completar Cloudflare
Turnstile. En desarrollo se usan las claves oficiales de prueba cuando no se
definen otras; producción exige valores reales en
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`.

Ejecuta `npm run email:worker` como proceso permanente para enviar y reintentar
la cola. Como alternativa, programa un `POST /api/cron/email-outbox` con la
cabecera `Authorization: Bearer <CRON_SECRET>`. No es necesario usar ambos.

Administradores y profesores pueden importar un CSV UTF-8 con las columnas
`nombre, usuario, contraseña, correo, tipo_de_usuario, organizacion`. Todos los
usuarios gestionados deben cambiar su contraseña inicial en el primer acceso.
Los profesores solo crean estudiantes de su organización y cada organización
admite hasta 60 estudiantes; para ampliar el límite se debe escribir a
`contacto@igfri.dev`.

Los ejercicios creados por un administrador de la plataforma pertenecen a un
único catálogo global y están disponibles para todas las organizaciones sin
duplicar registros. Los ejercicios creados por profesores pertenecen solamente
a la organización del profesor. Un profesor puede consultar el catálogo global,
pero solo puede editar o eliminar los ejercicios de su organización.

### Notas del Proyecto

- La app usa Next.js App Router y componentes de cliente para el comportamiento
  interactivo del editor.
- El editor de diagramas está construido sobre React Flow.
- El parser/importador usa utilidades de Babel parser.
- El runtime, validación, importación, ejecución y generación de código viven en
  `src/features/flow`.
- Los ejercicios viven en `src/features/exercises`.
