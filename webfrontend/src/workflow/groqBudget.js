export function prepareGroqPrompt(instruction, agentContext, fileContext, maxOutputTokens = 4096) {
  const notices = [];
  let context = agentContext || "";
  if (context.length > 5000) {
    context = context.slice(0, 4000) + "\n[Contexto anterior reduzido para economizar tokens; consulte a resposta completa no painel.]\n" + context.slice(-800);
    notices.push("O contexto dos agentes anteriores foi reduzido para economizar tokens. A resposta completa continua no painel.");
  }
  const prompt = [context, fileContext, "INSTRUCAO ATUAL:\n" + instruction].filter(Boolean).join("\n\n---\n\n");
  // Conservative estimate, not a provider tokenizer. Keep room below the
  // reported 8000 TPM budget for the completion and protocol overhead.
  const estimatedInputTokens = Math.ceil(new TextEncoder().encode(prompt).length / 3);
  const outputTokens = Math.min(4096, Math.max(256, Number(maxOutputTokens) || 4096), 6800 - estimatedInputTokens);
  if (outputTokens < 512) {
    throw new Error("O contexto desta etapa e grande demais para a cota de 8000 tokens do Groq (estimativa: " + estimatedInputTokens + " de entrada + " + Math.max(0, outputTokens) + " de resposta). Conecte menos arquivos ou reduza a tarefa. Nenhum arquivo foi cortado ou enviado nesta tentativa.");
  }
  return { prompt, maxOutputTokens: outputTokens, notices };
}
