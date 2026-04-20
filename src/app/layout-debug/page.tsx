import fs from "node:fs";
import path from "node:path";
import { getExercises } from "@/features/exercises/data/exercises";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type {
  AutoLayoutEdge,
  AutoLayoutNode,
} from "@/features/flow/auto-layout";
import { LayoutDebugClient, type LayoutDebugExercise } from "./LayoutDebugClient";

type ExportedDiagram = {
  nodes: AutoLayoutNode[];
  edges: AutoLayoutEdge[];
};

type FlowExportFile = {
  program?: {
    main?: ExportedDiagram;
    functions?: Array<ExportedDiagram & { name?: string }>;
  };
};

const referenceDirectory =
  process.env.FLOWCODE_REFERENCE_DIR ?? "/Users/hans/Downloads/FlowCode_JSON";

export const dynamic = "force-dynamic";

export default function LayoutDebugPage() {
  const exercises = getExercises("es");
  const debugExercises = exercises.map((exercise): LayoutDebugExercise => {
    const generatedResult = exercise.starterCode
      ? importJavaScriptToFlow(exercise.starterCode)
      : null;
    const generatedDiagrams =
      generatedResult?.ok === true
        ? [
            {
              diagram: sanitizeDiagram({
                nodes: generatedResult.nodes,
                edges: generatedResult.edges,
              }),
              name: "main",
            },
            ...generatedResult.functions.map((flowFunction) => ({
              diagram: sanitizeDiagram(flowFunction),
              name: `fn:${flowFunction.name}`,
            })),
          ]
        : [];
    const referenceDiagrams = loadReferenceDiagrams(exercise.title);
    const diagramNames = Array.from(
      new Set([
        ...referenceDiagrams.map((diagram) => diagram.name),
        ...generatedDiagrams.map((diagram) => diagram.name),
      ]),
    );

    return {
      diagrams: diagramNames.map((name) => ({
        generated:
          generatedDiagrams.find((diagram) => diagram.name === name)?.diagram ??
          null,
        name,
        reference:
          referenceDiagrams.find((diagram) => diagram.name === name)?.diagram ??
          null,
      })),
      id: exercise.id,
      importError:
        generatedResult && !generatedResult.ok ? generatedResult.message : null,
      title: exercise.title,
    };
  });

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-5 text-neutral-950 md:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
        <header className="border-b border-neutral-300 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            FlowCode layout debug
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
            Comparacion visual de auto-layout
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
            Referencias cargadas desde {referenceDirectory}. La columna derecha
            usa el parser actual con el nuevo motor heuristico.
          </p>
        </header>

        <LayoutDebugClient exercises={debugExercises} />
      </div>
    </main>
  );
}

function loadReferenceDiagrams(title: string) {
  const filePath = path.join(referenceDirectory, `${title}.json`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const exportFile = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as FlowExportFile;
  const diagrams: Array<{ diagram: ExportedDiagram; name: string }> = [];

  if (exportFile.program?.main) {
    diagrams.push({
      diagram: sanitizeDiagram(exportFile.program.main),
      name: "main",
    });
  }

  for (const flowFunction of exportFile.program?.functions ?? []) {
    diagrams.push({
      diagram: sanitizeDiagram(flowFunction),
      name: `fn:${flowFunction.name ?? "funcion"}`,
    });
  }

  return diagrams;
}

function sanitizeDiagram(diagram: ExportedDiagram): ExportedDiagram {
  return {
    edges: diagram.edges.map((edge) => ({
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? null,
      target: edge.target,
      targetHandle: edge.targetHandle ?? "in",
    })),
    nodes: diagram.nodes.map((node) => ({
      data: {
        config: node.data.config,
        handlePositions: node.data.handlePositions,
        label: node.data.label,
      },
      height: node.height,
      id: node.id,
      measured: node.measured,
      position: node.position,
      type: node.type,
      width: node.width,
    })),
  };
}
