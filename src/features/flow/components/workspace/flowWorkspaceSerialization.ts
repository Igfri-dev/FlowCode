import type { Connection } from "@xyflow/react";
import type { FlowCodeGenerationResult } from "@/features/flow/codegen";
import { createFlowEditorEdge } from "@/features/flow/flow-edge-factory";
import type { useI18n } from "@/features/i18n/I18nProvider";
import type { ImportedFlowNode } from "@/features/flow/parser";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
  FlowNodeConfig,
  FlowNodeHandlePositions,
  FlowNodeType,
  FlowProgram,
  FunctionCallNodeConfig,
} from "@/types/flow";
import { flowNodeTypes } from "@/types/flow";

export type ExportedFlowNode = {
  id: string;
  type: FlowNodeType;
  position: FlowEditorNode["position"];
  data: {
    label: string;
    config: FlowNodeConfig;
    handlePositions?: FlowNodeHandlePositions;
  };
  height?: number;
  measured?: FlowEditorNode["measured"];
  width?: number;
};

export type ExportedFlowDiagram = {
  nodes: ExportedFlowNode[];
  edges: FlowEditorEdge[];
};

export type ExportedFlowFunction = Omit<
  FlowFunctionDefinition,
  "nodes" | "edges"
> &
  ExportedFlowDiagram;

export type FlowDiagramExportFile = {
  schema: "flowcode.diagram";
  version: 1;
  exportedAt: string;
  activeDiagramId: string;
  code: string;
  codeWarnings: string[];
  program: {
    main: ExportedFlowDiagram;
    functions: ExportedFlowFunction[];
  };
};

export function createFlowDiagramExportFile({
  activeDiagramId,
  codeGenerationResult,
  program,
}: {
  activeDiagramId: string;
  codeGenerationResult: FlowCodeGenerationResult;
  program: FlowProgram;
}): FlowDiagramExportFile {
  return {
    schema: "flowcode.diagram",
    version: 1,
    exportedAt: new Date().toISOString(),
    activeDiagramId,
    code: codeGenerationResult.code,
    codeWarnings: codeGenerationResult.warnings,
    program: {
      main: serializeFlowDiagram(program.main),
      functions: program.functions.map((flowFunction) => ({
        id: flowFunction.id,
        name: flowFunction.name,
        parameters: flowFunction.parameters,
        parameterDefinitions: flowFunction.parameterDefinitions,
        ...serializeFlowDiagram(flowFunction),
      })),
    },
  };
}

export function parseFlowDiagramExportFile(
  text: string,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
  invalidMessage: string,
):
  | {
      ok: true;
      activeDiagramId: string;
      code: string;
      codeWarnings: string[];
      program: FlowProgram;
    }
  | {
      ok: false;
      message: string;
    } {
  const parsedValue = JSON.parse(text) as unknown;
  const root = isRecord(parsedValue) ? parsedValue : null;
  const programValue = root?.program;

  if (
    root?.schema !== "flowcode.diagram" ||
    root.version !== 1 ||
    !isRecord(programValue)
  ) {
    return {
      ok: false,
      message: invalidMessage,
    };
  }

  const main = parseExportedDiagram(
    programValue.main,
    createEditorNodeFromImport,
  );
  const functionValues = Array.isArray(programValue.functions)
    ? programValue.functions
    : [];
  const functions = functionValues
    .map((flowFunction) =>
      parseExportedFunction(flowFunction, createEditorNodeFromImport),
    )
    .filter((flowFunction): flowFunction is FlowFunctionDefinition =>
      flowFunction !== null,
    );

  if (!main || functions.length !== functionValues.length) {
    return {
      ok: false,
      message: invalidMessage,
    };
  }

  return {
    ok: true,
    activeDiagramId: readString(root.activeDiagramId, "main"),
    code: readString(root.code, ""),
    codeWarnings: readStringArray(root.codeWarnings),
    program: {
      main,
      functions,
    },
  };
}

export function getImportActiveDiagramId(
  importedActiveDiagramId: string,
  program: FlowProgram,
) {
  if (
    importedActiveDiagramId === "main" ||
    program.functions.some(
      (flowFunction) => flowFunction.id === importedActiveDiagramId,
    )
  ) {
    return importedActiveDiagramId;
  }

  return "main";
}

export function getDiagramById(program: FlowProgram, diagramId: string) {
  if (diagramId === "main") {
    return program.main;
  }

  return (
    program.functions.find((flowFunction) => flowFunction.id === diagramId) ??
    program.main
  );
}

export function getDiagramNameById(
  program: FlowProgram,
  diagramId: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  if (diagramId === "main") {
    return t("flow.main");
  }

  const flowFunction = program.functions.find(
    (item) => item.id === diagramId,
  );

  return `${t("flow.function")} ${flowFunction?.name ?? t("flow.unnamed")}`;
}

export function getNextNodeCounter(program: FlowProgram) {
  const nodeIds = [
    ...program.main.nodes.map((node) => node.id),
    ...program.functions.flatMap((flowFunction) =>
      flowFunction.nodes.map((node) => node.id),
    ),
  ];

  return Math.max(nodeIds.length, getMaxNumericSuffix(nodeIds));
}

export function getNextFunctionCounter(program: FlowProgram) {
  return getMaxNumericSuffix(
    program.functions.map((flowFunction) => flowFunction.id),
  );
}

export function hasDiagramContent(program: FlowProgram) {
  return (
    program.main.nodes.length > 0 ||
    program.main.edges.length > 0 ||
    program.functions.length > 0
  );
}

