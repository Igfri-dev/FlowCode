import type { FlowNodeType } from "@/types/flow";

export type FlowStabilityFixture = {
  id: string;
  name: string;
  code: string;
  expectations: {
    codeIncludes?: string[];
    errorIncludes?: string;
    importOk: boolean;
    minEdges?: number;
    minNodes?: number;
    nodeTypes?: FlowNodeType[];
  };
};

export const flowStabilityFixtures: FlowStabilityFixture[] = [
  {
    id: "linear-sequence",
    name: "Secuencia lineal simple",
    code: `
let total = 0;
total = total + 1;
console.log(total);
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 5,
      nodeTypes: ["start", "process", "output", "end"],
      codeIncludes: ["let total = 0;", "total = total + 1;", "console.log(total);"],
    },
  },
  {
    id: "if-simple",
    name: "If simple",
    code: `
let edad = 18;
if (edad >= 18) {
  console.log("mayor");
}
console.log("fin");
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 6,
      nodeTypes: ["start", "process", "decision", "output", "end"],
      codeIncludes: ['if (edad >= 18) {', 'console.log("mayor");'],
    },
  },
  {
    id: "if-else",
    name: "If/else",
    code: `
let puntaje = 62;
if (puntaje >= 60) {
  console.log("aprobado");
} else {
  console.log("revisar");
}
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 5,
      nodeTypes: ["start", "process", "decision", "output", "end"],
      codeIncludes: ["if (puntaje >= 60) {", "} else {"],
    },
  },
  {
    id: "while-loop",
    name: "While",
    code: `
let listo = false;
while (!listo) {
  console.log("iterar");
  listo = true;
}
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 6,
      nodeTypes: ["start", "process", "decision", "output", "end"],
      codeIncludes: ["while (!listo) {", "listo = true;"],
    },
  },
  {
    id: "for-loop",
    name: "For",
    code: `
for (let i = 0; i < 3; i++) {
  console.log(i);
}
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 5,
      nodeTypes: ["start", "process", "decision", "output", "end"],
      codeIncludes: ["for (let i = 0; i < 3; i++) {"],
    },
  },
  {
    id: "do-while-loop",
    name: "Do while",
    code: `
let intento = 0;
do {
  intento++;
  console.log(intento);
} while (intento < 2);
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 6,
      nodeTypes: ["start", "process", "decision", "output", "end"],
      codeIncludes: ["do {", "} while (intento < 2);"],
    },
  },
  {
    id: "switch-branches",
    name: "Switch",
    code: `
let operacion = "sumar";
switch (operacion) {
  case "sumar":
    console.log("suma");
    break;
  case "restar":
    console.log("resta");
    break;
  default:
    console.log("otro");
}
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 8,
      nodeTypes: ["start", "process", "decision", "output", "end"],
      codeIncludes: ["switch (operacion) {", 'case "sumar":', "default:"],
    },
  },
  {
    id: "function-return",
    name: "Funcion con return",
    code: `
function doble(x) {
  return x * 2;
}

let resultado = doble(4);
console.log(resultado);
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 5,
      nodeTypes: ["start", "process", "functionCall", "output", "return", "end"],
      codeIncludes: ["function doble(x) {", "return x * 2;", "doble(4);"],
    },
  },
  {
    id: "function-call-main",
    name: "Llamada a funcion desde main",
    code: `
function cuadrado(n) {
  let resultado = n * n;
  return resultado;
}

let valor = cuadrado(5);
console.log(valor);
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 5,
      nodeTypes: ["start", "process", "functionCall", "output", "return", "end"],
      codeIncludes: [
        "function cuadrado(n) {",
        "let valor;",
        "valor = await cuadrado(5);",
      ],
    },
  },
  {
    id: "arrays-callbacks",
    name: "Arrays con map/filter/reduce",
    code: `
let numeros = [1, 2, 3, 4];
let dobles = numeros.map(x => x * 2);
let pares = numeros.filter(x => x % 2 === 0);
let total = numeros.reduce((suma, x) => suma + x, 0);
console.log(total);
    `.trim(),
    expectations: {
      importOk: true,
      minNodes: 7,
      nodeTypes: ["start", "process", "output", "end"],
      codeIncludes: [
        "numeros.map(x => x * 2);",
        "numeros.filter(x => x % 2 === 0);",
        "numeros.reduce((suma, x) => suma + x, 0);",
      ],
    },
  },
  {
    id: "invalid-unsupported",
    name: "Caso invalido esperado",
    code: `
try {
  console.log("no soportado");
} catch (error) {
  console.log(error);
}
    `.trim(),
    expectations: {
      importOk: false,
      errorIncludes: 'La instruccion "TryStatement" todavia no esta soportada',
    },
  },
];
