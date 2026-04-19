"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
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
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
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

const fullscreenDrawerButtonClassName =
  "nodrag nopan nowheel pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-800 shadow-md transition-all hover:border-neutral-500 hover:bg-neutral-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2";

const fullscreenPanelTopOffsets = {
  left: [80, 265, 610],
  right: [96, 300, 504],
} as const;

const fullscreenPanelGap = 18;
const fullscreenPanelPadding = 32;
const fullscreenPanelBottomInset = {
  left: 170,
  right: 220,
} as const;

function getFullscreenPanelTopOffset(
  side: "left" | "right",
  index: number,
) {
  const offsets = fullscreenPanelTopOffsets[side];
  const fallbackSpacing = 224;
  const fallbackStart = offsets[offsets.length - 1] + fallbackSpacing;

  return (
    offsets[index] ??
    fallbackStart + (index - offsets.length) * fallbackSpacing
  );
}

function getFullscreenPanelOuterSpace(
  side: "left" | "right",
  index: number,
) {
  const offsets = fullscreenPanelTopOffsets[side];
  const currentOffset = getFullscreenPanelTopOffset(side, index);
  const nextOffset = offsets[index + 1];

  if (nextOffset !== undefined) {
    return Math.max(128, nextOffset - currentOffset - fullscreenPanelGap);
  }

  return `max(156px, calc(100vh - ${
    currentOffset + fullscreenPanelBottomInset[side]
  }px))`;
}

function getFullscreenPanelContentMaxHeight(
  side: "left" | "right",
  index: number,
) {
  const outerSpace = getFullscreenPanelOuterSpace(side, index);

  if (typeof outerSpace === "number") {
    return `${Math.max(96, outerSpace - fullscreenPanelPadding)}px`;
  }

  return `calc(${outerSpace} - ${fullscreenPanelPadding}px)`;
}

function getFullscreenEdgeZoneHeight(
  side: "left" | "right",
  index: number,
) {
  const outerSpace = getFullscreenPanelOuterSpace(side, index);

  if (typeof outerSpace === "number") {
    return `${outerSpace}px`;
  }

  return "128px";
}

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

