import type { Exercise } from "@/features/exercises/types";

const exercises = [
  {
    id: "count-1-to-5",
    title: "Contar del 1 al 5",
    description:
      "Practica una secuencia simple con una variable contador y un ciclo.",
    difficulty: "facil",
    objective:
      "Crea un flujo que muestre los numeros del 1 al 5, uno por uno.",
    starterCode: `let i = 1;
while (i <= 5) {
  console.log(i);
  i++;
}`,
    tags: ["variables", "ciclo", "salida"],
  },
  {
    id: "even-number",
    title: "Verificar si un numero es par",
    description:
      "Usa una decision para elegir entre dos salidas posibles.",
    difficulty: "facil",
    objective:
      "Pide o define un numero y muestra si es par o impar usando modulo.",
    starterCode: `let numero = 8;
if (numero % 2 === 0) {
  console.log("El numero es par");
} else {
  console.log("El numero es impar");
}`,
    tags: ["if", "modulo", "variables"],
  },
  {
    id: "sum-1-to-n",
    title: "Sumar numeros de 1 a N",
    description:
      "Combina acumuladores, ciclos y una condicion de repeticion.",
    difficulty: "media",
    objective:
      "Calcula la suma de todos los numeros desde 1 hasta N y muestra el resultado.",
    starterCode: `let n = 5;
let suma = 0;
let i = 1;
while (i <= n) {
  suma = suma + i;
  i++;
}
console.log("La suma es " + suma);`,
    tags: ["ciclo", "acumulador", "variables"],
  },
  {
    id: "positive-negative-zero",
    title: "Positivo, negativo o cero",
    description:
      "Clasifica un numero usando decisiones encadenadas.",
    difficulty: "media",
    objective:
      "Pide un numero y muestra si es positivo, negativo o cero.",
    starterCode: `async function leerEntrada(mensaje, tipo = "text") {
  const valor = prompt(mensaje);
  if (tipo === "number") return Number(valor);
  if (tipo === "boolean") return valor === "true" || valor === "si";
  return valor ?? "";
}

async function main() {
  let numero = await leerEntrada("Ingresa un numero", "number");
  if (numero > 0) {
    console.log("Positivo");
  } else {
    if (numero < 0) {
      console.log("Negativo");
    } else {
      console.log("Cero");
    }
  }
}

main();`,
    tags: ["entrada", "if", "comparaciones"],
  },
  {
    id: "multiplication-table",
    title: "Tabla de multiplicar",
    description:
      "Practica un ciclo for y salida con texto dinamico.",
    difficulty: "facil",
    objective:
      "Muestra la tabla de multiplicar de un numero desde 1 hasta 10.",
    starterCode: `let numero = 7;
for (let i = 1; i <= 10; i++) {
  console.log(\`\${numero} x \${i} = \${numero * i}\`);
}`,
    tags: ["for", "template", "salida"],
  },
  {
    id: "operation-menu",
    title: "Menu de operaciones",
    description:
      "Usa switch para seleccionar una operacion matematica.",
    difficulty: "media",
    objective:
      "Segun el texto de operacion, calcula suma, resta, multiplicacion o division.",
    starterCode: `let operacion = "multiplicar";
let a = 12;
let b = 4;

switch (operacion) {
  case "sumar":
    console.log(a + b);
    break;
  case "restar":
    console.log(a - b);
    break;
  case "multiplicar":
    console.log(a * b);
    break;
  case "dividir":
    console.log(a / b);
    break;
  default:
    console.log("Operacion no valida");
}`,
    tags: ["switch", "break", "operadores"],
  },
  {
    id: "access-attempts",
    title: "Intentos de acceso",
    description:
      "Modela una validacion que se ejecuta al menos una vez.",
    difficulty: "media",
    objective:
      "Simula hasta tres intentos de clave y detente cuando el acceso sea correcto.",
    starterCode: `let intento = 1;
let clave = "1234";
let claveIngresada = "0000";
let acceso = false;

do {
  if (claveIngresada === clave) {
    acceso = true;
    console.log("Acceso permitido");
  } else {
    console.log("Intento " + intento + " fallido");
    claveIngresada = intento === 2 ? "1234" : "1111";
  }
  intento++;
} while (!acceso && intento <= 3);

if (!acceso) {
  console.log("Cuenta bloqueada");
}`,
    tags: ["do while", "booleano", "ternario"],
  },
  {
    id: "normalize-user-profile",
    title: "Normalizar perfil de usuario",
    description:
      "Combina objetos, metodos seguros de texto y acceso opcional.",
    difficulty: "media",
    objective:
      "Limpia el nombre de un usuario y muestra su nivel en mayusculas.",
    starterCode: `let usuario = {
  nombre: "  Ana ",
  perfil: {
    nivel: "admin",
  },
};

let nombreLimpio = usuario.nombre.trim();
let nivel = usuario.perfil?.nivel ?? "invitado";
console.log("Usuario " + nombreLimpio + " - " + nivel.toUpperCase());`,
    tags: ["objetos", "optional chaining", "texto"],
  },
  {
    id: "shipping-quote",
    title: "Cotizacion de envio",
    description:
      "Calcula un total usando una funcion auxiliar, switch y Math.",
    difficulty: "media",
    objective:
      "Calcula envio, descuento y total final para un pedido.",
    starterCode: `function calcularEnvio(kilos, zona) {
  let base = Math.ceil(kilos) * 1200;

  switch (zona) {
    case "norte":
      return base + 3500;
    case "sur":
      return base + 2500;
    case "centro":
      return base + 1500;
    default:
      return base + 5000;
  }
}

let pedido = {
  subtotal: 42000,
  kilos: 3.4,
  zona: "sur",
  cupon: 0.15,
};

let envio = calcularEnvio(pedido.kilos, pedido.zona);
let descuento = pedido.subtotal * pedido.cupon;
let total = pedido.subtotal + envio - descuento;
console.log("Total: " + Math.round(total));`,
    tags: ["funciones", "switch", "Math"],
  },
  {
    id: "prime-number-function",
    title: "Numero primo con funcion",
    description:
      "Encapsula una validacion numerica en una funcion reutilizable.",
    difficulty: "dificil",
    objective:
      "Determina si un numero es primo usando una funcion, un for y retornos tempranos.",
    starterCode: `function esPrimo(numero) {
  if (numero < 2) {
    return false;
  }

  for (let divisor = 2; divisor * divisor <= numero; divisor++) {
    if (numero % divisor === 0) {
      return false;
    }
  }

  return true;
}

let numero = 29;
let primo = esPrimo(numero);

if (primo) {
  console.log(numero + " es primo");
} else {
  console.log(numero + " no es primo");
}`,
    tags: ["funciones", "for", "return"],
  },
  {
    id: "grade-report",
    title: "Reporte de notas",
    description:
      "Procesa un arreglo con funciones y clasifica el resultado con switch.",
    difficulty: "dificil",
    objective:
      "Calcula el promedio de notas, clasificalo y muestra una recomendacion.",
    starterCode: `function calcularPromedio(notas) {
  let suma = 0;

  for (let i = 0; i < notas.length; i++) {
    suma += notas[i];
  }

  return suma / notas.length;
}

function clasificarPromedio(promedio) {
  if (promedio >= 6) {
    return "excelente";
  }

  if (promedio >= 4) {
    return "aprueba";
  }

  return "riesgo";
}

let notas = [5, 6, 4, 7];
let promedio = calcularPromedio(notas);
let categoria = clasificarPromedio(promedio);

switch (categoria) {
  case "excelente":
    console.log("Promedio " + promedio + ": felicitar");
    break;
  case "aprueba":
    console.log("Promedio " + promedio + ": reforzar");
    break;
  default:
    console.log("Promedio " + promedio + ": plan de apoyo");
}`,
    tags: ["arreglos", "funciones", "switch"],
  },
  {
    id: "atm-with-validations",
    title: "Cajero con validaciones",
    description:
      "Combina reglas de negocio, funcion auxiliar, modulo y switch.",
    difficulty: "dificil",
    objective:
      "Valida un retiro, actualiza el saldo solo si corresponde y muestra el resultado.",
    starterCode: `function validarRetiro(saldo, monto) {
  if (monto <= 0) {
    return "monto invalido";
  }

  if (monto > saldo) {
    return "saldo insuficiente";
  }

  if (monto % 1000 !== 0) {
    return "multiplo invalido";
  }

  return "aprobado";
}

let saldo = 50000;
let monto = 18000;
let estado = validarRetiro(saldo, monto);

switch (estado) {
  case "aprobado":
    saldo -= monto;
    console.log("Retiro aprobado. Saldo: " + saldo);
    break;
  case "saldo insuficiente":
    console.log("No alcanza el saldo disponible");
    break;
  case "multiplo invalido":
    console.log("El monto debe ser multiplo de 1000");
    break;
  default:
    console.log("Monto invalido");
}`,
    tags: ["funciones", "validacion", "switch"],
  },
  {
    id: "geometry-lab",
    title: "Laboratorio de geometria",
    description:
      "Aplica varias funciones Math para calcular medidas derivadas.",
    difficulty: "media",
    objective:
      "Calcula area, perimetro, diagonal y redondeos usando constantes y funciones Math.",
    starterCode: `let radio = 4.5;
let ancho = 8;
let alto = 6;

let areaCirculo = Math.PI * Math.pow(radio, 2);
let perimetro = 2 * Math.PI * radio;
let diagonal = Math.sqrt(Math.pow(ancho, 2) + Math.pow(alto, 2));
let areaRedondeada = Math.round(areaCirculo);
let perimetroEntero = Math.trunc(perimetro);
let altoTecho = Math.ceil(alto / 4);
let anchoPiso = Math.floor(ancho / 3);

console.log("Area: " + areaRedondeada);
console.log("Perimetro entero: " + perimetroEntero);
console.log("Diagonal: " + diagonal);
console.log("Partes: " + altoTecho + " x " + anchoPiso);`,
    tags: ["Math", "geometria", "numeros"],
  },
  {
    id: "text-tag-cleaner",
    title: "Limpiador de etiquetas",
    description:
      "Normaliza texto usando metodos de string y transformaciones de arreglo.",
    difficulty: "media",
    objective:
      "Convierte una lista de etiquetas en texto limpio, filtrado y ordenado.",
    starterCode: `let entrada = "  JS, flujo, Datos, javascript, codigo  ";
let etiquetas = entrada
  .trim()
  .toLowerCase()
  .replace("javascript", "js")
  .split(",")
  .map(texto => texto.trim())
  .filter(texto => texto.length > 0);

let relevantes = etiquetas.filter(texto => texto.includes("j") || texto.startsWith("d"));
let resumen = relevantes.sort().join(" | ");
let primera = resumen.slice(0, 2);

console.log("Etiquetas: " + resumen);
console.log("Primer fragmento: " + primera);`,
    tags: ["texto", "arreglos", "callbacks"],
  },
  {
    id: "inventory-objects",
    title: "Inventario con objetos",
    description:
      "Combina objetos, Object.keys/values/entries y metodos de arreglo.",
    difficulty: "dificil",
    objective:
      "Calcula totales de stock, detecta productos bajos y arma un reporte ordenado.",
    starterCode: `let inventario = {
  lapices: 12,
  cuadernos: 4,
  mochilas: 2,
};

inventario.reglas = 7;
inventario["gomas"] = 3;

let nombres = Object.keys(inventario);
let cantidades = Object.values(inventario);
let entradas = Object.entries(inventario);
let total = cantidades.reduce((suma, cantidad) => suma + cantidad, 0);
let bajos = entradas
  .filter(item => item[1] <= 4)
  .map(item => item[0])
  .sort();

console.log("Productos: " + nombres.join(", "));
console.log("Total: " + total);
console.log("Stock bajo: " + bajos.join(" / "));`,
    tags: ["objetos", "Object", "reduce"],
  },
  {
    id: "unicode-message",
    title: "Mensaje Unicode",
    description:
      "Explora conversiones entre caracteres y codigos Unicode.",
    difficulty: "media",
    objective:
      "Lee caracteres, transforma codigos y valida si un texto termina con un simbolo.",
    starterCode: `let mensaje = "Hola 😀";
let primeraLetra = charAt(mensaje, 0);
let codigoH = charToCode(primeraLetra);
let emojiCodigo = codePointAt(mensaje, 5);
let emoji = fromCodePoint(emojiCodigo);
let letraA = codeToChar(65);
let letraB = fromCharCode(66);
let terminaConEmoji = mensaje.endsWith(emoji);

console.log("Primera letra: " + primeraLetra + " = " + codigoH);
console.log("Emoji: " + emoji + " = " + emojiCodigo);
console.log("Letras: " + letraA + letraB);
console.log("Termina con emoji: " + terminaConEmoji);`,
    tags: ["unicode", "caracteres", "texto"],
  },
  {
    id: "survey-scoreboard",
    title: "Ranking de encuesta",
    description:
      "Usa callbacks de arreglos para transformar, filtrar y resumir datos.",
    difficulty: "dificil",
    objective:
      "Procesa respuestas numericas, calcula estadisticas y encuentra valores destacados.",
    starterCode: `let respuestas = [5, 3, 4, 1, 5, 2, 4];
let ajustadas = respuestas.map(valor => Math.max(1, Math.min(5, valor + 1)));
let aprobadas = ajustadas.filter(valor => valor >= 4);
let primeraAlta = ajustadas.find(valor => valor === 5);
let hayBaja = ajustadas.some(valor => valor <= 2);
let todasValidas = ajustadas.every(valor => valor >= 1 && valor <= 5);
let total = ajustadas.reduce((suma, valor) => suma + valor, 0);
let promedio = Math.round(total / ajustadas.length);
let ranking = ajustadas.slice().sort((a, b) => b - a);

console.log("Ajustadas: " + ajustadas.join(", "));
console.log("Aprobadas: " + aprobadas.length);
console.log("Primera alta: " + primeraAlta);
console.log("Hay baja: " + hayBaja);
console.log("Todas validas: " + todasValidas);
console.log("Promedio: " + promedio);
console.log("Ranking: " + ranking.join(" > "));`,
    tags: ["arreglos", "callbacks", "Math"],
  },
] satisfies Exercise[];

export function getExercises(): Exercise[] {
  return exercises;
}
