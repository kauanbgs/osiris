import { prepareGroqPrompt } from "./groqBudget.js";
import { getConnectedFiles } from "./getConnectedFiles.js";
import { getConnectedNotes, buildNoteContext } from "./getConnectedNotes.js";
import { buildFileContext, buildFinalPrompt } from "./buildFileContext.js";
import { resolveAgentInputs, buildAgentContext, findWorkflowGoal } from "./resolveAgentInputs.js";
import { buildAgentSystemPrompt } from "./handoff.js";
import { resolveWorkflowModel } from "./modelSelection.js";
import { getActiveModel, sendPrompt } from "../services/llmService.js";

/**
 * Tenta escrever conteúdo em um arquivo no disco via Electron IPC.
 * É um no-op silencioso fora do Electron (web puro).
 *
 * @param {string} filePath  Caminho absoluto do arquivo
 * @param {string} content   Conteúdo a escrever
 * @returns {Promise<boolean>} true se escreveu, false se não foi possível
 */
async function writeFileToDisk(filePath, content) {
  if (!filePath) return false;

  const api = window?.electronAPI;
  if (typeof api?.writeFile !== "function") return false;

  try {
    await api.writeFile(filePath, content);
    return true;
  } catch (err) {
    console.error(`[executeAgentNode] Erro ao escrever "${filePath}":`, err);
    return false;
  }
}

/**
 * Executa um AgentNode:
 *  1. Coleta os arquivos de todos os FileNodes conectados pelo handle "files"
 *  2. Coleta outputs de AgentNodes upstream conectados (Agent→Agent)
 *  3. Constrói o contexto textual (arquivos + agentes upstream)
 *  4. Monta o prompt final
 *  5. Chama o LLM via llmService com suporte a streaming
 *
 * @param {{
 *   agentId: string;
 *   nodes: import('@xyflow/react').Node[];
 *   edges: import('@xyflow/react').Edge[];
 *   instruction: string;
 *   agentContext?: string;  // contexto pré-construído pelo runWorkflow (Agent→Agent em cadeia)
 *   onChunk?: (text: string) => void;
 *   signal?: AbortSignal;
 * }} params
 *
 * @returns {Promise<string>} Resposta completa do modelo
 */
export async function executeAgentNode({
  agentId,
  nodes,
  edges,
  instruction,
  agentContext,
  editableFileContext,
  onChunk,
  onNotice,
  signal,
}) {
  const node = nodes.find((item) => item.id === agentId);
  if (!node) throw new Error(`Agente ${agentId} nao encontrado.`);
  const modelConfig = resolveWorkflowModel(node.data, getActiveModel());
  signal?.throwIfAborted();

  // 1. Coletar arquivos dos FileNodes conectados
  const files = getConnectedFiles(agentId, nodes, edges);

  // 2. Contexto de agentes upstream
  //    Se agentContext foi passado pelo runWorkflow, usá-lo.
  //    Caso contrário, resolver diretamente dos nodes (execução isolada).
  const resolvedAgentContext =
    agentContext ??
    buildAgentContext(resolveAgentInputs(agentId, nodes, edges),
      { goal: findWorkflowGoal(agentId, nodes, edges), label: node.data?.label || agentId });

  // 3. Construir contexto de arquivos
  //    Notas de texto conectadas entram junto, antes dos arquivos.
  //    Arquivos de saida que nao estao na entrada vem em editableFileContext.
  const fileContext = [buildNoteContext(getConnectedNotes(agentId, nodes, edges)), buildFileContext(files), editableFileContext]
    .filter(Boolean).join("\n\n---\n\n");

  // 4. Montar contexto combinado (agentes upstream + arquivos)
  const combinedContext = [
    resolvedAgentContext,
    fileContext,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  // 5. Montar prompt final
  const groq = modelConfig?.type === "cloud" && modelConfig.provider === "groq"
    ? prepareGroqPrompt(instruction || "", resolvedAgentContext, fileContext, node.data?.maxOutputTokens) : null;
  for (const message of groq?.notices || []) onNotice?.({ type: "context", message });
  const finalPrompt = groq?.prompt || buildFinalPrompt(instruction || "", combinedContext);

  // 6. Enviar ao modelo
  const result = await sendPrompt({
    activeModelOverride: modelConfig,
    systemPrompt: buildAgentSystemPrompt(node.data?.label || agentId),
    maxOutputTokens: groq?.maxOutputTokens,
    continueOnLength: Boolean(groq),
    onNotice,
    prompt: finalPrompt,
    onChunk,
    signal,
  });

  // NOTA: A escrita em disco é feita pelo agentNode.jsx após parsear o JSON
  // estruturado da resposta. Não escrever aqui para evitar corromper os
  // arquivos de entrada com o JSON bruto do LLM.

  return result;
}

/**
 * Versão genérica para futuros tipos de node (Agent → Agent, etc).
 * Resolve os outputs de um node dado o contexto do grafo.
 *
 * @param {{
 *   nodeId: string;
 *   nodes: import('@xyflow/react').Node[];
 *   edges: import('@xyflow/react').Edge[];
 *   onChunk?: (text: string) => void;
 *   signal?: AbortSignal;
 * }} params
 */
export async function executeNode({
  nodeId,
  nodes,
  edges,
  agentContext,
  onChunk,
  signal,
}) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} não encontrado.`);

  if (node.type === "agent") {
    return executeAgentNode({
      agentId: nodeId,
      nodes,
      edges,
      instruction: node.data?.prompt ?? "",
      agentContext,
      onChunk,
      signal,
    });
  }

  throw new Error(`Tipo de node "${node.type}" não possui executor registrado.`);
}
