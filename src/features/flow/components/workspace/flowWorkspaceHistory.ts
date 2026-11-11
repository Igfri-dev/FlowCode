import { getDefaultFlowNodeHandlePositions } from "@/features/flow/handle-positions";
import type { ImportedFlowNode } from "@/features/flow/parser";
import type { FlowEditorNode, FlowProgram } from "@/types/flow";
import {
  getImportActiveDiagramId,
  parseFlowDiagramExportFile,
  type ExportedFlowDiagram,
  type FlowDiagramExportFile,
} from "./flowWorkspaceSerialization";

export type WorkspaceSnapshot = {
  program: FlowDiagramExportFile["program"];
  exerciseId: string | null;
  activeDiagramId: string;
};

export type WorkspaceHistory = {
  past: WorkspaceSnapshot[];
  present: WorkspaceSnapshot;
  future: WorkspaceSnapshot[];
};

const historyLimit = 60;

export function createWorkspaceSnapshot(
  program: FlowProgram,
  exerciseId: string | null,
  activeDiagramId: string,
): WorkspaceSnapshot {
  return {
    program: normalizeProgram(program),
    exerciseId,
    activeDiagramId: getImportActiveDiagramId(activeDiagramId, program),
  };
}

export function getWorkspaceSignature(snapshot: WorkspaceSnapshot): string {
  return JSON.stringify(
    sortObjectKeys({
      program: normalizeProgram(snapshot.program),
      exerciseId: snapshot.exerciseId,
    }),
  );
}

export function parseWorkspaceSnapshot(
  text: string,
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode,
): { snapshot: WorkspaceSnapshot; program: FlowProgram } | null {
  try {
    const value: unknown = JSON.parse(text);
    if (
      !isRecord(value) ||
      typeof value.activeDiagramId !== "string" ||
      (value.exerciseId !== null && typeof value.exerciseId !== "string") ||
      !isRecord(value.program) ||
      !Array.isArray(value.program.functions)
    ) {
      return null;
    }

    const parsed = parseFlowDiagramExportFile(
      JSON.stringify({
        schema: "flowcode.diagram",
        version: 1,
        program: value.program,
        activeDiagramId: value.activeDiagramId,
      }),
      createEditorNodeFromImport,
      "Invalid workspace draft.",
    );
    if (!parsed.ok) {
      return null;
    }

    return {
      snapshot: createWorkspaceSnapshot(
        parsed.program,
        value.exerciseId,
        parsed.activeDiagramId,
      ),
      program: parsed.program,
    };
  } catch {
    return null;
  }
}

export function createWorkspaceHistory(
  snapshot: WorkspaceSnapshot,
): WorkspaceHistory {
  return { past: [], present: snapshot, future: [] };
}

export function recordWorkspaceHistory(
  history: WorkspaceHistory,
  snapshot: WorkspaceSnapshot,
  coalesce = false,
): WorkspaceHistory {
  if (
    getWorkspaceSignature(history.present) === getWorkspaceSignature(snapshot)
  ) {
    return { ...history, present: snapshot };
  }

  return {
    past:
      coalesce && history.past.length > 0
        ? history.past
        : [...history.past, history.present].slice(-historyLimit),
    present: snapshot,
    future: [],
  };
}

export function undoWorkspaceHistory(
  history: WorkspaceHistory,
): WorkspaceHistory {
  const previous = history.past.at(-1);
  if (!previous) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoWorkspaceHistory(
  history: WorkspaceHistory,
): WorkspaceHistory {
  const next = history.future[0];
  if (!next) {
    return history;
  }

  return {
    past: [...history.past, history.present].slice(-historyLimit),
    present: next,
    future: history.future.slice(1),
  };
}

function normalizeProgram(
  program: FlowProgram | WorkspaceSnapshot["program"],
): WorkspaceSnapshot["program"] {
  return {
    main: normalizeDiagram(program.main),
    functions: program.functions.map((flowFunction) => ({
      id: flowFunction.id,
      name: flowFunction.name,
      parameters: [...flowFunction.parameters],
      ...(flowFunction.parameterDefinitions
        ? { parameterDefinitions: cloneJson(flowFunction.parameterDefinitions) }
        : {}),
      ...normalizeDiagram(flowFunction),
    })),
  };
}

function normalizeDiagram(
  diagram: FlowProgram["main"] | ExportedFlowDiagram,
): ExportedFlowDiagram {
  return {
    nodes: diagram.nodes.map((node) => ({
      id: node.id,
      type: node.type ?? "process",
      position: { x: node.position.x, y: node.position.y },
      data: {
        label: node.data.label,
        config: cloneJson(node.data.config),
        handlePositions: {
          ...getDefaultFlowNodeHandlePositions(node.type ?? "process"),
          ...node.data.handlePositions,
        },
      },
    })),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      type: "flow",
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? "out",
      targetHandle: edge.targetHandle ?? "in",
      ...(typeof edge.label === "string" || typeof edge.label === "number"
        ? { label: edge.label }
        : {}),
    })),
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortObjectKeys(value[key])]),
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