export function clearFunctionReferences(
  nodes: FlowEditorNode[],
  functionId: string,
): FlowEditorNode[] {
  return nodes.map((node): FlowEditorNode => {
    const config = node.data.config;

    if (!isFunctionCallConfig(config) || config.functionId !== functionId) {
      return node;
    }

    return {
      ...node,
      data: {
        ...node.data,
        config: {
          ...config,
          functionId: "",
        },
      },
    };
  });
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function serializeFlowDiagram(
  diagram: FlowProgram["main"],
): ExportedFlowDiagram {
  return {
    nodes: diagram.nodes.map(serializeFlowNode),
    edges: cloneJson(diagram.edges),
  };
}

function serializeFlowNode(node: FlowEditorNode): ExportedFlowNode {
  return {
    id: node.id,
    type: node.type,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
    width: node.width,
    height: node.height,
    measured: node.measured,
    data: {
      label: node.data.label,
      config: cloneJson(node.data.config),
      handlePositions: node.data.handlePositions,
    },
  };
}

function parseExportedFunction(
  value: unknown,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
): FlowFunctionDefinition | null {
  if (!isRecord(value)) {
    return null;
  }

  const diagram = parseExportedDiagram(value, createEditorNodeFromImport);

  if (!diagram) {
    return null;
  }

  return {
    id: readString(value.id, ""),
    name: readString(value.name, ""),
    parameters: readStringArray(value.parameters),
    parameterDefinitions: readParameterDefinitions(value.parameterDefinitions),
    nodes: diagram.nodes,
    edges: diagram.edges,
  };
}

function parseExportedDiagram(
  value: unknown,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
): FlowProgram["main"] | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    return null;
  }

  const importedNodes = value.nodes.map(createImportedNodeFromExport);
  const importedEdges = value.edges.map(createEditorEdgeFromExport);

  if (
    importedNodes.some((node) => node === null) ||
    importedEdges.some((edge) => edge === null)
  ) {
    return null;
  }

  return {
    nodes: importedNodes.map((node) =>
      createEditorNodeFromImport(node as ImportedFlowNode),
    ),
    edges: importedEdges as FlowEditorEdge[],
  };
}

function createImportedNodeFromExport(value: unknown): ImportedFlowNode | null {
  if (!isRecord(value) || !isFlowNodeType(value.type)) {
    return null;
  }

  const data = isRecord(value.data) ? value.data : null;
  const id = readString(value.id, "");
  const position = readPosition(value.position);

  if (!data || !id || !position) {
    return null;
  }

  return {
    id,
    type: value.type,
    position,
    width: readOptionalNumber(value.width),
    height: readOptionalNumber(value.height),
    measured: readMeasured(value.measured),
    data: {
      label: readString(data.label, value.type),
      config: isRecord(data.config)
        ? (cloneJson(data.config) as FlowNodeConfig)
        : {},
      handlePositions: readHandlePositions(data.handlePositions),
    },
  } as ImportedFlowNode;
}

function createEditorEdgeFromExport(value: unknown): FlowEditorEdge | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = readString(value.source, "");
  const target = readString(value.target, "");

  if (!source || !target) {
    return null;
  }

  const connection: Connection = {
    source,
    target,
    sourceHandle: readNullableString(value.sourceHandle),
    targetHandle: readNullableString(value.targetHandle) ?? "in",
  };
  const serializedEdge = cloneJson(value) as Partial<FlowEditorEdge>;
  const editorEdge = createFlowEditorEdge(connection);

  return {
    ...editorEdge,
    ...serializedEdge,
    id: readString(value.id, editorEdge.id),
    source,
    sourceHandle: connection.sourceHandle,
    target,
    targetHandle: connection.targetHandle,
    type: "flow",
  };
}

function getMaxNumericSuffix(values: string[]) {
  return values.reduce((maxValue, value) => {
    const match = /-(\d+)$/.exec(value);

    return match ? Math.max(maxValue, Number(match[1])) : maxValue;
  }, 0);
}

function readHandlePositions(value: unknown): FlowNodeHandlePositions | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const handlePositions: FlowNodeHandlePositions = {};

  for (const handleId of ["in", "out", "yes", "no"] as const) {
    if (isFlowHandlePosition(value[handleId])) {
      handlePositions[handleId] = value[handleId];
    }
  }

  return Object.keys(handlePositions).length > 0
    ? handlePositions
    : undefined;
}

function readParameterDefinitions(
  value: unknown,
): FlowFunctionDefinition["parameterDefinitions"] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter(isRecord)
    .map((parameter) => ({
      name: readString(parameter.name, ""),
      source: readString(parameter.source, ""),
      defaultValue:
        typeof parameter.defaultValue === "string"
          ? parameter.defaultValue
          : undefined,
      rest: typeof parameter.rest === "boolean" ? parameter.rest : undefined,
    }))
    .filter((parameter) => parameter.name || parameter.source);
}

function readPosition(value: unknown) {
  if (!isRecord(value)) {
    return null;
  }

  const x = readOptionalNumber(value.x);
  const y = readOptionalNumber(value.y);

  return x === undefined || y === undefined
    ? null
    : {
        x,
        y,
      };
}

function readMeasured(value: unknown): FlowEditorNode["measured"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = readOptionalNumber(value.width);
  const height = readOptionalNumber(value.height);

  if (width === undefined || height === undefined) {
    return undefined;
  }

  return {
    width,
    height,
  };
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFlowNodeType(value: unknown): value is FlowNodeType {
  return (
    typeof value === "string" &&
    flowNodeTypes.includes(value as FlowNodeType)
  );
}

function isFlowHandlePosition(value: unknown) {
  return (
    value === "top" ||
    value === "right" ||
    value === "bottom" ||
    value === "left"
  );
}

function isFunctionCallConfig(
  config: FlowNodeConfig,
): config is FunctionCallNodeConfig {
  return "functionId" in config && "args" in config;
}
