export type EdgeBridgeDirection = "horizontal" | "vertical";

export type EdgeBridgePoint = {
  x: number;
  y: number;
  direction: EdgeBridgeDirection;
};

type Point = {
  x: number;
  y: number;
};

type SampledSegment = {
  start: Point;
  end: Point;
  startLength: number;
  direction: EdgeBridgeDirection | null;
};

const edgePathSelector = "[data-flow-edge-path]";
const sampleDistance = 8;
const maxSampleCount = 240;
const minEndpointDistance = 18;
const minBridgeDistance = 24;
const maxBridgePointsPerEdge = 8;

export function findEdgeBridgePoints({
  currentEdgeId,
}: {
  currentEdgeId: string;
}): EdgeBridgePoint[] {
  if (typeof document === "undefined") {
    return [];
  }

  const edgePaths = Array.from(
    document.querySelectorAll<SVGPathElement>(edgePathSelector),
  );
  const currentPath = edgePaths.find(
    (path) => path.dataset.flowEdgePath === currentEdgeId,
  );
  const currentPathIndex = edgePaths.findIndex(
    (path) => path.dataset.flowEdgePath === currentEdgeId,
  );

  if (!currentPath || currentPathIndex < 0) {
    return [];
  }

  const currentPathData = samplePath(currentPath);

  if (!currentPathData) {
    return [];
  }

  const bridgePoints: EdgeBridgePoint[] = [];

  for (const [otherPathIndex, otherPath] of edgePaths.entries()) {
    const otherEdgeId = otherPath.dataset.flowEdgePath;

    if (!otherEdgeId || otherEdgeId === currentEdgeId) {
      continue;
    }

    // Draw only on the edge that is already above the other edge in the SVG.
    if (currentPathIndex < otherPathIndex) {
      continue;
    }

    const otherPathData = samplePath(otherPath);

    if (!otherPathData) {
      continue;
    }

    for (const currentSegment of currentPathData.segments) {
      if (!currentSegment.direction) {
        continue;
      }

      for (const otherSegment of otherPathData.segments) {
        const intersection = getSegmentIntersection(
          currentSegment.start,
          currentSegment.end,
          otherSegment.start,
          otherSegment.end,
        );

        if (!intersection) {
          continue;
        }

        const currentDistance =
          currentSegment.startLength +
          segmentDistance(currentSegment.start, intersection.point);
        const otherDistance =
          otherSegment.startLength +
          segmentDistance(otherSegment.start, intersection.point);

        if (
          isNearPathEndpoint(currentDistance, currentPathData.totalLength) ||
          isNearPathEndpoint(otherDistance, otherPathData.totalLength)
        ) {
          continue;
        }

        if (
          bridgePoints.some(
            (bridgePoint) =>
              segmentDistance(bridgePoint, intersection.point) <
              minBridgeDistance,
          )
        ) {
          continue;
        }

        bridgePoints.push({
          ...intersection.point,
          direction: currentSegment.direction,
        });

        if (bridgePoints.length >= maxBridgePointsPerEdge) {
          return bridgePoints;
        }
      }
    }
  }

  return bridgePoints;
}

export function areBridgePointsEqual(
  previousPoints: EdgeBridgePoint[],
  nextPoints: EdgeBridgePoint[],
) {
  if (previousPoints.length !== nextPoints.length) {
    return false;
  }

  return previousPoints.every((previousPoint, index) => {
    const nextPoint = nextPoints[index];

    return (
      nextPoint &&
      previousPoint.direction === nextPoint.direction &&
      Math.abs(previousPoint.x - nextPoint.x) < 0.5 &&
      Math.abs(previousPoint.y - nextPoint.y) < 0.5
    );
  });
}

function samplePath(path: SVGPathElement) {
  let totalLength: number;

  try {
    totalLength = path.getTotalLength();
  } catch {
    return null;
  }

  if (!Number.isFinite(totalLength) || totalLength <= 0) {
    return null;
  }

  const sampleCount = Math.min(
    maxSampleCount,
    Math.max(2, Math.ceil(totalLength / sampleDistance)),
  );
  const segments: SampledSegment[] = [];
  let previousPoint = getPointAtLength(path, 0);
  let previousLength = 0;

  for (let index = 1; index <= sampleCount; index += 1) {
    const currentLength = (totalLength * index) / sampleCount;
    const currentPoint = getPointAtLength(path, currentLength);

    if (segmentDistance(previousPoint, currentPoint) > 1) {
      segments.push({
        start: previousPoint,
        end: currentPoint,
        startLength: previousLength,
        direction: getSegmentDirection(previousPoint, currentPoint),
      });
    }

    previousPoint = currentPoint;
    previousLength = currentLength;
  }

  return {
    totalLength,
    segments,
  };
}

function getPointAtLength(path: SVGPathElement, length: number): Point {
  const point = path.getPointAtLength(length);

  return {
    x: point.x,
    y: point.y,
  };
}

function getSegmentDirection(
  start: Point,
  end: Point,
): EdgeBridgeDirection | null {
  const deltaX = Math.abs(end.x - start.x);
  const deltaY = Math.abs(end.y - start.y);

  if (deltaX < 1 && deltaY < 1) {
    return null;
  }

  if (deltaX >= deltaY * 1.5) {
    return "horizontal";
  }

  if (deltaY >= deltaX * 1.5) {
    return "vertical";
  }

  return null;
}

function getSegmentIntersection(
  firstStart: Point,
  firstEnd: Point,
  secondStart: Point,
  secondEnd: Point,
) {
  const firstDelta = {
    x: firstEnd.x - firstStart.x,
    y: firstEnd.y - firstStart.y,
  };
  const secondDelta = {
    x: secondEnd.x - secondStart.x,
    y: secondEnd.y - secondStart.y,
  };
  const denominator = cross(firstDelta, secondDelta);

  if (Math.abs(denominator) < 0.001) {
    return null;
  }

  const startDelta = {
    x: secondStart.x - firstStart.x,
    y: secondStart.y - firstStart.y,
  };
  const currentRatio = cross(startDelta, secondDelta) / denominator;
  const otherRatio = cross(startDelta, firstDelta) / denominator;

  if (
    currentRatio <= 0.05 ||
    currentRatio >= 0.95 ||
    otherRatio <= 0.05 ||
    otherRatio >= 0.95
  ) {
    return null;
  }

  return {
    point: {
      x: firstStart.x + currentRatio * firstDelta.x,
      y: firstStart.y + currentRatio * firstDelta.y,
    },
  };
}

function cross(first: Point, second: Point) {
  return first.x * second.y - first.y * second.x;
}

function segmentDistance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function isNearPathEndpoint(distance: number, totalLength: number) {
  return (
    distance < minEndpointDistance ||
    totalLength - distance < minEndpointDistance
  );
}
