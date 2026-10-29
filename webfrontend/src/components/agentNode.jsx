import { Handle, Position, useReactFlow, useStore } from "@xyflow/react";
import { Bot, GripVertical, Loader2, Play, Square, Workflow } from "lucide-react";
import WorkflowModelSelect from "@/components/WorkflowModelSelect";
import { useWorkflowExecution } from "@/contexts/useWorkflowExecution";
import { getAgentFileNodes } from "@/workflow/getConnectedFiles";
import { formatAgentOutput } from "@/workflow/agentFiles";
import { getAgentTerminals } from "@/workflow/agentTerminals";

export default function AgentNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const execution = useWorkflowExecution();
  const agentState = execution.agents[id];
  const status = agentState?.status === "running" ? "running" : agentState?.status === "error" ? "error" : "idle";
  const output = agentState?.output ?? data?.output ?? "";
  const error = agentState?.error || "";
  const chainStatus = agentState ? ({ waiting: "Aguardando agentes anteriores", done: "Concluido", cancelled: "Interrompido", skipped: "Nao executado" }[agentState.status] || "") : "";
  const handleClass = "!h-2.5 !w-2.5 !border-2 !border-[#151515] !bg-violet-500 hover:!bg-violet-400 transition-colors";
  const hasFileInput = useStore((state) => getAgentFileNodes(id, state.nodes, state.edges).inputs.length > 0);
  const hasFileOutput = useStore((state) => getAgentFileNodes(id, state.nodes, state.edges).outputs.length > 0);
  const hasTerminal = useStore((state) => getAgentTerminals(id, state.nodes, state.edges).length > 0);
  const hasAgentInput = useStore((state) => state.edges.some((edge) => edge.target === id && state.nodes.some((node) => node.id === edge.source && node.type === "agent")));
  const hasAgentOutput = useStore((state) => state.edges.some((edge) => edge.source === id && state.nodes.some((node) => node.id === edge.target && node.type === "agent")));
  const isChainRoot = hasAgentOutput;
  const handlePromptChange = (event) => updateNodeData(id, { prompt: event.target.value });
  const handleModelChange = (modelConfig) => updateNodeData(id, { modelConfig, model: null });
  const handleRun = () => status === "running" ? execution.stop() : execution.run({ onlyAgentId: id });
  const handleRunChain = () => execution.run({ startAgentId: id });

  return (
    <div className="group relative w-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition hover:border-zinc-700">
      {/* FileNode → Agent (esquerda) */}
      <Handle
        id="files"
        type="target"
        position={Position.Left}
        className={handleClass}
        style={{ top: "40%" }}
        title="Arquivos de entrada"
      />

      {/* Agent → FileNode (direita) */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className={handleClass}
        style={{ top: "40%" }}
        title="Output / edição de arquivos"
      />

      {/* Agent → Agent (entrada no topo) */}
      <Handle
        id="agent-in"
        type="target"
        position={Position.Top}
        className={`${handleClass} !bg-amber-500 hover:!bg-amber-400`}
        title="Recebe task de outro agente"
      />

      {/* Agent → Agent (saída na base) */}
      <Handle
        id="agent-out"
        type="source"
        position={Position.Bottom}
        className={`${handleClass} !bg-amber-500 hover:!bg-amber-400`}
        title="Passa task para outro agente"
      />

      {/* Header */}
      <div className="drag-handle flex h-11 cursor-grab items-center justify-between px-4 select-none active:cursor-grabbing">
        <div className="flex items-center gap-2.5">
          <Bot size={14} className="text-zinc-500" />

          <input aria-label="Nome do agente" className="nodrag w-28 bg-transparent text-[12px] font-medium text-zinc-200 outline-none" value={data?.label || "Agent"} disabled={execution.running} onChange={(event) => updateNodeData(id, { label: event.target.value })} />

          {hasFileInput && (
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
              lendo arquivos
            </span>
          )}

          {hasFileOutput && (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              pode editar arquivos
            </span>
          )}

          {hasTerminal && (
            <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">
              usa terminal
            </span>
          )}

          {hasAgentInput && (
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
              recebe task
            </span>
          )}

          {hasAgentOutput && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
              passa task
            </span>
          )}

          {status === "idle" && !hasFileInput && !hasFileOutput && !hasTerminal && !hasAgentInput && !hasAgentOutput && (
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

      {/* Chain status */}
      {chainStatus && (
        <>
          <div className="flex items-center gap-2 px-4 py-2 text-[10px] text-amber-400">
            <Loader2 size={9} className="animate-spin" />
            {chainStatus}
          </div>
          <div className="h-px bg-zinc-800/80" />
        </>
      )}

      {/* Prompt */}
      <div className="px-4 py-3">
        <textarea
          rows={3}
          value={data?.prompt ?? ""}
          onChange={handlePromptChange}
          disabled={execution.running}
          placeholder="Descreva o que este agente deve fazer..."
          className="nodrag nopan nowheel block w-full resize-none bg-transparent text-[13px] leading-5 text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      </div>

      {hasAgentOutput && <div className="px-4 pb-3">
        <label className="mb-1 block text-[10px] text-amber-400">Instrucoes para o proximo agente</label>
        <textarea aria-label="Instrucoes para o proximo agente" rows={2} value={data?.handoffPrompt || ""} disabled={execution.running}
          onChange={(event) => updateNodeData(id, { handoffPrompt: event.target.value })}
          placeholder="Ex.: use o plano gerado para implementar e testar os arquivos."
          className="nodrag nopan nowheel w-full resize-none rounded border border-amber-900/40 bg-zinc-950 p-2 text-xs text-zinc-200 outline-none" />
      </div>}
      {agentState?.received?.length > 0 && <details className="nodrag nopan nowheel mx-4 mb-3 rounded border border-amber-900/40 p-2 text-xs text-amber-300">
        <summary className="cursor-pointer">Instrucoes recebidas ({agentState.received.length})</summary>
        {agentState.received.map((message) => <div key={message.agentId} className="mt-2"><strong>{message.label}</strong><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-zinc-300">{message.instruction}{"\n"}{message.output}</pre></div>)}
      </details>}
      {/* Erro */}
      {status === "error" && error && (
        <>
          <div className="h-px bg-zinc-800/80" />

          <div className="nodrag nopan nowheel flex items-start gap-2 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-[10px] text-red-400">⚠</span>

            <p className="text-[11px] leading-relaxed text-red-400">{error}</p>


          </div>
        </>
      )}

      {agentState?.notice && <p role="status" className="nodrag px-4 py-2 text-xs text-amber-300">{agentState.notice}</p>}
      {/* Output */}
      {(output || status === "running") && (
        <>
          <div className="h-px bg-zinc-800/80" />

          <div className="nodrag nopan nowheel max-h-[320px] overflow-y-auto px-4 py-3">
            {output ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                {formatAgentOutput(output)}
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
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <div className="nodrag nopan flex items-center gap-2">
          <span className="text-[9px] text-zinc-600">modelo</span>

          <WorkflowModelSelect data={data} onChange={handleModelChange} disabled={execution.running} />
        </div>

        <div className="nodrag flex items-center gap-2">
          {/* Botão Run Chain (só aparece se for raiz de cadeia) */}
          {isChainRoot && (
            <button
              type="button"
              onClick={handleRunChain}
              disabled={execution.running}
              title="Executar toda a cadeia de agentes"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Workflow size={10} />
              Executar cadeia
            </button>
          )}

          {/* Botão Run individual */}
          <button
            type="button"
            onClick={handleRun}
            disabled={execution.running && status !== "running"}
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
                So este
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
