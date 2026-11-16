"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type EdgeTypes,
  type IsValidConnection,
  type NodeTypes,
  type OnConnect,
  type OnNodeDrag,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import { EdgeBridgeRenderContext } from "@/components/editor/edges/FlowEdge";
import { useI18n } from "@/features/i18n/I18nProvider";
import type { FlowEditorEdge, FlowEditorNode } from "@/types/flow";

const fitViewOptions = {
  padding: 0.24,
  minZoom: 0.35,
  maxZoom: 1.15,
  duration: 300,
};

const miniMapSize = {
  width: 200,
  height: 150,
};

const editorButtonClassName =
  "nodrag nopan nowheel flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 bg-white text-neutral-800 shadow-md transition-colors hover:border-neutral-500 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

const miniMapButtonClassName =
  "nodrag nopan nowheel pointer-events-auto absolute right-1 top-1 flex h-6 w-6 items-center justify-center bg-transparent text-neutral-700 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

function getMiniMapNodeColor(node: FlowEditorNode) {
  if (node.type === "start") {
    return "#bbf7d0";
  }

  if (node.type === "end") {
    return "#fecaca";
  }

  if (node.type === "decision") {
    return "#a5f3fc";
  }

  if (node.type === "input") {
    return "#bae6fd";
  }

  if (node.type === "output") {
    return "#fde68a";
  }

  if (node.type === "functionCall") {
    return "#ddd6fe";
  }

  if (node.type === "return") {
    return "#fecdd3";
  }

  return "#f5f5f5";
}

function getMiniMapNodeStrokeColor(node: FlowEditorNode) {
  if (node.type === "start") {
    return "#059669";
  }

  if (node.type === "end") {
    return "#b91c1c";
  }

  if (node.type === "decision") {
    return "#0891b2";
  }

  if (node.type === "input") {
    return "#0369a1";
  }

  if (node.type === "output") {
    return "#b45309";
  }

  if (node.type === "functionCall") {
    return "#7c3aed";
  }

  if (node.type === "return") {
    return "#be123c";
  }

  return "#525252";
}

function getEdgeTopologyKey(edges: FlowEditorEdge[]) {
  return edges
    .map(
      (edge) =>
        `${edge.id}:${edge.source}:${edge.sourceHandle ?? ""}:${
          edge.target
        }:${edge.targetHandle ?? ""}`,
    )
    .join("|");
}

type FlowEditorProps = {
  diagramId: string;
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  onNodesChange: OnNodesChange<FlowEditorNode>;
  onEdgesChange: OnEdgesChange<FlowEditorEdge>;
  onConnect: OnConnect;
  onNodeDragStart?: OnNodeDrag<FlowEditorNode>;
  onNodeDragStop?: OnNodeDrag<FlowEditorNode>;
  isValidConnection: IsValidConnection<FlowEditorEdge>;
  editorShellRef?: MutableRefObject<HTMLDivElement | null>;
  editorOverlays?: ReactNode;
  fullscreenBottomItem?: FullscreenFloatingPanelItem;
  fullscreenLeftItems?: FullscreenFloatingPanelItem[];
  fullscreenRightItems?: FullscreenFloatingPanelItem[];
};

