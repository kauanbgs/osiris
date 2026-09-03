import { useState, useEffect, useMemo } from 'react';
import {
  Download,
  FolderOpen,
  Check,
  Trash2,
  Loader2,
  Play,
  Search,
  Cpu,
  Sparkles,
  Zap,
  Bot,
  Brain,
  Code2
} from 'lucide-react';

const MODELS = [
  // ULTRA LEVES
  {
    name: 'SmolLM2 1.7B Instruct',
    filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    size: '~1.1 GB',
    category: 'Leve',
    description: 'Modelo ultra rápido e eficiente para assistentes leves.'
  },
  {
    name: 'Qwen 2.5 1.5B Instruct',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    size: '~1.0 GB',
    category: 'Leve',
    description: 'Respostas rápidas e excelente conversação em diversos idiomas.'
  },

  // PROGRAMAÇÃO
  {
    name: 'Qwen 2.5 Coder 1.5B',
    filename: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    size: '~1.0 GB',
    category: 'Programação',
    description: 'Compacto e extremamente veloz para scripts e autocomplete.'
  },
  {
    name: 'Qwen 2.5 Coder 3B',
    filename: 'Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    size: '~2.0 GB',
    category: 'Programação',
    description: 'Excelente equilíbrio entre velocidade e qualidade em código.'
  },
  {
    name: 'Qwen 2.5 Coder 7B',
    filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    size: '~4.7 GB',
    category: 'Programação',
    description: 'Referência em geração de código completo e refatoração.'
  },

  // RACIOCÍNIO
  {
    name: 'DeepSeek R1 Distill Qwen 1.5B',
    filename: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    size: '~1.1 GB',
    category: 'Raciocínio',
    description: 'Raciocínio passo a passo com tag <think> ultra compacto.'
  },
  {
    name: 'DeepSeek R1 Distill Qwen 7B',
    filename: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    size: '~4.7 GB',
    category: 'Raciocínio',
    description: 'Capacidade analítica avançada e destilação de raciocínio profundo.'
  },

  // USO GERAL / CHAT
  {
    name: 'Qwen 2.5 3B Instruct',
    filename: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    size: '~2.0 GB',
    category: 'Geral',
    description: 'Modelo versátil para tarefas diárias, texto e análise.'
  },
  {
    name: 'Qwen 2.5 7B Instruct',
    filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    size: '~4.7 GB',
    category: 'Geral',
    description: 'Alta capacidade geral em conversação, escrita e lógica.'
  },
  {
    name: 'Llama 3.2 3B Instruct',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '~2.0 GB',
    category: 'Geral',
    description: 'Modelo mais recente de 3B da Meta com respostas fluidas.'
  },
  {
    name: 'Phi 3.5 Mini Instruct',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    size: '~2.4 GB',
    category: 'Geral',
    description: 'Excelente compreensão de instruções da Microsoft.'
  },
  {
    name: 'Mistral 7B Instruct v0.3',
    filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    size: '~4.4 GB',
    category: 'Geral',
    description: 'Tradicional modelo 7B da Mistral AI para chat e redação.'
  },
  {
    name: 'Mistral Nemo 12B Instruct',
    filename: 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    size: '~7.5 GB',
    category: 'Avançado',
    description: 'Modelo potente desenvolvido em parceria com a NVIDIA.'
  }
];

