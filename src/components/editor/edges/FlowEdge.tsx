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
  areBridgePointsEqual,
  findEdgeBridgePoints,
  type EdgeBridgePoint,
} from "./edge-bridges";

const defaultEdgeStroke = "#525252";
const selectedEdgeStroke = "#2563eb";
const selectedEdgeHalo = "#bfdbfe";
const bridgeStroke = "#f5f5f5";

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
  const [bridgePoints, setBridgePoints] = useState<EdgeBridgePoint[]>([]);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const stroke =
    typeof style?.stroke === "string"
      ? style.stroke
      : selected
        ? selectedEdgeStroke
        : defaultEdgeStroke;
  const strokeWidth =
    typeof style?.strokeWidth === "number" ? style.strokeWidth : 2;

  useEffect(() => {
    const animationFrameId = window.requestAnimationFrame(() => {
      const nextBridgePoints = findEdgeBridgePoints({
        currentEdgeId: id,
      });

      setBridgePoints((previousBridgePoints) =>
        areBridgePointsEqual(previousBridgePoints, nextBridgePoints)
          ? previousBridgePoints
          : nextBridgePoints,
      );
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [edgePath, id, layoutRevision]);

  return (
    <>
      {selected ? (
        <path
          d={edgePath}
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
        markerStart={markerStart}
        markerEnd={markerEnd}
        interactionWidth={34}
        style={{
          ...style,
          stroke,
          strokeWidth: selected ? strokeWidth + 1.5 : strokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
        }}
      />
      {bridgePoints.map((bridgePoint) => {
        const bridgePath = getBridgePath(bridgePoint);

        return (
          <g
            key={`${bridgePoint.x}-${bridgePoint.y}-${bridgePoint.direction}`}
          >
            <path
              d={bridgePath}
              fill="none"
              stroke={bridgeStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={selected ? 10 : 8}
              pointerEvents="none"
            />
            <path
              d={bridgePath}
              fill="none"
              stroke={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={selected ? 3 : 2.25}
              pointerEvents="none"
            />
          </g>
        );
      })}
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

function getBridgePath({ x, y, direction }: EdgeBridgePoint) {
  const bridgeSize = 11;
  const bridgeHeight = 9;

  if (direction === "horizontal") {
    return `M ${x - bridgeSize} ${y} Q ${x} ${
      y - bridgeHeight
    } ${x + bridgeSize} ${y}`;
  }

  return `M ${x} ${y - bridgeSize} Q ${x + bridgeHeight} ${y} ${x} ${
    y + bridgeSize
  }`;
}
