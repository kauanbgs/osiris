import { Handle, Position, useReactFlow, useStore } from "@xyflow/react";
import { Bot, GripVertical, Loader2, Play, Square, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { executeAgentNode } from "@/workflow/executeAgentNode";

export default function AgentNode({ id, data }) {
  const { updateNodeData, getNodes, getEdges } = useReactFlow();

  const handleClass =
    "!h-2.5 !w-2.5 !border-2 !border-[#151515] !bg-violet-500 hover:!bg-violet-400 transition-colors";

  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle"); // "idle" | "running" | "error"
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  // Verificar se há FileNodes conectados (para feedback visual)
  // Lemos do store do ReactFlow para reagir a mudanças de edges em tempo real
  const hasFileInput = useStore((s) => {
    return s.edges.some(
      (e) => e.target === id && e.targetHandle === "files"
    );
  });

  function handlePromptChange(e) {
    updateNodeData(id, { prompt: e.target.value });
  }

  const handleRun = useCallback(async () => {
    if (status === "running") {
      abortRef.current?.abort();
      return;
    }

    const instruction = data?.prompt ?? "";

    setStatus("running");
    setOutput("");
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const nodes = getNodes();
      const edges = getEdges();

      const result = await executeAgentNode({
        agentId: id,
        nodes,
        edges,
        instruction,
        signal: controller.signal,
        onChunk: (text) => {
          setOutput(text);
        },
      });

      // Persiste o output no grafo do ReactFlow para que
      // nodes downstream (ex: Agent → Agent) possam ler data.output
      updateNodeData(id, { output: result });

      setStatus("idle");
    } catch (err) {
      if (err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError(err.message || "Erro desconhecido.");
      setStatus("error");
    }
  }, [id, data, status, getNodes, getEdges]);

  return (
    <div className="group relative w-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition hover:border-zinc-700">
      {/* Handle de entrada de arquivos (target) */}
      <Handle
        id="files"
        type="target"
        position={Position.Left}
        className={handleClass}
        style={{ top: "40%" }}
        title="Conecte um FileNode aqui"
      />

      {/* Handle de saída do output do agent */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className={handleClass}
        style={{ top: "40%" }}
        title="Output do agente"
      />

      {/* Handle genérico top/bottom para futuras conexões */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
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
          <Bot size={14} className="text-zinc-500" />

          <span className="text-[12px] font-medium text-zinc-200">
            {data?.label || "Agent"}
          </span>

          {/* Badge: arquivos conectados */}
          {hasFileInput && (
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
              arquivos conectados
            </span>
          )}

          {status === "idle" && !hasFileInput && (
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              online
            </div>
          )}

          {status === "running" && (
            <div className="flex items-center gap-1.5 text-[9px] text-amber-400">
              <Loader2 size={9} className="animate-spin" />
              executando...
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-1.5 text-[9px] text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              erro
            </div>
          )}
        </div>

        <GripVertical
          size={13}
          className="text-zinc-700 transition group-hover:text-zinc-500"
        />
      </div>

      <div className="h-px bg-zinc-800/80" />

      {/* Instrução (prompt) */}
      <div className="px-4 py-3">
        <textarea
          rows={3}
          value={data?.prompt ?? ""}
          onChange={handlePromptChange}
          placeholder="Descreva o que este agente deve fazer..."
          className="nodrag nopan nowheel block w-full resize-none bg-transparent text-[13px] leading-5 text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* Erro */}
      {status === "error" && error && (
        <>
          <div className="h-px bg-zinc-800/80" />
          <div className="nodrag nopan nowheel flex items-start gap-2 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-[10px] text-red-400">⚠</span>
            <p className="text-[11px] leading-relaxed text-red-400">{error}</p>
            <button
              type="button"
              onClick={() => { setStatus("idle"); setError(""); }}
              className="ml-auto shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300"
            >
              <X size={11} />
            </button>
          </div>
        </>
      )}

      {/* Output do streaming */}
      {(output || status === "running") && (
        <>
          <div className="h-px bg-zinc-800/80" />
          <div className="nodrag nopan nowheel max-h-[320px] overflow-y-auto px-4 py-3">
            {output ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                {output}
              </pre>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <Loader2 size={11} className="animate-spin text-violet-400" />
                Aguardando resposta...
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2 text-[9px] text-zinc-600">
          <span>local</span>
          <span className="text-zinc-800">•</span>
          <span>llama.cpp</span>
        </div>

        {/* Botão Run / Stop */}
        <button
          type="button"
          onClick={handleRun}
          title={status === "running" ? "Parar execução" : "Executar agente"}
          className={`nodrag flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            status === "running"
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
          }`}
        >
          {status === "running" ? (
            <>
              <Square size={10} />
              Parar
            </>
          ) : (
            <>
              <Play size={10} />
              Run
            </>
          )}
        </button>
      </div>
    </div>
  );
}