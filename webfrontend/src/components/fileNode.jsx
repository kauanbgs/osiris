import { Handle, Position, useReactFlow } from "@xyflow/react";
import { FileText, GripVertical, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

export default function FileNode({ id, data }) {
  const { updateNodeData } = useReactFlow();

  const handleClass =
    "!h-2.5 !w-2.5 !border-2 !border-[#151515] !bg-violet-500 hover:!bg-violet-400 transition-colors";

  const inputRef = useRef(null);
  const [draggingOver, setDraggingOver] = useState(false);

  // A fonte de verdade é data.files (serializável, vive no grafo do ReactFlow)
  const files = Array.isArray(data?.files) ? data.files : [];

  async function addFiles(fileList) {
    const selectedFiles = Array.from(fileList || []);
    if (selectedFiles.length === 0) return;

    const parsedFiles = await Promise.all(
      selectedFiles.map(async (file) => {
        let fileContent = "";
        try {
          fileContent = await file.text();
        } catch {
          fileContent = "Não foi possível ler o conteúdo deste arquivo.";
        }

        return {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          // file.path é exposto pelo Electron no renderer process
          // Em ambiente web puro, será undefined (sem escrita em disco)
          filePath: file.path ?? null,
          fileContent,
        };
      })
    );

    updateNodeData(id, {
      files: [...files, ...parsedFiles],
    });
  }

  async function handleFileChange(e) {
    await addFiles(e.target.files);
    // Resetar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = "";
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDraggingOver(false);
    await addFiles(e.dataTransfer.files);
  }

  function removeFile(index) {
    updateNodeData(id, {
      files: files.filter((_, i) => i !== index),
    });
  }

  function formatSize(bytes) {
    if (!bytes || bytes < 1024) return `${bytes ?? 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="group relative w-[360px] overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition hover:border-zinc-700">
      {/* Handle semântico de saída de arquivos */}
      <Handle
        id="files"
        type="source"
        position={Position.Right}
        className={handleClass}
        style={{ top: "50%" }}
      />

      {/* Handle genérico de entrada (para receber dados futuramente) */}
      <Handle
        id="input"
        type="target"
        position={Position.Left}
        className={handleClass}
        style={{ top: "50%" }}
      />

      {/* Header */}
      <div className="drag-handle flex h-11 cursor-grab items-center justify-between px-4 select-none active:cursor-grabbing">
        <div className="flex items-center gap-2.5">
          <FileText size={14} className="text-zinc-500" />

          <span className="text-[12px] font-medium text-zinc-200">
            {data?.label || "Arquivos"}
          </span>

          {files.length > 0 && (
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
              {files.length}
            </span>
          )}
        </div>

        <GripVertical
          size={13}
          className="text-zinc-700 transition group-hover:text-zinc-500"
        />
      </div>

      <div className="h-px bg-zinc-800/80" />

      {/* Drop Zone */}
      <div className="px-4 py-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingOver(true);
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`nodrag nopan nowheel flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed py-5 transition-colors ${
            draggingOver
              ? "border-violet-500/60 bg-violet-500/5"
              : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
          }`}
        >
          <Upload
            size={18}
            className={`transition-colors ${
              draggingOver ? "text-violet-400" : "text-zinc-600"
            }`}
          />

          <span className="text-[11px] text-zinc-500">
            {draggingOver ? "Solte aqui" : "Clique ou arraste arquivos"}
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Lista de arquivos + conteúdo */}
      {files.length > 0 && (
        <>
          <div className="h-px bg-zinc-800/80" />

          <div className="nodrag nopan nowheel max-h-[400px] overflow-y-auto px-4 py-3">
            {files.map((item, i) => (
              <div
                key={`${item.fileName}-${i}`}
                className="mb-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40 last:mb-0"
              >
                {/* Nome + tamanho + remover */}
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText size={12} className="shrink-0 text-zinc-500" />
                    <span className="truncate text-[11px] text-zinc-300">
                      {item.fileName}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-zinc-600">
                      {formatSize(item.fileSize)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(i);
                      }}
                      className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-red-400"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>

                {/* Conteúdo do arquivo */}
                <div className="border-t border-zinc-800">
                  <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words px-3 py-3 font-mono text-[10px] leading-relaxed text-zinc-400">
                    {item.fileContent || "Arquivo vazio"}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-1 text-[9px] text-zinc-600">
        <span>
          {files.length} arquivo{files.length !== 1 ? "s" : ""}
        </span>

        <span className="text-zinc-800">•</span>

        <span className="text-violet-500/60">files →</span>
      </div>
    </div>
  );
}
