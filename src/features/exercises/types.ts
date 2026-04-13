import type { FlowNode } from "@/types/flow";

export type ExerciseDifficulty = "facil" | "media" | "dificil";

export type ExerciseStarterNode = FlowNode & {
  position: {
    x: number;
    y: number;
  };
};

export type ExerciseStarterEdge = {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type ExerciseStarterDiagram = {
  main: {
    nodes: ExerciseStarterNode[];
    edges: ExerciseStarterEdge[];
  };
  functions?: ExerciseStarterFunction[];
};

export type ExerciseStarterFunction = {
  id: string;
  name: string;
  parameters: string[];
  nodes: ExerciseStarterNode[];
  edges: ExerciseStarterEdge[];
};

export type Exercise = {
  id: string;
  title: string;
  description: string;
  difficulty: ExerciseDifficulty;
  objective: string;
  starterCode?: string;
  starterDiagram?: ExerciseStarterDiagram;
  tags?: string[];
};
