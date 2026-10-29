import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Cloud,
  Cpu,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  KeyRound,
  Loader2,
  Play,
  Plus,
  Search,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import {
  CLOUD_PROVIDERS,
  CUSTOM_PROVIDER_ID,
  fetchCustomServerModels,
  fetchOpenRouterModels,
  getActiveModel,
  getAllProviderModels,
  getCustomProviderModels,
  getCustomServer,
  saveCustomProviderModels,
  saveCustomServer,
  setActiveModel,
  testProviderKey,
} from '@/services/llmService';

const MODELS = [
  {
    name: 'Gemma 3 1B',
    filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    size: '~0.8 GB',
    ram: '4 GB de RAM',
    tags: ['Mínimo', 'Chat'],
    description: 'O menor da lista. Serve para testar o app em máquina fraca e responder coisas curtas.',
  },
  {
    name: 'Qwen2.5 Coder 1.5B',
    filename: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    size: '~1.1 GB',
    ram: '4 GB de RAM',
    tags: ['Mínimo', 'Código'],
    description: 'Código em máquina modesta: completa e explica trechos, mas não conduz um agente sozinho.',
  },
  {
    name: 'Qwen3 1.7B',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    size: '~1.1 GB',
    ram: '4 GB de RAM',
    tags: ['Rápido', 'Chat'],
    description: 'Rápido em qualquer máquina, inclusive sem placa de vídeo. É o começo recomendado.',
  },
  {
    name: 'Llama 3.2 3B',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '~2 GB',
    ram: '8 GB de RAM',
    tags: ['Equilibrado', 'Chat'],
    description: 'O compacto da Meta. Bom de conversa geral, leve para o disco.',
  },
  {
    name: 'Phi-4 Mini',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    size: '~2.5 GB',
    ram: '8 GB de RAM',
    tags: ['Equilibrado', 'Raciocínio'],
    description: 'O pequeno da Microsoft, forte em raciocínio para o tamanho que tem.',
  },
  {
    name: 'Gemma 3 4B',
    filename: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    size: '~2.5 GB',
    ram: '8 GB de RAM',
    tags: ['Equilibrado', 'Chat'],
    description: 'O Gemma 3 do Google, com boa escrita em português.',
  },
  {
    name: 'Qwen3 4B',
    filename: 'Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    size: '~2.5 GB',
    ram: '8 GB de RAM',
    tags: ['Equilibrado', 'Chat', 'Ferramentas'],
    description: 'Modelo intermediário equilibrado com suporte avançado a chamadas de funções.',
  },
];

const TAG_STYLES = {
  Mínimo: 'bg-violet-500 text-white',
  Código: 'bg-violet-500 text-white',
  Rápido: 'bg-violet-500 text-white',
  Chat: 'bg-violet-500 text-white',
  Equilibrado: 'bg-violet-500 text-white',
  Raciocínio: 'bg-violet-500 text-white',
  Ferramentas: 'bg-violet-500 text-white',
  Importado: 'bg-zinc-700 text-zinc-200',
};

