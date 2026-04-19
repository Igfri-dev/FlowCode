import type { XYPosition } from "@xyflow/react";
import { getDefaultFlowNodeHandlePositions } from "@/features/flow/handle-positions";
import { translations, type Language } from "@/features/i18n/translations";
import type {
  FlowEditorNode,
  FlowNodeConfig,
  FlowNodeConfigChangeHandler,
  FlowNodeDataByType,
  FlowNodeHandlePositionsChangeHandler,
  FlowNodeLabelChangeHandler,
  FlowNodeType,
} from "@/types/flow";

const baseFlowNodeData: {
  [TType in FlowNodeType]: FlowNodeDataByType[TType];
} = {
  start: {
    label: "Inicio",
    config: {},
    handlePositions: getDefaultFlowNodeHandlePositions("start"),
  },
  end: {
    label: "Fin",
    config: {},
    handlePositions: getDefaultFlowNodeHandlePositions("end"),
  },
  process: {
    label: "x = x + 1",
    config: {
      instruction: "x = x + 1",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("process"),
  },
  decision: {
    label: "x > 5",
    config: {
      condition: "x > 5",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("decision"),
  },
  input: {
    label: "Leer edad",
    config: {
      prompt: "Ingresa tu edad",
      variableName: "edad",
      inputType: "number",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("input"),
  },
  output: {
    label: "Mostrar resultado",
    config: {
      expression: '"Resultado: " + x',
      outputMode: "expression",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("output"),
  },
  functionCall: {
    label: "Llamar funcion",
    config: {
      functionId: "",
      args: [],
      assignTo: "",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("functionCall"),
  },
  return: {
    label: "Retornar valor",
    config: {
      expression: "resultado",
    },
    handlePositions: getDefaultFlowNodeHandlePositions("return"),
  },
};

type CreateFlowNodeInput = {
  id: string;
  type: FlowNodeType;
  index: number;
  language?: Language;
  onLabelChange: FlowNodeLabelChangeHandler;
  onConfigChange: FlowNodeConfigChangeHandler;
  onHandlePositionsChange: FlowNodeHandlePositionsChangeHandler;
};

export function createFlowEditorNode({
  id,
  type,
  index,
  language = "es",
  onLabelChange,
  onConfigChange,
  onHandlePositionsChange,
}: CreateFlowNodeInput): FlowEditorNode {
  return {
    id,
    type,
    position: getFlowNodePosition(index),
    data: {
      ...getFlowNodeData(type, language),
      onLabelChange,
      onConfigChange,
      onHandlePositionsChange,
    },
  } as FlowEditorNode;
}

export function getFlowNodeLabelFromConfig(
  type: FlowNodeType,
  config: FlowNodeConfig,
  fallbackLabel: string,
  language: Language = "es",
) {
  const textSet = translations[language];

  if (type === "process" && "instruction" in config) {
    return config.instruction;
  }

  if (type === "decision" && "condition" in config) {
    return config.condition;
  }

  if (type === "input" && "variableName" in config) {
    return `${language === "en" ? "Read" : "Leer"} ${
      config.variableName || textSet["flow.variablePlaceholder"]
    }`;
  }

  if (type === "output" && "expression" in config) {
    return `${language === "en" ? "Show" : "Mostrar"} ${
      config.expression || textSet["flow.output"]
    }`;
  }

  if (type === "functionCall" && "functionId" in config) {
    return textSet["flow.callFunctionFallback"];
  }

  if (type === "return" && "expression" in config) {
    return `${language === "en" ? "Return" : "Retornar"} ${
      config.expression || textSet["flow.inputVariableFallback"]
    }`;
  }

  return fallbackLabel;
}

function getFlowNodeData(type: FlowNodeType, language: Language) {
  const textSet = translations[language];
  const data = baseFlowNodeData[type];

  if (type === "start") {
    return {
      ...data,
      label: textSet["flow.start"],
    };
  }

  if (type === "end") {
    return {
      ...data,
      label: textSet["flow.end"],
    };
  }

  if (type === "input" && "prompt" in data.config) {
    return {
      ...data,
      label: `${language === "en" ? "Read" : "Leer"} edad`,
      config: {
        ...data.config,
        prompt:
          language === "en"
            ? "Enter your age"
            : "Ingresa tu edad",
      },
    };
  }

  if (type === "output" && "expression" in data.config) {
    return {
      ...data,
      label: language === "en" ? "Show result" : "Mostrar resultado",
      config: {
        ...data.config,
        expression:
          language === "en" ? '"Result: " + x' : '"Resultado: " + x',
      },
    };
  }

  if (type === "functionCall") {
    return {
      ...data,
      label: textSet["flow.callFunctionFallback"],
    };
  }

  if (type === "return" && "expression" in data.config) {
    return {
      ...data,
      label: textSet["flow.returnValueFallback"],
      config: {
        ...data.config,
        expression: textSet["flow.returnFallback"],
      },
    };
  }

  return data;
}

function getFlowNodePosition(index: number): XYPosition {
  const column = index % 3;
  const row = Math.floor(index / 3);

  return {
    x: 80 + column * 220,
    y: 80 + row * 160,
  };
}
