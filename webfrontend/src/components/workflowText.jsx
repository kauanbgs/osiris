import { useReactFlow } from "@xyflow/react";

export default function WorkflowText({ id, data }) {
  const { updateNodeData } = useReactFlow();
  return (
    <div className="drag-handle group relative w-fit rounded-2xl text-center">

      <textarea
        value={data?.text ?? ""}
        onChange={(event) => updateNodeData(id, { text: event.target.value })}
        placeholder="Digite..."
        className="resize-none outline-none overflow-hidden"
      />
    </div>
  );
}