function ModelTag({ children }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${TAG_STYLES[children] || 'bg-zinc-700 text-zinc-200'}`}>
      {children}
    </span>
  );
}

function ProviderCard({
  provider,
  value,
  visible,
  activeModelConfig,
  onToggleVisible,
  onSave,
  onChange,
  onActivateModel,
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [customModels, setCustomModels] = useState(() => getCustomProviderModels(provider.id));
  const [newModelId, setNewModelId] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogModels, setCatalogModels] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogError, setCatalogError] = useState(null);

  const hasKey = Boolean(value?.trim());

  useEffect(() => {
    const handleSync = () => setCustomModels(getCustomProviderModels(provider.id));
    window.addEventListener('osiris:model-changed', handleSync);
    return () => window.removeEventListener('osiris:model-changed', handleSync);
  }, [provider.id]);

  const allModels = useMemo(() => {
    const base = provider.models || [];
    const existingIds = new Set(base.map((m) => m.id));
    const merged = customModels.filter((m) => !existingIds.has(m.id));
    return [...base, ...merged];
  }, [provider.models, customModels]);

  const handleAddCustomModel = (idToAdd, nameToAdd) => {
    const cleanId = (idToAdd || newModelId).trim();
    if (!cleanId) return;
    if (allModels.some((m) => m.id === cleanId)) {
      setNewModelId('');
      return;
    }
    const updated = [...customModels, { id: cleanId, name: nameToAdd || cleanId, isCustom: true }];
    setCustomModels(updated);
    saveCustomProviderModels(provider.id, updated);
    setNewModelId('');
  };

  const handleRemoveCustomModel = (modelId) => {
    const updated = customModels.filter((m) => m.id !== modelId);
    setCustomModels(updated);
    saveCustomProviderModels(provider.id, updated);
  };

  async function handleOpenCatalog() {
    setShowCatalogModal(true);
    if (catalogModels.length > 0) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const list = await fetchOpenRouterModels(value);
      setCatalogModels(list);
    } catch (err) {
      setCatalogError(err.message || 'Erro ao carregar catálogo.');
    } finally {
      setCatalogLoading(false);
    }
  }

  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return catalogModels;
    const term = catalogSearch.toLowerCase().trim();
    return catalogModels.filter(
      (m) => m.id.toLowerCase().includes(term) || (m.name && m.name.toLowerCase().includes(term)),
    );
  }, [catalogModels, catalogSearch]);

  async function handleTest() {
    if (!hasKey) return;
    setTesting(true);
    setTestResult(null);

    try {
      await testProviderKey(provider.id, value);
      setTestResult({ ok: true, msg: 'Chave válida!' });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message || 'Erro ao validar chave.' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-700/80 bg-[#181818] p-3.5 transition-colors">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-semibold text-zinc-100">{provider.name}</h3>
          {hasKey && (
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
              chave salva
            </span>
          )}
        </div>

        {provider.getKeyUrl && (
          <a
            href={provider.getKeyUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-400 transition-colors hover:text-violet-400"
          >
            Obter chave
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center rounded-md border border-zinc-700 bg-[#101010] px-2.5">
          <input
            type={visible ? 'text' : 'password'}
            value={value}
            onChange={(event) => {
              onChange(provider.id, event.target.value);
              setTestResult(null);
            }}
            placeholder={provider.placeholder}
            className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => onToggleVisible(provider.id)}
            aria-label={visible ? 'Ocultar chave' : 'Mostrar chave'}
            className="ml-2 text-zinc-500 transition-colors hover:text-zinc-200"
          >
            {visible ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onSave(provider.id)}
          className="h-8 rounded-md bg-violet-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Salvar
        </button>

        {hasKey && (
          <>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="flex h-8 items-center gap-1.5 rounded-md border border-zinc-700 bg-[#111111] px-3 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-50"
            >
              {testing && <Loader2 size={12} className="animate-spin" />}
              {testing ? 'Testando...' : 'Testar'}
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(provider.id, '');
                onSave(provider.id);
                setTestResult(null);
              }}
              aria-label={`Remover chave de ${provider.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>

      {testResult && (
        <div
          className={`mt-2 flex items-center gap-1.5 rounded px-2 py-1 text-[11px] ${
            testResult.ok
              ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {testResult.ok ? <Check size={12} /> : null}
          <span>{testResult.msg}</span>
        </div>
      )}

      {allModels.length > 0 && (
        <div className="mt-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Modelos disponíveis ({allModels.length}):
            </p>
            {provider.id === 'openrouter' && (
              <button
                type="button"
                onClick={handleOpenCatalog}
                className="flex items-center gap-1 text-[11px] font-medium text-violet-400 transition-colors hover:text-violet-300"
              >
                <Search size={11} />
                Explorar catálogo OpenRouter
              </button>
            )}
          </div>

          {provider.id === 'openrouter' && (
            <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-[#121212] p-1.5">
              <input
                type="text"
                value={newModelId}
                onChange={(e) => setNewModelId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomModel();
                }}
                placeholder="Digitar ID de outro modelo (ex: meta-llama/llama-3.2-3b-instruct)..."
                className="h-7 min-w-0 flex-1 bg-transparent px-2 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddCustomModel()}
                disabled={!newModelId.trim()}
                className="flex h-7 items-center gap-1 rounded bg-violet-600 px-2.5 text-[10px] font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
              >
                <Plus size={11} />
                Adicionar
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {allModels.map((model) => {
              const isActive =
                activeModelConfig?.type === 'cloud' &&
                activeModelConfig?.provider === provider.id &&
                activeModelConfig?.model === model.id;

              return (
                <div
                  key={model.id}
                  className={`flex items-center justify-between rounded-md border p-2 transition-colors ${
                    isActive
                      ? 'border-violet-500/80 bg-violet-950/20'
                      : 'border-zinc-800 bg-[#121212] hover:border-zinc-700'
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-mono text-[11px] font-medium text-zinc-200">
                        {model.name}
                      </p>
                      {model.isCustom && (
                        <span className="rounded bg-violet-500/20 px-1 py-0.2 text-[8px] font-mono text-violet-300">
                          personalizado
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-[9px] text-zinc-500">
                      {model.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {model.isCustom && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomModel(model.id)}
                        title="Remover modelo da lista"
                        className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!hasKey || isActive}
                      onClick={() =>
                        onActivateModel({
                          type: 'cloud',
                          provider: provider.id,
                          model: model.id,
                          name: `${provider.name} - ${model.name}`,
                        })
                      }
                      className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : hasKey
                          ? 'bg-violet-600 text-white hover:bg-violet-500'
                          : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <Check size={11} />
                          Em uso
                        </>
                      ) : (
                        'Ativar'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-zinc-700 bg-[#161616] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                  <Cloud size={15} className="text-violet-400" />
                  Catálogo de Modelos do OpenRouter
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Pesquise e escolha qualquer modelo suportado pelo OpenRouter.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-700 bg-[#101010] px-3 py-1.5">
              <Search size={14} className="text-zinc-500" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Filtrar por nome ou ID (ex: deepseek, llama, claude, :free)..."
                className="w-full bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                autoFocus
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => setCatalogSearch('')}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {catalogLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-zinc-400">
                <Loader2 size={24} className="mb-2 animate-spin text-violet-400" />
                <span className="text-xs">Carregando catálogo de modelos do OpenRouter...</span>
              </div>
            ) : catalogError ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-400">
                {catalogError}
              </div>
            ) : (
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700">
                {filteredCatalog.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-500">
                    Nenhum modelo encontrado com "{catalogSearch}".
                  </p>
                ) : (
                  filteredCatalog.slice(0, 80).map((m) => {
                    const isAdded = allModels.some((item) => item.id === m.id);
                    const isActive =
                      activeModelConfig?.type === 'cloud' &&
                      activeModelConfig?.provider === provider.id &&
                      activeModelConfig?.model === m.id;

                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#111111] p-2.5 hover:border-zinc-700"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-xs font-medium text-zinc-200">
                              {m.name}
                            </span>
                            {m.context_length && (
                              <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] text-zinc-400">
                                {Math.round(m.context_length / 1024)}k ctx
                              </span>
                            )}
                          </div>
                          <span className="block truncate font-mono text-[10px] text-zinc-500">
                            {m.id}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {isAdded ? (
                            <span className="text-[10px] font-medium text-zinc-500">Na lista</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddCustomModel(m.id, m.name)}
                              className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white"
                            >
                              + Adicionar
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!hasKey || isActive}
                            onClick={() => {
                              if (!isAdded) handleAddCustomModel(m.id, m.name);
                              onActivateModel({
                                type: 'cloud',
                                provider: provider.id,
                                model: m.id,
                                name: `${provider.name} - ${m.name}`,
                              });
                              setShowCatalogModal(false);
                            }}
                            className={`rounded px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                              isActive
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : hasKey
                                ? 'bg-violet-600 text-white hover:bg-violet-500'
                                : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                            }`}
                          >
                            {isActive ? 'Em uso' : 'Ativar'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                {filteredCatalog.length > 80 && (
                  <p className="py-2 text-center text-[10px] text-zinc-500">
                    Mostrando os primeiros 80 modelos. Refine a busca para encontrar modelos específicos.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function CustomServerCard({ activeModelConfig, onActivateModel }) {
  const [server, setServer] = useState(getCustomServer);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleConnect() {
    setLoading(true);
    setResult(null);
    try {
      const models = await fetchCustomServerModels(server.baseUrl, server.apiKey);
      const next = { ...server, models };
      setServer(next);
      saveCustomServer(next);
      setResult({ ok: true, msg: models.length ? `${models.length} modelo(s) encontrado(s).` : 'Conectado, mas o servidor nao tem modelos.' });
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'h-8 min-w-0 rounded-md border border-zinc-700 bg-[#101010] px-2.5 font-mono text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none';

  return (
    <section className="rounded-lg border border-zinc-700/80 bg-[#181818] p-3.5">
      <div className="mb-1 flex items-center gap-2">
        <Server size={13} className="text-violet-400" />
        <h3 className="text-[13px] font-semibold text-zinc-100">Servidor proprio (VPS)</h3>
      </div>
      <p className="mb-2.5 text-[10px] leading-4 text-zinc-500">
        Ollama, vLLM ou llama.cpp com API compativel com OpenAI. Abra o tunel SSH antes de conectar.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Endereco do servidor" value={server.baseUrl} placeholder="http://localhost:11434/v1"
          onChange={(event) => setServer({ ...server, baseUrl: event.target.value })} className={inputClass + ' flex-1'} />
        <input aria-label="Chave do servidor (opcional)" type="password" value={server.apiKey} placeholder="chave (opcional)"
          onChange={(event) => setServer({ ...server, apiKey: event.target.value })} className={inputClass + ' w-36'} />
        <button type="button" onClick={handleConnect} disabled={loading || !server.baseUrl.trim()}
          className="flex h-8 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
          {loading && <Loader2 size={12} className="animate-spin" />}
          Conectar e listar modelos
        </button>
      </div>

      {result && (
        <div className={`mt-2 rounded px-2 py-1 text-[11px] ${result.ok
          ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          : 'border border-red-500/20 bg-red-500/10 text-red-400'}`}>
          {result.msg}
        </div>
      )}

      {server.models.length > 0 && (
        <div className="mt-3.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {server.models.map((model) => {
            const isActive = activeModelConfig?.provider === CUSTOM_PROVIDER_ID && activeModelConfig?.model === model;
            return (
              <div key={model} className={`flex items-center justify-between rounded-md border p-2 ${isActive
                ? 'border-violet-500/80 bg-violet-950/20' : 'border-zinc-800 bg-[#121212]'}`}>
                <p className="min-w-0 truncate font-mono text-[11px] text-zinc-200">{model}</p>
                <button type="button" disabled={isActive}
                  onClick={() => onActivateModel({ type: 'cloud', provider: CUSTOM_PROVIDER_ID, model, name: `Servidor proprio - ${model}` })}
                  className={`flex h-6 items-center gap-1 rounded px-2 text-[10px] font-semibold ${isActive
                    ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-600 text-white hover:bg-violet-500'}`}>
                  {isActive ? <><Check size={11} />Em uso</> : 'Ativar'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function Modelos() {
  const [localModels, setLocalModels] = useState([]);
  const [status, setStatus] = useState({ isLoaded: false, activeModelName: null, activeModelPath: null });
  const [loadingPath, setLoadingPath] = useState(null);
  const [downloads, setDownloads] = useState({});
  const [activeTab, setActiveTab] = useState('cloud');
  const [cloudKeys, setCloudKeys] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('osiris_cloud_model_keys') || '{}');
    } catch {
      return {};
    }
  });
  const [activeModelConfig, setActiveModelConfig] = useState(getActiveModel);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [savedProvider, setSavedProvider] = useState(null);

  const isElectron = typeof window !== 'undefined' && Boolean(window.llama);

  const refreshData = async () => {
    if (!isElectron) return;
    try {
      const [currentStatus, modelsList] = await Promise.all([
        window.llama.getStatus(),
        window.llama.listLocalModels(),
      ]);
      setStatus(currentStatus);
      setLocalModels(modelsList);
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    }
  };

  useEffect(() => {
    refreshData();
    if (!isElectron) return;

    const removeProgressListener = window.llama.onDownloadProgress((data) => {
      setDownloads((prev) => ({ ...prev, [data.url]: data }));
    });

    const removeCompleteListener = window.llama.onDownloadComplete((data) => {
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[data.url];
        return next;
      });
      refreshData();
    });

    return () => {
      removeProgressListener?.();
      removeCompleteListener?.();
    };
  }, [isElectron]);

  const handleLoadLocalModel = async (modelPath, modelName) => {
    if (!isElectron) return;
    setLoadingPath(modelPath);
    try {
      await window.llama.loadModel(modelPath);
      await refreshData();
      const config = {
        type: 'local',
        modelPath,
        name: modelName || 'Modelo Local',
      };
      setActiveModel(config);
      setActiveModelConfig(config);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingPath(null);
    }
  };

  const handleDownload = async (url, filename) => {
    if (!isElectron) return;
    try {
      await window.llama.downloadModel(url, filename);
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleImport = async () => {
    if (!isElectron) return;
    try {
      const imported = await window.llama.importFile();
      if (imported) {
        await refreshData();
        await handleLoadLocalModel(imported.fullPath, imported.filename);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (modelPath) => {
    if (!isElectron) return;
    if (!window.confirm('Excluir este modelo local?')) return;
    try {
      await window.llama.deleteModel(modelPath);
      await refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCloudKeyChange = (providerId, value) => {
    setCloudKeys((prev) => ({ ...prev, [providerId]: value }));
    setSavedProvider(null);
  };

  const handleSaveCloudKey = (providerId) => {
    const next = { ...cloudKeys };
    if (!next[providerId]?.trim()) {
      delete next[providerId];
    }
    setCloudKeys(next);
    localStorage.setItem('osiris_cloud_model_keys', JSON.stringify(next));
    setSavedProvider(providerId);

    // If no active model is selected yet, auto-select default model for this provider
    const provider = CLOUD_PROVIDERS.find((p) => p.id === providerId);
    if (provider && provider.models.length > 0 && next[providerId]) {
      const defModel = provider.models.find((m) => m.default) || provider.models[0];
      const newConfig = {
        type: 'cloud',
        provider: provider.id,
        model: defModel.id,
        name: `${provider.name} - ${defModel.name}`,
      };
      setActiveModel(newConfig);
      setActiveModelConfig(newConfig);
    }
  };

  const handleActivateCloudModel = (modelConfig) => {
    setActiveModel(modelConfig);
    setActiveModelConfig(modelConfig);
  };

  const toggleVisibleKey = (providerId) => {
    setVisibleKeys((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const importedModels = useMemo(() => {
    return localModels.filter((model) => !MODELS.some((item) => item.filename === model.filename));
  }, [localModels]);

  return (
    <div className="h-full w-full overflow-y-auto bg-[#141414] text-zinc-100 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
      <div className="w-full max-w-[760px] px-6 pb-14 pt-12 lg:ml-20">
        {/* Active Model Banner */}
        <section className="mb-6 rounded-lg border border-violet-500/30 bg-violet-950/20 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-violet-400">
                Modelo Ativo no Osiris:
              </span>
              <h2 className="font-mono text-sm font-bold text-white">
                {activeModelConfig?.name || 'Nenhum modelo selecionado'}
              </h2>
            </div>
            <span className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-violet-300">
              {activeModelConfig?.type === 'cloud' ? '☁️ Nuvem' : '⚡ Local'}
            </span>
          </div>
        </section>

        <div className="mb-4 inline-flex rounded-md bg-[#181818] p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('cloud')}
            className={`flex h-8 items-center gap-1.5 rounded px-3.5 text-[11px] font-medium transition-colors ${
              activeTab === 'cloud'
                ? 'bg-violet-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cloud size={13} />
            Modelos em Nuvem (Gemini, ChatGPT, Claude, OpenRouter)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex h-8 items-center gap-1.5 rounded px-3.5 text-[11px] font-medium transition-colors ${
              activeTab === 'local'
                ? 'bg-violet-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HardDrive size={13} />
            Nesta Máquina (Local)
          </button>
        </div>

        {activeTab === 'cloud' ? (
          <div className="space-y-4">
            <p className="max-w-[700px] text-[11px] leading-5 text-zinc-400">
              Insira sua chave de API para habilitar modelos em nuvem. As chaves são salvas
              localmente no seu dispositivo.
            </p>

            <div className="space-y-3.5">
              <CustomServerCard activeModelConfig={activeModelConfig} onActivateModel={handleActivateCloudModel} />
              {CLOUD_PROVIDERS.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  value={cloudKeys[provider.id] || ''}
                  visible={Boolean(visibleKeys[provider.id])}
                  activeModelConfig={activeModelConfig}
                  onToggleVisible={toggleVisibleKey}
                  onSave={handleSaveCloudKey}
                  onChange={handleCloudKeyChange}
                  onActivateModel={handleActivateCloudModel}
                />
              ))}
            </div>

            {savedProvider && (
              <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400">
                <KeyRound size={13} />
                Chave salva para{' '}
                {CLOUD_PROVIDERS.find((provider) => provider.id === savedProvider)?.name}.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Local Engine Card */}
            <section className="rounded-lg border border-zinc-700/80 bg-[#181818] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Cpu size={13} className="text-violet-400" />
                    <h1 className="text-[13px] font-bold text-white">Motor local</h1>
                    <span className="truncate text-[11px] text-zinc-500">llama.cpp</span>
                  </div>
                  <p className="mt-2 max-w-[560px] text-[11px] leading-5 text-zinc-400">
                    Execução 100% offline em sua GPU/CPU.
                  </p>
                </div>
              </div>
            </section>

            <div className="space-y-2">
              {MODELS.map((model) => {
                const localFile = localModels.find((item) => item.filename === model.filename);
                const isActive =
                  activeModelConfig?.type === 'local' &&
                  localFile &&
                  status.activeModelPath === localFile.fullPath;
                const isLoading = localFile && loadingPath === localFile.fullPath;
                const downloadProgress = downloads[model.url];

                return (
                  <section
                    key={model.name}
                    className={`rounded-lg border bg-[#181818] p-3 transition-colors ${
                      isActive ? 'border-violet-500/80' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h2 className="text-[12px] font-bold text-white">{model.name}</h2>
                          {model.tags.map((tag) => (
                            <ModelTag key={tag}>{tag}</ModelTag>
                          ))}
                          {isActive && (
                            <span className="ml-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                              <Check size={11} />
                              ativo
                            </span>
                          )}
                        </div>
                        <p className="mt-2 truncate text-[11px] text-zinc-400">
                          {model.description}
                          <span className="ml-2 text-zinc-600">@</span>
                          <span className="ml-1 text-zinc-400">{model.size}</span>
                          <span className="mx-1 text-zinc-600">·</span>
                          <span>{model.ram}</span>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {downloadProgress ? (
                          <div className="w-28">
                            <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
                              <span>Baixando</span>
                              <span>{downloadProgress.progress}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-950">
                              <div
                                className="h-full rounded-full bg-violet-500 transition-all"
                                style={{ width: `${downloadProgress.progress}%` }}
                              />
                            </div>
                          </div>
                        ) : localFile ? (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(isLoading || isActive)}
                              onClick={() => handleLoadLocalModel(localFile.fullPath, model.name)}
                              className="flex h-7 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-[10px] font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-default disabled:bg-violet-500/40"
                            >
                              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                              {isActive ? 'Em uso' : 'Ativar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(localFile.fullPath)}
                              aria-label={`Excluir ${model.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDownload(model.url, model.filename)}
                            disabled={!isElectron}
                            className="flex h-7 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-[10px] font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download size={12} />
                            Baixar {model.size.replace('~', '')}
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}

              {importedModels.map((model) => {
                const isActive =
                  activeModelConfig?.type === 'local' &&
                  status.activeModelPath === model.fullPath;
                const isLoading = loadingPath === model.fullPath;
                const sizeLabel = model.sizeGB > 1 ? `${model.sizeGB} GB` : `${model.sizeMB} MB`;

                return (
                  <section
                    key={model.fullPath}
                    className={`rounded-lg border bg-[#181818] p-3 transition-colors ${
                      isActive ? 'border-violet-500/80' : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-[12px] font-bold text-white" title={model.filename}>
                            {model.filename}
                          </h2>
                          <ModelTag>Importado</ModelTag>
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                              <Check size={11} />
                              ativo
                            </span>
                          )}
                        </div>
                        <p className="mt-2 truncate text-[11px] text-zinc-400" title={model.fullPath}>
                          {model.fullPath}
                          <span className="ml-2 text-zinc-600">@</span>
                          <span className="ml-1 text-zinc-400">{sizeLabel}</span>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(isLoading || isActive)}
                          onClick={() => handleLoadLocalModel(model.fullPath, model.filename)}
                          className="flex h-7 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-[10px] font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-default disabled:bg-violet-500/40"
                        >
                          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                          {isActive ? 'Em uso' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(model.fullPath)}
                          aria-label={`Excluir ${model.filename}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}

              <button
                type="button"
                onClick={handleImport}
                disabled={!isElectron}
                className="mt-1 flex h-9 items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 text-[11px] font-semibold text-zinc-400 transition-colors hover:border-violet-500/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FolderOpen size={14} />
                Importar modelo .GGUF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
