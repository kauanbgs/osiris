/**
 * Retorna todos os nodes que enviam dados para `targetNodeId`,
 * opcionalmente filtrando pelo handle de destino.
 *
 * @param {string} targetNodeId
 * @param {import('@xyflow/react').Node[]} nodes
 * @param {import('@xyflow/react').Edge[]} edges
 * @param {{ targetHandle?: string }} [options]
 * @returns {{ node: import('@xyflow/react').Node, edge: import('@xyflow/react').Edge }[]}
 */
export function getNodeInputs(targetNodeId, nodes, edges, options = {}) {
  const { targetHandle } = options;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return edges
    .filter((edge) => {
      if (edge.target !== targetNodeId) return false;
      if (targetHandle !== undefined && edge.targetHandle !== targetHandle) return false;
      return true;
    })
    .map((edge) => {
      const node = nodeMap.get(edge.source);
      return node ? { node, edge } : null;
    })
    .filter(Boolean);
}
