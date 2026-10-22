import { useState, useRef, useEffect, useCallback } from "react";
import sheets from "@/services/api";
import { Terminal, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const QUICK_COMMANDS = [
  { label: "Node Version", cmd: "node -v" },
  { label: "Git Status", cmd: "git status" },
  { label: "List Files", cmd: "dir" },
  { label: "System Info", cmd: "systeminfo" },
];

export default function WebTerminalPanel({ terminalId, clearTrigger = 0 }) {
  const [history, setHistory] = useState([
    {
      id: "welcome-1",
      type: "system",
      text: "Osíris Terminal — Conectado à API Local (Modo REST)",
    },
    {
      id: "welcome-2",
      type: "system",
      text: "Digite qualquer comando do sistema ou clique nos comandos rápidos.",
    },
  ]);
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  // Clear trigger from header
  useEffect(() => {
    if (clearTrigger > 0) {
      setHistory([
        {
          id: `clear-${Date.now()}`,
          type: "system",
          text: "Terminal limpo.",
        },
      ]);
    }
  }, [clearTrigger]);

  const executeCommand = useCallback(
    async (rawCmd) => {
      const trimmed = (rawCmd !== undefined ? rawCmd : command).trim();
      if (!trimmed || loading) return;

      // Add to command history for arrow navigation
      setCmdHistory((prev) => [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, 50));
      setHistoryIdx(-1);
      setCommand("");
      setLoading(true);

      const runId = `cmd-${Date.now()}`;
      setHistory((prev) => [
        ...prev,
        { id: runId, type: "command", text: trimmed },
      ]);

      try {
        const response = await sheets.terminalExecute({
          command: trimmed,
          timeout_ms: 30000,
        });

        const data = response.data || {};
        const newEntries = [];

        if (data.stdout) {
          newEntries.push({
            id: `out-${Date.now()}`,
            type: "stdout",
            text: data.stdout.trimEnd(),
          });
        }

        if (data.stderr) {
          newEntries.push({
            id: `err-${Date.now()}`,
            type: "stderr",
            text: data.stderr.trimEnd(),
          });
        }

        if (!data.stdout && !data.stderr) {
          newEntries.push({
            id: `done-${Date.now()}`,
            type: "success",
            text: "Comando executado com sucesso (sem retorno de texto).",
          });
        }

        setHistory((prev) => [...prev, ...newEntries]);
      } catch (err) {
        const errMsg =
          err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          "Falha na comunicação com a API de terminal.";

        setHistory((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            type: "stderr",
            text: `Erro: ${errMsg}`,
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [command, loading]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeCommand();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
        setHistoryIdx(nextIdx);
        setCommand(cmdHistory[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setCommand(cmdHistory[nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setCommand("");
      }
    }
  };

  return (
    <div
      className="flex h-full w-full flex-col bg-[#0c0c0e] font-mono select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Quick commands bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800/40 bg-[#101012] px-3 py-1.5 text-xs">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider mr-1">
          Atalhos:
        </span>
        {QUICK_COMMANDS.map((qc) => (
          <button
            key={qc.label}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              executeCommand(qc.cmd);
            }}
            disabled={loading}
            className="rounded bg-zinc-800/70 px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-violet-600/30 hover:text-violet-200 disabled:opacity-50"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Output list */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto p-4 text-[13px] leading-relaxed"
      >
        {history.map((entry) => {
          if (entry.type === "command") {
            return (
              <div key={entry.id} className="flex items-start gap-2 pt-1 text-zinc-100">
                <span className="text-violet-400 font-bold">❯</span>
                <span className="font-semibold">{entry.text}</span>
              </div>
            );
          }

          if (entry.type === "stdout") {
            return (
              <pre
                key={entry.id}
                className="whitespace-pre-wrap rounded bg-zinc-900/40 p-2 text-zinc-300"
              >
                {entry.text}
              </pre>
            );
          }

          if (entry.type === "stderr") {
            return (
              <div
                key={entry.id}
                className="flex items-start gap-2 rounded border border-red-500/20 bg-red-950/20 p-2 text-red-300"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
                <pre className="whitespace-pre-wrap">{entry.text}</pre>
              </div>
            );
          }

          if (entry.type === "success") {
            return (
              <div
                key={entry.id}
                className="flex items-center gap-1.5 text-emerald-400 text-xs py-0.5"
              >
                <CheckCircle2 size={14} />
                <span>{entry.text}</span>
              </div>
            );
          }

          return (
            <div key={entry.id} className="text-zinc-500 text-xs italic py-0.5">
              {entry.text}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-violet-400 text-xs py-1">
            <Loader2 size={14} className="animate-spin" />
            <span>Executando comando no backend...</span>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="border-t border-zinc-800/60 bg-[#101012] p-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0c0c0e] px-3 py-1.5 focus-within:border-violet-500/60">
          <Terminal size={16} className="text-violet-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Digite um comando (ex: node -v, git status, dir)..."
            className="w-full bg-transparent text-[13px] text-zinc-100 placeholder-zinc-600 outline-none"
            autoComplete="off"
            spellCheck="false"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              executeCommand();
            }}
            disabled={loading || !command.trim()}
            className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:bg-violet-500 disabled:opacity-40"
          >
            Executar
          </button>
        </div>
      </div>
    </div>
  );
}
