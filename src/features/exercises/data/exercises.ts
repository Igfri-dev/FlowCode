import type { Exercise } from "@/features/exercises/types";
import {
  translations,
  type Language,
  type TranslationKey,
} from "@/features/i18n/translations";

const exerciseTextKeys = {
  "count-1-to-5": {
    title: "exercise.count.title",
    description: "exercise.count.description",
    objective: "exercise.count.objective",
  },
  "even-number": {
    title: "exercise.even.title",
    description: "exercise.even.description",
    objective: "exercise.even.objective",
  },
  "sum-1-to-n": {
    title: "exercise.sum.title",
    description: "exercise.sum.description",
    objective: "exercise.sum.objective",
  },
  "positive-negative-zero": {
    title: "exercise.sign.title",
    description: "exercise.sign.description",
    objective: "exercise.sign.objective",
  },
  "multiplication-table": {
    title: "exercise.table.title",
    description: "exercise.table.description",
    objective: "exercise.table.objective",
  },
  "operation-menu": {
    title: "exercise.menu.title",
    description: "exercise.menu.description",
    objective: "exercise.menu.objective",
  },
  "access-attempts": {
    title: "exercise.access.title",
    description: "exercise.access.description",
    objective: "exercise.access.objective",
  },
  "normalize-user-profile": {
    title: "exercise.profile.title",
    description: "exercise.profile.description",
    objective: "exercise.profile.objective",
  },
  "shipping-quote": {
    title: "exercise.shipping.title",
    description: "exercise.shipping.description",
    objective: "exercise.shipping.objective",
  },
  "prime-number-function": {
    title: "exercise.prime.title",
    description: "exercise.prime.description",
    objective: "exercise.prime.objective",
  },
  "grade-report": {
    title: "exercise.grades.title",
    description: "exercise.grades.description",
    objective: "exercise.grades.objective",
  },
  "atm-with-validations": {
    title: "exercise.atm.title",
    description: "exercise.atm.description",
    objective: "exercise.atm.objective",
  },
} as const satisfies Record<
  string,
  {
    title: TranslationKey;
    description: TranslationKey;
    objective: TranslationKey;
  }
>;

const englishTags: Record<string, string> = {
  acumulador: "accumulator",
  arreglos: "arrays",
  booleano: "boolean",
  ciclo: "loop",
  comparaciones: "comparisons",
  entrada: "input",
  for: "for",
  funciones: "functions",
  if: "if",
  Math: "Math",
  metodos: "methods",
  modulo: "modulo",
  objetos: "objects",
  operadores: "operators",
  "optional chaining": "optional chaining",
  salida: "output",
  switch: "switch",
  template: "template",
  ternario: "ternary",
  texto: "text",
  validacion: "validation",
  variables: "variables",
  "do while": "do while",
  break: "break",
  return: "return",
};

