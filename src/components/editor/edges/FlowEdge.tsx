import { createContext, useContext, useEffect, useId, useState } from "react";
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
import {
  useFlowEdgeRouting,
  useSharedTrunkAppearance,
} from "./useFlowEdgeRouting";

const defaultEdgeStroke = "#525252";
const defaultEdgeStrokeWidth = 3;
const selectedEdgeStroke = "#2563eb";
const selectedEdgeHalo = "#bfdbfe";
const straightEdgeAlignmentTolerance = 6;

export type EdgeBridgeRenderState = {
  disabled: boolean;
  revision: string;
};

export const EdgeBridgeRenderContext = createContext<EdgeBridgeRenderState>({
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
  const route = useFlowEdgeRouting(id);
  const trunkAppearance = useSharedTrunkAppearance(
    route?.trunk ? route.sharedEdgeIds : undefined,
  );
  const trunkMarkerId = `flow-join-${useId().replace(/:/g, "")}`;
  const [fallbackPath, fallbackLabelX, fallbackLabelY] = getFlowEdgePath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const edgePath = route?.path ?? fallbackPath;
  const visiblePath = route?.branch?.path ?? edgePath;
  const labelX = route?.branch?.labelX ?? route?.labelX ?? fallbackLabelX;
  const labelY = route?.branch?.labelY ?? route?.labelY ?? fallbackLabelY;
  const [bridgeRenderData, setBridgeRenderData] =
    useState<EdgeBridgeRenderData>({
      bridgePoints: [],
      displayPath: visiblePath,
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
      : visiblePath;
  const displayStrokeWidth = selected ? strokeWidth + 1.5 : strokeWidth;
  const trunkStroke = trunkAppearance?.selected
    ? selectedEdgeStroke
    : typeof trunkAppearance?.style?.stroke === "string"
      ? trunkAppearance.style.stroke
      : stroke;
  const trunkStrokeWidth =
    typeof trunkAppearance?.style?.strokeWidth === "number"
      ? trunkAppearance.style.strokeWidth
      : strokeWidth;
  const mergeGroup = route?.sharedEdgeIds?.join("|");

  useEffect(() => {
    if (bridgeRenderState.disabled) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const nextBridgeRenderData = getEdgeBridgeRenderData({
        currentEdgeId: id,
        fallbackPath: visiblePath,
      });

      setBridgeRenderData((previousBridgeRenderData) =>
        areBridgeRenderDataEqual(previousBridgeRenderData, nextBridgeRenderData)
          ? previousBridgeRenderData
          : nextBridgeRenderData,
      );
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [bridgeRenderState.disabled, bridgeRenderState.revision, visiblePath, id]);

  return (
    <>
      {selected ? (
        <path
          d={route?.branch ? edgePath : displayPath}
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
        d={visiblePath}
        data-flow-edge-path={id}
        data-flow-edge-source={source}
        data-flow-edge-target={target}
        data-flow-edge-merge-group={mergeGroup}
        fill="none"
        stroke="transparent"
        pointerEvents="none"
        aria-hidden="true"
      />
      <path
        className="react-flow__edge-path"
        d={displayPath}
        fill="none"
        markerStart={markerStart}
        markerEnd={route?.branch ? undefined : markerEnd}
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
      {route?.trunk ? (
        <>
          <defs>
            <marker
              id={trunkMarkerId}
              markerWidth="12.5"
              markerHeight="12.5"
              viewBox="-10 -10 20 20"
              markerUnits="strokeWidth"
              orient="auto-start-reverse"
              refX="0"
              refY="0"
            >
              <polyline
                points="-5,-4 0,0 -5,4 -5,-4"
                stroke={trunkStroke}
                fill={trunkStroke}
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </marker>
          </defs>
          <path
            d={route.trunk.path}
            data-flow-edge-path={`${id}:trunk`}
            data-flow-edge-merge-group={mergeGroup}
            fill="none"
            stroke={trunkStroke}
            strokeWidth={trunkStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={markerEnd ? `url(#${trunkMarkerId})` : undefined}
            pointerEvents="none"
          />
          {route.junctions?.map((point) => (
            <circle
              key={`${point.x}:${point.y}`}
              cx={point.x}
              cy={point.y}
              r={trunkStrokeWidth + 0.5}
              fill={trunkStroke}
              pointerEvents="none"
            />
          ))}
        </>
      ) : null}
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
