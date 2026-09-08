import { Handle, Position } from "@xyflow/react";
import { Bot, GripVertical } from "lucide-react";

export default function AgentNode({ id, data }) {
  const handleClass =
    "!h-2.5 !w-2.5 !border-2 !border-[#151515] !bg-violet-500 hover:!bg-violet-400 transition-colors";

  return (
    <div className="group relative w-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition hover:border-zinc-700">
      <Handle
        id="top"
        type="source"
        position={Position.Top}
        className={handleClass}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className={handleClass}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={handleClass}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={handleClass}
      />

      {/* Header */}
      <div className="drag-handle flex h-11 cursor-grab items-center justify-between px-4 select-none active:cursor-grabbing">
        <div className="flex items-center gap-2.5">
          <Bot
            size={14}
            className="text-zinc-500"
          />

          <span className="text-[12px] font-medium text-zinc-200">
            {data?.label || "Agent"}
          </span>

          <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            online
          </div>
        </div>

        <GripVertical
          size={13}
          className="text-zinc-700 transition group-hover:text-zinc-500"
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-800/80" />

      {/* Input */}
      <div className="px-4 py-3">
        <textarea
          rows={2}
          placeholder="Descreva o que este agente deve fazer..."
          className="nodrag nopan nowheel block w-full resize-none bg-transparent text-[13px] leading-5 text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 pb-3 text-[9px] text-zinc-600">
        <span>local</span>
        <span className="text-zinc-800">•</span>
        <span>llama.cpp</span>
      </div>
    </div>
  );
}