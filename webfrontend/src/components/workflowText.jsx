import { Handle, Position } from "@xyflow/react";

export default function WorkflowText() {
  return (
    <div className="drag-handle group relative w-fit rounded-2xl text-center">

      <textarea
        placeholder="Digite..."
        className="resize-none outline-none overflow-hidden"
      />
    </div>
  );
}
