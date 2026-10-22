import { useState, useEffect } from "react";
import {
  Compass,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  House,
  Lock,
  Globe,
  Plus,
  X,
  Search,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Bot,
  Layers,
  MousePointerClick,
  CheckCircle2,
  Copy,
} from "lucide-react";
import sheets from "@/services/api";

const QUICK_BOOKMARKS = [
  { name: "Hugging Face", url: "https://huggingface.co", desc: "Modelos e datasets de IA" },
  { name: "GitHub", url: "https://github.com", desc: "Repositórios e código-fonte" },
  { name: "Google", url: "https://google.com", desc: "Mecanismo de busca" },
  { name: "MDN Docs", url: "https://developer.mozilla.org", desc: "Documentação Web" },
  { name: "ArXiv", url: "https://arxiv.org", desc: "Artigos e pesquisas de IA" },
  { name: "Wikipedia", url: "https://pt.wikipedia.org", desc: "Enciclopédia livre" },
];

function sanitizeUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export default function NavegadorPage() {
  const [tabs, setTabs] = useState([
    {
      id: "tab-1",
      id_session: null,
      title: "Nova Guia",
      url: "",
      inputUrl: "",
      history: [""],
      historyIndex: 0,
      isLoading: false,
      dom_tree: null,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorSearch, setInspectorSearch] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const updateActiveTab = (updater) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return typeof updater === "function" ? updater(tab) : { ...tab, ...updater };
      })
    );
  };

  // Inicializa a sessão da API para a primeira aba caso ainda não exista
  useEffect(() => {
    if (activeTab && !activeTab.id_session) {
      sheets
        .createBrowserSession("about:blank")
        .then((res) => {
          if (res?.data?.session?.id_session) {
            updateActiveTab({
              id_session: res.data.session.id_session,
              dom_tree: res.data.session.dom_tree,
            });
          }
        })
        .catch(() => {
          // Fallback silencioso caso a API esteja em inicialização
        });
    }
  }, [activeTabId]);

  const addTab = async () => {
    if (tabs.length >= 10) return;
    const newId = `tab-${Date.now()}`;
    let sessionId = null;
    let initialDom = null;

    try {
      const res = await sheets.createBrowserSession("about:blank");
      sessionId = res?.data?.session?.id_session || null;
      initialDom = res?.data?.session?.dom_tree || null;
    } catch {
      // Cria aba mesmo se a API estiver indisponível
    }

    const newTab = {
      id: newId,
      id_session: sessionId,
      title: "Nova Guia",
      url: "",
      inputUrl: "",
      history: [""],
      historyIndex: 0,
      isLoading: false,
      dom_tree: initialDom,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (tabIdToClose, e) => {
    e.stopPropagation();

    const targetTab = tabs.find((t) => t.id === tabIdToClose);
    if (targetTab?.id_session) {
      sheets.closeBrowserSession(targetTab.id_session).catch(() => {});
    }

    if (tabs.length <= 1) {
      updateActiveTab({
        title: "Nova Guia",
        url: "",
        inputUrl: "",
        history: [""],
        historyIndex: 0,
        isLoading: false,
        dom_tree: null,
      });
      return;
    }

    const nextTabs = tabs.filter((t) => t.id !== tabIdToClose);
    setTabs(nextTabs);

    if (activeTabId === tabIdToClose) {
      const closedIndex = tabs.findIndex((t) => t.id === tabIdToClose);
      const fallbackTab = nextTabs[Math.max(0, closedIndex - 1)];
      setActiveTabId(fallbackTab.id);
    }
  };

  const navigateTo = async (targetUrl) => {
    const formatted = sanitizeUrl(targetUrl);
    if (!formatted) return;

    let displayTitle = formatted;
    try {
      const parsed = new URL(formatted);
      displayTitle = parsed.hostname.replace("www.", "");
    } catch {
      displayTitle = formatted.slice(0, 20);
    }

    updateActiveTab((curr) => {
      const newHistory = curr.history.slice(0, curr.historyIndex + 1);
      newHistory.push(formatted);
      return {
        ...curr,
        url: formatted,
        inputUrl: formatted,
        title: displayTitle,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isLoading: true,
      };
    });

    // Chamada à API Osíris para navegação e extração de árvore de nós DOM
    try {
      let currentSessionId = activeTab.id_session;
      if (!currentSessionId) {
        const sessionRes = await sheets.createBrowserSession(formatted);
        currentSessionId = sessionRes?.data?.session?.id_session;
      }

      if (currentSessionId) {
        const navRes = await sheets.navigateBrowser(currentSessionId, formatted);
        updateActiveTab({
          id_session: currentSessionId,
          dom_tree: navRes?.data?.dom_tree || null,
          isLoading: false,
        });
        return;
      }
    } catch {
      // Fallback gracioso
    }

    setTimeout(() => {
      updateActiveTab({ isLoading: false });
    }, 600);
  };

  const handleSimulatedClick = async (element) => {
    if (!activeTab.id_session || !element) return;
    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await sheets.clickBrowserElement(activeTab.id_session, {
        selector: element.selector,
        x: element.x,
        y: element.y,
      });

      const data = res?.data;
      setActionFeedback({
        type: "success",
        message: `Clique executado em "${element.selector}" com sucesso!`,
        data,
      });

      if (data?.navigation_triggered && data?.current_url) {
        navigateTo(data.current_url);
      }
    } catch (err) {
      setActionFeedback({
        type: "error",
        message: err.response?.data?.error?.message || "Falha ao enviar clique para a API.",
      });
    } finally {
      setActionLoading(false);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleGoBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const prevIdx = activeTab.historyIndex - 1;
    const targetUrl = activeTab.history[prevIdx];
    let displayTitle = "Nova Guia";
    if (targetUrl) {
      try {
        displayTitle = new URL(targetUrl).hostname.replace("www.", "");
      } catch {
        displayTitle = targetUrl;
      }
    }
    updateActiveTab({
      historyIndex: prevIdx,
      url: targetUrl,
      inputUrl: targetUrl,
      title: displayTitle,
      isLoading: Boolean(targetUrl),
    });
    if (targetUrl) {
      setTimeout(() => updateActiveTab({ isLoading: false }), 400);
    }
  };

  const handleGoForward = () => {
    if (activeTab.historyIndex >= activeTab.history.length - 1) return;
    const nextIdx = activeTab.historyIndex + 1;
    const targetUrl = activeTab.history[nextIdx];
    let displayTitle = "Nova Guia";
    if (targetUrl) {
      try {
        displayTitle = new URL(targetUrl).hostname.replace("www.", "");
      } catch {
        displayTitle = targetUrl;
      }
    }
    updateActiveTab({
      historyIndex: nextIdx,
      url: targetUrl,
      inputUrl: targetUrl,
      title: displayTitle,
      isLoading: Boolean(targetUrl),
    });
    if (targetUrl) {
      setTimeout(() => updateActiveTab({ isLoading: false }), 400);
    }
  };

  const handleReload = () => {
    if (!activeTab.url) return;
    updateActiveTab({ isLoading: true });
    if (activeTab.id_session) {
      sheets
        .navigateBrowser(activeTab.id_session, activeTab.url)
        .then((res) => {
          updateActiveTab({
            dom_tree: res?.data?.dom_tree || activeTab.dom_tree,
            isLoading: false,
          });
        })
        .catch(() => updateActiveTab({ isLoading: false }));
    } else {
      setTimeout(() => updateActiveTab({ isLoading: false }), 500);
    }
  };

  const handleHome = () => {
    updateActiveTab((curr) => ({
      ...curr,
      url: "",
      inputUrl: "",
      title: "Nova Guia",
      history: [...curr.history.slice(0, curr.historyIndex + 1), ""],
      historyIndex: curr.historyIndex + 1,
      isLoading: false,
    }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    navigateTo(activeTab.inputUrl);
  };

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;
  const isSecure = activeTab.url.startsWith("https://");

  const domElements = activeTab.dom_tree?.elements || [];
  const filteredElements = domElements.filter((el) => {
    if (!inspectorSearch) return true;
    const q = inspectorSearch.toLowerCase();
    return (
      el.selector?.toLowerCase().includes(q) ||
      el.text?.toLowerCase().includes(q) ||
      el.type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0c0e]">
      {/* 1. Barra de Abas (Tabs Bar) */}
      <div className="flex h-9 shrink-0 items-end gap-1 border-b border-zinc-800/80 bg-[#121214] px-2 pt-1">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex h-8 max-w-[200px] min-w-[120px] cursor-pointer items-center justify-between gap-2 rounded-t-md px-3 text-xs transition-colors ${
                  isActive
                    ? "bg-[#18181b] text-zinc-100 font-medium border-t-2 border-violet-500 shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5 truncate">
                  {tab.isLoading ? (
                    <div className="h-3 w-3 animate-spin rounded-full border border-violet-400 border-t-transparent" />
                  ) : tab.url ? (
                    <Globe size={13} className={isActive ? "text-violet-400" : "text-zinc-500"} />
                  ) : (
                    <Compass size={13} className={isActive ? "text-violet-400" : "text-zinc-500"} />
                  )}
                  <span className="truncate">{tab.title || "Nova Guia"}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => closeTab(tab.id, e)}
                  className="rounded p-0.5 text-zinc-500 opacity-60 transition hover:bg-zinc-700/60 hover:text-zinc-200 group-hover:opacity-100"
                  title="Fechar guia"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addTab}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
            title="Nova guia"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Indicador de Status da API */}
        <div className="hidden pb-1 sm:flex items-center gap-2 text-[11px] font-mono text-zinc-400">
          {activeTab.id_session ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              API Conectada
            </span>
          ) : (
            <span className="flex items-center gap-1 text-zinc-500">
              <span className="h-2 w-2 rounded-full bg-zinc-600" />
              Sessão Local
            </span>
          )}
        </div>
      </div>

      {/* 2. Barra de Navegação (Navigation Bar) */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-800/60 bg-[#161619] px-3">
        {/* Controles de Histórico e Ações */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleGoBack}
            disabled={!canGoBack}
            className={`rounded-md p-1.5 transition ${
              canGoBack
                ? "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                : "text-zinc-600 cursor-not-allowed"
            }`}
            title="Voltar"
          >
            <ArrowLeft size={16} />
          </button>

          <button
            type="button"
            onClick={handleGoForward}
            disabled={!canGoForward}
            className={`rounded-md p-1.5 transition ${
              canGoForward
                ? "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
                : "text-zinc-600 cursor-not-allowed"
            }`}
            title="Avançar"
          >
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            onClick={handleReload}
            className={`rounded-md p-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 ${
              activeTab.isLoading ? "animate-spin text-violet-400" : ""
            }`}
            title="Recarregar"
          >
            <RotateCw size={15} />
          </button>

          <button
            type="button"
            onClick={handleHome}
            className="rounded-md p-1.5 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            title="Página Inicial"
          >
            <House size={16} />
          </button>
        </div>

        {/* Input de URL / Busca */}
        <form onSubmit={handleFormSubmit} className="flex flex-1 items-center">
          <div className="relative flex flex-1 items-center">
            <div className="absolute left-3 flex items-center pointer-events-none text-zinc-500">
              {activeTab.url ? (
                isSecure ? (
                  <Lock size={13} className="text-emerald-400" />
                ) : (
                  <Globe size={13} className="text-zinc-400" />
                )
              ) : (
                <Search size={14} className="text-zinc-500" />
              )}
            </div>

            <input
              type="text"
              value={activeTab.inputUrl}
              onChange={(e) => updateActiveTab({ inputUrl: e.target.value })}
              placeholder="Digite uma URL ou termo de pesquisa..."
              className="h-8 w-full rounded-md border border-zinc-700/60 bg-[#0e0e11] pl-8 pr-20 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/80 focus:bg-[#0a0a0d] focus:outline-none transition-colors"
            />

            <div className="absolute right-1.5 flex items-center gap-1">
              {activeTab.inputUrl && (
                <button
                  type="button"
                  onClick={() => updateActiveTab({ inputUrl: "" })}
                  className="rounded p-1 text-zinc-500 hover:text-zinc-300 transition"
                  title="Limpar"
                >
                  <X size={12} />
                </button>
              )}
              <button
                type="submit"
                className="rounded bg-violet-600 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-violet-500"
              >
                Ir
              </button>
            </div>
          </div>
        </form>

        {/* Botão de Toggle do Painel de Inspeção do DOM */}
        <button
          type="button"
          onClick={() => setIsInspectorOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
            isInspectorOpen
              ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
              : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
          title="Inspecionar elementos detectados na página"
        >
          <Layers size={13} className={isInspectorOpen ? "text-violet-400" : ""} />
          <span>Inspecionar DOM</span>
          {domElements.length > 0 && (
            <span className="ml-1 rounded-full bg-violet-500/20 px-1.5 py-0.2 text-[10px] font-mono font-semibold text-violet-300">
              {domElements.length}
            </span>
          )}
        </button>

        {/* Ação Externa */}
        {activeTab.url && (
          <button
            type="button"
            onClick={() => window.open(activeTab.url, "_blank")}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            title="Abrir no navegador do sistema"
          >
            <ExternalLink size={13} />
            <span className="hidden md:inline">Externo</span>
          </button>
        )}
      </div>

      {/* Barra de Progresso Animada */}
      {activeTab.isLoading && (
        <div className="h-0.5 w-full bg-zinc-800 overflow-hidden">
          <div className="h-full bg-violet-500 animate-pulse w-3/4 transition-all duration-300" />
        </div>
      )}

      {/* Toast Feedback de Ação de Agente */}
      {actionFeedback && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
            actionFeedback.type === "success"
              ? "bg-emerald-950/60 border-emerald-800/40 text-emerald-300"
              : "bg-red-950/60 border-red-800/40 text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="opacity-70 hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* 3. Área Principal: Viewport + Painel de Inspeção */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Viewport Central */}
        <div className="relative flex-1 overflow-hidden bg-[#0a0a0c]">
          {!activeTab.url ? (
            /* Start Page do Osiris */
            <div className="flex h-full w-full flex-col items-center justify-center p-6 overflow-y-auto">
              <div className="w-full max-w-2xl text-center space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 shadow-lg shadow-violet-500/5">
                    <Compass size={34} className="text-violet-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                      Navegador Osiris
                    </h2>
                    <p className="mt-1 text-xs text-zinc-400">
                      Motor visual integrado para navegação autônoma de agentes e inspeção web
                    </p>
                  </div>
                </div>

                {/* Caixa de busca central */}
                <form onSubmit={handleFormSubmit} className="relative mx-auto max-w-lg">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={activeTab.inputUrl}
                    onChange={(e) => updateActiveTab({ inputUrl: e.target.value })}
                    placeholder="Pesquisar ou inserir endereço da web..."
                    className="h-11 w-full rounded-xl border border-zinc-800 bg-[#121215] pl-10 pr-12 text-sm text-zinc-200 placeholder:text-zinc-500 shadow-md focus:border-violet-500/60 focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
                  >
                    Navegar
                  </button>
                </form>

                {/* Atalhos Rápidos */}
                <div className="pt-4">
                  <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium text-zinc-400">
                    <Sparkles size={13} className="text-violet-400" />
                    <span>Acesso Rápido</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {QUICK_BOOKMARKS.map((bm) => (
                      <button
                        key={bm.name}
                        type="button"
                        onClick={() => navigateTo(bm.url)}
                        className="group flex flex-col items-start rounded-lg border border-zinc-800/80 bg-[#121215]/80 p-3 text-left transition hover:border-zinc-700 hover:bg-[#16161a]"
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-medium text-zinc-200 group-hover:text-violet-300">
                            {bm.name}
                          </span>
                          <Globe size={13} className="text-zinc-500 group-hover:text-zinc-300" />
                        </div>
                        <span className="mt-1 text-[11px] text-zinc-500 line-clamp-1">
                          {bm.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destaque de Recursos */}
                <div className="pt-6 border-t border-zinc-900 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 p-3">
                    <div className="flex items-center gap-2 text-violet-400 text-xs font-medium mb-1">
                      <Bot size={14} />
                      <span>Automação por IA</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Sessões ativas na API prontas para execução de cliques por agentes.
                    </p>
                  </div>

                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 p-3">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium mb-1">
                      <ShieldCheck size={14} />
                      <span>Sandbox Isolado</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Ambiente seguro para visualização de conteúdo externo.
                    </p>
                  </div>

                  <div className="rounded-lg border border-zinc-800/40 bg-zinc-900/30 p-3">
                    <div className="flex items-center gap-2 text-sky-400 text-xs font-medium mb-1">
                      <Layers size={14} />
                      <span>Árvore de Nós DOM</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Extração estruturada de elementos interativos e seletores CSS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Visualizador de Página Ativa */
            <div className="flex h-full w-full flex-col">
              <div className="flex items-center justify-between border-b border-zinc-800/60 bg-[#121215] px-4 py-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                    <ShieldCheck size={13} />
                    Sessão API:
                  </span>
                  <span className="font-mono text-zinc-400 text-[11px] truncate max-w-[200px]">
                    {activeTab.id_session || "Local"}
                  </span>
                  <span className="text-zinc-600">|</span>
                  <span className="font-mono text-zinc-300 truncate max-w-sm">
                    {activeTab.url}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsInspectorOpen(true)}
                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-0.5 text-[11px] text-violet-300 hover:bg-zinc-700"
                  >
                    <Layers size={11} />
                    Ver {domElements.length} nós DOM
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(activeTab.url, "_blank")}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-700"
                  >
                    <ExternalLink size={12} />
                    Abrir externamente
                  </button>
                </div>
              </div>

              <div className="relative flex-1 w-full bg-white">
                <iframe
                  title={activeTab.title}
                  src={activeTab.url}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  className="h-full w-full border-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Painel Lateral de Inspeção do DOM (Inspector Panel) */}
        {isInspectorOpen && (
          <aside className="w-80 md:w-96 border-l border-zinc-800/80 bg-[#111114] flex flex-col shrink-0">
            {/* Header do Inspector */}
            <div className="flex h-11 items-center justify-between border-b border-zinc-800/60 px-3">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-violet-400" />
                <h3 className="text-xs font-semibold text-zinc-100">
                  Inspeção DOM & Agente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInspectorOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Metadados da Sessão */}
            <div className="p-3 border-b border-zinc-800/40 bg-zinc-950/40 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-500">ID da Sessão:</span>
                <span className="text-zinc-300 truncate max-w-[160px]">
                  {activeTab.id_session || "Nenhuma sessão ativa"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-zinc-500">Nós Extraídos:</span>
                <span className="text-emerald-400 font-semibold">{domElements.length} elementos</span>
              </div>

              {/* Filtro de Busca */}
              <div className="relative pt-1">
                <Search size={13} className="absolute left-2.5 top-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={inspectorSearch}
                  onChange={(e) => setInspectorSearch(e.target.value)}
                  placeholder="Filtrar por seletor, tag ou texto..."
                  className="h-7 w-full rounded border border-zinc-800 bg-[#16161a] pl-7 pr-2 text-[11px] font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none"
                />
              </div>
            </div>

            {/* Lista de Elementos Detectados */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredElements.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  <Bot size={24} className="mx-auto mb-2 opacity-40" />
                  <p>Nenhum elemento interativo encontrado</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Navegue para uma URL para extrair a árvore DOM
                  </p>
                </div>
              ) : (
                filteredElements.map((el, idx) => (
                  <div
                    key={el.id || idx}
                    className="group rounded-md border border-zinc-800/80 bg-[#151518] p-2.5 transition hover:border-zinc-700 hover:bg-[#18181d]"
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-mono font-medium uppercase ${
                            el.tag === "button"
                              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              : el.tag === "input"
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : el.tag === "a"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {el.tag || el.type || "tag"}
                        </span>
                        {el.clickable && (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            clicável
                          </span>
                        )}
                      </div>

                      {/* Botão de Simulação de Clique */}
                      {el.clickable && (
                        <button
                          type="button"
                          onClick={() => handleSimulatedClick(el)}
                          disabled={actionLoading}
                          className="flex items-center gap-1 rounded bg-violet-600/90 px-2 py-0.5 text-[10px] font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
                          title="Enviar comando de clique para a API Osíris"
                        >
                          <MousePointerClick size={11} />
                          <span>Clicar</span>
                        </button>
                      )}
                    </div>

                    {/* Seletor CSS */}
                    <div className="flex items-center justify-between rounded bg-[#0e0e11] px-2 py-1 font-mono text-[11px] text-zinc-300">
                      <span className="truncate">{el.selector}</span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(el.selector)}
                        className="text-zinc-500 hover:text-zinc-200 ml-1 transition"
                        title="Copiar seletor"
                      >
                        <Copy size={11} />
                      </button>
                    </div>

                    {/* Texto do Elemento */}
                    {el.text && (
                      <p className="mt-1.5 text-[11px] text-zinc-400 line-clamp-2">
                        "{el.text}"
                      </p>
                    )}

                    {/* Link de Destino */}
                    {el.href && (
                      <p className="mt-1 text-[10px] font-mono text-zinc-500 truncate">
                        Destino: {el.href}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Rodapé Informativo */}
            <div className="border-t border-zinc-800/60 p-2.5 bg-zinc-950/60 text-[10px] text-zinc-500 flex items-center justify-between">
              <span>Sessão: {activeTab.title}</span>
              <span className="font-mono">API: v1.0</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
