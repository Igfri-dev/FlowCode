import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import {
  getNodesBounds,
  getViewportForBounds,
  type useEdgesState,
  type useNodesState,
} from "@xyflow/react";
import { toJpeg, toPng, toSvg } from "html-to-image";
import {
  generateJavaScriptFromFlow,
  type FlowCodeGenerationResult,
} from "@/features/flow/codegen";
import { importJavaScriptToFlow } from "@/features/flow/parser";
import type { useI18n } from "@/features/i18n/I18nProvider";
import type {
  ImportedFlowFunctionDefinition,
  ImportedFlowNode,
} from "@/features/flow/parser";
import type {
  FlowEditorEdge,
  FlowEditorNode,
  FlowFunctionDefinition,
  FlowProgram,
} from "@/types/flow";
import type { FlowExportOptions } from "../FlowExportModal";
import {
  createFlowDiagramExportFile,
  getDiagramById,
  getDiagramNameById,
  getImportActiveDiagramId,
  getNextFunctionCounter,
  getNextNodeCounter,
  hasDiagramContent,
  parseFlowDiagramExportFile,
} from "./flowWorkspaceSerialization";

export const initialCodeGenerationResult: FlowCodeGenerationResult = {
  code: "",
  warnings: [],
};

export type ImportStatus = "idle" | "success" | "error";

type SetNodes = ReturnType<typeof useNodesState<FlowEditorNode>>[1];
type SetEdges = ReturnType<typeof useEdgesState<FlowEditorEdge>>[1];

