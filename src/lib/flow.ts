import type { FlowDiagram } from "@/types/flow";

export function createEmptyFlowDiagram(): FlowDiagram {
  return {
    nodes: [],
    edges: [],
  };
}
