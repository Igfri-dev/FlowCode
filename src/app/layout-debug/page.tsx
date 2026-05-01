import { generateJavaScriptFromFlow } from "@/features/flow/codegen";
import { flowStabilityFixtures } from "@/features/flow/fixtures/stability-fixtures";
import { analyzeFlowLayout } from "@/features/flow/layout-quality";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import { validateFlowDiagram } from "@/features/flow/flow-validation";
import type { FlowEditorNode } from "@/types/flow";
import { LayoutDebugClient, type LayoutDebugExample } from "./LayoutDebugClient";

export const dynamic = "force-dynamic";

export default function LayoutDebugPage() {
  const examples = flowStabilityFixtures.map(createDebugExample);

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-5 text-neutral-950 md:px-6">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
        <header className="border-b border-neutral-300 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            FlowCode layout debug
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
            Galeria interna de layout
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-700">
            Ejemplos generados desde fixtures estables para revisar importacion,
            auto-layout, codegen y calidad visual basica.
          </p>
        </header>

        <LayoutDebugClient examples={examples} />
      </div>
    </main>
  );
}

function createDebugExample(fixture: (typeof flowStabilityFixtures)[number]) {
  const importResult = importJavaScriptToFlow(fixture.code);

  if (!importResult.ok) {
    return {
      id: fixture.id,
      name: fixture.name,
      code: fixture.code,
      codegenWarnings: [],
      diagram: null,
      expectedImportOk: fixture.expectations.importOk,
      importError: importResult.message,
      importWarnings: [],
      quality: null,
      validationMessages: [],
    } satisfies LayoutDebugExample;
  }

  const codegenResult = generateJavaScriptFromFlow({
    nodes: importResult.nodes as FlowEditorNode[],
    edges: importResult.edges,
    functions: importResult.functions as unknown as Parameters<
      typeof generateJavaScriptFromFlow
    >[0]["functions"],
  });
  const validationMessages = validateFlowDiagram({
    nodes: importResult.nodes as FlowEditorNode[],
    edges: importResult.edges,
    functions: importResult.functions as unknown as Parameters<
      typeof validateFlowDiagram
    >[0]["functions"],
  }).map((issue) => issue.message);
  const diagram = {
    nodes: importResult.nodes,
    edges: importResult.edges,
  };

  return {
    id: fixture.id,
    name: fixture.name,
    code: fixture.code,
    codegenWarnings: codegenResult.warnings,
    diagram,
    expectedImportOk: fixture.expectations.importOk,
    importError: null,
    importWarnings: importResult.warnings,
    quality: analyzeFlowLayout(diagram),
    validationMessages,
  } satisfies LayoutDebugExample;
}