export function useFlowImportExport({
  activeDiagramId,
  createEditorNodeFromImport,
  createFunctionDefinitionFromImport,
  currentProgram,
  nextFunctionIdRef,
  nextNodeIdRef,
  nodes,
  onClearExerciseSelection,
  requestReplaceConfirmation,
  resetExecutionForDiagram,
  setActiveDiagramId,
  setBlockedConnectionMessage,
  setEdges,
  setFunctions,
  setIsAutoRunning,
  setMainDiagram,
  setNodes,
  t,
}: {
  activeDiagramId: string;
  createEditorNodeFromImport: (node: ImportedFlowNode) => FlowEditorNode;
  createFunctionDefinitionFromImport: (
    flowFunction: ImportedFlowFunctionDefinition,
  ) => FlowFunctionDefinition;
  currentProgram: FlowProgram;
  nextFunctionIdRef: RefObject<number>;
  nextNodeIdRef: RefObject<number>;
  nodes: FlowEditorNode[];
  onClearExerciseSelection: () => void;
  requestReplaceConfirmation: (onConfirm: () => void) => void;
  resetExecutionForDiagram: (diagramId: string, name: string) => void;
  setActiveDiagramId: (diagramId: string) => void;
  setBlockedConnectionMessage: (message: string | null) => void;
  setEdges: SetEdges;
  setFunctions: (
    value:
      | FlowFunctionDefinition[]
      | ((currentFunctions: FlowFunctionDefinition[]) => FlowFunctionDefinition[]),
  ) => void;
  setIsAutoRunning: (isAutoRunning: boolean) => void;
  setMainDiagram: (diagram: FlowProgram["main"]) => void;
  setNodes: SetNodes;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement | null>(null);
  const [codeGenerationResult, setCodeGenerationResult] = useState(
    initialCodeGenerationResult,
  );
  const [importCode, setImportCode] = useState("");
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const resetCodeGeneration = useCallback(() => {
    setCodeGenerationResult(initialCodeGenerationResult);
  }, []);

  const handleGenerateCode = useCallback(() => {
    setCodeGenerationResult(
      generateJavaScriptFromFlow({
        nodes: currentProgram.main.nodes,
        edges: currentProgram.main.edges,
        functions: currentProgram.functions,
      }),
    );
  }, [currentProgram]);

  const handleImportCode = useCallback(() => {
    const importResult = importJavaScriptToFlow(importCode);

    if (!importResult.ok) {
      setImportStatus("error");
      setImportMessage(importResult.message);
      setImportWarnings([]);
      return;
    }

    const importedNodes = importResult.nodes.map(createEditorNodeFromImport);
    const importedFunctions = importResult.functions.map(
      createFunctionDefinitionFromImport,
    );
    const nextMainDiagram = {
      nodes: importedNodes,
      edges: importResult.edges,
    };
    const importedNodeCount =
      importResult.nodes.length +
      importResult.functions.reduce(
        (count, flowFunction) => count + flowFunction.nodes.length,
        0,
      );

    setBlockedConnectionMessage(null);
    setIsAutoRunning(false);
    resetExecutionForDiagram("main", t("flow.main"));
    setCodeGenerationResult(initialCodeGenerationResult);
    setImportStatus("success");
    setImportMessage(
      importedFunctions.length > 0
        ? t("flow.importGeneratedWithFunctions")
        : t("flow.importGenerated"),
    );
    setImportWarnings(importResult.warnings);
    nextNodeIdRef.current = importedNodeCount;
    setActiveDiagramId("main");
    setMainDiagram(nextMainDiagram);
    setFunctions(importedFunctions);
    setNodes(nextMainDiagram.nodes);
    setEdges(nextMainDiagram.edges);
  }, [
    createEditorNodeFromImport,
    createFunctionDefinitionFromImport,
    importCode,
    nextNodeIdRef,
    resetExecutionForDiagram,
    setActiveDiagramId,
    setBlockedConnectionMessage,
    setEdges,
    setFunctions,
    setIsAutoRunning,
    setMainDiagram,
    setNodes,
    t,
  ]);

  const handleOpenExportModal = useCallback(() => {
    setExportError(null);
    setIsExportModalOpen(true);
  }, []);

  const handleCloseExportModal = useCallback(() => {
    if (isExporting) {
      return;
    }

    setExportError(null);
    setIsExportModalOpen(false);
  }, [isExporting]);

  const handleExportDiagram = useCallback(
    async (options: FlowExportOptions) => {
      setIsExporting(true);
      setExportError(null);

      try {
        const generatedCode = generateJavaScriptFromFlow({
          nodes: currentProgram.main.nodes,
          edges: currentProgram.main.edges,
          functions: currentProgram.functions,
        });
        const baseFileName = createExportBaseFileName();

        if (options.includeImage) {
          await exportDiagramImage({
            editorShell: editorShellRef.current,
            fileName: `${baseFileName}.${options.imageFormat}`,
            format: options.imageFormat,
            nodes,
            noDiagramMessage: t("flow.exportNoDiagram"),
            transparentBackground: options.transparentBackground,
          });
        }

        if (options.includeJavaScript) {
          downloadTextFile({
            content: generatedCode.code,
            fileName: `${baseFileName}.js`,
            mimeType: "text/javascript;charset=utf-8",
          });
        }

        if (options.includeJson) {
          downloadTextFile({
            content: JSON.stringify(
              createFlowDiagramExportFile({
                activeDiagramId,
                codeGenerationResult: generatedCode,
                program: currentProgram,
              }),
              null,
              2,
            ),
            fileName: `${baseFileName}.json`,
            mimeType: "application/json;charset=utf-8",
          });
        }

        setCodeGenerationResult(generatedCode);
        setIsExportModalOpen(false);
      } catch (error) {
        setExportError(
          error instanceof Error
            ? error.message
            : t("flow.exportImageError"),
        );
      } finally {
        setIsExporting(false);
      }
    },
    [activeDiagramId, currentProgram, nodes, t],
  );

  const handleImportJsonButtonClick = useCallback(() => {
    importJsonInputRef.current?.click();
  }, []);

  const handleImportJsonFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      try {
        const importedDiagram = parseFlowDiagramExportFile(
          await file.text(),
          createEditorNodeFromImport,
          t("flow.importJsonInvalid"),
        );

        if (!importedDiagram.ok) {
          setImportStatus("error");
          setImportMessage(importedDiagram.message);
          setImportWarnings([]);
          return;
        }

        const applyImport = () => {
          const nextProgram = importedDiagram.program;
          const nextActiveDiagramId = getImportActiveDiagramId(
            importedDiagram.activeDiagramId,
            nextProgram,
          );
          const nextActiveDiagram = getDiagramById(
            nextProgram,
            nextActiveDiagramId,
          );
          const nextActiveDiagramName = getDiagramNameById(
            nextProgram,
            nextActiveDiagramId,
            t,
          );
          const nextCode =
            importedDiagram.code.trim().length > 0
              ? importedDiagram.code
              : generateJavaScriptFromFlow({
                  nodes: nextProgram.main.nodes,
                  edges: nextProgram.main.edges,
                  functions: nextProgram.functions,
                }).code;

          setBlockedConnectionMessage(null);
          setIsAutoRunning(false);
          onClearExerciseSelection();
          setActiveDiagramId(nextActiveDiagramId);
          setMainDiagram(nextProgram.main);
          setFunctions(nextProgram.functions);
          setNodes(nextActiveDiagram.nodes);
          setEdges(nextActiveDiagram.edges);
          setImportCode(nextCode);
          setImportStatus("success");
          setImportMessage(t("flow.importJsonSuccess"));
          setImportWarnings([]);
          setCodeGenerationResult({
            code: nextCode,
            warnings: importedDiagram.codeWarnings,
          });
          resetExecutionForDiagram(nextActiveDiagramId, nextActiveDiagramName);
          nextNodeIdRef.current = getNextNodeCounter(nextProgram);
          nextFunctionIdRef.current = getNextFunctionCounter(nextProgram);
        };

        if (hasDiagramContent(currentProgram)) {
          requestReplaceConfirmation(applyImport);
          return;
        }

        applyImport();
      } catch {
        setImportStatus("error");
        setImportMessage(t("flow.importJsonReadError"));
        setImportWarnings([]);
      }

      return undefined;
    },
    [
      createEditorNodeFromImport,
      currentProgram,
      nextFunctionIdRef,
      nextNodeIdRef,
      onClearExerciseSelection,
      requestReplaceConfirmation,
      resetExecutionForDiagram,
      setActiveDiagramId,
      setBlockedConnectionMessage,
      setEdges,
      setFunctions,
      setIsAutoRunning,
      setMainDiagram,
      setNodes,
      t,
    ],
  );

  return {
    codeGenerationResult,
    editorShellRef,
    exportError,
    handleCloseExportModal,
    handleExportDiagram,
    handleGenerateCode,
    handleImportCode,
    handleImportJsonButtonClick,
    handleImportJsonFileChange,
    handleOpenExportModal,
    importCode,
    importJsonInputRef,
    importMessage,
    importStatus,
    importWarnings,
    isExportModalOpen,
    isExporting,
    resetCodeGeneration,
    setCodeGenerationResult,
    setImportCode,
    setImportMessage,
    setImportStatus,
    setImportWarnings,
  };
}

