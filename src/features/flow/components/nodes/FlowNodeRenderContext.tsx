"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { FlowEditorNode } from "@/types/flow";

type FlowNodeExecution = NonNullable<FlowEditorNode["data"]["execution"]>;
type AvailableFlowFunctions = NonNullable<
  FlowEditorNode["data"]["availableFunctions"]
>;

type FlowNodeRenderContextValue = {
  availableFunctions: AvailableFlowFunctions;
  getExecution: (nodeId: string) => FlowNodeExecution | undefined;
};

const emptyAvailableFunctions: AvailableFlowFunctions = [];

const FlowNodeRenderContext = createContext<FlowNodeRenderContextValue>({
  availableFunctions: emptyAvailableFunctions,
  getExecution: () => undefined,
});

export function FlowNodeRenderProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: FlowNodeRenderContextValue;
}) {
  return (
    <FlowNodeRenderContext.Provider value={value}>
      {children}
    </FlowNodeRenderContext.Provider>
  );
}

export function useFlowNodeRenderContext() {
  return useContext(FlowNodeRenderContext);
}
