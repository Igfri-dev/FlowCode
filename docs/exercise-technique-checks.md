# Validación de técnicas en los ejercicios

Cada caso de prueba puede exigir salidas correctas y técnicas concretas. Las entregas se vuelven a evaluar en el servidor con las reglas del ejercicio; no se confía en resultados enviados por el navegador.

Los doce ejercicios incluidos ya tienen requisitos explícitos. Las versiones antiguas guardadas en la base de datos heredan los del ejercicio del catálogo. No se requieren cambios de esquema.

## Configuración para profesores

En el campo de casos de prueba JSON:

```json
[
  {
    "name": "Suma con acumulador",
    "expectedOutputs": ["15"],
    "requirements": ["loop", "accumulator"]
  }
]
```

Técnicas disponibles:

| Identificador | Evidencia requerida |
| --- | --- |
| `loop` | Repetición ejecutada en el grafo que participa en la salida o su control. Permite diagramas hechos a mano. |
| `for`, `doWhile` | Ciclo ejecutado con esa estructura identificada por el importador. Para equivalentes manuales, preferir `loop`. |
| `decision` | Decisión ejecutada que determina una salida o un valor utilizado. |
| `switch` | Selección switch ejecutada que participa en el resultado. |
| `function` | Llamada a función cuyos datos o salidas se utilizan. |
| `input` | Entrada de datos utilizada por la solución. |
| `modulo` | Uso del operador `%` que aporta a datos o decisiones relevantes. |
| `accumulator` | Actualización aritmética de un valor que llega a los datos impresos. Un contador alrededor de una respuesta literal no basta. |
| `stringMethods` | Uso de métodos de texto sobre cadenas. |
| `optionalChaining` | Acceso opcional utilizado por la solución. |
| `array`, `object` | Uso de arreglos u objetos en los datos del resultado. |
| `math` | Operaciones `Math` que participan en el resultado. |

Los requisitos se aplican **por caso**, a la ruta que realmente se ejecutó. No se exige que una técnica de una rama no tomada se ejecute en todos los casos. Se deben elegir requisitos apropiados para cada entrada.

En un ejercicio propio, omitir `requirements` conserva la evaluación sólo de salidas. En una versión de un ejercicio del catálogo, omitirlo hereda sus requisitos originales. Un profesor puede escribir `"requirements": []` para desactivarlos explícitamente. Los nombres desconocidos o formatos incorrectos se rechazan.

## Qué se comprueba

El motor registra los bloques ejecutados, analiza sus expresiones y sigue las dependencias de datos y control hasta las salidas. Por eso no basta con agregar bloques desconectados, ejecutar un ciclo irrelevante o calcular algo y luego sustituirlo por una respuesta escrita previamente.

Cada caso aprueba sólo si termina sin errores, coincide exactamente con las salidas esperadas y demuestra todas sus técnicas. El detalle muestra ambas comprobaciones por separado. Los resultados antiguos se siguen mostrando, pero no se recalifican hasta ejecutar o entregar otra vez.

Es una comprobación pedagógica de los casos configurados, no una prueba formal de que cualquier entrada imaginable esté resuelta ni un detector de intención. Conviene incluir entradas variadas, casos límite y revisión docente para valorar el razonamiento completo. La combinación de evaluación dinámica y estructural está documentada en [Scaling Automated Programming Assessment Systems](https://doi.org/10.3390/electronics12040942).
