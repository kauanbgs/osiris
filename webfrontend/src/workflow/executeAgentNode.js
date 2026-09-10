import { getConnectedFiles } from "./getConnectedFiles";
import { buildFileContext, buildFinalPrompt } from "./buildFileContext";
import { sendPrompt } from "@/services/llmService";

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
 *  2. Constrói o contexto textual
 *  3. Monta o prompt final
 *  4. Chama o LLM via llmService com suporte a streaming
 *  5. Escreve o output de volta em cada arquivo conectado (se houver filePath)
 *
 * @param {{
 *   agentId: string;
 *   nodes: import('@xyflow/react').Node[];
 *   edges: import('@xyflow/react').Edge[];
 *   instruction: string;
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
  onChunk,
  signal,
}) {
  // 1. Coletar arquivos dos FileNodes conectados
  const files = getConnectedFiles(agentId, nodes, edges);

  // 2. Construir contexto de arquivos
  const fileContext = buildFileContext(files);

  // 3. Montar prompt final
  const finalPrompt = buildFinalPrompt(instruction || "", fileContext);

  // 4. Enviar ao modelo
  const result = await sendPrompt({
    prompt: finalPrompt,
    onChunk,
    signal,
  });

  // 5. Escrever o output de volta nos arquivos que possuem filePath
  //    (ou seja, arquivos que vieram do disco, não de exemplos mock)
  const filesWithPath = files.filter((f) => f.filePath);

  if (filesWithPath.length > 0) {
    await Promise.all(
      filesWithPath.map((file) => writeFileToDisk(file.filePath, result))
    );
  }

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
export async function executeNode({ nodeId, nodes, edges, onChunk, signal }) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} não encontrado.`);

  if (node.type === "agent") {
    return executeAgentNode({
      agentId: nodeId,
      nodes,
      edges,
      instruction: node.data?.prompt ?? "",
      onChunk,
      signal,
    });
  }

  throw new Error(`Tipo de node "${node.type}" não possui executor registrado.`);
}