export default function Modelos() {
  const [localModels, setLocalModels] = useState([]);
  const [status, setStatus] = useState({ isLoaded: false, activeModelName: null, activeModelPath: null });
  const [loadingPath, setLoadingPath] = useState(null);
  const [downloads, setDownloads] = useState({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const isElectron = typeof window !== 'undefined' && Boolean(window.llama);

  const refreshData = async () => {
    if (!isElectron) return;
    try {
      const [currentStatus, modelsList] = await Promise.all([
        window.llama.getStatus(),
        window.llama.listLocalModels()
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

  const handleLoadModel = async (modelPath) => {
    if (!isElectron) return;
    setLoadingPath(modelPath);
    try {
      await window.llama.loadModel(modelPath);
      await refreshData();
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
        await handleLoadModel(imported.fullPath);
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

  const categories = ['Todos', 'Baixados', 'Programação', 'Raciocínio', 'Leve', 'Geral'];

  const filteredModels = useMemo(() => {
    return MODELS.filter((model) => {
      const isDownloaded = localModels.some((m) => m.filename === model.filename);
      const matchesSearch =
        model.name.toLowerCase().includes(search.toLowerCase()) ||
        model.category.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedCategory === 'Baixados') return isDownloaded;
      if (selectedCategory !== 'Todos') return model.category.includes(selectedCategory);

      return true;
    });
  }, [search, selectedCategory, localModels]);

  const customImportedModels = useMemo(() => {
    return localModels.filter((m) => !MODELS.some((item) => item.filename === m.filename));
  }, [localModels]);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#141414] px-8 py-8 font-sans text-zinc-100 select-none scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-12">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <Cpu className="size-6 text-violet-400" />
              <h1 className="font-mono text-xl font-bold tracking-tight text-white">
                Modelos GGUF
              </h1>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400 font-sans">
              Gerencie e ative modelos LLM locais executados via Llama.cpp.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleImport}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 font-mono text-xs font-semibold text-white shadow-md shadow-violet-600/20 transition-all hover:bg-violet-500"
            >
              <FolderOpen size={15} />
              Importar .GGUF
            </button>
          </div>
        </header>

        {/* Active Model Status Hero Card */}
        <section className="relative overflow-hidden rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-purple-950/20 p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${status.isLoaded ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-800/60 text-zinc-500'}`}>
                <Bot size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status.isLoaded ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                  <span className="font-mono text-[11px] font-medium text-zinc-400">
                    {status.isLoaded ? 'MODELO ATIVO NA MEMÓRIA' : 'NENHUM MODELO ATIVO'}
                  </span>
                </div>
                <h2 className="mt-0.5 font-mono text-base font-bold text-white">
                  {status.activeModelName || 'Selecione ou baixe um modelo abaixo para iniciar'}
                </h2>
              </div>
            </div>

            {status.isLoaded && (
              <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-400">
                <Check size={13} />
                Pronto
              </span>
            )}
          </div>
        </section>

        {/* Controls: Search & Category Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors ${isSelected ? 'bg-violet-600 text-white shadow-sm' : 'bg-zinc-900/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800/60'}`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-8 pr-3 py-1.5 font-mono text-xs text-zinc-200 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Models Grid */}
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {filteredModels.map((model) => {
            const localFile = localModels.find((m) => m.filename === model.filename);
            const isActive = localFile && status.activeModelPath === localFile.fullPath;
            const isLoading = localFile && loadingPath === localFile.fullPath;
            const downloadProgress = downloads[model.url];

            return (
              <div
                key={model.name}
                className={`group flex flex-col justify-between rounded-xl border p-4.5 transition-all duration-200 ${isActive ? 'border-violet-500/80 bg-violet-950/20 shadow-md shadow-violet-500/10' : 'border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900/80'}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-mono text-sm font-bold text-white">
                        {model.name}
                      </h3>
                      <span className="mt-1 inline-block rounded bg-zinc-800/80 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-400">
                        {model.category}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-zinc-400">
                      {model.size}
                    </span>
                  </div>

                  <p className="mt-2.5 font-sans text-xs text-zinc-400 leading-relaxed">
                    {model.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-zinc-800/60 pt-3">
                  {downloadProgress ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between font-mono text-[11px] text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <Loader2 size={12} className="animate-spin text-violet-400" />
                          Baixando... {downloadProgress.progress}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-950">
                        <div
                          className="h-full bg-gradient-to-r from-violet-600 to-purple-500 transition-all duration-300"
                          style={{ width: `${downloadProgress.progress}%` }}
                        />
                      </div>
                    </div>
                  ) : isActive ? (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-400">
                        <Check size={14} />
                        Modelo Ativo
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(localFile.fullPath)}
                        className="rounded p-1 text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="Excluir arquivo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : localFile ? (
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleLoadModel(localFile.fullPath)}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 font-mono text-xs font-semibold text-white shadow-sm transition-colors hover:bg-violet-500 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                        Ativar Modelo
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(localFile.fullPath)}
                        className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                        title="Excluir modelo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDownload(model.url, model.filename)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/90 py-2 font-mono text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                    >
                      <Download size={14} />
                      Baixar Modelo ({model.size})
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Outros modelos customizados importados */}
          {customImportedModels.map((local) => {
            const isActive = status.activeModelPath === local.fullPath;
            const isLoading = loadingPath === local.fullPath;

            return (
              <div
                key={local.fullPath}
                className={`flex flex-col justify-between rounded-xl border p-4.5 transition-all ${isActive ? 'border-violet-500/80 bg-violet-950/20' : 'border-zinc-800/80 bg-zinc-900/50'}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-mono text-sm font-bold text-white truncate max-w-xs" title={local.filename}>
                      {local.filename}
                    </h3>
                    <span className="font-mono text-xs text-zinc-400">
                      {local.sizeGB > 1 ? `${local.sizeGB} GB` : `${local.sizeMB} MB`}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500 truncate" title={local.fullPath}>
                    {local.fullPath}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3">
                  {isActive ? (
                    <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-400">
                      <Check size={14} />
                      Ativo no Momento
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleLoadModel(local.fullPath)}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                      Ativar Modelo
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(local.fullPath)}
                    className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-red-500/20 hover:text-red-400"
                    title="Excluir modelo"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