async function exportDiagramImage({
  editorShell,
  fileName,
  format,
  nodes,
  noDiagramMessage,
  transparentBackground,
}: {
  editorShell: HTMLDivElement | null;
  fileName: string;
  format: FlowExportOptions["imageFormat"];
  nodes: FlowEditorNode[];
  noDiagramMessage: string;
  transparentBackground: boolean;
}) {
  if (nodes.length === 0) {
    throw new Error(noDiagramMessage);
  }

  const viewport = editorShell?.querySelector<HTMLElement>(
    ".react-flow__viewport",
  );

  if (!viewport) {
    throw new Error(noDiagramMessage);
  }

  const bounds = getNodesBounds(nodes);
  const imageWidth = clampNumber(Math.ceil(bounds.width + 180), 900, 5000);
  const imageHeight = clampNumber(Math.ceil(bounds.height + 180), 640, 5000);
  const exportViewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.1,
    1.6,
    0.14,
  );
  const imageOptions = {
    backgroundColor:
      transparentBackground && format !== "jpg" ? undefined : "#f5f5f5",
    cacheBust: true,
    height: imageHeight,
    pixelRatio: 2,
    skipAutoScale: true,
    style: {
      height: `${imageHeight}px`,
      transform: `translate(${exportViewport.x}px, ${exportViewport.y}px) scale(${exportViewport.zoom})`,
      width: `${imageWidth}px`,
    },
    width: imageWidth,
  };
  const dataUrl =
    format === "svg"
      ? await toSvg(viewport, imageOptions)
      : format === "jpg"
        ? await toJpeg(viewport, {
            ...imageOptions,
            quality: 0.95,
          })
        : await toPng(viewport, imageOptions);

  downloadDataUrl({
    dataUrl,
    fileName,
  });
}

function createExportBaseFileName() {
  return `flowcode-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19)}`;
}

function downloadTextFile({
  content,
  fileName,
  mimeType,
}: {
  content: string;
  fileName: string;
  mimeType: string;
}) {
  const blob = new Blob([content], {
    type: mimeType,
  });
  const objectUrl = URL.createObjectURL(blob);

  downloadDataUrl({
    dataUrl: objectUrl,
    fileName,
  });
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function downloadDataUrl({
  dataUrl,
  fileName,
}: {
  dataUrl: string;
  fileName: string;
}) {
  const link = document.createElement("a");

  link.download = fileName;
  link.href = dataUrl;
  link.click();
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
