// Executa um agente do workflow no celular. Agente simples: uma chamada ao
// modelo local do desktop. Se o agente tiver nós de arquivo de saída ou
// terminais ligados, roda em rodadas: aplica os JSON pedidos e devolve a saída
// real até o modelo encerrar (limite de MAX_ROUNDS).
// Porta adaptada de runAgentRounds.js: a resposta vem de POST /api/prompt
// (sem streaming) e os comandos de terminal rodam via /terminal/exec.

import { AsyncStorage } from '@react-native-async-storage/async-storage';
import {
  getAgentFileNodes, getConnectedFiles, getConnectedNotes,
  buildNoteContext, buildFileContext, buildFinalPrompt,
} from './nodeContext.js';
import {
  applyAgentResultToFileNodes, buildFileEditInstruction, extractJson,
} from './agentFiles.js';
import {
  buildAgentSystemPrompt, buildJsonHandoffRequest, buildTextHandoffRequest,
} from './handoff.js';
import { assertSignalAlive } from './runWorkflow.js';
import { aiUrl, apiUrl } from '../services/serverConfig';

export const MAX_ROUNDS = 5;
const MAX_COMMANDS_PER_ROUND = 8;
const MAX_COMMAND_CHARS = 2000;
const KEPT_HISTORY_ROUNDS = 2;

// Chamadas diretas a API (axios tem interceptors, fetch bruto nao).
async function authHeaders() {
  try {
    const token = (await AsyncStorage.getItem('token')) || '';
    return token ? { Authorization: 'Bearer ' + token } : {};
  } catch {
    return {};
  }
}

// Nós de terminal ligados ao agente (conexões livres: qualquer aresta vale).
export function getAgentTerminals(agentId, nodes, edges) {
  const terminals = new Map(nodes.filter((node) => node.type === 'terminal').map((node) => [node.id, node]));
  const found = new Map();
  for (const edge of edges) {
    if (edge.source === agentId && terminals.has(edge.target)) found.set(edge.target, terminals.get(edge.target));
    if (edge.target === agentId && terminals.has(edge.source)) found.set(edge.source, terminals.get(edge.source));
  }
  return [...found.values()];
}

function describeShell() {
  return 'O terminal roda no desktop conectado (API /terminal/exec): um comando por item, sem linhas multiplas (encadeie com comando separado).';
}

// Equivalente do refreshAgentFileNodes do desktop: rele dos FileNodes do
// agente (entrada e saida) o conteudo atual dos arquivos no desktop. Um
// agente anterior pode ter criado/alterado arquivos sem o node estar a par.
async function refreshAgentFileNodes({ agentId, getNodes, edges, onUpdate, signal }) {
  const { inputs, outputs } = getAgentFileNodes(agentId, getNodes(), edges);
  const seen = new Set();
  for (const node of [...inputs, ...outputs]) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    const files = Array.isArray(node.data?.files) ? node.data.files : [];
    if (!files.some((file) => file.filePath)) continue;
    const freshFiles = await Promise.all(files.map(async (file) => {
      if (!file.filePath) return file;
      try {
        const response = await fetch(apiUrl() + '/file/workspace/content?path=' + encodeURIComponent(file.filePath), {
          headers: { ...(await authHeaders()) },
          signal,
        });
        if (!response.ok) return file;
        const body = await response.json().catch(() => null);
        const content = body?.fileContent;
        return typeof content === 'string' ? { ...file, fileContent: content, fileSize: content.length } : file;
      } catch {
        return file;
      }
    }));
    onUpdate(node.id, { files: freshFiles });
  }
}

function roundHistory(rounds) {
  if (!rounds.length) return '';
  return 'HISTORICO DESTA EXECUCAO (os arquivos acima ja refletem o que voce alterou antes):\n\n' +
    rounds.slice(-KEPT_HISTORY_ROUNDS).join('\n\n') +
    '\n\nContinue a partir daqui:\n' +
    '- O que voce ja alterou esta feito: NAO repita edicoes ("fileOperations" deve ser [] a menos que ainda falte algo).\n' +
    '- Se a tarefa ja esta cumprida, nao peca mais comandos.\n' +
    '- Em "message" descreva o resultado COMPLETO da tarefa (o que foi feito em todas as rodadas e o que o terminal mostrou).';
}

async function callModel({ prompt, systemPrompt, model, signal }) {
  const response = await fetch(aiUrl() + '/api/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, ...(systemPrompt ? { systemPrompt } : {}), ...(model ? { model } : {}) }),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Erro HTTP ' + response.status + ' no modelo.');
  const result = body?.response;
  if (typeof result !== 'string' || !result.trim()) throw new Error('O modelo nao retornou uma resposta.');
  return result;
}

