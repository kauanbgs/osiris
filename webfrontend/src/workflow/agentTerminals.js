// Lets an agent type into the Terminal nodes connected to it.

export const MAX_COMMANDS_PER_ROUND = 8;
export const MAX_ROUNDS = 5;
const MAX_COMMAND_CHARS = 2000;
const ENTER = String.fromCharCode(13);
const CTRL_C = String.fromCharCode(3);
const MARKER = "__OSIRIS_DONE__";

/**
 * Terminal nodes linked to the agent. The canvas uses loose connections, so
 * any edge between the two counts, whatever its direction or handle.
 */
export function getAgentTerminals(agentId, nodes, edges) {
  const terminals = new Map(nodes.filter((node) => node.type === "terminal").map((node) => [node.id, node]));
  const found = new Map();
  for (const edge of edges) {
    if (edge.source === agentId && terminals.has(edge.target)) found.set(edge.target, terminals.get(edge.target));
    if (edge.target === agentId && terminals.has(edge.source)) found.set(edge.source, terminals.get(edge.source));
  }
  return [...found.values()];
}

export function isWindows(platform = typeof navigator === "undefined" ? "" : navigator.userAgent) {
  return /win/i.test(platform);
}

// What the model needs to know to write commands the terminal understands.
export function describeShell(windows = isWindows()) {
  return windows
    ? "O terminal e o Windows PowerShell 5: encadeie comandos com ';' (nao use '&&'), use caminhos do Windows e comandos como Get-ChildItem, Set-Location, node, npm, git."
    : "O terminal e um shell POSIX (bash/zsh): pode usar '&&', pipes e comandos Unix.";
}

export function stripAnsi(value) {
  return String(value)
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[()][A-Z0-9]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

// The finish marker is built so that the line the shell echoes back while we
// type never contains it: only the real output of the final echo does.
function markerCommand(windows) {
  return windows ? "; Write-Output ('__OSIRIS_'+'DONE__')" : "; echo __OSIRIS_''DONE__";
}

function tail(text, maxChars) {
  return text.length > maxChars ? "[...saida cortada...]\n" + text.slice(-maxChars) : text;
}

// Output of the command only: no echoed command line, no finish marker.
export function cleanTerminalOutput(raw, maxChars = 4000) {
  let text = stripAnsi(raw);
  const done = text.indexOf(MARKER);
  if (done !== -1) text = text.slice(0, done);
  const echoed = [...text.matchAll(/__OSIRIS_(?:'\+'|'')DONE__/g)].pop();
  if (echoed) {
    const lineEnd = text.indexOf("\n", echoed.index);
    text = lineEnd === -1 ? "" : text.slice(lineEnd + 1);
  }
  text = text.split("\n").filter((line) => !line.includes("__OSIRIS")).join("\n").trim();
  return tail(text, maxChars);
}

/**
 * Types one command into a terminal and waits until it finishes.
 * @returns {Promise<{ output: string, status: "done" | "timeout" | "silent" }>}
 */
// After a Ctrl+C the shell discards what is typed while it handles the
// interrupt, so the next command to that terminal waits until this time.
const cooldownUntil = new Map();
function interrupt(api, terminalId, settleMs) {
  api.terminalWrite(terminalId, CTRL_C);
  cooldownUntil.set(terminalId, Date.now() + settleMs);
}

export async function runTerminalCommand(terminalId, command, {
  api = typeof window === "undefined" ? undefined : window.electronAPI,
  signal,
  windows = isWindows(),
  timeoutMs = 120000,
  silentMs = 20000,
  settleMs = 1000,
  maxChars = 4000,
} = {}) {
  if (!api?.terminalWrite || !api?.onTerminalData) {
    throw new Error("O terminal so funciona no aplicativo Electron.");
  }
  signal?.throwIfAborted();
  const wait = (cooldownUntil.get(terminalId) ?? 0) - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    let raw = "";
    let finished = false;
    let silentTimer;
    const stopListening = api.onTerminalData((targetId, data) => {
      if (targetId !== terminalId) return;
      raw += data;
      if (raw.includes(MARKER)) return finish("done");
      clearTimeout(silentTimer);
      silentTimer = setTimeout(() => finish("silent"), silentMs);
    });
    const timeout = setTimeout(() => finish("timeout"), timeoutMs);
    const onAbort = () => {
      interrupt(api, terminalId, settleMs);
      finish("aborted");
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    function finish(status) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      clearTimeout(silentTimer);
      stopListening?.();
      signal?.removeEventListener("abort", onAbort);
      if (status === "aborted") return reject(signal.reason ?? new DOMException("Interrompido", "AbortError"));
      // A command that never ends (dev server, prompt waiting for input) is
      // interrupted so the next command does not get typed into it.
      const result = { output: cleanTerminalOutput(raw, maxChars), status };
      if (status === "done") return resolve(result);
      interrupt(api, terminalId, settleMs);
      resolve(result);
    }

    api.terminalWrite(terminalId, command + markerCommand(windows) + ENTER);
  });
}

