// useTerminal.js — lógica da tela de Terminal: abas de sessão, execução de comandos
// no PC pela API, histórico de comandos (↑ / ↓) e verificação da conexão.
import { useCallback, useEffect, useState } from "react";

import sheets from "../services/api";
import { getIP, loadIP } from "../services/serverConfig";

// Remove códigos ANSI de escape das saídas do terminal
function stripAnsi(str) {
  if (typeof str !== "string") return "";
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

export function useTerminal() {
  const [currentIp, setCurrentIp] = useState(getIP());
  const [connected, setConnected] = useState(null); // true | false | null

  // Abas do terminal (múltiplas sessões simultâneas)
  const [tabs, setTabs] = useState([
    {
      id: "term-1",
      label: "Terminal 1",
      lines: [
        {
          id: "init-1",
          type: "system",
          text: `Osíris Terminal — Conectado ao PC (${getIP()}:5000)`,
        },
        {
          id: "init-2",
          type: "system",
          text: "Digite qualquer comando do sistema operacional do seu desktop.",
        },
      ],
      command: "",
      loading: false,
      cmdHistory: [],
      historyIdx: -1,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("term-1");


  // Aba atualmente selecionada
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Carrega IP e testa status da API do PC
  const checkConnection = useCallback(async () => {
    try {
      const ip = await loadIP();
      if (ip) setCurrentIp(ip);
      await sheets.health();
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);


  // Atualiza propriedades da aba ativa
  const updateActiveTab = useCallback(
    (updater) => {
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.id === activeTabId ? updater(t) : t))
      );
    },
    [activeTabId]
  );

  // Adicionar nova aba
  const handleAddTab = () => {
    if (tabs.length >= 6) return;
    const newIdx = tabs.length + 1;
    const newId = `term-${Date.now()}`;
    const newTab = {
      id: newId,
      label: `Terminal ${newIdx}`,
      lines: [
        {
          id: `init-${Date.now()}-1`,
          type: "system",
          text: `Osíris Terminal [Sessão ${newIdx}] — PC (${currentIp}:5000)`,
        },
        {
          id: `init-${Date.now()}-2`,
          type: "system",
          text: "Sessão iniciada. Digite qualquer comando do PC.",
        },
      ],
      command: "",
      loading: false,
      cmdHistory: [...(activeTab.cmdHistory || [])],
      historyIdx: -1,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Fechar aba
  const handleRemoveTab = (tabIdToRemove) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabIdToRemove);
    setTabs(nextTabs);
    if (activeTabId === tabIdToRemove) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Limpar a aba atual
  const handleClear = () => {
    updateActiveTab((t) => ({
      ...t,
      lines: [
        {
          id: `clear-${Date.now()}`,
          type: "system",
          text: "Terminal limpo.",
        },
      ],
    }));
  };

  // Navegar no histórico de comandos (↑ / ↓)
  const navigateHistory = (direction) => {
    const history = activeTab.cmdHistory;
    if (!history.length) return;
    let nextIdx = activeTab.historyIdx;
    if (direction === "up") {
      nextIdx = Math.min(activeTab.historyIdx + 1, history.length - 1);
    } else {
      nextIdx = Math.max(activeTab.historyIdx - 1, -1);
    }
    updateActiveTab((t) => ({
      ...t,
      historyIdx: nextIdx,
      command: nextIdx === -1 ? "" : history[nextIdx],
    }));
  };

  // Executar comando no PC
  const handleExecute = async () => {
    const cmd = activeTab.command.trim();
    if (!cmd || activeTab.loading) return;

    // Atualiza histórico de comandos digitados
    const updatedHistory = [
      cmd,
      ...activeTab.cmdHistory.filter((c) => c !== cmd),
    ].slice(0, 30);

    const cmdLine = {
      id: `cmd-${Date.now()}`,
      type: "command",
      text: cmd,
    };

    updateActiveTab((t) => ({
      ...t,
      command: "",
      loading: true,
      cmdHistory: updatedHistory,
      historyIdx: -1,
      lines: [...t.lines, cmdLine],
    }));

    try {
      const response = await sheets.executeCommand(cmd, 30000);
      const data = response?.data || {};

      const stdout = stripAnsi(data.stdout || "").trimEnd();
      const stderr = stripAnsi(data.stderr || "").trimEnd();
      const newItems = [];

      if (stdout) {
        newItems.push({
          id: `out-${Date.now()}`,
          type: "stdout",
          text: stdout,
        });
      }

      if (stderr) {
        newItems.push({
          id: `err-${Date.now()}`,
          type: "stderr",
          text: stderr,
        });
      }

      if (!stdout && !stderr) {
        newItems.push({
          id: `done-${Date.now()}`,
          type: "system",
          text: `[Comando finalizado com sucesso — código ${data.exit_code ?? 0}]`,
        });
      }

      setConnected(true);
      updateActiveTab((t) => ({
        ...t,
        loading: false,
        lines: [...t.lines, ...newItems],
      }));
    } catch (err) {
      let errMsg = "Erro de conexão com o terminal do PC.";
      if (err?.response?.status === 401) {
        errMsg = "Não autorizado (401). Faça login no aplicativo.";
      } else if (err?.response?.data?.error?.message) {
        errMsg = err.response.data.error.message;
      } else if (err?.message) {
        errMsg = err.message;
      }

      setConnected(false);
      updateActiveTab((t) => ({
        ...t,
        loading: false,
        lines: [
          ...t.lines,
          {
            id: `err-${Date.now()}`,
            type: "stderr",
            text: errMsg,
          },
        ],
      }));
    }
  };

  return {
    // abas
    abas: tabs,
    abaAtiva: activeTab,
    abaAtivaId: activeTabId,
    selecionarAba: setActiveTabId,
    novaAba: handleAddTab,
    fecharAba: handleRemoveTab,
    // comandos
    setComando: (text) => updateActiveTab((t) => ({ ...t, command: text })),
    executar: handleExecute,
    limpar: handleClear,
    navegarHistorico: navigateHistory,
    // conexão
    conectado: connected,
    ipAtual: currentIp,
    verificarConexao: checkConnection,
  };
}