export type FullscreenFloatingPanelItem = {
  id: string;
  label: string;
  buttonLabel: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function FlowEditor({
  diagramId,
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDragStart,
  onNodeDragStop,
  isValidConnection,
  editorShellRef: externalEditorShellRef,
  editorOverlays,
  fullscreenBottomItem,
  fullscreenLeftItems = [],
  fullscreenRightItems = [],
}: FlowEditorProps) {
  const { t } = useI18n();
  const internalEditorShellRef = useRef<HTMLDivElement>(null);
  const [areEdgeBridgesDisabled, setAreEdgeBridgesDisabled] = useState(false);
  const [nodeDragBridgeRevision, setNodeDragBridgeRevision] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMiniMapCollapsed, setIsMiniMapCollapsed] = useState(false);
  const [openFullscreenPanels, setOpenFullscreenPanels] = useState<
    Record<string, boolean>
  >({});
  const edgeTopologyKey = useMemo(() => getEdgeTopologyKey(edges), [edges]);

  const edgeBridgeRenderState = useMemo(
    () => ({
      disabled: areEdgeBridgesDisabled,
      revision: `${nodeDragBridgeRevision}:${edgeTopologyKey}`,
    }),
    [areEdgeBridgesDisabled, edgeTopologyKey, nodeDragBridgeRevision],
  );

  const setEditorShellRef = useCallback(
    (element: HTMLDivElement | null) => {
      internalEditorShellRef.current = element;

      if (externalEditorShellRef) {
        externalEditorShellRef.current = element;
      }
    },
    [externalEditorShellRef],
  );

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(
        document.fullscreenElement === internalEditorShellRef.current,
      );
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const editorShell = internalEditorShellRef.current;

    if (!editorShell) {
      return;
    }

    if (document.fullscreenElement === editorShell) {
      await document.exitFullscreen();
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }

    await editorShell.requestFullscreen();
  }, []);

  const handleToggleMiniMap = useCallback(() => {
    setIsMiniMapCollapsed(
      (currentIsMiniMapCollapsed) => !currentIsMiniMapCollapsed,
    );
  }, []);

  const handleNodeDragStart = useCallback<OnNodeDrag<FlowEditorNode>>(
    (event, node, draggedNodes) => {
      setAreEdgeBridgesDisabled(true);
      onNodeDragStart?.(event, node, draggedNodes);
    },
    [onNodeDragStart],
  );

  const handleNodeDragStop = useCallback<OnNodeDrag<FlowEditorNode>>(
    (event, node, draggedNodes) => {
      setAreEdgeBridgesDisabled(false);
      setNodeDragBridgeRevision((currentRevision) => currentRevision + 1);
      onNodeDragStop?.(event, node, draggedNodes);
    },
    [onNodeDragStop],
  );

  const isFullscreenPanelOpen = useCallback(
    (item: FullscreenFloatingPanelItem) =>
      openFullscreenPanels[item.id] ?? item.defaultOpen ?? false,
    [openFullscreenPanels],
  );

  const setFullscreenPanelOpen = useCallback(
    (itemId: string, isOpen: boolean) => {
      setOpenFullscreenPanels((currentOpenFullscreenPanels) => ({
        ...currentOpenFullscreenPanels,
        [itemId]: isOpen,
      }));
    },
    [],
  );

  return (
    <div
      ref={setEditorShellRef}
      className={`flow-editor-shell relative h-full min-h-[360px] bg-slate-50 ${
        isFullscreen ? "h-screen min-h-screen" : ""
      }`}
    >
      <EdgeBridgeRenderContext.Provider value={edgeBridgeRenderState}>
        <ReactFlow<FlowEditorNode, FlowEditorEdge>
          key={diagramId}
          className={`flow-editor-canvas h-full min-h-[360px] bg-slate-50 [&_.react-flow__pane]:cursor-grab [&_.react-flow__pane.dragging]:cursor-grabbing [&_.react-flow__renderer]:transition-colors ${
            isFullscreen ? "min-h-screen" : ""
          }`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={handleNodeDragStart}
          onNodeDragStop={handleNodeDragStop}
          isValidConnection={isValidConnection}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionRadius={32}
          connectionDragThreshold={6}
          fitView
          fitViewOptions={fitViewOptions}
          minZoom={0.18}
          maxZoom={2.2}
          nodesDraggable
          selectNodesOnDrag={false}
          nodeDragThreshold={3}
          nodeClickDistance={3}
          panOnDrag={[0, 1, 2]}
          panActivationKeyCode="Space"
          selectionKeyCode="Shift"
          selectionOnDrag={false}
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnScroll={false}
          autoPanOnNodeDrag
          autoPanOnConnect
          autoPanSpeed={16}
          elevateNodesOnSelect
          elevateEdgesOnSelect
          snapToGrid={false}
          snapGrid={[20, 20]}
          onlyRenderVisibleElements
          attributionPosition="top-right"
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="#cbd5e1"
            size={1.25}
            gap={24}
          />
          <Panel position="top-right" className="!m-4">
            <button
              type="button"
              className={editorButtonClassName}
              title={
                isFullscreen ? t("flow.exitFullscreen") : t("flow.fullscreen")
              }
              aria-label={
                isFullscreen ? t("flow.exitFullscreen") : t("flow.fullscreen")
              }
              aria-pressed={isFullscreen}
              onClick={() => {
                void handleToggleFullscreen();
              }}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </Panel>
          <Controls
            position="bottom-left"
            showFitView
            fitViewOptions={fitViewOptions}
            className="!rounded-xl !border !border-slate-200 !bg-white !shadow-sm [&_button]:!border-slate-100 [&_button]:!transition-colors [&_button:hover]:!bg-emerald-50 [&_button:hover]:!text-emerald-800"
            aria-label={t("flow.diagramControls")}
          />
          {isMiniMapCollapsed ? (
            <Panel position="bottom-right" className="!m-4">
              <button
                type="button"
                className="nodrag nopan nowheel bg-transparent px-1 text-lg font-semibold leading-none text-neutral-700 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                title={t("flow.showMiniMap")}
                aria-label={t("flow.showMiniMap")}
                aria-expanded="false"
                onClick={handleToggleMiniMap}
              >
                <MiniMapOpenIcon />
              </button>
            </Panel>
          ) : (
            <>
              <MiniMap<FlowEditorNode>
                position="bottom-right"
                pannable
                zoomable
                nodeColor={getMiniMapNodeColor}
                nodeStrokeColor={getMiniMapNodeStrokeColor}
                nodeStrokeWidth={3}
                nodeBorderRadius={4}
                bgColor="#ffffff"
                maskColor="rgba(248, 250, 252, 0.78)"
                maskStrokeColor="#94a3b8"
                maskStrokeWidth={1}
                offsetScale={8}
                zoomStep={12}
                ariaLabel={t("flow.miniMap")}
                className="!m-4 !rounded-xl !border !border-slate-200 !bg-white !shadow-sm"
                style={miniMapSize}
              />
              <Panel
                position="bottom-right"
                className="pointer-events-none !m-4 !z-20"
                style={miniMapSize}
              >
                <button
                  type="button"
                  className={miniMapButtonClassName}
                  title={t("flow.hideMiniMap")}
                  aria-label={t("flow.hideMiniMap")}
                  aria-expanded="true"
                  onClick={handleToggleMiniMap}
                >
                  <MiniMapCollapseIcon />
                </button>
              </Panel>
            </>
          )}
        </ReactFlow>
      </EdgeBridgeRenderContext.Provider>
      {isFullscreen ? (
        <>
          {fullscreenLeftItems.map((item, index) => (
            <FullscreenFloatingPanel
              key={item.id}
              item={item}
              index={index}
              itemCount={fullscreenLeftItems.length}
              isOpen={isFullscreenPanelOpen(item)}
              side="left"
              onOpenChange={(isOpen) => setFullscreenPanelOpen(item.id, isOpen)}
            />
          ))}
          {fullscreenRightItems.map((item, index) => (
            <FullscreenFloatingPanel
              key={item.id}
              item={item}
              index={index}
              itemCount={fullscreenRightItems.length}
              isOpen={isFullscreenPanelOpen(item)}
              side="right"
              onOpenChange={(isOpen) => setFullscreenPanelOpen(item.id, isOpen)}
            />
          ))}
          {fullscreenBottomItem ? (
            <FullscreenBottomFloatingPanel
              item={fullscreenBottomItem}
              isOpen={isFullscreenPanelOpen(fullscreenBottomItem)}
              onOpenChange={(isOpen) =>
                setFullscreenPanelOpen(fullscreenBottomItem.id, isOpen)
              }
            />
          ) : null}
        </>
      ) : null}
      {editorOverlays}
    </div>
  );
}

