import {
  Handle,
  Position,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import {
  Bot,
  GripVertical,
  Loader2,
  Play,
  Square,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { executeAgentNode } from "@/workflow/executeAgentNode";

const MODELS = [
  {
    value: "qwen2.5-coder:7b",
    label: "Qwen 2.5 Coder 7B",
  },
  {
    value: "qwen2.5:7b",
    label: "Qwen 2.5 7B",
  },
  {
    value: "llama3.2:3b",
    label: "Llama 3.2 3B",
  },
  {
    value: "mistral:7b",
    label: "Mistral 7B",
  },
];

function extractJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // tenta pegar JSON mesmo se o modelo mandar ```json ... ```
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // tenta localizar o objeto JSON dentro de texto extra
  }

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function applyFileOperations(files, operations) {
  let nextFiles = [...files];

  for (const operation of operations) {
    const action = operation?.action;
    const fileName = operation?.fileName;

    if (!action || !fileName) {
      continue;
    }

    if (action === "create") {
      const content = operation.content ?? "";

      const existingIndex = nextFiles.findIndex(
        (file) => file.fileName === fileName
      );

      const newFile = {
        fileName,
        fileContent: content,
        fileType: operation.fileType ?? "text/plain",
        fileSize: new Blob([content]).size,
        filePath: operation.filePath ?? null,
      };

      if (existingIndex !== -1) {
        nextFiles[existingIndex] = {
          ...nextFiles[existingIndex],
          ...newFile,
        };
      } else {
        nextFiles.push(newFile);
      }
    }

    if (action === "update") {
      const existingIndex = nextFiles.findIndex(
        (file) => file.fileName === fileName
      );

      const content = operation.content ?? "";

      // Se não existir, cria automaticamente
      if (existingIndex === -1) {
        nextFiles.push({
          fileName,
          fileContent: content,
          fileType: operation.fileType ?? "text/plain",
          fileSize: new Blob([content]).size,
          filePath: operation.filePath ?? null,
        });

        continue;
      }

      nextFiles[existingIndex] = {
        ...nextFiles[existingIndex],
        fileContent: content,
        fileSize: new Blob([content]).size,
        fileType:
          operation.fileType ??
          nextFiles[existingIndex].fileType ??
          "text/plain",
      };
    }

    if (action === "delete") {
      nextFiles = nextFiles.filter(
        (file) => file.fileName !== fileName
      );
    }
  }

  return nextFiles;
}

export default function AgentNode({ id, data }) {
  const {
    updateNodeData,
    getNodes,
    getEdges,
  } = useReactFlow();

  const handleClass =
    "!h-2.5 !w-2.5 !border-2 !border-[#151515] !bg-violet-500 hover:!bg-violet-400 transition-colors";

  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const abortRef = useRef(null);

  const model =
    data?.model ?? MODELS[0].value;

  const hasFileInput = useStore((state) => {
    return state.edges.some(
      (edge) =>
        edge.target === id &&
        edge.targetHandle === "files"
    );
  });

  const hasFileOutput = useStore((state) => {
    const outgoingEdges = state.edges.filter(
      (edge) =>
        edge.source === id &&
        (
          edge.sourceHandle === "output" ||
          edge.sourceHandle === "bottom"
        )
    );

    return outgoingEdges.some((edge) => {
      const targetNode = state.nodes.find(
        (node) => node.id === edge.target
      );

      return targetNode?.type === "file";
    });
  });

  function handlePromptChange(event) {
    updateNodeData(id, {
      prompt: event.target.value,
    });
  }

  function handleModelChange(event) {
    updateNodeData(id, {
      model: event.target.value,
    });
  }

  const handleRun = useCallback(async () => {
    if (status === "running") {
      abortRef.current?.abort();
      return;
    }

    const instruction =
      data?.prompt ?? "";

    const selectedModel =
      data?.model ?? MODELS[0].value;

    setStatus("running");
    setOutput("");
    setError("");

    const controller =
      new AbortController();

    abortRef.current = controller;

    try {
      const nodes = getNodes();
      const edges = getEdges();

      const outgoingFileEdges = edges.filter(
        (edge) =>
          edge.source === id &&
          (
            edge.sourceHandle === "output" ||
            edge.sourceHandle === "bottom"
          )
      );

      const outputFileNodes =
        outgoingFileEdges
          .map((edge) =>
            nodes.find(
              (node) =>
                node.id === edge.target
            )
          )
          .filter(
            (node) =>
              node &&
              node.type === "file"
          );

      let finalInstruction =
        instruction;

      // Se há FileNode depois do agente,
      // instruímos o modelo a responder de forma estruturada
      if (outputFileNodes.length > 0) {
        const outputFiles =
          outputFileNodes.flatMap(
            (node) =>
              Array.isArray(
                node.data?.files
              )
                ? node.data.files
                : []
          );

        const currentFilesText =
          outputFiles.length > 0
            ? outputFiles
                .map(
                  (file) => `
ARQUIVO: ${file.fileName}

${file.fileContent ?? ""}
`
                )
                .join("\n")
            : "Nenhum arquivo existe atualmente no FileNode de saída.";

        finalInstruction = `
${instruction}

Você pode modificar arquivos que estão conectados na saída deste agente.

ARQUIVOS ATUAIS DO FILE NODE DE SAÍDA:

${currentFilesText}

Quando a tarefa exigir criar, alterar ou excluir arquivos,
responda SOMENTE com JSON válido.

Formato obrigatório:

{
  "fileOperations": [
    {
      "action": "update",
      "fileName": "src/App.jsx",
      "content": "conteúdo completo do arquivo"
    }
  ],
  "message": "Resumo opcional do que foi feito"
}

Ações permitidas:

- "create": cria um arquivo novo
- "update": atualiza um arquivo existente
- "delete": exclui um arquivo

REGRAS IMPORTANTES:

1. Para "create" e "update", envie o conteúdo COMPLETO do arquivo.
2. Nunca envie somente trechos ou diffs.
3. Não use markdown.
4. Não use blocos com crases.
5. Não escreva texto fora do JSON.
6. Se não precisar alterar arquivos, use:
{
  "fileOperations": [],
  "message": "sua resposta"
}
`;
      }

      const result =
        await executeAgentNode({
          agentId: id,
          nodes,
          edges,
          instruction:
            finalInstruction,
          model: selectedModel,
          signal: controller.signal,

          onChunk: (text) => {
            setOutput(text);
          },
        });

      updateNodeData(id, {
        output: result,
      });

      // ========================================
      // ALTERAR FILENODES CONECTADOS NA SAÍDA
      // ========================================

      if (outputFileNodes.length > 0) {
        const parsed =
          extractJson(result);

        if (
          parsed &&
          Array.isArray(
            parsed.fileOperations
          )
        ) {
          for (const fileNode of outputFileNodes) {
            const currentFiles =
              Array.isArray(
                fileNode.data?.files
              )
                ? fileNode.data.files
                : [];

            const nextFiles =
              applyFileOperations(
                currentFiles,
                parsed.fileOperations
              );

            updateNodeData(
              fileNode.id,
              {
                files: nextFiles,
              }
            );
          }

          if (parsed.message) {
            setOutput(parsed.message);
          } else {
            const total =
              parsed.fileOperations.length;

            setOutput(
              total > 0
                ? `${total} operação${
                    total !== 1 ? "ões" : ""
                  } de arquivo aplicada${
                    total !== 1 ? "s" : ""
                  }.`
                : "Nenhum arquivo foi alterado."
            );
          }
        } else {
          setOutput(result);
        }
      }

      setStatus("idle");
    } catch (err) {
      if (
        err?.name === "AbortError"
      ) {
        setStatus("idle");
        return;
      }

      setError(
        err?.message ||
          "Erro desconhecido."
      );

      setStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, [
    id,
    data?.prompt,
    data?.model,
    status,
    getNodes,
    getEdges,
    updateNodeData,
  ]);

  return (
    <div className="group relative w-[520px] overflow-hidden rounded-2xl border border-zinc-800 bg-[#151515] shadow-[0_12px_40px_rgba(0,0,0,0.28)] transition hover:border-zinc-700">
      {/* FileNode -> Agent */}
      <Handle
        id="files"
        type="target"
        position={Position.Left}
        className={handleClass}
        style={{
          top: "40%",
        }}
        title="Arquivos de entrada"
      />

      {/* Agent -> FileNode */}
      <Handle
        id="output"
        type="source"
        position={Position.Right}
        className={handleClass}
        style={{
          top: "40%",
        }}
        title="Output / edição de arquivos"
      />

      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className={handleClass}
      />

      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className={handleClass}
      />

      {/* Header */}
      <div className="drag-handle flex h-11 cursor-grab items-center justify-between px-4 select-none active:cursor-grabbing">
        <div className="flex items-center gap-2.5">
          <Bot
            size={14}
            className="text-zinc-500"
          />

          <span className="text-[12px] font-medium text-zinc-200">
            {data?.label ||
              "Agent"}
          </span>

          {hasFileInput && (
            <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
              lendo arquivos
            </span>
          )}

          {hasFileOutput && (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
              pode editar arquivos
            </span>
          )}

          {status === "idle" &&
            !hasFileInput &&
            !hasFileOutput && (
              <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                online
              </div>
            )}

          {status ===
            "running" && (
            <div className="flex items-center gap-1.5 text-[9px] text-amber-400">
              <Loader2
                size={9}
                className="animate-spin"
              />
              executando...
            </div>
          )}

          {status === "error" && (
            <div className="flex items-center gap-1.5 text-[9px] text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              erro
            </div>
          )}
        </div>

        <GripVertical
          size={13}
          className="text-zinc-700 transition group-hover:text-zinc-500"
        />
      </div>

      <div className="h-px bg-zinc-800/80" />

      {/* Prompt */}
      <div className="px-4 py-3">
        <textarea
          rows={3}
          value={
            data?.prompt ?? ""
          }
          onChange={
            handlePromptChange
          }
          placeholder="Descreva o que este agente deve fazer..."
          className="nodrag nopan nowheel block w-full resize-none bg-transparent text-[13px] leading-5 text-zinc-200 outline-none placeholder:text-zinc-600"
        />
      </div>

      {/* Erro */}
      {status === "error" &&
        error && (
          <>
            <div className="h-px bg-zinc-800/80" />

            <div className="nodrag nopan nowheel flex items-start gap-2 px-4 py-3">
              <span className="mt-0.5 shrink-0 text-[10px] text-red-400">
                ⚠
              </span>

              <p className="text-[11px] leading-relaxed text-red-400">
                {error}
              </p>

              <button
                type="button"
                onClick={() => {
                  setStatus(
                    "idle"
                  );
                  setError("");
                }}
                className="ml-auto shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300"
              >
                <X size={11} />
              </button>
            </div>
          </>
        )}

      {/* Output */}
      {(output ||
        status ===
          "running") && (
        <>
          <div className="h-px bg-zinc-800/80" />

          <div className="nodrag nopan nowheel max-h-[320px] overflow-y-auto px-4 py-3">
            {output ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                {output}
              </pre>
            ) : (
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <Loader2
                  size={11}
                  className="animate-spin text-violet-400"
                />

                Aguardando
                resposta...
              </div>
            )}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <div className="nodrag nopan flex items-center gap-2">
          <span className="text-[9px] text-zinc-600">
            modelo
          </span>

          <select
            value={model}
            onChange={
              handleModelChange
            }
            disabled={
              status ===
              "running"
            }
            className="nowheel cursor-pointer rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 outline-none transition hover:border-zinc-700 focus:border-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {MODELS.map(
              (item) => (
                <option
                  key={
                    item.value
                  }
                  value={
                    item.value
                  }
                >
                  {item.label}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={handleRun}
          title={
            status ===
            "running"
              ? "Parar execução"
              : "Executar agente"
          }
          className={`nodrag flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
            status ===
            "running"
              ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
              : "bg-violet-500/15 text-violet-300 hover:bg-violet-500/25"
          }`}
        >
          {status ===
          "running" ? (
            <>
              <Square
                size={10}
              />
              Parar
            </>
          ) : (
            <>
              <Play
                size={10}
              />
              Run
            </>
          )}
        </button>
      </div>
    </div>
  );
}