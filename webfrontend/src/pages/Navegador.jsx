import { useState, useEffect, useRef } from "react";
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
  Laptop,
  AlertTriangle,
  Camera,
  Download,
  FileJson,
  Image,
  Loader2,
  AlertCircle,
  Check,
  Table as TableIcon,
  AlignLeft,
  Heading,
  Info,
  Maximize2,
} from "lucide-react";
import sheets from "@/services/api";
import { isElectron } from "@/utils/isElectron";

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

export default function Navegador() {
  const isElectronApp = isElectron();
  // Mapa de refs por aba: cada aba tem sua própria ref de webview
  const webviewRefs = useRef({});

  // Ref que sempre aponta para o webview da aba ativa
  const getActiveWebview = () => webviewRefs.current[activeTabId] ?? null;

  // =========================================================
  // ESTADOS DO NAVEGADOR (Abas, Histórico, DOM)
  // =========================================================
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
      loadError: null,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("tab-1");
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorSearch, setInspectorSearch] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // =========================================================
  // ESTADOS DA CAPTURA & EXTRAÇÃO DE DADOS (Playwright)
  // =========================================================
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureUrl, setCaptureUrl] = useState("https://example.com");
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [captureSuccess, setCaptureSuccess] = useState(null);
  const [captureResult, setCaptureResult] = useState(null);
  const [captureSubTab, setCaptureSubTab] = useState("overview");
  const [copiedLink, setCopiedLink] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  // Aba ativa do navegador
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Atualiza uma aba específica pelo id (evita closure stale com activeTabId)
  const updateTab = (tabId, updater) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== tabId) return tab;
        return typeof updater === "function" ? updater(tab) : { ...tab, ...updater };
      })
    );
  };

  // Atalho para atualizar a aba correntemente ativa
  const updateActiveTab = (updater) => updateTab(activeTabId, updater);

  // Inicializa sessão da API para a aba ativa caso ainda não exista
  useEffect(() => {
    if (activeTab && !activeTab.id_session) {
      const tabId = activeTabId;
      sheets
        .createBrowserSession("about:blank")
        .then((res) => {
          if (res?.data?.session?.id_session) {
            updateTab(tabId, {
              id_session: res.data.session.id_session,
              dom_tree: res.data.session.dom_tree,
            });
          }
        })
        .catch(() => {
          // Fallback silencioso — API pode não estar disponível
        });
    }
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Registra eventos de cada webview quando ele é montado no DOM (via ref callback).
  // A função é chamada com o elemento ao montar e com null ao desmontar.
  // Usamos um Set por aba para não registrar handlers duplicados.
  const registeredWebviewHandlers = useRef({});

  const registerWebviewEvents = (tabId, webview) => {
    // Evita registro duplicado (React pode chamar o ref duas vezes em dev mode)
    if (registeredWebviewHandlers.current[tabId]) return;

    const handleStartLoading = () => {
      updateTab(tabId, { isLoading: true, loadError: null });
    };

    const handleStopLoading = () => {
      updateTab(tabId, { isLoading: false });
    };

    const handleNavigate = (e) => {
      if (!e.url || e.url === "about:blank") return;
      let displayTitle = e.url;
      try {
        displayTitle = new URL(e.url).hostname.replace("www.", "");
      } catch {
        displayTitle = e.url.slice(0, 20);
      }
      updateTab(tabId, (curr) => {
        if (curr.url === e.url) return curr;
        const newHistory = [...curr.history.slice(0, curr.historyIndex + 1), e.url];
        return {
          ...curr,
          url: e.url,
          inputUrl: e.url,
          title: displayTitle,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          isLoading: false,
          loadError: null,
        };
      });
    };

    const handleTitleUpdated = (e) => {
      if (e.title) {
        updateTab(tabId, { title: e.title });
      }
    };

    const handleFailLoad = (e) => {
      // Erros -3 (ERR_ABORTED) são cancelamentos normais (ex: redirecionamentos)
      if (e.errorCode === -3) return;
      updateTab(tabId, {
        isLoading: false,
        loadError: e.errorDescription || "Falha ao carregar a página.",
      });
    };

    webview.addEventListener("did-start-loading", handleStartLoading);
    webview.addEventListener("did-stop-loading", handleStopLoading);
    webview.addEventListener("did-navigate", handleNavigate);
    webview.addEventListener("did-navigate-in-page", handleNavigate);
    webview.addEventListener("page-title-updated", handleTitleUpdated);
    webview.addEventListener("did-fail-load", handleFailLoad);

    // Armazena os handlers para remoção posterior
    registeredWebviewHandlers.current[tabId] = {
      handleStartLoading,
      handleStopLoading,
      handleNavigate,
      handleTitleUpdated,
      handleFailLoad,
    };
  };

  const unregisterWebviewEvents = (tabId, webview) => {
    const handlers = registeredWebviewHandlers.current[tabId];
    if (!handlers) return;
    webview.removeEventListener("did-start-loading", handlers.handleStartLoading);
    webview.removeEventListener("did-stop-loading", handlers.handleStopLoading);
    webview.removeEventListener("did-navigate", handlers.handleNavigate);
    webview.removeEventListener("did-navigate-in-page", handlers.handleNavigate);
    webview.removeEventListener("page-title-updated", handlers.handleTitleUpdated);
    webview.removeEventListener("did-fail-load", handlers.handleFailLoad);
    delete registeredWebviewHandlers.current[tabId];
  };

  // Gerenciamento de Abas
  const addTab = () => {
    if (tabs.length >= 10) return;
    const newId = `tab-${Date.now()}`;

    const newTab = {
      id: newId,
      id_session: null,
      title: "Nova Guia",
      url: "",
      inputUrl: "",
      history: [""],
      historyIndex: 0,
      isLoading: false,
      dom_tree: null,
      loadError: null,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);

    // Inicializa sessão na API silenciosamente em segundo plano, sem bloquear a UI
    sheets
      .createBrowserSession("about:blank")
      .then((res) => {
        if (res?.data?.session?.id_session) {
          updateTab(newId, {
            id_session: res.data.session.id_session,
            dom_tree: res.data.session.dom_tree || null,
          });
        }
      })
      .catch(() => {});
  };

  const closeTab = (tabIdToClose, e) => {
    e.stopPropagation();

    const targetTab = tabs.find((t) => t.id === tabIdToClose);
    if (targetTab?.id_session) {
      sheets.closeBrowserSession(targetTab.id_session).catch(() => {});
    }

    const existingWebview = webviewRefs.current[tabIdToClose];
    if (existingWebview) {
      unregisterWebviewEvents(tabIdToClose, existingWebview);
      delete webviewRefs.current[tabIdToClose];
    }
    delete registeredWebviewHandlers.current[tabIdToClose];

    if (tabs.length <= 1) {
      updateActiveTab({
        title: "Nova Guia",
        url: "",
        inputUrl: "",
        history: [""],
        historyIndex: 0,
        isLoading: false,
        dom_tree: null,
        loadError: null,
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

    // Captura o tabId no momento da chamada para evitar closure stale
    const tabId = activeTabId;

    let displayTitle = formatted;
    try {
      const parsed = new URL(formatted);
      displayTitle = parsed.hostname.replace("www.", "");
    } catch {
      displayTitle = formatted.slice(0, 20);
    }

    updateTab(tabId, (curr) => {
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
        loadError: null,
      };
    });

    // No Electron, navega via loadURL() no webview da aba correta.
    // O webview é identificado por key={tab.id} e já está no DOM (pode estar oculto).
    if (isElectronApp) {
      const webview = webviewRefs.current[tabId];
      if (webview) {
        const doLoad = () => {
          try {
            webview.loadURL(formatted);
          } catch (err) {
            console.warn("[Navegador] loadURL falhou:", err?.message);
          }
        };

        // Se o webview ainda não está pronto, aguarda dom-ready uma vez
        if (!webview.getURL) {
          // getURL está disponível apenas após dom-ready; espera o evento
          webview.addEventListener("dom-ready", doLoad, { once: true });
        } else {
          doLoad();
        }
        // No Electron a navegação real é gerenciada pelo Chromium/webview;
        // não precisamos chamar a API para a navegação visual.
        return;
      }
    }

    // Fallback para modo Web: usa a API Playwright
    try {
      const currentTab = tabs.find((t) => t.id === tabId);
      let currentSessionId = currentTab?.id_session;
      if (!currentSessionId) {
        const sessionRes = await sheets.createBrowserSession(formatted);
        currentSessionId = sessionRes?.data?.session?.id_session;
      }

      if (currentSessionId) {
        const navRes = await sheets.navigateBrowser(currentSessionId, formatted);
        updateTab(tabId, {
          id_session: currentSessionId,
          dom_tree: navRes?.data?.dom_tree || null,
          isLoading: false,
        });
        return;
      }
    } catch {
      // Fallback
    }

    setTimeout(() => {
      updateTab(tabId, { isLoading: false });
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
    const webview = getActiveWebview();
    if (isElectronApp && webview?.canGoBack?.()) {
      webview.goBack();
      return;
    }
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
      loadError: null,
    });
    if (targetUrl) {
      setTimeout(() => updateActiveTab({ isLoading: false }), 400);
    }
  };

  const handleGoForward = () => {
    const webview = getActiveWebview();
    if (isElectronApp && webview?.canGoForward?.()) {
      webview.goForward();
      return;
    }
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
      loadError: null,
    });
    if (targetUrl) {
      setTimeout(() => updateActiveTab({ isLoading: false }), 400);
    }
  };

  const handleReload = () => {
    const webview = getActiveWebview();
    if (isElectronApp && webview) {
      webview.reload();
      return;
    }
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

  // =========================================================
  // FUNÇÕES DE CAPTURA & EXTRAÇÃO (Playwright)
  // =========================================================
  async function handleCapturePage(e) {
    if (e) e.preventDefault();

    const targetUrl = captureUrl.trim();
    if (!targetUrl) {
      setCaptureError("Por favor, informe uma URL válida.");
      return;
    }

    if (!/^https?:\/\//i.test(targetUrl)) {
      setCaptureError("A URL deve iniciar com http:// ou https://");
      return;
    }

    setCaptureLoading(true);
    setCaptureError(null);
    setCaptureSuccess(null);

    try {
      const response = await sheets.browserCapture(targetUrl);
      const data = response.data;
      setCaptureResult(data);
      setCaptureSuccess(`Página capturada com sucesso! Status HTTP ${data.status_code}.`);
    } catch (err) {
      console.error("Erro na captura:", err);
      const message =
        err.response?.data?.error?.message ||
        err.message ||
        "Falha ao capturar a página. Verifique se a URL é pública e acessível.";
      setCaptureError(message);
    } finally {
      setCaptureLoading(false);
    }
  }

  function handleDownloadImage() {
    if (!captureResult?.screenshot?.base64) return;

    try {
      const byteCharacters = atob(captureResult.screenshot.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      const blobUrl = URL.createObjectURL(blob);

      const hostname = safeHostname(captureResult.url);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `screenshot_${hostname}_${timestamp}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Erro ao baixar screenshot:", e);
    }
  }

  function handleDownloadJson() {
    if (!captureResult) return;

    try {
      const exportData = {
        url: captureResult.url,
        status_code: captureResult.status_code,
        captured_at: captureResult.captured_at,
        data: captureResult.data,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const blobUrl = URL.createObjectURL(blob);

      const hostname = safeHostname(captureResult.url);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `extracao_${hostname}_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Erro ao baixar JSON:", e);
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedLink(id);
      setTimeout(() => setCopiedLink(null), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  }

  function safeHostname(rawUrl) {
    try {
      return new URL(rawUrl).hostname.replace(/[^a-zA-Z0-9_-]/g, "_");
    } catch {
      return "pagina";
    }
  }

  const canGoBack = isElectronApp
    ? (getActiveWebview()?.canGoBack?.() ?? activeTab.historyIndex > 0)
    : activeTab.historyIndex > 0;
  const canGoForward = isElectronApp
    ? (getActiveWebview()?.canGoForward?.() ?? activeTab.historyIndex < activeTab.history.length - 1)
    : activeTab.historyIndex < activeTab.history.length - 1;
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

  const headingsList = captureResult?.data?.headings || [];
  const linksList = captureResult?.data?.links || [];
  const tablesList = captureResult?.data?.tables || [];
  const extractedText = captureResult?.data?.text || "";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-surface-0 font-sans text-zinc-100">
      {/* 1. Barra de Abas (Tabs Bar) */}
      <div className="flex h-9 shrink-0 items-end gap-1 border-b border-zinc-800/80 bg-surface-0 px-2 pt-1 select-none">
        <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex h-8 max-w-[200px] min-w-[120px] cursor-pointer items-center justify-between gap-2 rounded-t-md px-3 text-xs transition-colors ${
                  isActive
                    ? "bg-surface-1 text-zinc-100 font-medium border-t-2 border-violet-500 shadow-sm"
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

        {/* Indicador de Status (Electron vs Web) */}
        <div className="hidden pb-1 sm:flex items-center gap-2 text-[11px] font-mono">
          {isElectronApp ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-400">
              <Laptop size={11} />
              Webview Nativo (Electron)
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-medium text-violet-300">
              <Globe size={11} />
              Modo Web (Iframe)
            </span>
          )}

          {activeTab.id_session && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              API
            </span>
          )}
        </div>
      </div>

      {/* 2. Barra de Navegação (Navigation Bar) */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-800/60 bg-surface-1 px-3">
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

        {/* Campo de URL / Busca */}
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
              className="h-8 w-full rounded-md border border-zinc-700/60 bg-surface-0 pl-8 pr-20 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/80 focus:bg-surface-0 focus:outline-none transition-colors"
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

        {/* BOTÃO CAPTURAR PÁGINA (PLAYWRIGHT) */}
        <button
          type="button"
          onClick={() => {
            setIsCaptureOpen((prev) => !prev);
            if (!isCaptureOpen && activeTab.url && activeTab.url.startsWith("http")) {
              setCaptureUrl(activeTab.url);
            }
          }}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
            isCaptureOpen
              ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
              : "border-zinc-800 bg-surface-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          }`}
          title="Capturar screenshot real e extrair dados da página"
        >
          <Camera size={13} className={isCaptureOpen ? "text-violet-400" : ""} />
          <span className="font-medium">Capturar Página</span>
          {captureResult && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Captura pronta" />
          )}
        </button>

        {/* BOTÃO INSPECIONAR DOM */}
        <button
          type="button"
          onClick={() => setIsInspectorOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition ${
            isInspectorOpen
              ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
              : "border-zinc-800 bg-surface-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
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
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-surface-1 px-2.5 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
            title="Abrir no navegador padrão do sistema"
          >
            <ExternalLink size={13} />
            <span className="hidden md:inline">Externo</span>
          </button>
        )}
      </div>

      {/* Barra de Progresso */}
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

      {/* 3. ÁREA DE NAVEGAÇÃO & PAINÉIS LATERAIS */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* VIEWPORT PRINCIPAL DO NAVEGADOR */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-0">
          {/* WEBVIEWS ELECTRON: somente abas com URL montam webview nativo */}
          {isElectronApp && (
            <div className="relative h-full w-full">
              {tabs
                .filter((tab) => Boolean(tab.url))
                .map((tab) => {
                  const isCurrentActive = tab.id === activeTabId;
                  return (
                    <webview
                      key={tab.id}
                      ref={(el) => {
                        if (el) {
                          webviewRefs.current[tab.id] = el;
                          registerWebviewEvents(tab.id, el);
                        } else {
                          const existing = webviewRefs.current[tab.id];
                          if (existing) unregisterWebviewEvents(tab.id, existing);
                          delete webviewRefs.current[tab.id];
                        }
                      }}
                      src={tab.url}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        visibility: isCurrentActive ? "visible" : "hidden",
                        pointerEvents: isCurrentActive ? "auto" : "none",
                        zIndex: isCurrentActive ? 1 : 0,
                      }}
                      className="bg-white"
                      allowpopups="true"
                    />
                  );
                })}

              {/* Tela inicial exibida quando a aba ativa não tem URL */}
              {!activeTab.url && (
                <div className="relative z-10 flex h-full w-full flex-col items-center overflow-y-auto px-6 py-8 text-center bg-surface-0">
                  <div className="mb-4 flex size-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800/80 bg-surface-1 shadow-inner">
                    <Compass className="size-7 text-violet-400" />
                  </div>
                  <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
                    Navegador Osíris
                  </h2>
                  <p className="mt-1 max-w-md text-xs text-zinc-400">
                    Explore a internet, inspecione elementos do DOM com agentes de IA e capture dados estruturados.
                  </p>

                  {/* Busca central da main */}
                  <form onSubmit={handleFormSubmit} className="relative mt-6 w-full max-w-lg">
                    <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={activeTab.inputUrl}
                      onChange={(e) => updateActiveTab({ inputUrl: e.target.value })}
                      placeholder="Pesquisar ou inserir endereço da web..."
                      aria-label="Pesquisar ou inserir endereço da web"
                      className="h-11 w-full rounded-xl border border-zinc-800 bg-surface-1 pl-10 pr-14 text-sm text-zinc-200 placeholder:text-zinc-500 shadow-md transition-all focus:border-violet-500/60 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
                    >
                      Ir
                    </button>
                  </form>

                  {/* Atalhos rápidos das duas versões */}
                  <div className="mt-7 w-full max-w-2xl">
                    <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium text-zinc-400">
                      <Sparkles size={13} className="text-violet-400" />
                      <span>Acesso rápido</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {QUICK_BOOKMARKS.map((bookmark) => (
                        <button
                          key={bookmark.name}
                          type="button"
                          onClick={() => navigateTo(bookmark.url)}
                          className="group flex flex-col items-start rounded-lg border border-zinc-800/80 bg-surface-1 p-3 text-left transition hover:border-violet-500/40 hover:bg-zinc-800/40"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="text-xs font-medium text-zinc-200 group-hover:text-violet-300">
                              {bookmark.name}
                            </span>
                            <ExternalLink size={12} className="text-zinc-500 group-hover:text-violet-400" />
                          </div>
                          <span className="mt-1 line-clamp-1 text-[11px] text-zinc-500">
                            {bookmark.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recursos apresentados na main */}
                  <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 border-t border-zinc-800/60 pt-5 text-left sm:grid-cols-3">
                    <div className="rounded-lg border border-zinc-800/60 bg-surface-1 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-violet-400">
                        <Bot size={14} />
                        <span>Automação por IA</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        Sessões da API disponíveis para interação com elementos da página.
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-surface-1 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-400">
                        <ShieldCheck size={14} />
                        <span>Webview no Electron</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        Navegação desktop pelo Chromium nativo, sem as limitações de iframe.
                      </p>
                    </div>
                    <div className="rounded-lg border border-zinc-800/60 bg-surface-1 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-sky-400">
                        <Layers size={14} />
                        <span>Inspeção DOM</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        Extração de seletores e elementos interativos da página.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sobreposição de erro de carregamento */}
              {activeTab.loadError && activeTab.url && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-surface-0 px-8 text-center">
                  <AlertTriangle size={36} className="text-amber-400" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">Não foi possível carregar a página</p>
                    <p className="mt-1 text-xs text-zinc-400">{activeTab.loadError}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500 truncate max-w-xs">{activeTab.url}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReload}
                      className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
                    >
                      <RotateCw size={13} />
                      Tentar novamente
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(activeTab.url, "_blank")}
                      className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-surface-1 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    >
                      <ExternalLink size={13} />
                      Abrir no navegador
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isElectronApp && (!activeTab.url ? (
            /* TELA INICIAL (modo web) */
            <div className="flex h-full w-full flex-col items-center overflow-y-auto px-6 py-8 text-center">
              <div className="mb-4 flex size-14 shrink-0 items-center justify-center rounded-2xl border border-zinc-800/80 bg-surface-1 shadow-inner">
                <Compass className="size-7 text-violet-400" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
                Navegador Osíris
              </h2>
              <p className="mt-1 max-w-md text-xs text-zinc-400">
                Explore a internet, inspecione elementos do DOM com agentes de IA e capture dados estruturados.
              </p>

              {/* Busca central da main */}
              <form onSubmit={handleFormSubmit} className="relative mt-6 w-full max-w-lg">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={activeTab.inputUrl}
                  onChange={(e) => updateActiveTab({ inputUrl: e.target.value })}
                  placeholder="Pesquisar ou inserir endereço da web..."
                  aria-label="Pesquisar ou inserir endereço da web"
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-surface-1 pl-10 pr-14 text-sm text-zinc-200 placeholder:text-zinc-500 shadow-md transition-all focus:border-violet-500/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
                >
                  Ir
                </button>
              </form>

              {/* Atalhos rápidos das duas versões */}
              <div className="mt-7 w-full max-w-2xl">
                <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium text-zinc-400">
                  <Sparkles size={13} className="text-violet-400" />
                  <span>Acesso rápido</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {QUICK_BOOKMARKS.map((bookmark) => (
                    <button
                      key={bookmark.name}
                      type="button"
                      onClick={() => navigateTo(bookmark.url)}
                      className="group flex flex-col items-start rounded-lg border border-zinc-800/80 bg-surface-1 p-3 text-left transition hover:border-violet-500/40 hover:bg-zinc-800/40"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-medium text-zinc-200 group-hover:text-violet-300">
                          {bookmark.name}
                        </span>
                        <ExternalLink size={12} className="text-zinc-500 group-hover:text-violet-400" />
                      </div>
                      <span className="mt-1 line-clamp-1 text-[11px] text-zinc-500">
                        {bookmark.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recursos apresentados na main */}
              <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-3 border-t border-zinc-800/60 pt-5 text-left sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-800/60 bg-surface-1 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium text-violet-400">
                    <Bot size={14} />
                    <span>Automação por IA</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Sessões da API disponíveis para interação com elementos da página.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800/60 bg-surface-1 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium text-emerald-400">
                    <ShieldCheck size={14} />
                    <span>Webview no Electron</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Navegação desktop pelo Chromium nativo, sem as limitações de iframe.
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800/60 bg-surface-1 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-medium text-sky-400">
                    <Layers size={14} />
                    <span>Inspeção DOM</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Extração de seletores e elementos interativos da página.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* MODO WEB: IFRAME COM FALLBACK */
            <div className="relative h-full w-full flex flex-col">
              <div className="flex shrink-0 items-center justify-between bg-surface-1 border-b border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                  <span className="truncate">
                    Alguns sites bloqueiam exibição em iframe (X-Frame-Options).
                  </span>
                  <span className="hidden font-mono text-zinc-500 md:inline">
                    Sessão: {activeTab.id_session || "Local"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCaptureOpen(true);
                      setCaptureUrl(activeTab.url);
                    }}
                    className="text-violet-400 hover:text-violet-300 font-medium"
                  >
                    Capturar via Playwright
                  </button>
                  <a
                    href={activeTab.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-300 hover:text-white underline"
                  >
                    Abrir em nova aba
                  </a>
                </div>
              </div>
              <iframe
                src={activeTab.url}
                title={activeTab.title}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                className="h-full w-full flex-1 border-0 bg-white"
              />
            </div>
          ))}
        </div>

        {/* PAINEL LATERAL 1: INSPEÇÃO DO DOM (Existente da main) */}
        {isInspectorOpen && (
          <aside className="w-80 md:w-96 border-l border-zinc-800/80 bg-surface-0 flex flex-col shrink-0">
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
                className="text-zinc-400 hover:text-white p-1 rounded"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-2 border-b border-zinc-800/60">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2 text-zinc-500" />
                <input
                  type="text"
                  value={inspectorSearch}
                  onChange={(e) => setInspectorSearch(e.target.value)}
                  placeholder="Filtrar por seletor, tag ou texto..."
                  className="h-7 w-full rounded border border-zinc-800 bg-surface-1 pl-7 pr-2 text-[11px] font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500/60 focus:outline-none"
                />
              </div>
            </div>

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
                    className="group rounded-md border border-zinc-800/80 bg-surface-1 p-2.5 transition hover:border-zinc-700 hover:bg-surface-1"
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
                    <div className="flex items-center justify-between rounded bg-surface-0 px-2 py-1 font-mono text-[11px] text-zinc-300">
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

                    {el.text && (
                      <p className="mt-1.5 text-[11px] text-zinc-400 line-clamp-2">
                        "{el.text}"
                      </p>
                    )}

                    {el.href && (
                      <p className="mt-1 text-[10px] font-mono text-zinc-500 truncate">
                        Destino: {el.href}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-zinc-800/60 p-2.5 bg-zinc-950/60 text-[10px] text-zinc-500 flex items-center justify-between">
              <span>Sessão: {activeTab.title}</span>
              <span className="font-mono">API: v1.0</span>
            </div>
          </aside>
        )}

        {/* PAINEL LATERAL 2: CAPTURA DE TELA & EXTRAÇÃO DE DADOS (Playwright) */}
        {isCaptureOpen && (
          <aside className="w-full sm:w-[500px] lg:w-[580px] shrink-0 border-l border-zinc-800/80 bg-surface-0 flex flex-col z-30 shadow-2xl overflow-hidden">
            {/* Header do Painel de Captura */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-surface-1 px-4">
              <div className="flex items-center gap-2">
                <Camera size={15} className="text-violet-400" />
                <h3 className="font-mono text-xs font-semibold text-zinc-100">
                  Captura & Extração Estruturada
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {captureResult && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadImage}
                      title="Baixar imagem JPEG"
                      className="flex h-7 items-center gap-1 rounded bg-zinc-800 px-2 text-[11px] text-zinc-300 hover:bg-zinc-700 hover:text-white"
                    >
                      <Image size={11} className="text-violet-400" />
                      <span>JPEG</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadJson}
                      title="Baixar JSON estruturado"
                      className="flex h-7 items-center gap-1 rounded bg-violet-600/20 px-2 text-[11px] font-mono text-violet-300 hover:bg-violet-600/30"
                    >
                      <FileJson size={11} />
                      <span>JSON</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setIsCaptureOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  title="Fechar painel"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Input e Disparo de Captura */}
            <div className="p-3 border-b border-zinc-800/60 bg-surface-1">
              <form onSubmit={handleCapturePage} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-500">
                    <Globe size={13} />
                  </span>
                  <input
                    type="text"
                    value={captureUrl}
                    onChange={(e) => setCaptureUrl(e.target.value)}
                    placeholder="URL para captura (ex: https://example.com)"
                    disabled={captureLoading}
                    className="h-8 w-full rounded border border-zinc-800 bg-surface-0 pl-8 pr-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={captureLoading}
                  className="inline-flex h-8 items-center gap-1.5 rounded bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 disabled:opacity-50 shrink-0"
                >
                  {captureLoading ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      <span>Capturando...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={12} />
                      <span>Capturar</span>
                    </>
                  )}
                </button>
              </form>

              {/* Feedbacks de Erro / Sucesso */}
              {captureError && (
                <div className="mt-2 flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
                  <AlertCircle size={13} className="shrink-0 text-red-400" />
                  <span className="flex-1">{captureError}</span>
                </div>
              )}
              {captureSuccess && !captureError && (
                <div className="mt-2 flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-400" />
                  <span className="flex-1 font-mono">{captureSuccess}</span>
                </div>
              )}
            </div>

            {/* Conteúdo da Captura */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {captureLoading ? (
                <div className="flex h-64 flex-col items-center justify-center text-center">
                  <Loader2 size={24} className="animate-spin text-violet-400 mb-2" />
                  <p className="text-xs font-medium text-zinc-300">Iniciando Chromium em modo headless...</p>
                  <p className="text-[11px] text-zinc-500 mt-1">Renderizando DOM e gerando screenshot JPEG.</p>
                </div>
              ) : !captureResult ? (
                <div className="flex h-64 flex-col items-center justify-center text-center p-4">
                  <Camera size={32} className="text-zinc-600 mb-2" />
                  <p className="text-xs font-medium text-zinc-400">Nenhuma captura realizada nesta sessão</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Insira a URL acima ou navegue até uma página e clique em Capturar.
                  </p>
                </div>
              ) : (
                <>
                  {/* Preview da Screenshot */}
                  <div className="rounded-lg border border-zinc-800 bg-surface-0 overflow-hidden">
                    <div className="flex h-8 items-center justify-between border-b border-zinc-800 bg-surface-1 px-3 text-[11px] font-mono text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Image size={12} className="text-violet-400" />
                        <span>Screenshot JPEG</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowFullImageModal(true)}
                          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-white"
                          title="Ampliar captura"
                        >
                          <Maximize2 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadImage}
                          className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-white"
                          title="Baixar imagem"
                        >
                          <Download size={11} />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-56 overflow-auto p-2 bg-black/40">
                      <img
                        src={`data:${captureResult.screenshot.mime_type};base64,${captureResult.screenshot.base64}`}
                        alt="Screenshot capturada"
                        className="w-full rounded border border-zinc-800/80 object-contain cursor-pointer"
                        onClick={() => setShowFullImageModal(true)}
                      />
                    </div>
                  </div>

                  {/* Abas de Dados Estruturados */}
                  <div className="rounded-lg border border-zinc-800 bg-surface-0 overflow-hidden">
                    {/* Tab Navigation */}
                    <div className="flex h-8 items-center gap-1 border-b border-zinc-800 bg-surface-1 px-2 overflow-x-auto">
                      <TabButton
                        active={captureSubTab === "overview"}
                        onClick={() => setCaptureSubTab("overview")}
                        icon={Info}
                        label="Geral"
                      />
                      <TabButton
                        active={captureSubTab === "headings"}
                        onClick={() => setCaptureSubTab("headings")}
                        icon={Heading}
                        label="Títulos"
                        badge={headingsList.length}
                      />
                      <TabButton
                        active={captureSubTab === "links"}
                        onClick={() => setCaptureSubTab("links")}
                        icon={ExternalLink}
                        label="Links"
                        badge={linksList.length}
                      />
                      <TabButton
                        active={captureSubTab === "tables"}
                        onClick={() => setCaptureSubTab("tables")}
                        icon={TableIcon}
                        label="Tabelas"
                        badge={tablesList.length}
                      />
                      <TabButton
                        active={captureSubTab === "text"}
                        onClick={() => setCaptureSubTab("text")}
                        icon={AlignLeft}
                        label="Texto"
                      />
                      <TabButton
                        active={captureSubTab === "json"}
                        onClick={() => setCaptureSubTab("json")}
                        icon={FileJson}
                        label="JSON"
                      />
                    </div>

                    {/* Conteúdo da Aba */}
                    <div className="p-3 text-xs max-h-72 overflow-y-auto">
                      {captureSubTab === "overview" && (
                        <div className="space-y-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-zinc-500">Título</span>
                            <p className="mt-0.5 rounded bg-surface-1 p-2 text-zinc-200 font-medium">
                              {captureResult.data?.title || "(Sem título)"}
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-mono uppercase text-zinc-500">Descrição</span>
                            <p className="mt-0.5 rounded bg-surface-1 p-2 text-zinc-400 italic">
                              {captureResult.data?.description || "(Sem meta description)"}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <MetricCard label="Status HTTP" value={captureResult.status_code} color="text-emerald-400" />
                            <MetricCard label="Headings" value={headingsList.length} color="text-violet-400" />
                            <MetricCard label="Links" value={linksList.length} color="text-cyan-400" />
                          </div>
                        </div>
                      )}

                      {captureSubTab === "headings" && (
                        <div className="space-y-1.5">
                          {headingsList.length === 0 ? (
                            <EmptyState message="Nenhum título encontrado." />
                          ) : (
                            headingsList.map((h, idx) => (
                              <div key={idx} className="flex items-start gap-2 rounded bg-surface-1 p-2">
                                <span
                                  className={`rounded px-1 py-0.2 font-mono text-[9px] font-bold uppercase ${
                                    h.level === "h1"
                                      ? "bg-violet-600/30 text-violet-300"
                                      : h.level === "h2"
                                      ? "bg-cyan-600/30 text-cyan-300"
                                      : "bg-zinc-800 text-zinc-400"
                                  }`}
                                >
                                  {h.level}
                                </span>
                                <span className="flex-1 text-zinc-200">{h.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {captureSubTab === "links" && (
                        <div className="space-y-1.5">
                          {linksList.length === 0 ? (
                            <EmptyState message="Nenhum link público encontrado." />
                          ) : (
                            linksList.map((link, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2 rounded bg-surface-1 p-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-zinc-200">{link.text || "(Link)"}</p>
                                  <p className="truncate font-mono text-[10px] text-zinc-500">{link.url}</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(link.url, idx)}
                                    className="p-1 text-zinc-500 hover:text-zinc-200"
                                    title="Copiar link"
                                  >
                                    {copiedLink === idx ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  </button>
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 text-zinc-500 hover:text-violet-400"
                                    title="Abrir"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {captureSubTab === "tables" && (
                        <div className="space-y-2">
                          {tablesList.length === 0 ? (
                            <EmptyState message="Nenhuma tabela HTML encontrada." />
                          ) : (
                            tablesList.map((tbl, tIdx) => (
                              <div key={tIdx} className="rounded border border-zinc-800 overflow-x-auto p-1 bg-surface-1">
                                <table className="w-full text-left font-mono text-[11px]">
                                  <tbody>
                                    {tbl.map((row, rIdx) => (
                                      <tr key={rIdx} className="border-b border-zinc-800/40 last:border-0">
                                        {row.map((c, cIdx) => (
                                          <td key={cIdx} className="px-2 py-1 text-zinc-300">
                                            {c || "-"}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {captureSubTab === "text" && (
                        <div>
                          <div className="mb-1 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                            <span>{extractedText.length} caracteres</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(extractedText)}
                              className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                            >
                              {copiedText ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedText ? "Copiado!" : "Copiar"}</span>
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap rounded bg-surface-1 p-2 font-mono text-[11px] leading-4 text-zinc-300 max-h-56 overflow-auto">
                            {extractedText || "(Sem texto visível)"}
                          </pre>
                        </div>
                      )}

                      {captureSubTab === "json" && (
                        <div>
                          <div className="mb-1 flex justify-between items-center text-[10px] font-mono text-zinc-500">
                            <span>JSON Estruturado</span>
                            <button
                              type="button"
                              onClick={handleDownloadJson}
                              className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                            >
                              <Download size={11} />
                              <span>Baixar</span>
                            </button>
                          </div>
                          <pre className="rounded bg-surface-1 p-2 font-mono text-[10px] leading-4 text-zinc-300 max-h-56 overflow-auto">
                            {JSON.stringify(
                              {
                                url: captureResult.url,
                                status_code: captureResult.status_code,
                                captured_at: captureResult.captured_at,
                                data: captureResult.data,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* MODAL FULLSCREEN PARA SCREENSHOT */}
      {showFullImageModal && captureResult?.screenshot?.base64 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm select-none"
          onClick={() => setShowFullImageModal(false)}
        >
          <div
            className="relative flex max-h-full max-w-5xl flex-col rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 items-center justify-between px-3 text-xs font-mono text-zinc-300">
              <span className="truncate">{captureResult.url}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500"
                >
                  Download JPEG
                </button>
                <button
                  type="button"
                  onClick={() => setShowFullImageModal(false)}
                  className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-white"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto p-1">
              <img
                src={`data:${captureResult.screenshot.mime_type};base64,${captureResult.screenshot.base64}`}
                alt="Captura ampliada"
                className="w-full rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// COMPONENTES AUXILIARES
// =========================================================

function TabButton({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-mono transition ${
        active
          ? "bg-zinc-800 text-zinc-100 font-medium"
          : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
      }`}
    >
      <Icon size={12} className={active ? "text-violet-400" : "text-zinc-500"} />
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={`ml-0.5 rounded px-1 text-[9px] ${
            active ? "bg-violet-600/30 text-violet-300" : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="rounded border border-zinc-800 bg-surface-1 p-2 text-center">
      <p className="text-[9px] font-mono uppercase text-zinc-500">{label}</p>
      <p className={`mt-0.5 font-mono text-base font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex h-24 items-center justify-center text-center text-xs text-zinc-500">
      {message}
    </div>
  );
}