type FullscreenFloatingPanelProps = {
  index: number;
  itemCount: number;
  isOpen: boolean;
  item: FullscreenFloatingPanelItem;
  onOpenChange: (isOpen: boolean) => void;
  side: "left" | "right";
};

function FullscreenFloatingPanel({
  index,
  itemCount,
  isOpen,
  item,
  onOpenChange,
  side,
}: FullscreenFloatingPanelProps) {
  const { t } = useI18n();
  const toggleRef = useFullscreenToggleFocus(isOpen);
  // Keep all entry points between the top controls and the bottom minimap.
  const top = `calc(64px + max(180px, 100dvh - 264px) * ${(index + 0.5) / itemCount})`;
  const panelTop = `clamp(16px, calc(${top} - 80px), max(16px, calc(100dvh - 340px)))`;
  const panelId = `fullscreen-panel-${item.id}`;

  if (isOpen) {
    return (
      <aside
        id={panelId}
        aria-label={item.label}
        className={`fullscreen-drawer fullscreen-drawer--${side}`}
        style={{
          top: panelTop,
          maxHeight: `min(480px, calc(100dvh - ${panelTop} - 16px))`,
        }}
      >
        <FullscreenPanelHeader item={item}>
          <button
            ref={toggleRef}
            type="button"
            className="fullscreen-drawer__close nodrag nopan nowheel"
            title={t("flow.hidePanel", { label: item.label })}
            aria-label={t("flow.hidePanel", { label: item.label })}
            aria-expanded="true"
            aria-controls={panelId}
            onClick={() => onOpenChange(false)}
          >
            {side === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </button>
        </FullscreenPanelHeader>
        <ScrollableFullscreenPanelContent className="fullscreen-overlay-content fullscreen-drawer__body">
          {item.children}
        </ScrollableFullscreenPanelContent>
      </aside>
    );
  }

  return (
    <button
      ref={toggleRef}
      type="button"
      className={`fullscreen-edge-tab fullscreen-edge-tab--${side} nodrag nopan nowheel`}
      style={{ top }}
      title={t("flow.showPanel", { label: item.label })}
      aria-label={t("flow.showPanel", { label: item.label })}
      aria-expanded="false"
      onClick={() => onOpenChange(true)}
    >
      <span className="fullscreen-panel-icon">
        <FullscreenPanelIcon item={item} />
      </span>
    </button>
  );
}

function useFullscreenToggleFocus(isOpen: boolean) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const previousIsOpen = useRef(isOpen);

  useEffect(() => {
    if (previousIsOpen.current !== isOpen) {
      toggleRef.current?.focus({ preventScroll: true });
      previousIsOpen.current = isOpen;
    }
  }, [isOpen]);

  return toggleRef;
}

