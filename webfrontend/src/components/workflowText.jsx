export default function WorkflowText({ id, data }) {
  return (
    <div className="drag-handle group relative w-fit rounded-2xl text-center">
      <textarea
        value={data?.text || ""}
        onChange={(event) => data?.onWorkflowDataChange?.(id, { text: event.target.value })}
        placeholder="Digite..."
        className="resize-none outline-none overflow-hidden"
      />
    </div>
  );
}
