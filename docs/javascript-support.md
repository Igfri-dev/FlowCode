# Soporte JavaScript de FlowCode

FlowCode no es un ejecutor de JavaScript arbitrario. El soporte actual esta
orientado a algoritmos educativos que se pueden representar como diagramas de
flujo ejecutables y revisar visualmente.

El panel de validacion distingue errores, que deben corregirse, de advertencias,
que señalan riesgos o recomendaciones sin bloquear necesariamente el trabajo.

## Soportado

### Declaraciones y asignaciones

```js
let total = 0;
total = total + 1;
const nombre = "Ada";
```

Se importan como bloques Proceso y se ejecutan dentro del runtime seguro.

### Condicionales if/else

```js
if (edad >= 18) {
  console.log("mayor");
} else {
  console.log("menor");
}
```

Se importan como nodos Decision con ramas Si/No.

### Ciclos while, for y do while

```js
while (!listo) {
  listo = true;
}

for (let i = 0; i < 3; i++) {
  console.log(i);
}

do {
  intento++;
} while (intento < 2);
```

Los ciclos validos pueden tener conexiones hacia atras. La validacion no bloquea
loops usados para representar `while`, `for` o `do while`.

### switch

```js
switch (operacion) {
  case "sumar":
    console.log("suma");
    break;
  default:
    console.log("otro");
}
```

Se importa como una cadena de decisiones con metadatos de `switch` cuando el
parser puede conservar la estructura.

### Funciones y llamadas

```js
function cuadrado(n) {
  let resultado = n * n;
  return resultado;
}

let valor = cuadrado(5);
```

Las funciones se modelan como subflujos. Las llamadas desde `main` usan nodos
Function Call. Si una llamada guarda el resultado, la funcion debe tener un
camino claro hacia Retorno.

### Input con leerEntrada

```js
let edad = leerEntrada("Edad", "number");
```

`leerEntrada(mensaje, tipo)` se importa como bloque Entrada. Tipos usados por la
UI: `text`, `number`, `boolean`.

### Output con console.log

```js
console.log(total);
console.log("resultado");
```

Se importa como bloque Salida.

### Arrays y callbacks probados

```js
let dobles = numeros.map(x => x * 2);
let pares = numeros.filter(x => x % 2 === 0);
let total = numeros.reduce((suma, x) => suma + x, 0);
```

Tambien hay cobertura de runtime para metodos como `find`, `some`, `every`,
`sort`, `push`, `pop`, `shift`, `unshift`, `includes`, `indexOf`, `slice` y
`join`.

### Objetos

```js
let usuario = { nombre: "Ada", nivel: "admin" };
usuario.activo = true;
let nombre = usuario.nombre;
let claves = Object.keys(usuario);
```

Se soportan objetos literales, acceso por propiedad, acceso dinamico basico,
asignacion de propiedades y helpers seguros de `Object` probados en runtime.

## Parcialmente soportado

- Inferencia de `for` desde diagramas: el generador puede convertir algunos
  patrones `while` con inicializacion y actualizacion claras en `for`.
- `switch`: soportado para casos representables como decisiones encadenadas; no
  todos los patrones avanzados de fallthrough estan garantizados.
- Funciones: soportadas como subflujos sin closures avanzados ni imports.
- Expresiones: se aceptan expresiones comunes que el runtime seguro reconoce.
  Las expresiones validas para Babel pueden fallar si usan APIs no permitidas.
- Objetos y arrays: pensados para datos locales y transformaciones educativas,
  no para prototipos personalizados ni metaprogramacion.

## No soportado

- Clases.
- Modulos `import`/`export`.
- `try/catch/finally`.
- `throw`.
- `for...of`, `for...in` y `for await`.
- Generadores.
- `async` real de red o concurrencia externa.
- Desestructuracion avanzada si no puede representarse como proceso simple.
- DOM, eventos del navegador o manipulacion visual desde el codigo importado.

## Bloqueado por seguridad

Estas APIs no deben agregarse al runtime educativo:

```js
eval("1 + 1");
Function("return 1")();
window.document;
document.querySelector("body");
fetch("/api");
setTimeout(() => console.log("x"), 100);
```

FlowCode bloquea o evita APIs de ejecucion dinamica y navegador como `eval`,
`Function`, `window`, `document`, DOM, `fetch`, timers e imports externos. El
objetivo es mantener un entorno seguro, determinista y facil de explicar.
