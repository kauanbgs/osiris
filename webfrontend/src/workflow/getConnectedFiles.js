/**
 * FileNodes ligados ao agente, separados em entrada e saida. O canvas aceita
 * ligar qualquer ponto em qualquer sentido, entao o ponto do lado do agente
 * decide quando e explicito ("files" = entrada, "output" = saida); nos demais
 * casos vale o sentido da seta (agente -> arquivo = saida).
 */
export function getAgentFileNodes(agentId, nodes, edges) {
  const files = new Map(nodes.filter((node) => node.type === "file").map((node) => [node.id, node]));
  const inputs = new Map();
  const outputs = new Map();
  for (const edge of edges) {
    const agentIsSource = edge.source === agentId;
    if (!agentIsSource && edge.target !== agentId) continue;
    const file = files.get(agentIsSource ? edge.target : edge.source);
    if (!file) continue;
    const handle = agentIsSource ? edge.sourceHandle : edge.targetHandle;
    const isOutput = handle === "files" ? false : handle === "output" ? true : agentIsSource;
    (isOutput ? outputs : inputs).set(file.id, file);
  }
  return { inputs: [...inputs.values()], outputs: [...outputs.values()] };
}

/**
 * Coleta todos os arquivos dos FileNodes de entrada do `agentId`
 * (veja getAgentFileNodes).
 *
 * Suporta múltiplos FileNodes conectados simultaneamente:
 *
 *   FileNode A ──┐
 *   FileNode B ──┼──► AgentNode
 *   FileNode C ──┘
 *
 * @param {string} agentId
 * @param {import('@xyflow/react').Node[]} nodes
 * @param {import('@xyflow/react').Edge[]} edges
 * @returns {{ fileName: string; fileType: string; fileSize: number; fileContent: string }[]}
 */
export function getConnectedFiles(agentId, nodes, edges) {
  const files = [];

  for (const node of getAgentFileNodes(agentId, nodes, edges).inputs) {
    const nodeFiles = node.data?.files;
    if (!Array.isArray(nodeFiles)) continue;

    for (const file of nodeFiles) {
      files.push({
        fileName: file.fileName ?? "sem-nome",
        fileType: file.fileType ?? "",
        fileSize: file.fileSize ?? 0,
        fileContent: file.fileContent ?? "",
        filePath: file.filePath ?? null, // caminho absoluto no disco (Electron)
      });
    }
  }

  return files;
}
