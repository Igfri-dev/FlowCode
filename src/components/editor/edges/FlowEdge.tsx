import { useEffect, useState } from "react";
import {
  BaseEdge,
  EdgeText,
  getSmoothStepPath,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import type { FlowEditorEdge } from "@/types/flow";
import {
  areBridgeRenderDataEqual,
  getEdgeBridgeRenderData,
  type EdgeBridgeRenderData,
} from "./edge-bridges";

const defaultEdgeStroke = "#525252";
const defaultEdgeStrokeWidth = 3;
const selectedEdgeStroke = "#2563eb";
const selectedEdgeHalo = "#bfdbfe";

export function FlowEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  markerStart,
  style,
  selected,
  label,
  labelShowBg,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps<FlowEditorEdge>) {
  const layoutRevision = useStore((store) =>
    [
      store.nodes
        .map(
          (node) =>
            `${node.id}:${node.position.x}:${node.position.y}:${
              node.measured?.width ?? node.width ?? ""
            }:${node.measured?.height ?? node.height ?? ""}`,
        )
        .join("|"),
      store.edges
        .map(
          (edge) =>
            `${edge.id}:${edge.source}:${edge.target}:${
              edge.sourceHandle ?? ""
            }:${edge.targetHandle ?? ""}`,
        )
        .join("|"),
    ].join("::"),
  );
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const [bridgeRenderData, setBridgeRenderData] =
    useState<EdgeBridgeRenderData>({
      bridgePoints: [],
      displayPath: edgePath,
    });
  const stroke =
    typeof style?.stroke === "string"
      ? style.stroke
      : selected
        ? selectedEdgeStroke
        : defaultEdgeStroke;
  const strokeWidth =
    typeof style?.strokeWidth === "number"
      ? style.strokeWidth
      : defaultEdgeStrokeWidth;
  const displayPath =
    bridgeRenderData.bridgePoints.length > 0
      ? bridgeRenderData.displayPath
      : edgePath;
  const displayStrokeWidth = selected ? strokeWidth + 1.5 : strokeWidth;

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const nextBridgeRenderData = getEdgeBridgeRenderData({
        currentEdgeId: id,
        fallbackPath: edgePath,
      });

      setBridgeRenderData((previousBridgeRenderData) =>
        areBridgeRenderDataEqual(
          previousBridgeRenderData,
          nextBridgeRenderData,
        )
          ? previousBridgeRenderData
          : nextBridgeRenderData,
      );
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [edgePath, id, layoutRevision]);

  return (
    <>
      {selected ? (
        <path
          d={displayPath}
          fill="none"
          stroke={selectedEdgeHalo}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth + 8}
          pointerEvents="none"
        />
      ) : null}
      <BaseEdge
        id={id}
        path={edgePath}
        data-flow-edge-path={id}
        data-flow-edge-source={source}
        data-flow-edge-target={target}
        interactionWidth={34}
        style={{
          ...style,
          stroke: "transparent",
          strokeWidth: 1,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
      <path
        className="react-flow__edge-path"
        d={displayPath}
        fill="none"
        markerStart={markerStart}
        markerEnd={markerEnd}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={displayStrokeWidth}
        style={{
          stroke,
          strokeWidth: displayStrokeWidth,
        }}
        pointerEvents="none"
      />
      <EdgeText
        x={labelX}
        y={labelY}
        label={label}
        labelShowBg={labelShowBg}
        labelStyle={{
          ...labelStyle,
          fill: selected ? selectedEdgeStroke : labelStyle?.fill,
          fontWeight: selected ? 800 : labelStyle?.fontWeight,
        }}
        labelBgStyle={{
          ...labelBgStyle,
          fill: selected ? "#eff6ff" : labelBgStyle?.fill,
          stroke: selected ? selectedEdgeStroke : labelBgStyle?.stroke,
          strokeWidth: selected ? 1 : labelBgStyle?.strokeWidth,
        }}
        labelBgPadding={labelBgPadding ?? [6, 4]}
        labelBgBorderRadius={labelBgBorderRadius ?? 4}
      />
    </>
  );
}
