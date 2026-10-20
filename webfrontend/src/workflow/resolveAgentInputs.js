export function resolveAgentInputs(targetAgentId, nodes, edges) {
  const ids = new Set(edges.filter((edge) => edge.target === targetAgentId).map((edge) => edge.source));
  return nodes.filter((node) => ids.has(node.id) && node.type === "agent" && node.data?.output)
    .map((node) => ({ agentId: node.id, label: node.data?.label || node.id,
      output: typeof node.data.output === "string" ? node.data.output : JSON.stringify(node.data.output),
      instruction: node.data?.handoffPrompt || "" }));
}

export function buildAgentContext(inputs) {
  if (!inputs?.length) return "";
  return "INSTRUCOES E RESULTADOS RECEBIDOS DE OUTROS AGENTES:\n" +
    "Use as instrucoes recebidas para executar a sua etapa, respeitando o pedido do usuario. Nao apenas repita a resposta anterior.\n\n" +
    inputs.map((input) => "### De: " + input.label + " [" + input.agentId + "]\n" +
      (input.instruction ? "Instrucao de encaminhamento: " + input.instruction + "\n\n" : "") +
      "Resultado e instrucoes do agente:\n" + input.output).join("\n\n---\n\n");
}
