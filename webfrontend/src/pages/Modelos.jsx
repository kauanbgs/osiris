import { useState, useEffect } from 'react';
import {
  Download,
  FolderOpen,
  Check,
  Trash2,
  Loader2,
  Play,
  Plus
} from 'lucide-react';

const MODELS = [
  // =========================================================
  // ULTRA LEVES
  // =========================================================
  {
    name: 'SmolLM2 1.7B Instruct',
    filename: 'SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf',
    size: '~1.1 GB',
    tag: 'Leve'
  },

  {
    name: 'Qwen 2.5 1.5B Instruct',
    filename: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    size: '~1.0 GB',
    tag: 'Leve / Geral'
  },

  // =========================================================
  // PROGRAMAÇÃO
  // =========================================================
  {
    name: 'Qwen 2.5 Coder 1.5B',
    filename: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    size: '~1.0 GB',
    tag: 'Programação'
  },

  {
    name: 'Qwen 2.5 Coder 3B',
    filename: 'Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    size: '~2.0 GB',
    tag: 'Programação'
  },

  {
    name: 'Qwen 2.5 Coder 7B',
    filename: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    size: '~4.7 GB',
    tag: 'Programação / Avançado'
  },

  // =========================================================
  // RACIOCÍNIO
  // =========================================================
  {
    name: 'DeepSeek R1 Distill Qwen 1.5B',
    filename: 'DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    size: '~1.1 GB',
    tag: 'Raciocínio'
  },

  {
    name: 'DeepSeek R1 Distill Qwen 7B',
    filename: 'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf',
    size: '~4.7 GB',
    tag: 'Raciocínio / Avançado'
  },

  // =========================================================
  // USO GERAL / CHAT
  // =========================================================
  {
    name: 'Qwen 2.5 3B Instruct',
    filename: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    size: '~2.0 GB',
    tag: 'Geral'
  },

  {
    name: 'Qwen 2.5 7B Instruct',
    filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Qwen2.5-7B-Instruct-GGUF/resolve/main/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
    size: '~4.7 GB',
    tag: 'Geral / Avançado'
  },

  // =========================================================
  // LLAMA
  // =========================================================
  {
    name: 'Llama 3.2 3B Instruct',
    filename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    size: '~2.0 GB',
    tag: 'Chat / Geral'
  },

  // =========================================================
  // MICROSOFT PHI
  // =========================================================
  {
    name: 'Phi 3.5 Mini Instruct',
    filename: 'Phi-3.5-mini-instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    size: '~2.4 GB',
    tag: 'Geral / Raciocínio'
  },

  // =========================================================
  // MISTRAL
  // =========================================================
  {
    name: 'Mistral 7B Instruct v0.3',
    filename: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',
    size: '~4.4 GB',
    tag: 'Chat / Geral'
  },

  {
    name: 'Mistral Nemo 12B Instruct',
    filename: 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Mistral-Nemo-Instruct-2407-GGUF/resolve/main/Mistral-Nemo-Instruct-2407-Q4_K_M.gguf',
    size: '~7.5 GB',
    tag: 'Avançado'
  }
];

export default function Modelos() {
  const [localModels, setLocalModels] = useState([]);
  const [status, setStatus] = useState({ isLoaded: false, activeModelName: null, activeModelPath: null });
  const [loadingPath, setLoadingPath] = useState(null);
  const [downloads, setDownloads] = useState({});

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
      console.error(err);
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

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[#141414] px-10 py-8 font-sans text-zinc-200 select-none">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Minimal Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-100">
              Modelos
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              {status.isLoaded
                ? `Ativo: ${status.activeModelName}`
                : 'Nenhum modelo ativo na memória'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleImport}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <FolderOpen size={14} />
            Importar GGUF
          </button>
        </header>

        {/* Minimal Models List */}
        <div className="divide-y divide-zinc-800/60 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
          {MODELS.map((model) => {
            const localFile = localModels.find((m) => m.filename === model.filename);
            const isActive = localFile && status.activeModelPath === localFile.fullPath;
            const isLoading = localFile && loadingPath === localFile.fullPath;
            const downloadProgress = downloads[model.url];

            return (
              <div
                key={model.name}
                className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-900/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-400 font-mono text-xs font-bold">
                    GGUF
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-zinc-100">
                        {model.name}
                      </span>
                      <span className="rounded bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                        {model.size}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {model.tag}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {downloadProgress ? (
                    <div className="flex items-center gap-2 font-mono text-xs text-violet-400">
                      <Loader2 size={13} className="animate-spin" />
                      <span>{downloadProgress.progress}%</span>
                    </div>
                  ) : isActive ? (
                    <span className="flex items-center gap-1 font-mono text-xs text-emerald-400 font-medium px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <Check size={13} />
                      Ativo
                    </span>
                  ) : localFile ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleLoadModel(localFile.fullPath)}
                        className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1 font-mono text-xs text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Ativar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(localFile.fullPath)}
                        className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDownload(model.url, model.filename)}
                      className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                      <Download size={13} />
                      Baixar
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Outros modelos locais importados */}
          {localModels
            .filter((m) => !MODELS.some((item) => item.filename === m.filename))
            .map((local) => {
              const isActive = status.activeModelPath === local.fullPath;
              const isLoading = loadingPath === local.fullPath;

              return (
                <div
                  key={local.fullPath}
                  className="flex items-center justify-between p-4 transition-colors hover:bg-zinc-900/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 text-zinc-400 font-mono text-xs font-bold">
                      GGUF
                    </div>
                    <div>
                      <span className="font-mono text-sm font-semibold text-zinc-100 truncate max-w-xs block">
                        {local.filename}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {local.sizeGB > 1 ? `${local.sizeGB} GB` : `${local.sizeMB} MB`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="flex items-center gap-1 font-mono text-xs text-emerald-400 font-medium px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <Check size={13} />
                        Ativo
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleLoadModel(local.fullPath)}
                        className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1 font-mono text-xs text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Ativar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(local.fullPath)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
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
