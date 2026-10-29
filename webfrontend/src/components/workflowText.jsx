import { Handle, NodeResizer, NodeToolbar, Position, useReactFlow } from "@xyflow/react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, StickyNote, Type } from "lucide-react";

const SIZES = [12, 16, 24, 36, 48, 72, 96, 144];
const COLORS = {
  neutral: { text: "#e4e4e7", note: "#e4e4e7" },
  amber: { text: "#fbbf24", note: "#fde68a" },
  rose: { text: "#fb7185", note: "#fbcfe8" },
  emerald: { text: "#34d399", note: "#bbf7d0" },
  sky: { text: "#38bdf8", note: "#bfdbfe" },
  violet: { text: "#a78bfa", note: "#ddd6fe" },
};
const ALIGNS = [
  { value: "left", icon: AlignLeft, label: "Alinhar a esquerda" },
  { value: "center", icon: AlignCenter, label: "Centralizar" },
  { value: "right", icon: AlignRight, label: "Alinhar a direita" },
];
const PLACEHOLDER = "Digite...";

const toolButton = "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 hover:bg-zinc-800 disabled:opacity-40";
const handleClass = "!h-2.5 !w-2.5 !border-2 !border-[#151515] !bg-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100";

export default function WorkflowText({ id, data, selected }) {
  const { updateNodeData, updateNode } = useReactFlow();
  const note = Boolean(data?.note);
  const text = data?.text ?? "";
  const fontSize = data?.fontSize ?? (note ? 16 : 36);
  const align = data?.align ?? (note ? "left" : "center");
  const color = COLORS[data?.color] ? data.color : note ? "amber" : "neutral";
  const sizeIndex = SIZES.indexOf(fontSize);
  const set = (patch) => updateNodeData(id, patch);
  const toggleNote = () => {
    // Size presets differ per mode, and only notes keep a resized box.
    set({ note: !note, fontSize: undefined, align: undefined });
    if (note) updateNode(id, { width: undefined, height: undefined });
  };

  const textStyle = {
    fontSize,
    textAlign: align,
    fontWeight: data?.bold ? 700 : 500,
    fontStyle: data?.italic ? "italic" : "normal",
    color: note ? "#18181b" : COLORS[color].text,
  };

  return (
    <div className={"group relative " + (note ? "h-full w-full" : "w-fit")}>
      <NodeToolbar isVisible={selected} className="flex items-center gap-0.5 rounded-full border border-zinc-800 bg-zinc-900 p-1 text-xs text-zinc-300 shadow-lg">
        <button type="button" title="Diminuir texto" disabled={sizeIndex === 0} className={toolButton}
          onClick={() => set({ fontSize: SIZES[Math.max(0, sizeIndex - 1)] })}>A-</button>
        <select aria-label="Tamanho do texto" value={fontSize} onChange={(event) => set({ fontSize: Number(event.target.value) })}
          className="rounded bg-transparent px-1 py-1 outline-none">
          {SIZES.map((size) => <option key={size} value={size} className="bg-zinc-900">{size}px</option>)}
        </select>
        <button type="button" title="Aumentar texto" disabled={sizeIndex === SIZES.length - 1} className={toolButton + " text-sm"}
          onClick={() => set({ fontSize: SIZES[Math.min(SIZES.length - 1, sizeIndex + 1)] })}>A+</button>

        <span className="mx-1 h-4 w-px bg-zinc-700" />
        <button type="button" title="Negrito" aria-pressed={Boolean(data?.bold)} onClick={() => set({ bold: !data?.bold })}
          className={toolButton + (data?.bold ? " bg-zinc-700 text-white" : "")}><Bold size={14} /></button>
        <button type="button" title="Italico" aria-pressed={Boolean(data?.italic)} onClick={() => set({ italic: !data?.italic })}
          className={toolButton + (data?.italic ? " bg-zinc-700 text-white" : "")}><Italic size={14} /></button>
        {ALIGNS.map(({ value, icon: Icon, label }) => (
          <button key={value} type="button" title={label} aria-pressed={align === value} onClick={() => set({ align: value })}
            className={toolButton + (align === value ? " bg-zinc-700 text-white" : "")}><Icon size={14} /></button>
        ))}

        <span className="mx-1 h-4 w-px bg-zinc-700" />
        {Object.entries(COLORS).map(([key, value]) => (
          <button key={key} type="button" title={"Cor " + key} aria-pressed={color === key} onClick={() => set({ color: key })}
            className={"h-5 w-5 rounded-full border-2 " + (color === key ? "border-white" : "border-transparent")}
            style={{ background: note ? value.note : value.text }} />
        ))}

        <span className="mx-1 h-4 w-px bg-zinc-700" />
        <button type="button" title={note ? "Voltar para texto" : "Transformar em nota adesiva"} onClick={toggleNote} className={toolButton}>
          {note ? <Type size={14} /> : <StickyNote size={14} />}
        </button>
      </NodeToolbar>

      {/* Loose connections: one handle per side links the text to an agent. */}
      {[Position.Top, Position.Right, Position.Bottom, Position.Left].map((position) => (
        <Handle key={position} id={position} type="source" position={position} className={handleClass} />
      ))}

      {note ? <NoteBody id={id} text={text} textStyle={textStyle} background={COLORS[color].note} selected={selected} onChange={(value) => set({ text: value })} />
        : <TextBody text={text} textStyle={textStyle} onChange={(value) => set({ text: value })} />}
    </div>
  );
}

function TextBody({ text, textStyle, onChange }) {
  // Textarea and its invisible copy share one grid cell and the same
  // typography, so the copy sizes the box exactly to the content.
  const typography = "col-start-1 row-start-1 m-0 whitespace-pre p-1 leading-tight";
  return (
    <div className="drag-handle relative inline-grid rounded-2xl" style={textStyle}>
      {/* Trailing space keeps the height of an empty last line. */}
      <span aria-hidden="true" className={typography + " invisible"}>{(text || PLACEHOLDER) + " "}</span>
      <textarea
        value={text}
        onChange={(event) => onChange(event.target.value)}
        placeholder={PLACEHOLDER}
        rows={1}
        wrap="off"
        className={typography + " h-full w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-zinc-600"}
        style={textStyle}
      />
    </div>
  );
}

function NoteBody({ text, textStyle, background, selected, onChange }) {
  return (
    <div className="relative flex h-full min-h-[160px] w-full min-w-[220px] flex-col rounded-md shadow-[0_12px_30px_rgba(0,0,0,0.35)]" style={{ background }}>
      <NodeResizer isVisible={selected} minWidth={220} minHeight={160} lineClassName="!border-zinc-400" handleClassName="!h-2 !w-2 !rounded-sm !border-zinc-400 !bg-zinc-100" />
      <div className="drag-handle h-6 shrink-0 cursor-grab rounded-t-md bg-black/10 active:cursor-grabbing" title="Arrastar nota" />
      <textarea
        value={text}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Escreva uma nota..."
        className="nodrag nowheel flex-1 resize-none bg-transparent px-3 py-2 leading-snug outline-none placeholder:text-zinc-500"
        style={textStyle}
      />
    </div>
  );
}