function FullscreenPanelHeader({
  item,
  children,
}: {
  item: FullscreenFloatingPanelItem;
  children: ReactNode;
}) {
  return (
    <div className="fullscreen-drawer__header">
      <span className="fullscreen-panel-icon">
        <FullscreenPanelIcon item={item} />
      </span>
      <h2 className="fullscreen-drawer__title">{item.label}</h2>
      {children}
    </div>
  );
}

function FullscreenPanelIcon({ item }: { item: FullscreenFloatingPanelItem }) {
  const paths: Record<string, string> = {
    execution: "m9 5 10 7-10 7V5Z",
    functions: "M15 4h-2a3 3 0 0 0-3 3v10a3 3 0 0 1-3 3H5m2-10h9",
    validation: "m8 12 3 3 5-6M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z",
    variables: "M8 4H6v6l-2 2 2 2v6h2m8-16h2v6l2 2-2 2v6h-2M10 12h4",
    outputs: "M4 5h16v14H4V5Zm4 4 3 3-3 3m5 0h3",
    history: "M4 10a8 8 0 1 1 1 7M4 4v6h6m2-3v5l3 2",
    blocks: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm14 0v7m-3-3.5h7",
  };
  const path = paths[item.id];

  return path ? (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  ) : (
    <span aria-hidden="true">{item.buttonLabel}</span>
  );
}

type ScrollableFullscreenPanelContentProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

