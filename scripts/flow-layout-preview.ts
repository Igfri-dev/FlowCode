import fs from "node:fs";
import path from "node:path";
import { getExercises } from "@/features/exercises/data/exercises";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type { AutoLayoutEdge, AutoLayoutNode } from "@/features/flow/auto-layout";

type DiagramSummary = {
  bounds: {
    height: number;
    width: number;
  };
  edgeCount: number;
  handleCounts: Record<string, number>;
  nodeCount: number;
  totalEdgeLength: number;
};

type ExerciseLayoutSummary = {
  diagrams: Array<{
    generated?: DiagramSummary;
    name: string;
    reference?: DiagramSummary;
  }>;
  id: string;
  title: string;
};

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
  process.argv[2] ?? "/Users/hans/Downloads/FlowCode_JSON";
const outputFile =
  process.argv[3] ??
  path.join(process.cwd(), ".flow-layout-preview", "layout-summary.json");

const summaries = getExercises("es").map((exercise): ExerciseLayoutSummary => {
  const generatedResult = exercise.starterCode
    ? importJavaScriptToFlow(exercise.starterCode)
    : null;
  const generatedDiagrams =
    generatedResult?.ok === true
      ? [
          {
            name: "main",
            nodes: generatedResult.nodes,
            edges: generatedResult.edges,
          },
          ...generatedResult.functions.map((flowFunction) => ({
            name: `fn:${flowFunction.name}`,
            nodes: flowFunction.nodes,
            edges: flowFunction.edges,
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
      generated: summarizeDiagram(
        generatedDiagrams.find((diagram) => diagram.name === name),
      ),
      name,
      reference: summarizeDiagram(
        referenceDiagrams.find((diagram) => diagram.name === name),
      ),
    })),
    id: exercise.id,
    title: exercise.title,
  };
});

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(summaries, null, 2)}\n`);

console.log(`Resumen escrito en ${outputFile}`);

for (const exercise of summaries) {
  console.log(`\n${exercise.title}`);

  for (const diagram of exercise.diagrams) {
    const generated = diagram.generated
      ? `${diagram.generated.nodeCount} nodos, ${diagram.generated.totalEdgeLength}px edges`
      : "sin generado";
    const reference = diagram.reference
      ? `${diagram.reference.nodeCount} nodos, ${diagram.reference.totalEdgeLength}px edges`
      : "sin referencia";

    console.log(`  ${diagram.name}: generado ${generated}; referencia ${reference}`);
  }
}

function loadReferenceDiagrams(title: string) {
  const filePath = path.join(referenceDirectory, `${title}.json`);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  const exportFile = JSON.parse(
    fs.readFileSync(filePath, "utf8"),
  ) as FlowExportFile;
  const diagrams: Array<ExportedDiagram & { name: string }> = [];

  if (exportFile.program?.main) {
    diagrams.push({
      ...exportFile.program.main,
      name: "main",
    });
  }

  for (const flowFunction of exportFile.program?.functions ?? []) {
    diagrams.push({
      ...flowFunction,
      name: `fn:${flowFunction.name ?? "funcion"}`,
    });
  }

  return diagrams;
}

function summarizeDiagram(
  diagram: (ExportedDiagram & { name: string }) | undefined,
): DiagramSummary | undefined {
  if (!diagram) {
    return undefined;
  }

  const centerById = new Map(
    diagram.nodes.map((node) => [node.id, getNodeCenter(node)]),
  );
  const bounds = getDiagramBounds(diagram.nodes);
  const handleCounts: Record<string, number> = {};

  for (const node of diagram.nodes) {
    for (const [handleId, position] of Object.entries(
      node.data.handlePositions ?? {},
    )) {
      const key = `${handleId}:${position}`;
      handleCounts[key] = (handleCounts[key] ?? 0) + 1;
    }
  }

  return {
    bounds: {
      height: Math.round(bounds.height),
      width: Math.round(bounds.width),
    },
    edgeCount: diagram.edges.length,
    handleCounts,
    nodeCount: diagram.nodes.length,
    totalEdgeLength: Math.round(
      diagram.edges.reduce((total, edge) => {
        const source = centerById.get(edge.source);
        const target = centerById.get(edge.target);

        if (!source || !target) {
          return total;
        }

        return (
          total +
          Math.abs(source.x - target.x) +
          Math.abs(source.y - target.y)
        );
      }, 0),
    ),
  };
}

function getDiagramBounds(nodes: AutoLayoutNode[]) {
  if (nodes.length === 0) {
    return {
      height: 0,
      width: 0,
    };
  }

  const boxes = nodes.map((node) => {
    const size = getNodeSize(node);

    return {
      maxX: node.position.x + size.width,
      maxY: node.position.y + size.height,
      minX: node.position.x,
      minY: node.position.y,
    };
  });

  const minX = Math.min(...boxes.map((box) => box.minX));
  const maxX = Math.max(...boxes.map((box) => box.maxX));
  const minY = Math.min(...boxes.map((box) => box.minY));
  const maxY = Math.max(...boxes.map((box) => box.maxY));

  return {
    height: maxY - minY,
    width: maxX - minX,
  };
}

function getNodeCenter(node: AutoLayoutNode) {
  const size = getNodeSize(node);

  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
}

function getNodeSize(node: AutoLayoutNode) {
  return {
    height: node.measured?.height ?? node.height ?? 90,
    width: node.measured?.width ?? node.width ?? 220,
  };
}
