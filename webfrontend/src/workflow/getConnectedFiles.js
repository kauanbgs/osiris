import { getNodeInputs } from "./getNodeInputs";

/**
 * Coleta todos os arquivos dos FileNodes conectados ao `agentId`
 * pelo handle "files".
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
  const inputs = getNodeInputs(agentId, nodes, edges, { targetHandle: "files" });

  const files = [];

  for (const { node } of inputs) {
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
