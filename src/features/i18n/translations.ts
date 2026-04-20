export const supportedLanguages = ["es", "en"] as const;

export type Language = (typeof supportedLanguages)[number];

const es = {
  "app.subtitle": "Editor visual de algoritmos",
  "language.label": "Idioma",
  "language.toggle": "Cambiar idioma",
  "language.es": "ES",
  "language.en": "EN",
  "exercise.mode": "Modo ejercicios",
  "exercise.modeHelp": "Elige un desafio para cargar su codigo inicial.",
  "exercise.select": "Selecciona un ejercicio",
  "exercise.active": "Activo",
  "exercise.objective": "Objetivo:",
  "exercise.empty": "Selecciona un ejercicio para ver las instrucciones.",
  "difficulty.facil": "Facil",
  "difficulty.media": "Media",
  "difficulty.dificil": "Dificil",
  "flow.validation": "Validacion",
  "flow.validationOk": "El diagrama no tiene problemas estructurales.",
  "validation.startCountMissing": "Debe existir exactamente un bloque Inicio.",
  "validation.startCountMultiple":
    "Debe existir exactamente un bloque Inicio; hay {count}.",
  "flow.connectionBlocked": "Conexion bloqueada:",
  "flow.loopDetected":
    "Se detecto un bucle. Esto es valido y puede usarse para representar ciclos.",
  "flow.functions": "Funciones",
  "flow.function": "Funcion",
  "flow.defaultFunctionPrefix": "funcion",
  "flow.functionsHelp": "Edita el flujo principal o un subflujo reutilizable.",
  "flow.main": "Principal",
  "flow.unnamed": "sin nombre",
  "flow.parameters": "Parametros",
  "flow.newFunction": "Nueva funcion",
  "flow.editFunctionName": "Editar nombre",
  "flow.editFunctionNameAria": "Editar nombre de {name}",
  "flow.deleteFunction": "Eliminar funcion",
  "flow.deleteFunctionAria": "Eliminar funcion {name}",
  "flow.blocks": "Bloques",
  "flow.blocksHelp": "Inserta bloques en el lienzo.",
  "flow.addStart": "Agregar Inicio",
  "flow.addEnd": "Agregar Fin",
  "flow.addProcess": "Agregar Proceso",
  "flow.addInput": "Agregar Entrada",
  "flow.addOutput": "Agregar Salida",
  "flow.addDecision": "Agregar Decision",
  "flow.addFunctionCall": "Agregar Llamada a funcion",
  "flow.addReturn": "Agregar Retorno",
  "flow.start": "Inicio",
  "flow.end": "Fin",
  "flow.process": "Proceso",
  "flow.input": "Entrada",
  "flow.output": "Salida",
  "flow.decision": "Decision",
  "flow.functionCall": "Llamada",
  "flow.return": "Retorno",
  "flow.yes": "Si",
  "flow.no": "No",
  "flow.inPort": "Entrada",
  "flow.outPort": "Salida",
  "flow.ports": "Puertos",
  "flow.top": "Arriba",
  "flow.right": "Derecha",
  "flow.bottom": "Abajo",
  "flow.left": "Izquierda",
  "flow.text": "Texto",
  "flow.number": "Numero",
  "flow.boolean": "Booleano",
  "flow.variablePlaceholder": "variable",
  "flow.resultPlaceholder": "resultado",
  "flow.saveReturnPlaceholder": "guardar en...",
  "flow.selectFunction": "Selecciona funcion",
  "flow.expression": "Expresion",
  "flow.literalText": "Texto literal",
  "flow.inputPromptFallback": "Ingresa un valor",
  "flow.inputVariableFallback": "valor",
  "flow.outputFallback": "\"Hola\"",
  "flow.returnFallback": "resultado",
  "flow.callFunctionFallback": "Llamar funcion",
  "flow.callFunctionHistory": "llamar funcion",
  "flow.returnValueFallback": "Retornar valor",
  "flow.diagram": "Diagrama:",
  "flow.diagramHelp": "Agrega bloques desde la barra lateral",
  "flow.blockCount": "{count} bloques",
  "flow.export": "Exportar",
  "flow.importJson": "Importar JSON",
  "flow.importJsonAria": "Archivo JSON del diagrama",
  "flow.exportDialogTitle": "Exportar diagrama",
  "flow.exportDialogHelp":
    "Elige los archivos que quieres descargar desde el diagrama actual.",
  "flow.closeExportDialog": "Cerrar exportacion",
  "flow.exportAsImage": "Imagen del diagrama",
  "flow.exportAsImageHelp":
    "Descarga una captura ajustada a los bloques visibles del lienzo.",
  "flow.exportImageFormat": "Formato de imagen",
  "flow.exportJavaScript": "Archivo JavaScript",
  "flow.exportJavaScriptHelp":
    "Guarda el codigo generado desde el flujo principal y sus funciones.",
  "flow.exportJson": "Archivo JSON del editor",
  "flow.exportJsonHelp":
    "Incluye bloques, posiciones, puertos, conexiones, funciones y codigo.",
  "flow.exportConfirm": "Exportar",
  "flow.exporting": "Exportando...",
  "flow.exportImageError":
    "No se pudo exportar la imagen del diagrama.",
  "flow.exportNoDiagram": "Agrega bloques antes de exportar una imagen.",
  "flow.importJsonSuccess":
    "Diagrama importado desde JSON. Codigo cargado en el importador.",
  "flow.importJsonInvalid": "El archivo JSON no tiene un diagrama valido.",
  "flow.importJsonReadError": "No se pudo leer el archivo JSON.",
  "flow.clear": "Limpiar",
  "flow.clearDialogTitle": "Limpiar {name}",
  "flow.clearDialogMessage":
    "Se eliminaran todos los bloques y conexiones de este diagrama.",
  "flow.replaceDialogTitle": "Reemplazar espacio de trabajo",
  "flow.replaceDialogMessage":
    "Seleccionar este ejercicio reemplazara contenido actual del espacio de trabajo.",
  "flow.replace": "Reemplazar",
  "flow.cancel": "Cancelar",
  "flow.outputs": "Salidas",
  "flow.outputsEmpty": "Las salidas apareceran durante la ejecucion.",
  "flow.variables": "Variables",
  "flow.variablesEmpty": "Sin variables todavia.",
  "flow.history": "Historial",
  "flow.historyRecent": "Reciente primero",
  "flow.historyEmpty": "Ejecuta un paso para ver el recorrido.",
  "flow.latest": "Ultimo",
  "flow.branch": "Rama {label}",
  "flow.step": "Paso {step}",
  "flow.stepOf": "Paso {step} de {max}",
  "flow.stepAction": "Ejecutar paso",
  "flow.run": "Ejecutar automatico",
  "flow.pause": "Pausar",
  "flow.reset": "Reiniciar",
  "flow.executionControls": "Controles de ejecucion",
  "flow.fullscreen": "Pantalla completa",
  "flow.exitFullscreen": "Salir pantalla completa",
  "flow.diagramControls": "Controles del diagrama",
  "flow.showMiniMap": "Mostrar minimapa",
  "flow.hideMiniMap": "Minimizar minimapa",
  "flow.miniMap": "Mini mapa del diagrama",
  "flow.showPanel": "Mostrar {label}",
  "flow.hidePanel": "Ocultar {label}",
  "flow.executionPanel": "ejecucion",
  "flow.functionsPanel": "funciones",
  "flow.validationPanel": "validacion",
  "flow.variablesPanel": "variables",
  "flow.outputsPanel": "salidas",
  "flow.historyPanel": "historial",
  "flow.blocksPanel": "bloques",
  "flow.codeTitle": "Codigo JavaScript",
  "flow.codeHelp": "Genera una version legible del diagrama actual.",
  "flow.generateCode": "Generar codigo",
  "flow.codePlaceholder":
    "// Presiona \"Generar codigo\" para ver el programa.",
  "flow.warnings": "Avisos",
  "flow.importTitle": "Importar codigo JavaScript",
  "flow.importHelp":
    "Usa variables, funciones, if/else, ciclos, switch y expresiones comunes.",
  "flow.importButton": "Generar diagrama",
  "flow.importAria": "Codigo JavaScript para importar",
  "flow.importLoaded": "Codigo inicial del ejercicio cargado en el importador.",
  "flow.importGeneratedWithFunctions":
    "Diagrama y funciones generados desde el codigo JavaScript.",
  "flow.importGenerated": "Diagrama generado desde el codigo JavaScript.",
  "modal.inputTitle": "Entrada requerida",
  "modal.inputSavedIn": "Se guardara en:",
  "modal.confirm": "Confirmar",
  "modal.validNumber": "Ingresa un numero valido.",
  "modal.validText": "Ingresa un texto.",
  "modal.parametersTitle": "Parametros requeridos",
  "modal.parametersFor": "Ingresa los valores para ejecutar {name}.",
  "modal.parametersHelp":
    "Puedes usar numeros, booleanos, texto, arreglos u objetos.",
  "modal.defaultValue": "defecto:",
  "modal.runFunction": "Ejecutar funcion",
  "modal.restPlaceholder": "[1, 2, 3]",
  "modal.defaultPlaceholder": "Deja vacio para usar el valor por defecto",
  "modal.valuePlaceholder": "5, true o \"texto\"",
  "modal.valueRequired": "Ingresa un valor para \"{name}\".",
  "modal.parameterError": "Parametro \"{name}\": {message}",
  "modal.restArray":
    "Parametro \"{name}\": ingresa un arreglo como [1, 2, 3].",
  "modal.parseValueError":
    "no se pudo interpretar el valor. Usa comillas para texto literal o una expresion valida.",
  "node.startTextAria": "Texto del bloque de inicio",
  "node.endTextAria": "Texto del bloque de fin",
  "node.processInstructionAria": "Instruccion del bloque de proceso",
  "node.decisionConditionAria": "Condicion del bloque de decision",
  "node.inputPromptAria": "Texto de la pregunta",
  "node.inputVariableAria": "Variable donde se guarda la entrada",
  "node.inputTypeAria": "Tipo de entrada",
  "node.outputExpressionAria": "Texto o expresion de salida",
  "node.outputModeAria": "Modo de salida",
  "node.functionToCallAria": "Funcion a llamar",
  "node.callArgumentsAria": "Argumentos de la llamada",
  "node.callReturnVariableAria": "Variable para guardar el retorno",
  "node.returnExpressionAria": "Expresion de retorno",
  "execution.ready": "Listo para ejecutar.",
  "execution.reset": "Ejecucion reiniciada.",
  "execution.finished": "Ejecucion finalizada.",
  "execution.started": "Inicio.",
  "exercise.count.title": "Contar del 1 al 5",
  "exercise.count.description":
    "Practica una secuencia simple con una variable contador y un ciclo.",
  "exercise.count.objective":
    "Crea un flujo que muestre los numeros del 1 al 5, uno por uno.",
  "exercise.even.title": "Verificar si un numero es par",
  "exercise.even.description":
    "Usa una decision para elegir entre dos salidas posibles.",
  "exercise.even.objective":
    "Pide o define un numero y muestra si es par o impar usando modulo.",
  "exercise.sum.title": "Sumar numeros de 1 a N",
  "exercise.sum.description":
    "Combina acumuladores, ciclos y una condicion de repeticion.",
  "exercise.sum.objective":
    "Calcula la suma de todos los numeros desde 1 hasta N y muestra el resultado.",
  "exercise.sign.title": "Positivo, negativo o cero",
  "exercise.sign.description":
    "Clasifica un numero usando decisiones encadenadas.",
  "exercise.sign.objective":
    "Pide un numero y muestra si es positivo, negativo o cero.",
  "exercise.table.title": "Tabla de multiplicar",
  "exercise.table.description":
    "Practica un ciclo for y salida con texto dinamico.",
  "exercise.table.objective":
    "Muestra la tabla de multiplicar de un numero desde 1 hasta 10.",
  "exercise.menu.title": "Menu de operaciones",
  "exercise.menu.description":
    "Usa switch para seleccionar una operacion matematica.",
  "exercise.menu.objective":
    "Segun el texto de operacion, calcula suma, resta, multiplicacion o division.",
  "exercise.access.title": "Intentos de acceso",
  "exercise.access.description":
    "Modela una validacion que se ejecuta al menos una vez.",
  "exercise.access.objective":
    "Simula hasta tres intentos de clave y detente cuando el acceso sea correcto.",
  "exercise.profile.title": "Normalizar perfil de usuario",
  "exercise.profile.description":
    "Combina objetos, metodos seguros de texto y acceso opcional.",
  "exercise.profile.objective":
    "Limpia el nombre de un usuario y muestra su nivel en mayusculas.",
  "exercise.shipping.title": "Cotizacion de envio",
  "exercise.shipping.description":
    "Calcula un total usando una funcion auxiliar, switch y Math.",
  "exercise.shipping.objective":
    "Calcula envio, descuento y total final para un pedido.",
  "exercise.prime.title": "Numero primo con funcion",
  "exercise.prime.description":
    "Encapsula una validacion numerica en una funcion reutilizable.",
  "exercise.prime.objective":
    "Determina si un numero es primo usando una funcion, un for y retornos tempranos.",
  "exercise.grades.title": "Reporte de notas",
  "exercise.grades.description":
    "Procesa un arreglo con funciones y clasifica el resultado con switch.",
  "exercise.grades.objective":
    "Calcula el promedio de notas, clasificalo y muestra una recomendacion.",
  "exercise.atm.title": "Cajero con validaciones",
  "exercise.atm.description":
    "Combina reglas de negocio, funcion auxiliar, modulo y switch.",
  "exercise.atm.objective":
    "Valida un retiro, actualiza el saldo solo si corresponde y muestra el resultado.",
} as const;