type DragScrollState = {
  pointerId: number;
  scrollLeft: number;
  scrollTop: number;
  x: number;
  y: number;
};

function ScrollableFullscreenPanelContent({
  children,
  className = "",
  style,
}: ScrollableFullscreenPanelContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dragScrollStateRef = useRef<DragScrollState | null>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const contentElement = contentRef.current;

      if (
        event.button !== 0 ||
        isInteractiveScrollTarget(event.target) ||
        !contentElement ||
        (contentElement.scrollHeight <= contentElement.clientHeight &&
          contentElement.scrollWidth <= contentElement.clientWidth)
      ) {
        return;
      }

      dragScrollStateRef.current = {
        pointerId: event.pointerId,
        scrollLeft: contentElement.scrollLeft,
        scrollTop: contentElement.scrollTop,
        x: event.clientX,
        y: event.clientY,
      };
      contentElement.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const dragScrollState = dragScrollStateRef.current;
      const contentElement = contentRef.current;

      if (
        !dragScrollState ||
        dragScrollState.pointerId !== event.pointerId ||
        !contentElement
      ) {
        return;
      }

      const deltaX = event.clientX - dragScrollState.x;
      const deltaY = event.clientY - dragScrollState.y;

      if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) {
        return;
      }

      contentElement.scrollLeft = dragScrollState.scrollLeft - deltaX;
      contentElement.scrollTop = dragScrollState.scrollTop - deltaY;
      event.preventDefault();
    },
    [],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const contentElement = contentRef.current;

      if (contentElement?.hasPointerCapture(event.pointerId)) {
        contentElement.releasePointerCapture(event.pointerId);
      }

      dragScrollStateRef.current = null;
    },
    [],
  );

  return (
    <div
      ref={contentRef}
      className={`fullscreen-scroll-content min-h-0 overflow-auto overscroll-contain ${className}`}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      {children}
    </div>
  );
}

function isInteractiveScrollTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "a, button, input, label, select, textarea, [contenteditable='true'], [role='button']",
      ),
    )
  );
}

type FullscreenBottomFloatingPanelProps = {
  isOpen: boolean;
  item: FullscreenFloatingPanelItem;
  onOpenChange: (isOpen: boolean) => void;
};

function FullscreenBottomFloatingPanel({
  isOpen,
  item,
  onOpenChange,
}: FullscreenBottomFloatingPanelProps) {
  const { t } = useI18n();
  const toggleRef = useFullscreenToggleFocus(isOpen);
  const panelId = `fullscreen-panel-${item.id}`;

  if (isOpen) {
    return (
      <aside
        id={panelId}
        aria-label={item.label}
        className="fullscreen-drawer fullscreen-drawer--bottom"
      >
        <FullscreenPanelHeader item={item}>
          <button
            ref={toggleRef}
            type="button"
            className="fullscreen-drawer__close nodrag nopan nowheel"
            title={t("flow.hidePanel", { label: item.label })}
            aria-label={t("flow.hidePanel", { label: item.label })}
            aria-expanded="true"
            aria-controls={panelId}
            onClick={() => onOpenChange(false)}
          >
            <ChevronDownIcon />
          </button>
        </FullscreenPanelHeader>
        <ScrollableFullscreenPanelContent className="fullscreen-overlay-content fullscreen-drawer__body">
          {item.children}
        </ScrollableFullscreenPanelContent>
      </aside>
    );
  }

  return (
    <button
      ref={toggleRef}
      type="button"
      className="fullscreen-blocks-tab nodrag nopan nowheel"
      title={t("flow.showPanel", { label: item.label })}
      aria-label={t("flow.showPanel", { label: item.label })}
      aria-expanded="false"
      onClick={() => onOpenChange(true)}
    >
      <FullscreenPanelIcon item={item} />
      <span>{item.label}</span>
      <MiniMapOpenIcon />
    </button>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 4v5H4M15 4v5h5M20 15h-5v5M4 15h5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MiniMapCollapseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 12h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MiniMapOpenIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 15l6-6 6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