type FlowEditorProps = {
  nodes: FlowEditorNode[];
  edges: FlowEditorEdge[];
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  onNodesChange: OnNodesChange<FlowEditorNode>;
  onEdgesChange: OnEdgesChange<FlowEditorEdge>;
  onConnect: OnConnect;
  isValidConnection: IsValidConnection<FlowEditorEdge>;
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
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  isValidConnection,
  editorOverlays,
  fullscreenBottomItem,
  fullscreenLeftItems = [],
  fullscreenRightItems = [],
}: FlowEditorProps) {
  const editorShellRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMiniMapCollapsed, setIsMiniMapCollapsed] = useState(false);
  const [openFullscreenPanels, setOpenFullscreenPanels] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === editorShellRef.current);
    };

    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
    };
  }, []);

  const handleToggleFullscreen = useCallback(async () => {
    const editorShell = editorShellRef.current;

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
    setIsMiniMapCollapsed((currentIsMiniMapCollapsed) =>
      !currentIsMiniMapCollapsed,
    );
  }, []);

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
      ref={editorShellRef}
      className={`relative h-full min-h-[580px] bg-neutral-100 ${
        isFullscreen ? "h-screen min-h-screen" : ""
      }`}
    >
      <ReactFlow<FlowEditorNode, FlowEditorEdge>
        className={`flow-editor-canvas h-full min-h-[580px] bg-neutral-100 [&_.react-flow__pane]:cursor-grab [&_.react-flow__pane.dragging]:cursor-grabbing [&_.react-flow__renderer]:transition-colors ${
          isFullscreen ? "min-h-screen" : ""
        }`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
          variant={BackgroundVariant.Lines}
          color="#d4d4d4"
          gap={24}
        />
        <Panel position="top-right" className="!m-4">
          <button
            type="button"
            className={editorButtonClassName}
            title={
              isFullscreen ? "Salir pantalla completa" : "Pantalla completa"
            }
            aria-label={
              isFullscreen ? "Salir pantalla completa" : "Pantalla completa"
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
          className="!rounded-md !border !border-neutral-300 !bg-white !shadow-md [&_button]:!border-neutral-200 [&_button]:!transition-colors [&_button:hover]:!bg-emerald-50 [&_button:hover]:!text-emerald-800"
          aria-label="Controles del diagrama"
        />
        {isMiniMapCollapsed ? (
          <Panel position="bottom-right" className="!m-4">
            <button
              type="button"
              className="nodrag nopan nowheel bg-transparent px-1 text-lg font-semibold leading-none text-neutral-700 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              title="Mostrar minimapa"
              aria-label="Mostrar minimapa"
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
              maskColor="rgba(245, 245, 245, 0.68)"
              maskStrokeColor="#525252"
              maskStrokeWidth={1}
              offsetScale={8}
              zoomStep={12}
              ariaLabel="Mini mapa del diagrama"
              className="!m-4 !rounded-md !border !border-neutral-300 !bg-white !shadow-lg"
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
                title="Minimizar minimapa"
                aria-label="Minimizar minimapa"
                aria-expanded="true"
                onClick={handleToggleMiniMap}
              >
                <MiniMapCollapseIcon />
              </button>
            </Panel>
          </>
        )}
      </ReactFlow>
      {isFullscreen ? (
        <>
          {fullscreenLeftItems.map((item, index) => (
            <FullscreenFloatingPanel
              key={item.id}
              item={item}
              index={index}
              isOpen={isFullscreenPanelOpen(item)}
              side="left"
              onOpenChange={(isOpen) =>
                setFullscreenPanelOpen(item.id, isOpen)
              }
            />
          ))}
          {fullscreenRightItems.map((item, index) => (
            <FullscreenFloatingPanel
              key={item.id}
              item={item}
              index={index}
              isOpen={isFullscreenPanelOpen(item)}
              side="right"
              onOpenChange={(isOpen) =>
                setFullscreenPanelOpen(item.id, isOpen)
              }
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
  isOpen: boolean;
  item: FullscreenFloatingPanelItem;
  onOpenChange: (isOpen: boolean) => void;
  side: "left" | "right";
};

function FullscreenFloatingPanel({
  index,
  isOpen,
  item,
  onOpenChange,
  side,
}: FullscreenFloatingPanelProps) {
  const top = `${getFullscreenPanelTopOffset(side, index)}px`;
  const contentMaxHeight = getFullscreenPanelContentMaxHeight(side, index);
  const edgeStyle: CSSProperties = {
    top,
    height: getFullscreenEdgeZoneHeight(side, index),
  };
  const edgeClassName =
    side === "left"
      ? "pointer-events-none absolute left-0 z-30 w-32 group/fullscreen-edge"
      : "pointer-events-none absolute right-0 z-30 w-32 group/fullscreen-edge";
  const edgeAuraClassName =
    side === "left"
      ? "absolute left-0 top-1/2 h-24 w-24 -translate-x-14 -translate-y-1/2 rounded-r-full bg-sky-400/25 opacity-0 blur-sm shadow-[0_0_34px_rgba(14,165,233,0.42)] transition-all duration-200 ease-out group-hover/fullscreen-edge:-translate-x-3 group-hover/fullscreen-edge:opacity-100"
      : "absolute right-0 top-1/2 h-24 w-24 translate-x-14 -translate-y-1/2 rounded-l-full bg-sky-400/25 opacity-0 blur-sm shadow-[0_0_34px_rgba(14,165,233,0.42)] transition-all duration-200 ease-out group-hover/fullscreen-edge:translate-x-3 group-hover/fullscreen-edge:opacity-100";
  const edgeProtrusionClassName =
    side === "left"
      ? "absolute left-0 top-1/2 h-12 w-9 -translate-x-8 -translate-y-1/2 rounded-r-full bg-sky-300/55 opacity-0 shadow-[0_0_22px_rgba(56,189,248,0.55)] transition-all duration-200 ease-out group-hover/fullscreen-edge:-translate-x-1 group-hover/fullscreen-edge:opacity-100"
      : "absolute right-0 top-1/2 h-12 w-9 translate-x-8 -translate-y-1/2 rounded-l-full bg-sky-300/55 opacity-0 shadow-[0_0_22px_rgba(56,189,248,0.55)] transition-all duration-200 ease-out group-hover/fullscreen-edge:translate-x-1 group-hover/fullscreen-edge:opacity-100";
  const closedButtonClassName =
    side === "left"
      ? `${fullscreenDrawerButtonClassName} absolute left-4 top-1/2 -translate-x-12 -translate-y-1/2 opacity-0 duration-200 ease-out group-hover/fullscreen-edge:translate-x-0 group-hover/fullscreen-edge:opacity-100`
      : `${fullscreenDrawerButtonClassName} absolute right-4 top-1/2 translate-x-12 -translate-y-1/2 opacity-0 duration-200 ease-out group-hover/fullscreen-edge:translate-x-0 group-hover/fullscreen-edge:opacity-100`;
  const panelClassName =
    side === "left"
      ? "fullscreen-overlay-content pointer-events-auto absolute left-4 z-30 flex w-80 flex-col overflow-hidden rounded-[24px] border border-neutral-300 bg-white/95 p-4 shadow-xl backdrop-blur"
      : "fullscreen-overlay-content pointer-events-auto absolute right-4 z-30 flex w-80 flex-col overflow-hidden rounded-[24px] border border-neutral-300 bg-white/95 p-4 shadow-xl backdrop-blur";
  const openButtonClassName =
    side === "left"
      ? "nodrag nopan nowheel absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-transparent text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      : "nodrag nopan nowheel absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-transparent text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600";
  const contentPadding = side === "left" ? "pr-8" : "pl-8";

  if (isOpen) {
    return (
      <aside className={panelClassName} style={{ top }}>
        <ScrollableFullscreenPanelContent
          className={contentPadding}
          style={{ maxHeight: contentMaxHeight }}
        >
          {item.children}
        </ScrollableFullscreenPanelContent>
        <button
          type="button"
          className={openButtonClassName}
          title={`Ocultar ${item.label}`}
          aria-label={`Ocultar ${item.label}`}
          aria-expanded="true"
          onClick={() => onOpenChange(false)}
        >
          {side === "left" ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
      </aside>
    );
  }

  return (
    <div className={edgeClassName} style={edgeStyle}>
      <div className={edgeAuraClassName} aria-hidden="true" />
      <div className={edgeProtrusionClassName} aria-hidden="true" />
      <div className="pointer-events-auto absolute inset-0" aria-hidden="true" />
      <button
        type="button"
        className={closedButtonClassName}
        title={`Mostrar ${item.label}`}
        aria-label={`Mostrar ${item.label}`}
        aria-expanded="false"
        onClick={() => onOpenChange(true)}
      >
        {item.buttonLabel}
      </button>
    </div>
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
  if (isOpen) {
    return (
      <aside className="fullscreen-overlay-content pointer-events-auto absolute bottom-4 left-1/2 z-30 w-[min(68rem,calc(100vw-18rem))] -translate-x-1/2 rounded-[28px] border border-neutral-300 bg-white/95 p-4 pr-10 shadow-xl backdrop-blur">
        <button
          type="button"
          className="nodrag nopan nowheel absolute right-3 top-3 flex h-6 w-6 items-center justify-center bg-transparent text-neutral-600 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          title={`Ocultar ${item.label}`}
          aria-label={`Ocultar ${item.label}`}
          aria-expanded="true"
          onClick={() => onOpenChange(false)}
        >
          <MiniMapCollapseIcon />
        </button>
        <ScrollableFullscreenPanelContent>
          {item.children}
        </ScrollableFullscreenPanelContent>
      </aside>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center group/fullscreen-bottom">
      <div
        className="absolute bottom-0 left-1/2 h-20 w-[26rem] -translate-x-1/2 translate-y-12 rounded-t-full bg-sky-400/25 opacity-0 blur-sm shadow-[0_0_34px_rgba(14,165,233,0.42)] transition-all duration-200 ease-out group-hover/fullscreen-bottom:translate-y-4 group-hover/fullscreen-bottom:opacity-100"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-0 left-1/2 h-10 w-20 -translate-x-1/2 translate-y-8 rounded-t-full bg-sky-300/55 opacity-0 shadow-[0_0_22px_rgba(56,189,248,0.55)] transition-all duration-200 ease-out group-hover/fullscreen-bottom:translate-y-2 group-hover/fullscreen-bottom:opacity-100"
        aria-hidden="true"
      />
      <div
        className="pointer-events-auto h-20 w-80 max-w-[60vw]"
        aria-hidden="true"
      />
      <button
        type="button"
        className={`${fullscreenDrawerButtonClassName} absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-10 opacity-0 duration-200 ease-out group-hover/fullscreen-bottom:translate-y-0 group-hover/fullscreen-bottom:opacity-100`}
        title={`Mostrar ${item.label}`}
        aria-label={`Mostrar ${item.label}`}
        aria-expanded="false"
        onClick={() => onOpenChange(true)}
      >
        {item.buttonLabel}
      </button>
    </div>
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