async function runTerminalCommand(command, signal) {
  const response = await fetch(apiUrl() + '/terminal/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ command, timeout_ms: 30000 }),
    signal,
  });
  const body = await response.json().catch(() => ({}));
  if (body && (body.stdout || body.stderr || body.exit_code !== undefined)) {
    const output = [body.stdout, body.stderr && 'ERRO:\n' + body.stderr].filter(Boolean).join('\n');
    return { output: output && body.exit_code ? output + '\n[exit ' + body.exit_code + ']' : output, status: body.exit_code === 0 ? 'done' : 'status desconhecido' };
  }
  throw new Error(body?.error?.message || body?.error || 'Falha ao executar comando no desktop.');
}

function readTerminalCommands(parsed, terminals) {
  const requested = Array.isArray(parsed?.terminalCommands) ? parsed.terminalCommands : [];
  const commands = [];
  const errors = [];
  if (!requested.length) return { commands, errors };
  if (!terminals.length) {
    return { commands, errors: ['nenhum terminal conectado a este agente'] };
  }
  const labelOf = (node) => node.data?.label || 'Terminal';
  for (const item of requested.slice(0, MAX_COMMANDS_PER_ROUND)) {
    const text = typeof item === 'string' ? item : item?.command;
    if (typeof text !== 'string' || !text.trim()) { errors.push('comando vazio ignorado'); continue; }
    const command = text.trim();
    if (/[\r\n]/.test(command)) { errors.push('comando com varias linhas ignorado: ' + command.split(/[\r\n]/)[0] + '...'); continue; }
    if (command.length > MAX_COMMAND_CHARS) { errors.push('comando longo demais ignorado'); continue; }
    let terminal = terminals[0];
    if (item && typeof item === 'object' && item.terminal) {
      const wanted = String(item.terminal).toLowerCase();
      terminal = terminals.find((node) => node.id === item.terminal || labelOf(node).toLowerCase() === wanted);
      if (!terminal) { errors.push('terminal "' + item.terminal + '" nao esta conectado ao agente (comando ignorado)'); continue; }
    }
    commands.push({ terminalId: terminal.id, label: labelOf(terminal), command });
  }
  if (requested.length > MAX_COMMANDS_PER_ROUND) errors.push('so os primeiros ' + MAX_COMMANDS_PER_ROUND + ' comandos de cada rodada sao executados');
  return { commands, errors };
}

function formatTerminalResults(results, maxTotalChars = 8000) {
  const blocks = results.map((item) =>
    '$ ' + item.command + '  (' + item.label + ')' + (item.error ? ' [nao executou: ' + item.error + ']' : '') + '\n' + (item.output || '(sem saida)'));
  const text = blocks.join('\n\n');
  return text.length > maxTotalChars ? '[...saidas anteriores cortadas...]\n' + text.slice(-maxTotalChars) : text;
}

