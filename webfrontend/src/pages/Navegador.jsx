import { useState } from "react";
import {
  Globe,
  Camera,
  Download,
  ExternalLink,
  FileJson,
  Image,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Table as TableIcon,
  AlignLeft,
  Heading,
  Info,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import sheets from "@/services/api";

export default function Navegador() {
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [copiedLink, setCopiedLink] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);

  // =========================================================
  // SUBMETER CAPTURA
  // =========================================================
  async function handleCapture(e) {
    if (e) e.preventDefault();

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Por favor, informe uma URL válida.");
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError("A URL deve iniciar com http:// ou https://");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await sheets.browserCapture(trimmedUrl);
      const data = response.data;
      setResult(data);
      setSuccess(`Página capturada com sucesso! Status HTTP ${data.status_code}.`);
    } catch (err) {
      console.error("Erro na captura:", err);
      const message =
        err.response?.data?.error?.message ||
        err.message ||
        "Falha ao capturar a página. Verifique se a URL é pública e acessível.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // DOWNLOAD DA IMAGEM JPEG
  // =========================================================
  function handleDownloadImage() {
    if (!result?.screenshot?.base64) return;

    try {
      const byteCharacters = atob(result.screenshot.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });
      const blobUrl = URL.createObjectURL(blob);

      const hostname = safeHostname(result.url);
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

  // =========================================================
  // DOWNLOAD DO JSON
  // =========================================================
  function handleDownloadJson() {
    if (!result) return;

    try {
      const exportData = {
        url: result.url,
        status_code: result.status_code,
        captured_at: result.captured_at,
        data: result.data,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const blobUrl = URL.createObjectURL(blob);

      const hostname = safeHostname(result.url);
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

  // =========================================================
  // COPIAR LINK
  // =========================================================
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

  const headingsList = result?.data?.headings || [];
  const linksList = result?.data?.links || [];
  const tablesList = result?.data?.tables || [];
  const extractedText = result?.data?.text || "";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0c0e] text-zinc-100 font-sans">
      {/* HEADER DA PÁGINA */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#121214] px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/30">
            <Globe size={18} />
          </div>
          <div>
            <h1 className="font-mono text-sm font-semibold tracking-tight text-zinc-100">
              Navegador & Captura Web
            </h1>
            <p className="text-[11px] text-zinc-500">
              Captura de tela em alta resolução e extração estruturada de conteúdo com Playwright
            </p>
          </div>
        </div>

        {result && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadImage}
              title="Baixar imagem JPEG da captura"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
            >
              <Image size={13} className="text-violet-400" />
              <span>Baixar Imagem</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              title="Baixar dados estruturados em JSON"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-violet-500/30 bg-violet-600/20 px-3 text-xs font-medium text-violet-300 transition hover:bg-violet-600/30 hover:text-white"
            >
              <FileJson size={13} className="text-violet-400" />
              <span>Baixar JSON</span>
            </button>
          </div>
        )}
      </header>

      {/* BARRA DE PESQUISA / URL */}
      <div className="shrink-0 border-b border-zinc-800/50 bg-[#0f0f12] px-6 py-3">
        <form onSubmit={handleCapture} className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
              <Globe size={15} />
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Digite a URL pública (ex: https://example.com)"
              disabled={loading}
              className="h-10 w-full rounded-lg border border-zinc-800 bg-[#141416] pl-9 pr-4 text-xs font-mono text-zinc-100 placeholder-zinc-500 transition focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <Camera size={14} />
                <span>Capturar Página</span>
              </>
            )}
          </button>
        </form>

        {/* FEEDBACK DE ERRO OU SUCESSO */}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs text-red-300">
            <AlertCircle size={15} className="shrink-0 text-red-400" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {success && !error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-300">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-400" />
            <span className="flex-1 font-mono">{success}</span>
          </div>
        )}
      </div>

      {/* ÁREA PRINCIPAL DE CONTEÚDO */}
      <div className="min-h-0 flex-1 overflow-hidden p-6">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-violet-500/20">
              <Loader2 className="size-8 animate-spin text-violet-400" />
            </div>
            <h3 className="font-mono text-sm font-semibold text-zinc-200">
              Iniciando Chromium e capturando página...
            </h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-500">
              Carregando o DOM, tirando screenshot JPEG e extraindo dados semânticos estruturados.
            </p>
          </div>
        ) : !result ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-white/5">
              <Camera className="size-7 text-zinc-600" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-300">
              Nenhuma captura realizada ainda
            </h3>
            <p className="mt-1 max-w-md text-xs text-zinc-500">
              Digite uma URL no campo acima e clique em{" "}
              <strong className="text-zinc-400 font-medium">Capturar Página</strong> para
              gerar o screenshot e extrair links, tabelas, cabeçalhos e textos.
            </p>
          </div>
        ) : (
          <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-12 min-h-0">
            {/* COLUNA ESQUERDA: SCREENSHOT REAL */}
            <div className="flex flex-col rounded-xl border border-zinc-800/80 bg-[#121214] overflow-hidden lg:col-span-5 min-h-0">
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-900/40 px-3.5">
                <div className="flex items-center gap-2">
                  <Image size={14} className="text-violet-400" />
                  <span className="text-xs font-mono font-medium text-zinc-300">
                    Captura Real (Screenshot)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                    {result.screenshot.full_page ? "Página Inteira" : "Viewport"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullImageModal(true)}
                    title="Ampliar captura"
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                  >
                    <Maximize2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    title="Baixar imagem JPEG"
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                  >
                    <Download size={12} />
                  </button>
                </div>
              </div>

              {/* IMAGEM PREVIEW */}
              <div className="relative min-h-0 flex-1 overflow-auto bg-zinc-950 p-2.5">
                {result.screenshot?.base64 ? (
                  <img
                    src={`data:${result.screenshot.mime_type};base64,${result.screenshot.base64}`}
                    alt={`Screenshot de ${result.url}`}
                    className="w-full rounded border border-zinc-800/60 object-contain shadow-lg"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                    Nenhuma imagem disponível.
                  </div>
                )}
              </div>

              {/* FOOTER DA COLUNA DE IMAGEM */}
              <div className="flex h-8 shrink-0 items-center justify-between border-t border-zinc-800/60 bg-zinc-900/30 px-3 text-[10px] font-mono text-zinc-500">
                <span>Formato: {result.screenshot.mime_type}</span>
                <span>Data: {new Date(result.captured_at).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* COLUNA DIREITA: DADOS ESTRUTURADOS COM ABAS */}
            <div className="flex flex-col rounded-xl border border-zinc-800/80 bg-[#121214] overflow-hidden lg:col-span-7 min-h-0">
              {/* TAB BAR */}
              <div className="flex h-10 shrink-0 items-center gap-1 border-b border-zinc-800/60 bg-zinc-900/40 px-2 overflow-x-auto">
                <TabButton
                  active={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  icon={Info}
                  label="Visão Geral"
                />
                <TabButton
                  active={activeTab === "headings"}
                  onClick={() => setActiveTab("headings")}
                  icon={Heading}
                  label="Títulos"
                  badge={headingsList.length}
                />
                <TabButton
                  active={activeTab === "links"}
                  onClick={() => setActiveTab("links")}
                  icon={ExternalLink}
                  label="Links"
                  badge={linksList.length}
                />
                <TabButton
                  active={activeTab === "tables"}
                  onClick={() => setActiveTab("tables")}
                  icon={TableIcon}
                  label="Tabelas"
                  badge={tablesList.length}
                />
                <TabButton
                  active={activeTab === "text"}
                  onClick={() => setActiveTab("text")}
                  icon={AlignLeft}
                  label="Texto"
                />
                <TabButton
                  active={activeTab === "json"}
                  onClick={() => setActiveTab("json")}
                  icon={FileJson}
                  label="JSON"
                />
              </div>

              {/* CONTEÚDO DA ABA ATIVA */}
              <div className="min-h-0 flex-1 overflow-y-auto p-4 text-xs">
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[11px] font-mono font-semibold uppercase text-zinc-500">
                        URL Capturada
                      </h4>
                      <div className="mt-1 flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#141416] p-2.5 font-mono text-xs text-zinc-200">
                        <span className="flex-1 truncate">{result.url}</span>
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-400 hover:text-violet-300"
                          title="Abrir página no navegador"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold uppercase text-zinc-500">
                        Título da Página
                      </h4>
                      <p className="mt-1 rounded-lg border border-zinc-800 bg-[#141416] p-2.5 font-medium text-zinc-200">
                        {result.data?.title || "(Sem título definido)"}
                      </p>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-mono font-semibold uppercase text-zinc-500">
                        Meta Descrição
                      </h4>
                      <p className="mt-1 rounded-lg border border-zinc-800 bg-[#141416] p-2.5 text-zinc-400 italic">
                        {result.data?.description || "(Sem meta tag description informada)"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <MetricCard
                        label="Status HTTP"
                        value={result.status_code}
                        color="text-emerald-400"
                      />
                      <MetricCard
                        label="Títulos Extraídos"
                        value={headingsList.length}
                        color="text-violet-400"
                      />
                      <MetricCard
                        label="Links Coletados"
                        value={linksList.length}
                        color="text-cyan-400"
                      />
                      <MetricCard
                        label="Tabelas"
                        value={tablesList.length}
                        color="text-amber-400"
                      />
                    </div>
                  </div>
                )}

                {activeTab === "headings" && (
                  <div className="space-y-2">
                    {headingsList.length === 0 ? (
                      <EmptyState message="Nenhum título (H1, H2, H3) encontrado na página." />
                    ) : (
                      headingsList.map((h, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-lg border border-zinc-800/70 bg-[#141416] p-2.5"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                              h.level === "h1"
                                ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                                : h.level === "h2"
                                ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30"
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

                {activeTab === "links" && (
                  <div className="space-y-2">
                    {linksList.length === 0 ? (
                      <EmptyState message="Nenhum link público encontrado na página." />
                    ) : (
                      linksList.map((link, idx) => (
                        <div
                          key={idx}
                          className="group flex items-center justify-between gap-3 rounded-lg border border-zinc-800/70 bg-[#141416] p-2.5 transition hover:border-zinc-700"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-zinc-200">
                              {link.text || "(Link sem texto)"}
                            </p>
                            <p className="truncate font-mono text-[11px] text-zinc-500">
                              {link.url}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(link.url, idx)}
                              title="Copiar URL"
                              className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                            >
                              {copiedLink === idx ? (
                                <Check size={13} className="text-emerald-400" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir link"
                              className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-violet-400"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "tables" && (
                  <div className="space-y-4">
                    {tablesList.length === 0 ? (
                      <EmptyState message="Nenhuma tabela HTML encontrada na página." />
                    ) : (
                      tablesList.map((table, tIdx) => (
                        <div
                          key={tIdx}
                          className="overflow-hidden rounded-lg border border-zinc-800 bg-[#141416]"
                        >
                          <div className="border-b border-zinc-800 bg-zinc-900/60 px-3 py-1.5 font-mono text-[11px] text-zinc-400">
                            Tabela #{tIdx + 1} ({table.length} linhas)
                          </div>
                          <div className="overflow-x-auto p-2">
                            <table className="w-full text-left font-mono text-xs">
                              <tbody>
                                {table.map((row, rIdx) => (
                                  <tr
                                    key={rIdx}
                                    className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-900/30"
                                  >
                                    {row.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className={`px-2.5 py-1.5 ${
                                          rIdx === 0
                                            ? "font-semibold text-violet-300"
                                            : "text-zinc-300"
                                        }`}
                                      >
                                        {cell || "-"}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "text" && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-zinc-500">
                        {extractedText.length} caracteres extraídos
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(extractedText)}
                        className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[11px] font-mono text-zinc-300 hover:bg-zinc-700"
                      >
                        {copiedText ? (
                          <>
                            <Check size={11} className="text-emerald-400" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={11} />
                            <span>Copiar texto</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-[#141416] p-3.5 font-mono text-xs leading-5 text-zinc-300">
                      {extractedText || "(Nenhum texto visível no corpo da página)"}
                    </pre>
                  </div>
                )}

                {activeTab === "json" && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-zinc-500">
                        Visualização da Resposta da API
                      </span>
                      <button
                        type="button"
                        onClick={handleDownloadJson}
                        className="inline-flex items-center gap-1 rounded bg-violet-600/20 px-2 py-1 text-[11px] font-mono text-violet-300 hover:bg-violet-600/30"
                      >
                        <Download size={11} />
                        <span>Baixar JSON</span>
                      </button>
                    </div>
                    <pre className="max-h-[500px] overflow-auto rounded-lg border border-zinc-800 bg-[#141416] p-3.5 font-mono text-[11px] leading-5 text-zinc-300">
                      {JSON.stringify(
                        {
                          url: result.url,
                          status_code: result.status_code,
                          captured_at: result.captured_at,
                          data: result.data,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL FULLSCREEN PARA SCREENSHOT */}
      {showFullImageModal && result?.screenshot?.base64 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onClick={() => setShowFullImageModal(false)}
        >
          <div
            className="relative flex max-h-full max-w-5xl flex-col rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 items-center justify-between px-3 text-xs font-mono text-zinc-300">
              <span className="truncate">{result.url}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500"
                >
                  Download
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
                src={`data:${result.screenshot.mime_type};base64,${result.screenshot.base64}`}
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
      className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-mono transition ${
        active
          ? "bg-zinc-800 text-zinc-100 font-medium"
          : "text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300"
      }`}
    >
      <Icon size={13} className={active ? "text-violet-400" : "text-zinc-500"} />
      <span>{label}</span>
      {badge !== undefined && (
        <span
          className={`ml-1 rounded px-1 text-[10px] ${
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
    <div className="rounded-lg border border-zinc-800 bg-[#141416] p-3 text-center">
      <p className="text-[10px] font-mono uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex h-32 items-center justify-center text-center text-xs text-zinc-500">
      {message}
    </div>
  );
}