const localizedStarterCode: Partial<Record<Language, Record<string, string>>> = {
  en: {
    "count-1-to-5": `let i = 1;
while (i <= 5) {
  console.log(i);
  i++;
}`,
    "even-number": `let number = 8;
if (number % 2 === 0) {
  console.log("The number is even");
} else {
  console.log("The number is odd");
}`,
    "sum-1-to-n": `let n = 5;
let sum = 0;
let i = 1;
while (i <= n) {
  sum = sum + i;
  i++;
}
console.log("The sum is " + sum);`,
    "positive-negative-zero": `async function leerEntrada(mensaje, tipo = "text") {
  const valor = prompt(mensaje);
  if (tipo === "number") return Number(valor);
  if (tipo === "boolean") return valor === "true" || valor === "yes";
  return valor ?? "";
}

async function main() {
  let number = await leerEntrada("Enter a number", "number");
  if (number > 0) {
    console.log("Positive");
  } else {
    if (number < 0) {
      console.log("Negative");
    } else {
      console.log("Zero");
    }
  }
}

main();`,
    "multiplication-table": `let number = 7;
for (let i = 1; i <= 10; i++) {
  console.log(\`\${number} x \${i} = \${number * i}\`);
}`,
    "operation-menu": `let operation = "multiply";
let a = 12;
let b = 4;

switch (operation) {
  case "add":
    console.log(a + b);
    break;
  case "subtract":
    console.log(a - b);
    break;
  case "multiply":
    console.log(a * b);
    break;
  case "divide":
    console.log(a / b);
    break;
  default:
    console.log("Invalid operation");
}`,
    "access-attempts": `let attempt = 1;
let password = "1234";
let enteredPassword = "0000";
let access = false;

do {
  if (enteredPassword === password) {
    access = true;
    console.log("Access granted");
  } else {
    console.log("Attempt " + attempt + " failed");
    enteredPassword = attempt === 2 ? "1234" : "1111";
  }
  attempt++;
} while (!access && attempt <= 3);

if (!access) {
  console.log("Account locked");
}`,
    "normalize-user-profile": `let user = {
  name: "  Ana ",
  profile: {
    level: "admin",
  },
};

let cleanName = user.name.trim();
let level = user.profile?.level ?? "guest";
console.log("User " + cleanName + " - " + level.toUpperCase());`,
    "shipping-quote": `function calculateShipping(kilos, zone) {
  let base = Math.ceil(kilos) * 1200;

  switch (zone) {
    case "north":
      return base + 3500;
    case "south":
      return base + 2500;
    case "center":
      return base + 1500;
    default:
      return base + 5000;
  }
}

let order = {
  subtotal: 42000,
  kilos: 3.4,
  zone: "south",
  coupon: 0.15,
};

let shipping = calculateShipping(order.kilos, order.zone);
let discount = order.subtotal * order.coupon;
let total = order.subtotal + shipping - discount;
console.log("Total: " + Math.round(total));`,
    "prime-number-function": `function isPrime(number) {
  if (number < 2) {
    return false;
  }

  for (let divisor = 2; divisor * divisor <= number; divisor++) {
    if (number % divisor === 0) {
      return false;
    }
  }

  return true;
}

let number = 29;
let prime = isPrime(number);

if (prime) {
  console.log(number + " is prime");
} else {
  console.log(number + " is not prime");
}`,
    "grade-report": `function calculateAverage(grades) {
  let sum = 0;

  for (let i = 0; i < grades.length; i++) {
    sum += grades[i];
  }

  return sum / grades.length;
}

function classifyAverage(average) {
  if (average >= 6) {
    return "excellent";
  }

  if (average >= 4) {
    return "passing";
  }

  return "risk";
}

let grades = [5, 6, 4, 7];
let average = calculateAverage(grades);
let category = classifyAverage(average);

switch (category) {
  case "excellent":
    console.log("Average " + average + ": congratulate");
    break;
  case "passing":
    console.log("Average " + average + ": reinforce");
    break;
  default:
    console.log("Average " + average + ": support plan");
}`,
    "atm-with-validations": `function validateWithdrawal(balance, amount) {
  if (amount <= 0) {
    return "invalid amount";
  }

  if (amount > balance) {
    return "insufficient balance";
  }

  if (amount % 1000 !== 0) {
    return "invalid multiple";
  }

  return "approved";
}

let balance = 50000;
let amount = 18000;
let status = validateWithdrawal(balance, amount);

switch (status) {
  case "approved":
    balance -= amount;
    console.log("Withdrawal approved. Balance: " + balance);
    break;
  case "insufficient balance":
    console.log("Available balance is not enough");
    break;
  case "invalid multiple":
    console.log("The amount must be a multiple of 1000");
    break;
  default:
    console.log("Invalid amount");
}`,
  },
};

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
] satisfies Exercise[];

export function getExercises(language: Language = "es"): Exercise[] {
  const textSet = translations[language];

  return exercises.map((exercise) => {
    const textKeys =
      exerciseTextKeys[exercise.id as keyof typeof exerciseTextKeys];

    if (!textKeys) {
      return exercise;
    }

    return {
      ...exercise,
      title: textSet[textKeys.title],
      description: textSet[textKeys.description],
      objective: textSet[textKeys.objective],
      starterCode:
        localizedStarterCode[language]?.[exercise.id] ?? exercise.starterCode,
      tags:
        language === "en"
          ? exercise.tags?.map((tag) => englishTags[tag] ?? tag)
          : exercise.tags,
    };
  });
}