/**
 * Commands requested in an agent answer. Entries are a string (first terminal)
 * or { terminal: "label or id", command: "..." }. Invalid entries are reported
 * in `errors` and never run.
 */
export function readTerminalCommands(parsed, terminals) {
  const requested = Array.isArray(parsed?.terminalCommands) ? parsed.terminalCommands : [];
  const commands = [];
  const errors = [];
  if (!requested.length) return { commands, errors };
  if (!terminals.length) {
    return { commands, errors: ["nenhum terminal conectado a este agente: conecte um Terminal ao agente para executar comandos"] };
  }
  const labelOf = (node) => node.data?.label || "Terminal";
  for (const item of requested.slice(0, MAX_COMMANDS_PER_ROUND)) {
    const text = typeof item === "string" ? item : item?.command;
    if (typeof text !== "string" || !text.trim()) { errors.push("comando vazio ignorado"); continue; }
    const command = text.trim();
    if (/[\r\n]/.test(command)) { errors.push(`comando com varias linhas ignorado: "${command.split(/[\r\n]/)[0]}..."`); continue; }
    if (command.length > MAX_COMMAND_CHARS) { errors.push("comando longo demais ignorado"); continue; }
    let terminal = terminals[0];
    if (item && typeof item === "object" && item.terminal) {
      const wanted = String(item.terminal).toLowerCase();
      terminal = terminals.find((node) => node.id === item.terminal || labelOf(node).toLowerCase() === wanted);
      if (!terminal) { errors.push(`terminal "${item.terminal}" nao esta conectado ao agente (comando ignorado: ${command})`); continue; }
    }
    commands.push({ terminalId: terminal.id, label: labelOf(terminal), command });
  }
  if (requested.length > MAX_COMMANDS_PER_ROUND) errors.push(`so os primeiros ${MAX_COMMANDS_PER_ROUND} comandos de cada rodada sao executados`);
  return { commands, errors };
}

/** Runs the commands in order and stops at the first failure to run. */
export async function runTerminalCommands(commands, options = {}) {
  const results = [];
  for (const item of commands) {
    options.signal?.throwIfAborted();
    options.onStart?.(item);
    try {
      const { output, status } = await runTerminalCommand(item.terminalId, item.command, options);
      results.push({ ...item, output, status });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      results.push({ ...item, output: "", status: "error", error: error.message });
      break;
    }
  }
  return results;
}

const STATUS_TEXT = {
  done: "",
  timeout: " [interrompido: passou do tempo limite]",
  silent: " [interrompido: ficou sem saida por muito tempo; pode estar esperando uma entrada]",
};

// Text fed back to the model after a round of commands.
export function formatTerminalResults(results, maxTotalChars = 8000) {
  const blocks = results.map((item) =>
    `$ ${item.command}  (${item.label})${item.status === "error" ? ` [nao executou: ${item.error}]` : STATUS_TEXT[item.status] || ""}\n${item.output || "(sem saida)"}`);
  const text = blocks.join("\n\n");
  return text.length > maxTotalChars ? "[...saidas anteriores cortadas...]\n" + text.slice(-maxTotalChars) : text;
}
