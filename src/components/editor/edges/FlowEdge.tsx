import { createContext, useContext, useEffect, useState } from "react";
import {
  BaseEdge,
  EdgeText,
  Position,
  getSmoothStepPath,
  getStraightPath,
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
const straightEdgeAlignmentTolerance = 6;

export type EdgeBridgeRenderState = {
  disabled: boolean;
  revision: string;
};

export const EdgeBridgeRenderContext =
  createContext<EdgeBridgeRenderState>({
    disabled: false,
    revision: "0",
  });

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
  const bridgeRenderState = useContext(EdgeBridgeRenderContext);
  const [edgePath, labelX, labelY] = getFlowEdgePath({
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
    !bridgeRenderState.disabled && bridgeRenderData.bridgePoints.length > 0
      ? bridgeRenderData.displayPath
      : edgePath;
  const displayStrokeWidth = selected ? strokeWidth + 1.5 : strokeWidth;

  useEffect(() => {
    if (bridgeRenderState.disabled) {
      return;
    }

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
  }, [bridgeRenderState.disabled, bridgeRenderState.revision, edgePath, id]);

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

function getFlowEdgePath({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}) {
  if (
    shouldUseStraightEdge({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })
  ) {
    return getStraightPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
    });
  }

  return getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
}

function shouldUseStraightEdge({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}) {
  const isVerticalConnection =
    (sourcePosition === Position.Bottom && targetPosition === Position.Top) ||
    (sourcePosition === Position.Top && targetPosition === Position.Bottom);
  const isHorizontalConnection =
    (sourcePosition === Position.Right && targetPosition === Position.Left) ||
    (sourcePosition === Position.Left && targetPosition === Position.Right);

  if (
    isVerticalConnection &&
    Math.abs(sourceX - targetX) <= straightEdgeAlignmentTolerance
  ) {
    return true;
  }

  return (
    isHorizontalConnection &&
    Math.abs(sourceY - targetY) <= straightEdgeAlignmentTolerance
  );
}
