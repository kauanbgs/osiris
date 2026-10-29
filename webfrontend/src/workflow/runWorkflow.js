import { buildAgentContext, findWorkflowGoal, toAgentInput } from "./resolveAgentInputs.js";

// Every directed connection between agent nodes carries a handoff, regardless
// of the visual handle used to draw it.
export function getAgentEdges(nodes, edges) {
  const ids = new Set(nodes.filter((node) => node.type === "agent").map((node) => node.id));
  return edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
}

export function planWorkflow(nodes, edges, startAgentId) {
  const agents = nodes.filter((node) => node.type === "agent");
  const agentEdges = getAgentEdges(nodes, edges);
  let included = new Set(agents.map((node) => node.id));
  if (startAgentId) {
    if (!included.has(startAgentId)) throw new Error("Agente inicial nao encontrado.");
    included = new Set([startAgentId]);
    const pending = [startAgentId];
    while (pending.length) {
      const source = pending.shift();
      for (const edge of agentEdges.filter((item) => item.source === source)) {
        if (!included.has(edge.target)) { included.add(edge.target); pending.push(edge.target); }
      }
    }
  }
  // A downstream join must also wait for its other prerequisites.
  if (startAgentId) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of agentEdges) {
        if (included.has(edge.target) && !included.has(edge.source)) {
          included.add(edge.source);
          changed = true;
        }
      }
    }
  }
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();
  function visit(node) {
    if (visiting.has(node.id)) throw new Error("Ciclo detectado no workflow: " + (node.data?.label || node.id));
    if (visited.has(node.id)) return;
    visiting.add(node.id);
    for (const edge of agentEdges.filter((item) => item.target === node.id && included.has(item.source))) {
      visit(agents.find((item) => item.id === edge.source));
    }
    visiting.delete(node.id);
    visited.add(node.id);
    ordered.push(node);
  }
  for (const node of agents.filter((item) => included.has(item.id))) visit(node);
  if (!ordered.length) throw new Error("Adicione um agente ao workflow.");
  return ordered;
}

export async function runWorkflow({ nodes, edges, startAgentId, onlyAgentId, executeAgent,
  onPlan, onTransfer, onAgentStart, onAgentDone, onAgentError, signal }) {
  const ordered = onlyAgentId ? nodes.filter((node) => node.type === "agent" && node.id === onlyAgentId) : planWorkflow(nodes, edges, startAgentId);
  if (!ordered.length) throw new Error("Agente nao encontrado.");
  const agentEdges = getAgentEdges(nodes, edges);
  const outputs = new Map();
  const results = [];
  onPlan?.(ordered);
  for (const [index, node] of ordered.entries()) {
    signal?.throwIfAborted();
    const label = node.data?.label || node.id;
    const received = [];
    for (const sourceId of new Set(agentEdges.filter((edge) => edge.target === node.id).map((edge) => edge.source))) {
      const source = nodes.find((item) => item.id === sourceId);
      // Whole-workflow runs use only fresh results. A single-node run may use
      // saved predecessor output, with that origin made explicit in the log.
      const saved = onlyAgentId && !outputs.has(sourceId);
      const output = saved ? source.data?.output : outputs.get(sourceId);
      if (output === undefined || output === null || output === "") continue;
      const input = toAgentInput(source, output);
      // If the sender ignored the handoff format, still deliver what the user
      // wrote in its "Instrucoes para o proximo agente" field.
      if (!input.instruction && source.data?.handoffPrompt?.trim()) input.instruction = source.data.handoffPrompt.trim();
      const transfer = { ...input, targetId: node.id, targetLabel: label, saved: Boolean(saved) };
      received.push(transfer);
      onTransfer?.(transfer);
    }
    const context = buildAgentContext(received, { goal: findWorkflowGoal(node.id, nodes, edges), label,
      step: onlyAgentId ? undefined : index + 1, total: ordered.length });
    onAgentStart?.(node.id, label, index, ordered.length, received);
    try {
      const result = await executeAgent(node.id, context, signal);
      signal?.throwIfAborted();
      outputs.set(node.id, result);
      results.push({ agentId: node.id, result });
      await onAgentDone?.(node.id, label, result);
    } catch (error) {
      onAgentError?.(node.id, label, error);
      throw error;
    }
  }
  return results;
}