// Executa um agente (uma ou varias rodadas) e devolve o resultado final:
// string simples ou JSON agregado { fileOperations, message, handoff, ... }.
export async function runAgentRounds({
  agentId, getNodes, edges, context, signal, onUpdate, emit,
}) {
  const first = getNodes().find((item) => item.id === agentId);
  if (!first) throw new Error('Agente removido durante a execucao.');
  const label = first.data?.label || agentId;
  const nodes = getNodes();
  const targets = nodes.filter((item) => item.type === 'agent' && edges.some((edge) => edge.source === agentId && edge.target === item.id));
  const terminals = getAgentTerminals(agentId, nodes, edges);
  const maxRounds = terminals.length ? MAX_ROUNDS : 1;

  const history = [];
  const allOperations = [];
  const allCommands = [];
  let rounds = 0;
  let result = '';
  let lastMessage = '';
  let lastHandoff = null;

  for (let round = 1; round <= maxRounds; round++) {
    assertSignalAlive(signal);
    rounds = round;
    // Arquivos criados por agentes anteriores (ou pelo terminal) podem nao
    // estar ainda no FileNode deste agente: rele do desktop antes do contexto.
    await refreshAgentFileNodes({ agentId, getNodes, edges, onUpdate, signal });
    assertSignalAlive(signal);
    const currentNodes = getNodes();
    const node = currentNodes.find((item) => item.id === agentId);
    if (!node) throw new Error('Agente removido durante a execucao.');
    const specifier = getAgentFileNodes(agentId, currentNodes, edges);
    const outputFiles = specifier.outputs;
    const inputFiles = getConnectedFiles(agentId, currentNodes, edges);

    let instruction = node.data?.prompt || '';
    if (!instruction.trim() && getConnectedNotes(agentId, currentNodes, edges).length) {
      instruction = 'Cumpra o que esta descrito nas NOTAS CONECTADAS.';
    }
    if (!instruction.trim()) {
      throw new Error('Descreva primeiro a tarefa deste agente.');
    }
    const handoffPrompt = node.data?.handoffPrompt?.trim() || '';
    const systemPrompt = buildAgentSystemPrompt(label, { editsFiles: outputFiles.length > 0, usesTerminal: terminals.length > 0 });

    let finalPrompt;
    if (outputFiles.length || terminals.length) {
      finalPrompt = buildFileEditInstruction({
        instruction, outputFiles, inputFiles,
        handoffRequest: targets.length ? buildJsonHandoffRequest(targets, handoffPrompt) : '',
        terminalSpec: terminals.length ? describeShell() : '',
      });
      const historyBlock = roundHistory(history);
      if (historyBlock) finalPrompt += '\n\n' + historyBlock;
    } else {
      finalPrompt = buildFinalPrompt(instruction, [
        buildNoteContext(getConnectedNotes(agentId, currentNodes, edges)),
        buildFileContext(inputFiles),
      ].filter(Boolean).join('\n\n---\n\n'));
      if (targets.length) finalPrompt += buildTextHandoffRequest(targets, handoffPrompt);
    }

    onUpdate(node.id, { runStatus: 'running', notice: round > 1 ? 'Rodada ' + round + ' de ' + maxRounds : '' });
    result = await callModel({ prompt: finalPrompt, systemPrompt, model: node.data?.model, signal });
    assertSignalAlive(signal);
    onUpdate(node.id, { output: result, notice: '' });

    // 1) Aplica operacoes de arquivo no no de saida.
    let operations = [];
    if (outputFiles.length) {
      const parsed = extractJson(result);
      if (parsed && Array.isArray(parsed.fileOperations)) {
        operations = parsed.fileOperations;
        for (const fileNode of outputFiles) {
          const files = Array.isArray(fileNode.data?.files) ? fileNode.data.files : [];
          const applied = applyAgentResultToFileNodes(operations, files);
          onUpdate(fileNode.id, { files: applied.files });
          for (const operation of parsed.fileOperations) {
            if (!['create', 'update'].includes(operation.action) || typeof operation.content !== 'string') continue;
            const original = files.find((file) => file.fileName === operation.fileName);
            if (!original?.filePath) continue;
            try {
              await fetch(apiUrl() + '/file/workspace/content', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
                body: JSON.stringify({ path: original.filePath, content: operation.content }),
                signal,
              });
            } catch (writeError) {
              if (signal.aborted) return null;
            }
          }
        }
        emit({ type: 'files', text: label + ': ' + (operations.length ? operations.map((o) => (o.action || '?') + ' ' + (o.fileName || '')).join(', ') : 'nenhuma operacao') });
      } else {
        emit({ type: 'error', text: label + ': resposta nao veio no JSON esperado; nenhuma operacao aplicada.' });
      }
    }

    if (!terminals.length) {
      // Agente simples: um agente de saida de arquivos devolve o JSON
      // original para o handoff saber ler o que foi alterado.
      return result;
    }

    // 2) Loop de terminal.
    const parsed = extractJson(result);
    if (!parsed || typeof parsed !== 'object') {
      onUpdate(agentId, { notice: 'Resposta fora do JSON esperado; nenhum comando foi executado.' });
      break;
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) lastMessage = parsed.message;
    if (parsed.handoff) lastHandoff = parsed.handoff;
    if (Array.isArray(parsed.fileOperations)) allOperations.push(...parsed.fileOperations);

    const { commands, errors } = readTerminalCommands(parsed, terminals);
    if (errors.length) {
      emit({ type: 'error', text: label + ' (terminal): ' + errors.join('; ') });
      onUpdate(agentId, { notice: 'Terminal: ' + errors.join('; ') });
    }
    if (!commands.length) break;
    if (round === maxRounds) {
      onUpdate(agentId, { notice: 'Limite de ' + maxRounds + ' rodadas de terminal atingido.' });
      break;
    }

    const outcomes = [];
    for (const item of commands) {
      assertSignalAlive(signal);
      onUpdate(agentId, { notice: 'Executando no desktop: ' + item.command });
      try {
        const outcome = await runTerminalCommand(item.command, signal);
        outcomes.push({ ...item, ...outcome });
      } catch (runError) {
        if (runError?.name === 'AbortError') throw runError;
        outcomes.push({ ...item, output: '', error: runError.message });
        break;
      }
    }
    onUpdate(agentId, { notice: '' });
    const report = formatTerminalResults(outcomes);
    emit({ type: 'terminal', text: label + ' (terminal):\n' + report });
    allCommands.push(...outcomes.map((item) => item.command));
    onUpdate(agentId, { terminalContent: mergeTerminalContent(node, outcomes) });
    // O agente disse que nao precisa ver a saida: nao ha segunda chamada.
    if (parsed.readOutput === false) break;
    history.push('Rodada ' + round + ' - voce pediu estes comandos; esta e a saida real do terminal:\n' + report);
  }

  if (rounds === 1 && !allCommands.length) return result;
  return JSON.stringify({
    fileOperations: allOperations,
    terminalCommands: allCommands,
    message: lastMessage,
    ...(lastHandoff ? { handoff: lastHandoff } : {}),
  });
}

function mergeTerminalContent(node, outcomes) {
  const previous = node.data?.terminalContent || '';
  const block = outcomes
    .map((item) => '> ' + item.command + '\n' + (item.output || '(sem saida)') + (item.error ? '\nERRO: ' + item.error : ''))
    .join('\n\n');
  return previous + (previous ? '\n\n' : '') + block;
}