const en: Record<keyof typeof es, string> = {
  "app.subtitle": "Visual algorithm editor",
  "language.label": "Language",
  "language.toggle": "Change language",
  "language.es": "ES",
  "language.en": "EN",
  "exercise.mode": "Exercise mode",
  "exercise.modeHelp": "Choose a challenge to load its starter code.",
  "exercise.select": "Select an exercise",
  "exercise.active": "Active",
  "exercise.objective": "Objective:",
  "exercise.empty": "Select an exercise to see the instructions.",
  "difficulty.facil": "Easy",
  "difficulty.media": "Medium",
  "difficulty.dificil": "Hard",
  "flow.validation": "Validation",
  "flow.validationOk": "The diagram has no structural problems.",
  "validation.startCountMissing": "There must be exactly one Start block.",
  "validation.startCountMultiple":
    "There must be exactly one Start block; there are {count}.",
  "flow.connectionBlocked": "Blocked connection:",
  "flow.loopDetected":
    "A loop was detected. This is valid and can be used to represent cycles.",
  "flow.functions": "Functions",
  "flow.function": "Function",
  "flow.defaultFunctionPrefix": "function",
  "flow.functionsHelp": "Edit the main flow or a reusable subflow.",
  "flow.main": "Main",
  "flow.unnamed": "unnamed",
  "flow.parameters": "Parameters",
  "flow.newFunction": "New function",
  "flow.editFunctionName": "Edit name",
  "flow.editFunctionNameAria": "Edit name of {name}",
  "flow.deleteFunction": "Delete function",
  "flow.deleteFunctionAria": "Delete function {name}",
  "flow.blocks": "Blocks",
  "flow.blocksHelp": "Insert blocks into the canvas.",
  "flow.addStart": "Add Start",
  "flow.addEnd": "Add End",
  "flow.addProcess": "Add Process",
  "flow.addInput": "Add Input",
  "flow.addOutput": "Add Output",
  "flow.addDecision": "Add Decision",
  "flow.addFunctionCall": "Add Function Call",
  "flow.addReturn": "Add Return",
  "flow.start": "Start",
  "flow.end": "End",
  "flow.process": "Process",
  "flow.input": "Input",
  "flow.output": "Output",
  "flow.decision": "Decision",
  "flow.functionCall": "Call",
  "flow.return": "Return",
  "flow.yes": "Yes",
  "flow.no": "No",
  "flow.inPort": "Input",
  "flow.outPort": "Output",
  "flow.ports": "Ports",
  "flow.top": "Top",
  "flow.right": "Right",
  "flow.bottom": "Bottom",
  "flow.left": "Left",
  "flow.text": "Text",
  "flow.number": "Number",
  "flow.boolean": "Boolean",
  "flow.variablePlaceholder": "variable",
  "flow.resultPlaceholder": "result",
  "flow.saveReturnPlaceholder": "save in...",
  "flow.selectFunction": "Select function",
  "flow.expression": "Expression",
  "flow.literalText": "Literal text",
  "flow.inputPromptFallback": "Enter a value",
  "flow.inputVariableFallback": "value",
  "flow.outputFallback": "\"Hello\"",
  "flow.returnFallback": "result",
  "flow.callFunctionFallback": "Call function",
  "flow.callFunctionHistory": "call function",
  "flow.returnValueFallback": "Return value",
  "flow.diagram": "Diagram:",
  "flow.diagramHelp": "Add blocks from the sidebar",
  "flow.blockCount": "{count} blocks",
  "flow.export": "Export",
  "flow.importJson": "Import JSON",
  "flow.importJsonAria": "Diagram JSON file",
  "flow.exportDialogTitle": "Export diagram",
  "flow.exportDialogHelp":
    "Choose the files you want to download from the current diagram.",
  "flow.closeExportDialog": "Close export",
  "flow.exportAsImage": "Diagram image",
  "flow.exportAsImageHelp":
    "Downloads a capture fitted to the visible blocks in the canvas.",
  "flow.exportImageFormat": "Image format",
  "flow.exportJavaScript": "JavaScript file",
  "flow.exportJavaScriptHelp":
    "Saves the code generated from the main flow and its functions.",
  "flow.exportJson": "Editor JSON file",
  "flow.exportJsonHelp":
    "Includes blocks, positions, ports, connections, functions, and code.",
  "flow.exportConfirm": "Export",
  "flow.exporting": "Exporting...",
  "flow.exportImageError":
    "The diagram image could not be exported.",
  "flow.exportNoDiagram": "Add blocks before exporting an image.",
  "flow.importJsonSuccess":
    "Diagram imported from JSON. Code loaded into the importer.",
  "flow.importJsonInvalid": "The JSON file does not contain a valid diagram.",
  "flow.importJsonReadError": "The JSON file could not be read.",
  "flow.clear": "Clear",
  "flow.clearDialogTitle": "Clear {name}",
  "flow.clearDialogMessage":
    "All blocks and connections in this diagram will be deleted.",
  "flow.replaceDialogTitle": "Replace workspace",
  "flow.replaceDialogMessage":
    "Selecting this exercise will replace the current workspace content.",
  "flow.replace": "Replace",
  "flow.cancel": "Cancel",
  "flow.outputs": "Outputs",
  "flow.outputsEmpty": "Outputs will appear during execution.",
  "flow.variables": "Variables",
  "flow.variablesEmpty": "No variables yet.",
  "flow.history": "History",
  "flow.historyRecent": "Newest first",
  "flow.historyEmpty": "Run one step to see the path.",
  "flow.latest": "Latest",
  "flow.branch": "Branch {label}",
  "flow.step": "Step {step}",
  "flow.stepOf": "Step {step} of {max}",
  "flow.stepAction": "Run step",
  "flow.run": "Auto run",
  "flow.pause": "Pause",
  "flow.reset": "Reset",
  "flow.executionControls": "Execution controls",
  "flow.fullscreen": "Fullscreen",
  "flow.exitFullscreen": "Exit fullscreen",
  "flow.diagramControls": "Diagram controls",
  "flow.showMiniMap": "Show mini map",
  "flow.hideMiniMap": "Minimize mini map",
  "flow.miniMap": "Diagram mini map",
  "flow.showPanel": "Show {label}",
  "flow.hidePanel": "Hide {label}",
  "flow.executionPanel": "execution",
  "flow.functionsPanel": "functions",
  "flow.validationPanel": "validation",
  "flow.variablesPanel": "variables",
  "flow.outputsPanel": "outputs",
  "flow.historyPanel": "history",
  "flow.blocksPanel": "blocks",
  "flow.codeTitle": "JavaScript code",
  "flow.codeHelp": "Generate a readable version of the current diagram.",
  "flow.generateCode": "Generate code",
  "flow.codePlaceholder":
    "// Press \"Generate code\" to see the program.",
  "flow.warnings": "Warnings",
  "flow.importTitle": "Import JavaScript code",
  "flow.importHelp":
    "Use variables, functions, if/else, loops, switch, and common expressions.",
  "flow.importButton": "Generate diagram",
  "flow.importAria": "JavaScript code to import",
  "flow.importLoaded": "Exercise starter code loaded into the importer.",
  "flow.importGeneratedWithFunctions":
    "Diagram and functions generated from JavaScript code.",
  "flow.importGenerated": "Diagram generated from JavaScript code.",
  "modal.inputTitle": "Input required",
  "modal.inputSavedIn": "Saved in:",
  "modal.confirm": "Confirm",
  "modal.validNumber": "Enter a valid number.",
  "modal.validText": "Enter text.",
  "modal.parametersTitle": "Required parameters",
  "modal.parametersFor": "Enter the values to run {name}.",
  "modal.parametersHelp":
    "You can use numbers, booleans, text, arrays, or objects.",
  "modal.defaultValue": "default:",
  "modal.runFunction": "Run function",
  "modal.restPlaceholder": "[1, 2, 3]",
  "modal.defaultPlaceholder": "Leave empty to use the default value",
  "modal.valuePlaceholder": "5, true or \"text\"",
  "modal.valueRequired": "Enter a value for \"{name}\".",
  "modal.parameterError": "Parameter \"{name}\": {message}",
  "modal.restArray": "Parameter \"{name}\": enter an array like [1, 2, 3].",
  "modal.parseValueError":
    "the value could not be interpreted. Use quotes for literal text or a valid expression.",
  "node.startTextAria": "Start block text",
  "node.endTextAria": "End block text",
  "node.processInstructionAria": "Process block instruction",
  "node.decisionConditionAria": "Decision block condition",
  "node.inputPromptAria": "Question text",
  "node.inputVariableAria": "Variable where the input is saved",
  "node.inputTypeAria": "Input type",
  "node.outputExpressionAria": "Output text or expression",
  "node.outputModeAria": "Output mode",
  "node.functionToCallAria": "Function to call",
  "node.callArgumentsAria": "Call arguments",
  "node.callReturnVariableAria": "Variable to save the return value",
  "node.returnExpressionAria": "Return expression",
  "execution.ready": "Ready to run.",
  "execution.reset": "Execution reset.",
  "execution.finished": "Execution finished.",
  "execution.started": "Start.",
  "exercise.count.title": "Count from 1 to 5",
  "exercise.count.description":
    "Practice a simple sequence with a counter variable and a loop.",
  "exercise.count.objective":
    "Create a flow that prints the numbers from 1 to 5, one by one.",
  "exercise.even.title": "Check if a number is even",
  "exercise.even.description":
    "Use a decision to choose between two possible outputs.",
  "exercise.even.objective":
    "Ask for or define a number and show whether it is even or odd using modulo.",
  "exercise.sum.title": "Sum numbers from 1 to N",
  "exercise.sum.description":
    "Combine accumulators, loops, and a repeat condition.",
  "exercise.sum.objective":
    "Calculate the sum of all numbers from 1 to N and show the result.",
  "exercise.sign.title": "Positive, negative, or zero",
  "exercise.sign.description":
    "Classify a number using chained decisions.",
  "exercise.sign.objective":
    "Ask for a number and show whether it is positive, negative, or zero.",
  "exercise.table.title": "Multiplication table",
  "exercise.table.description":
    "Practice a for loop and output with dynamic text.",
  "exercise.table.objective":
    "Show the multiplication table for a number from 1 to 10.",
  "exercise.menu.title": "Operations menu",
  "exercise.menu.description":
    "Use switch to select a mathematical operation.",
  "exercise.menu.objective":
    "Based on the operation text, calculate addition, subtraction, multiplication, or division.",
  "exercise.access.title": "Access attempts",
  "exercise.access.description":
    "Model a validation that runs at least once.",
  "exercise.access.objective":
    "Simulate up to three password attempts and stop when access is correct.",
  "exercise.profile.title": "Normalize user profile",
  "exercise.profile.description":
    "Combine objects, safe text methods, and optional access.",
  "exercise.profile.objective":
    "Clean a user's name and show the level in uppercase.",
  "exercise.shipping.title": "Shipping quote",
  "exercise.shipping.description":
    "Calculate a total using a helper function, switch, and Math.",
  "exercise.shipping.objective":
    "Calculate shipping, discount, and final total for an order.",
  "exercise.prime.title": "Prime number with function",
  "exercise.prime.description":
    "Encapsulate numeric validation in a reusable function.",
  "exercise.prime.objective":
    "Determine whether a number is prime using a function, a for loop, and early returns.",
  "exercise.grades.title": "Grade report",
  "exercise.grades.description":
    "Process an array with functions and classify the result with switch.",
  "exercise.grades.objective":
    "Calculate the grade average, classify it, and show a recommendation.",
  "exercise.atm.title": "ATM with validations",
  "exercise.atm.description":
    "Combine business rules, a helper function, modulo, and switch.",
  "exercise.atm.objective":
    "Validate a withdrawal, update the balance only when allowed, and show the result.",
};

export const translations = {
  es,
  en,
};

export type TranslationKey = keyof typeof es;

export function isSupportedLanguage(value: string): value is Language {
  return supportedLanguages.includes(value as Language);
}

export function resolveLanguage(value: string | undefined | null): Language {
  if (!value) {
    return "es";
  }

  const normalizedValue = value.toLowerCase().split("-")[0];

  return isSupportedLanguage(normalizedValue) ? normalizedValue : "es";
}

export function formatTranslation(
  text: string,
  values: Record<string, string | number> = {},
) {
  return text.replace(/\{(\w+)\}/g, (match, key) =>
    values[key] === undefined ? match : String(values[key]),
  );
}
