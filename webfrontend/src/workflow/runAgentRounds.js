import { executeAgentNode } from "./executeAgentNode.js";
import { applyAgentResultToFileNodes, buildFileEditInstruction, extractJson } from "./agentFiles.js";
import { buildJsonHandoffRequest, buildTextHandoffRequest } from "./handoff.js";
import { getAgentFileNodes, getConnectedFiles } from "./getConnectedFiles.js";
import { getConnectedNotes, NOTES_TASK } from "./getConnectedNotes.js";
import {
  MAX_ROUNDS,
  describeShell,
  formatTerminalResults,
  getAgentTerminals,
  readTerminalCommands,
  runTerminalCommands,
} from "./agentTerminals.js";

const KEPT_HISTORY_ROUNDS = 2;

function roundHistory(rounds) {
  if (!rounds.length) return "";
  return "HISTORICO DESTA EXECUCAO (os arquivos acima ja refletem o que voce alterou antes):\n\n" +
    rounds.slice(-KEPT_HISTORY_ROUNDS).join("\n\n") +
    "\n\nContinue a partir daqui:\n" +
    "- O que voce ja alterou nos arquivos esta feito: NAO repita edicoes (\"fileOperations\" deve ser [] a menos que ainda falte algo).\n" +
    "- Se a tarefa ja esta cumprida, nao peca mais comandos.\n" +
    "- Em \"message\" descreva o resultado COMPLETO da tarefa (o que foi feito em todas as rodadas e o que o terminal mostrou): e isso que o usuario vai ler. Nao escreva que algo \"ja foi feito\" sem dizer o que foi.";
}

/**
 * Runs one agent. A plain agent makes a single call. An agent with connected
 * file outputs also has its answer applied to the files, and an agent with
 * connected terminals can type commands: their real output is fed back and the
 * agent answers again, up to MAX_ROUNDS times, until it asks for no commands.
 *
 * `deps` exists so the loop can be tested without a model or a terminal.
 */
