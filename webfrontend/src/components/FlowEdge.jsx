import { getBezierPath } from "@xyflow/react";

export default function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.6,
  });

  return (
    <>
      {/* Glow / blur layer */}
      <path
        d={edgePath}
        fill="none"
        stroke="#8b5cf6"
        strokeOpacity={selected ? 0.45 : 0.2}
        strokeWidth={12}
        strokeLinecap="round"
        style={{ filter: "blur(7px)", transition: "stroke-opacity 0.2s" }}
      />

      {/* Main animated line */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={selected ? "#c4b5fd" : "#8b5cf6"}
        strokeWidth={selected ? 2.5 : 2}
        strokeLinecap="round"
        strokeDasharray="6 5"
        markerEnd={markerEnd}
        style={{
          animation: "flowDash 0.9s linear infinite",
          transition: "stroke 0.2s, stroke-width 0.2s",
        }}
      />

      <style>{`
        @keyframes flowDash {
          from { stroke-dashoffset: 22; }
          to   { stroke-dashoffset: 0; }
        }
      `}</style>
    </>
  );
}
