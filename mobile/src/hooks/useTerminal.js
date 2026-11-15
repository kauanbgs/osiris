// useTerminal.js — lógica da tela de Terminal: abas de sessão, execução de comandos no PC pelo app desktop,
// pasta atual de cada aba, histórico de comandos (↑ / ↓) e verificação da conexão e da conta.
import { useCallback, useEffect, useRef, useState } from "react";

import { executeDesktopCommand, verificarAcessoDesktop } from "../services/desktopModels";
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
  // true = pode usar o PC | false = PC fora do alcance | "sem-acesso" = conta diferente ou sem login | null = testando
  const [connected, setConnected] = useState(null);
  // true quando o PC está fora da rede local e os comandos vão pela API até o desktop
  const [viaApi, setViaApi] = useState(false);
  // Número da próxima aba: só cresce, para não repetir nomes depois de fechar abas.
  const proximoNumeroAba = useRef(2);

  // Abas do terminal (múltiplas sessões simultâneas)
  const [tabs, setTabs] = useState([
    {
      id: "term-1",
      label: "Terminal 1",
      lines: [
        {
          id: "init-1",
          type: "system",
          text: `Osíris Terminal — PC ${getIP()}`,
        },
        {
          id: "init-2",
          type: "system",
          text: "Os comandos rodam no seu PC. Comandos destrutivos são bloqueados.",
        },
      ],
      command: "",
      loading: false,
      cmdHistory: [],
      historyIdx: -1,
      pasta: null,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("term-1");


  // Aba atualmente selecionada
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Carrega o IP e testa se o app desktop está aberto e logado com a mesma conta
  const checkConnection = useCallback(async () => {
    setConnected(null);
    try {
      const ip = await loadIP();
      if (ip) setCurrentIp(ip);
      const acesso = await verificarAcessoDesktop();
      setViaApi(Boolean(acesso?.viaApi));
      setConnected(true);
    } catch (error) {
      setConnected(error?.status === 401 || error?.status === 403 ? "sem-acesso" : false);
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
    const newIdx = proximoNumeroAba.current++;
    const newId = `term-${Date.now()}`;
    const newTab = {
      id: newId,
      label: `Terminal ${newIdx}`,
      lines: [
        {
          id: `init-${Date.now()}-1`,
          type: "system",
          text: `Osíris Terminal [Sessão ${newIdx}] — PC ${currentIp}`,
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
      pasta: activeTab.pasta,
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
      const data = (await executeDesktopCommand(cmd, 30000, activeTab.pasta)) || {};

      const stdout = stripAnsi(data.stdout || "").trimEnd();
      const stderr = stripAnsi(data.stderr || "").trimEnd();
      const codigo = data.exit_code ?? 0;
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
          text: codigo === 0
            ? "[Comando finalizado com sucesso]"
            : `[Comando terminou com erro — código ${codigo}]`,
        });
      } else if (codigo !== 0) {
        newItems.push({
          id: `code-${Date.now()}`,
          type: "system",
          text: `[Código de saída ${codigo}]`,
        });
      }

      // O PC devolve a pasta onde o comando rodou (ou a nova pasta, depois de um "cd").
      const novaPasta = typeof data.pasta === "string" ? data.pasta : null;
      if (novaPasta && novaPasta !== activeTab.pasta && /^(cd|chdir)\b/i.test(cmd)) {
        newItems.push({
          id: `dir-${Date.now()}`,
          type: "system",
          text: `Pasta atual: ${novaPasta}`,
        });
      }

      setConnected(true);
      updateActiveTab((t) => ({
        ...t,
        loading: false,
        pasta: novaPasta || t.pasta,
        lines: [...t.lines, ...newItems],
      }));
    } catch (err) {
      const errMsg = err?.message || "Erro de conexão com o terminal do PC.";

      // Erro com status HTTP: o PC respondeu (comando bloqueado, conta diferente...). Sem status: PC fora do alcance.
      if (err?.status === 401 || err?.status === 403) setConnected("sem-acesso");
      else if (!err?.status) setConnected(false);

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
    viaApi,
    verificarConexao: checkConnection,
  };
}