export async function runAgentRounds({
  agentId, nodes, getNodes, edges, context, signal, updateNodeData, patch, emit,
  deps = {},
}) {
  const execute = deps.executeAgentNode || executeAgentNode;
  const applyFiles = deps.applyAgentResultToFileNodes || applyAgentResultToFileNodes;
  const runCommands = deps.runTerminalCommands || runTerminalCommands;

  const first = getNodes().find((item) => item.id === agentId);
  if (!first) throw new Error("Agente removido durante a execucao.");
  const label = first.data?.label || agentId;
  const targets = nodes.filter((item) => item.type === "agent" && edges.some((edge) => edge.source === agentId && edge.target === item.id));
  const terminals = getAgentTerminals(agentId, getNodes(), edges);
  const maxRounds = terminals.length ? MAX_ROUNDS : 1;

  const history = [];
  const allOperations = [];
  const allCommands = [];
  let rounds = 0;
  let result = "";
  let lastParsed = null;
  let lastMessage = "";
  let lastHandoff = null;

  for (let round = 1; round <= maxRounds; round++) {
    signal.throwIfAborted();
    rounds = round;
    const currentNodes = getNodes();
    const node = currentNodes.find((item) => item.id === agentId);
    if (!node) throw new Error("Agente removido durante a execucao.");
    const outputFiles = getAgentFileNodes(agentId, currentNodes, edges).outputs;

    let instruction = node.data?.prompt || "";
    // The request may live only in a connected note.
    if (!instruction.trim() && getConnectedNotes(agentId, currentNodes, edges).length) instruction = NOTES_TASK;
    const handoffPrompt = node.data?.handoffPrompt?.trim() || "";
    const handoffRequest = targets.length ? buildJsonHandoffRequest(targets, handoffPrompt) : "";

    let editableFileContext = "";
    if (outputFiles.length || terminals.length) {
      ({ instruction, fileContext: editableFileContext } = buildFileEditInstruction(
        instruction, outputFiles, handoffRequest, getConnectedFiles(agentId, currentNodes, edges),
        { terminals, history: roundHistory(history), shell: describeShell() },
      ));
    } else if (targets.length) {
      instruction += buildTextHandoffRequest(targets, handoffPrompt);
    }

    result = await execute({
      agentId, nodes: currentNodes, edges, instruction, agentContext: context, editableFileContext, signal,
      onNotice: (notice) => {
        patch(agentId, { notice: notice.message });
        emit({
          type: notice.type,
          title: label + " - " + (notice.type === "rate-limit" ? "aguardando Groq" : notice.type === "continuation" ? "continuando resposta" : "economia de contexto"),
          text: notice.message,
        });
      },
      onChunk: (output) => { if (!signal.aborted) patch(agentId, { output, notice: "" }); },
    });
    signal.throwIfAborted();

    if (outputFiles.length) {
      const applied = await applyFiles({ agentId, result, nodes: getNodes(), edges, updateNodeData, signal });
      emit({
        type: "files",
        title: label + " - arquivos",
        text: applied
          ? [applied.written.length ? "Gravado: " + applied.written.join(", ") : "Nenhum arquivo foi gravado.",
            applied.warnings.length && "Avisos: " + applied.warnings.join("; "),
            JSON.stringify(applied.fileOperations, null, 2)].filter(Boolean).join("\n\n")
          : "A resposta nao continha operacoes de arquivo validas.",
      });
      const problems = applied ? applied.errors : ["a resposta nao veio no formato JSON esperado"];
      const notes = [problems.length && "Nao aplicado (arquivos com erro ficaram como estavam): " + problems.join("; "),
        applied?.warnings.length && "Atencao: " + applied.warnings.join("; ")].filter(Boolean);
      if (notes.length) patch(agentId, { notice: notes.join(" | ") });
    }

    if (!terminals.length) return result;

    const parsed = extractJson(result);
    if (!parsed || typeof parsed !== "object") {
      patch(agentId, { notice: "A resposta nao veio no formato JSON esperado; nenhum comando foi executado." });
      break;
    }
    lastParsed = parsed;
    // A later round may come back empty: keep the last real message/handoff.
    if (typeof parsed.message === "string" && parsed.message.trim()) lastMessage = parsed.message;
    if (parsed.handoff) lastHandoff = parsed.handoff;
    if (Array.isArray(parsed.fileOperations)) allOperations.push(...parsed.fileOperations);

    const { commands, errors } = readTerminalCommands(parsed, terminals);
    if (errors.length) {
      emit({ type: "error", title: label + " - terminal", text: errors.join("\n") });
      patch(agentId, { notice: "Terminal: " + errors.join("; ") });
    }
    if (!commands.length) break;

    if (round === maxRounds) {
      patch(agentId, { notice: "Limite de " + maxRounds + " rodadas de terminal atingido; os ultimos comandos nao foram executados." });
      break;
    }

    const outcomes = await runCommands(commands, {
      signal,
      onStart: (item) => patch(agentId, { notice: "Digitando no terminal: " + item.command }),
    });
    patch(agentId, { notice: "" });
    const report = formatTerminalResults(outcomes);
    emit({ type: "terminal", title: label + " - terminal", text: report });
    allCommands.push(...outcomes.map((item) => item.command));
    // The agent said it does not need to read the result: no second call.
    if (parsed.readOutput === false) break;
    history.push("Rodada " + round + " - voce pediu estes comandos; esta e a saida real do terminal:\n" + report);
  }

  // One round: the answer as it came. Several: one JSON with everything done.
  if (rounds === 1 && !allCommands.length) return result;
  return JSON.stringify({
    fileOperations: allOperations,
    terminalCommands: allCommands,
    message: lastMessage,
    ...(lastHandoff ? { handoff: lastHandoff } : {}),
  });
}
