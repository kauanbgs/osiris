import { Handle, Position } from "@xyflow/react";
import Terminal from "./terminal";

export default function TerminalNode({ id, data }) {
  return (
    <div className="w-[560px] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950 shadow-2xl">
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-violet-500 border-2 border-zinc-900"
      />

      {/* Header bar that serves as drag handle */}
      <div className="drag-handle flex h-10 cursor-grab items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-3.5 select-none active:cursor-grabbing hover:bg-zinc-900 transition-colors">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          <span className="text-xs font-semibold font-mono text-zinc-200">
            {data?.label || "Terminal"}
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">⠿ Drag</span>
      </div>

      {/* Terminal Container */}
      <div className="nodrag nowheel pointer-events-auto h-[320px] bg-[#0c0c0e] p-2">
        <Terminal terminalId={id} mode={data?.mode} />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-violet-500 border-2 border-zinc-900"
      />
    </div>
  );
}