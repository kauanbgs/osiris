import { NodeToolbar, useReactFlow } from "@xyflow/react";

const SIZES = [16, 24, 36, 48, 72, 96, 144];
const DEFAULT_SIZE = 36;
const PLACEHOLDER = "Digite...";

export default function WorkflowText({ id, data, selected }) {
  const { updateNodeData } = useReactFlow();
  const text = data?.text ?? "";
  const fontSize = data?.fontSize ?? DEFAULT_SIZE;
  const sizeIndex = SIZES.indexOf(fontSize);
  const setSize = (size) => updateNodeData(id, { fontSize: size });
  // Textarea and its invisible copy share one grid cell and the same
  // typography, so the copy sizes the box exactly to the content.
  const typography = "col-start-1 row-start-1 m-0 whitespace-pre p-1 text-center font-medium leading-tight";

  return (
    <div className="drag-handle group relative inline-grid rounded-2xl" style={{ fontSize }}>
      <NodeToolbar isVisible={selected} className="flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 p-1 text-xs text-zinc-300 shadow-lg">
        <button type="button" title="Diminuir texto" disabled={sizeIndex === 0}
          onClick={() => setSize(SIZES[Math.max(0, sizeIndex - 1)])}
          className="rounded-full px-2 py-1 hover:bg-zinc-800 disabled:opacity-40">A-</button>
        <select aria-label="Tamanho do texto" value={fontSize} onChange={(event) => setSize(Number(event.target.value))}
          className="rounded bg-transparent px-1 py-1 outline-none">
          {SIZES.map((size) => <option key={size} value={size} className="bg-zinc-900">{size}px</option>)}
        </select>
        <button type="button" title="Aumentar texto" disabled={sizeIndex === SIZES.length - 1}
          onClick={() => setSize(SIZES[Math.min(SIZES.length - 1, sizeIndex + 1)])}
          className="rounded-full px-2 py-1 text-sm hover:bg-zinc-800 disabled:opacity-40">A+</button>
      </NodeToolbar>

      {/* Trailing space keeps the height of an empty last line. */}
      <span aria-hidden="true" className={typography + " invisible"}>{(text || PLACEHOLDER) + " "}</span>

      <textarea
        value={text}
        onChange={(event) => updateNodeData(id, { text: event.target.value })}
        placeholder={PLACEHOLDER}
        rows={1}
        wrap="off"
        className={typography + " h-full w-full resize-none overflow-hidden bg-transparent text-zinc-200 outline-none placeholder:text-zinc-600"}
      />
    </div>
  );
}
