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
] satisfies Exercise[];

export function getExercises(): Exercise[] {
  return exercises;
}
