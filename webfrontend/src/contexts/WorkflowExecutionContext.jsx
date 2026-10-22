import { useEffect, useRef, useState } from "react";
import { WorkflowExecutionContext } from "./useWorkflowExecution";
import { useReactFlow } from "@xyflow/react";
import { runWorkflow } from "@/workflow/runWorkflow";
import { executeAgentNode } from "@/workflow/executeAgentNode";
import { applyAgentResultToFileNodes, buildFileEditInstruction } from "@/workflow/agentFiles";
import { buildJsonHandoffRequest, buildTextHandoffRequest } from "@/workflow/handoff";

export function WorkflowExecutionProvider({ children, initialEvents = [], onEventsChange }) {
  const { getNodes, getEdges, updateNodeData } = useReactFlow();
  const [events, setEvents] = useState(initialEvents);
  const [agents, setAgents] = useState({});
  const [running, setRunning] = useState(false);
  const controller = useRef(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => { onEventsChange?.(events); }, [events, onEventsChange]);
  const emit = (event) => {
    if (mounted.current) setEvents((current) => [...current, { ...event, id: crypto.randomUUID(), time: new Date().toISOString() }]);
  };
  const patch = (id, values) => {
    if (mounted.current) setAgents((current) => ({ ...current, [id]: { ...current[id], ...values } }));
  };
  async function run({ startAgentId, onlyAgentId } = {}) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setAgents({});
    const nodes = getNodes();
    const edges = getEdges();
    emit({ type: "run", title: onlyAgentId ? "Executando agente individual" : "Orquestracao iniciada" });
    let finished = false;
    try {
      await runWorkflow({ nodes, edges, startAgentId, onlyAgentId, signal: abort.signal,
        onPlan: (ordered) => {
          setAgents(Object.fromEntries(ordered.map((node) => [node.id, { label: node.data?.label || node.id, status: "waiting", output: "", error: "" }])));
          emit({ type: "plan", title: "Ordem de execucao", text: ordered.map((node) => node.data?.label || node.id).join(" -> ") });
        },
        onTransfer: (transfer) => {
          emit({ type: "transfer", title: transfer.label + " -> " + transfer.targetLabel,
            text: (transfer.instruction ? "Tarefa encaminhada:\n" + transfer.instruction + "\n\n" : "") + "Dados:\n" + transfer.output,
            note: [transfer.saved ? "Resultado salvo de uma execucao anterior" : "Instrucoes entregues nesta execucao",
              !transfer.structured && "O agente anterior nao seguiu o formato de passagem; foi repassado o final da resposta"].filter(Boolean).join(". ") });
        },
        onAgentStart: (agentId, label, index, total, received) => {
          const prompt = nodes.find((node) => node.id === agentId)?.data?.prompt || "";
          patch(agentId, { label, status: "running", received, output: "", error: "" });
          emit({ type: "start", title: "[" + (index + 1) + "/" + total + "] " + label + " executando", text: prompt || "Executando as instrucoes recebidas." });
        },
        onAgentDone: (agentId, label, result) => {
          updateNodeData(agentId, { output: result });
          patch(agentId, { status: "done", output: result, notice: "" });
          emit({ type: "done", title: label + " concluiu", text: result });
        },
        onAgentError: (agentId, label, error) => {
          patch(agentId, { status: error.name === "AbortError" ? "cancelled" : "error", error: error.name === "AbortError" ? "" : error.message });
          if (error.name !== "AbortError") emit({ type: "error", title: label + " falhou", text: error.message });
        },
        executeAgent: async (agentId, context, signal) => {
          signal.throwIfAborted();
          const currentNodes = getNodes();
          const node = currentNodes.find((item) => item.id === agentId);
          if (!node) throw new Error("Agente removido durante a execucao.");
          const targets = nodes.filter((item) => item.type === "agent" && edges.some((edge) => edge.source === agentId && edge.target === item.id));
          const outputFiles = currentNodes.filter((item) => item.type === "file" && edges.some((edge) => edge.source === agentId && edge.target === item.id && ["output", "bottom"].includes(edge.sourceHandle)));
          let instruction = node.data?.prompt || "";
          const handoffPrompt = node.data?.handoffPrompt?.trim() || "";
          if (outputFiles.length) instruction = buildFileEditInstruction(instruction, outputFiles, targets.length ? buildJsonHandoffRequest(targets, handoffPrompt) : "");
          else if (targets.length) instruction += buildTextHandoffRequest(targets, handoffPrompt);
          const result = await executeAgentNode({ agentId, nodes: currentNodes, edges, instruction, agentContext: context, signal,
            onNotice: (notice) => {
              patch(agentId, { notice: notice.message });
              emit({ type: notice.type, title: (node.data?.label || agentId) + " - " + (notice.type === "rate-limit" ? "aguardando Groq" : notice.type === "continuation" ? "continuando resposta" : "economia de contexto"), text: notice.message });
            },
            onChunk: (output) => { if (!signal.aborted) patch(agentId, { output, notice: "" }); },
          });
          signal.throwIfAborted();
          if (outputFiles.length) {
            const applied = await applyAgentResultToFileNodes({ agentId, result, nodes: getNodes(), edges, updateNodeData, signal });
            emit({ type: "files", title: (node.data?.label || agentId) + " - arquivos",
              text: applied ? JSON.stringify(applied.fileOperations, null, 2) : "A resposta nao continha operacoes de arquivo validas." });
          }
          return result;
        },
      });
      finished = true;
      emit({ type: "complete", title: "Execucao concluida" });
    } catch (error) {
      emit({ type: error.name === "AbortError" ? "cancelled" : "error", title: error.name === "AbortError" ? "Execucao interrompida" : "Execucao encerrada com erro", text: error.name === "AbortError" ? "" : error.message });
    } finally {
      if (mounted.current) {
        setAgents((current) => Object.fromEntries(Object.entries(current).map(([id, state]) => [id,
          ["waiting", "running"].includes(state.status) ? { ...state, status: abort.signal.aborted ? "cancelled" : finished ? "done" : "skipped" } : state])));
        setRunning(false);
      }
      controller.current = null;
    }
  }
  return <WorkflowExecutionContext.Provider value={{ events, agents, running, run, stop: () => controller.current?.abort() }}>
    {children}
  </WorkflowExecutionContext.Provider>;
}
