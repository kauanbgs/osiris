export function extractJson(text) {
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
        (file) => file.fileName === fileName,
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
        (file) => file.fileName === fileName,
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
        // Preserva o filePath original — o LLM não conhece o caminho real
        fileContent: content,
        fileSize: new Blob([content]).size,
        fileType:
          operation.fileType ??
          nextFiles[existingIndex].fileType ??
          "text/plain",
      };
    }

    if (action === "delete") {
      nextFiles = nextFiles.filter((file) => file.fileName !== fileName);
    }
  }

  return nextFiles;
}

/**
 * Aplica o resultado de um agente nos FileNodes de saída conectados.
 * Reutilizável tanto na execução isolada quanto na cadeia.
 */
export async function applyAgentResultToFileNodes({
  agentId,
  result,
  nodes,
  edges,
  updateNodeData,
  signal,
}) {
  const outgoingFileEdges = edges.filter(
    (edge) =>
      edge.source === agentId &&
      (edge.sourceHandle === "output" || edge.sourceHandle === "bottom"),
  );

  const outputFileNodes = outgoingFileEdges
    .map((edge) => nodes.find((node) => node.id === edge.target))
    .filter((node) => node && node.type === "file");

  if (outputFileNodes.length === 0) return null;

  const parsed = extractJson(result);

  if (!parsed || !Array.isArray(parsed.fileOperations)) return null;

  for (const fileNode of outputFileNodes) {
    signal?.throwIfAborted();
    const currentFiles = Array.isArray(fileNode.data?.files)
      ? fileNode.data.files
      : [];

    const nextFiles = applyFileOperations(currentFiles, parsed.fileOperations);

    // Atualiza o FileNode visualmente
    updateNodeData(fileNode.id, { files: nextFiles });

    // Escrever no arquivo real (Electron)
    for (const operation of parsed.fileOperations) {
      if (operation.action !== "update" && operation.action !== "create") {
        continue;
      }

      if (typeof operation.content !== "string") {
        console.error("Operação sem conteúdo:", operation);
        continue;
      }

      const originalFile = currentFiles.find(
        (f) => f.fileName === operation.fileName,
      );

      if (!originalFile) {
        console.warn(
          "[agentNode] Arquivo não encontrado em currentFiles:",
          operation.fileName,
        );
        continue;
      }

      if (!originalFile.filePath) {
        console.warn(
          "[agentNode] Arquivo sem filePath:",
          originalFile.fileName,
        );
        continue;
      }

      console.log("[agentNode] Escrevendo arquivo:", originalFile.filePath);

      signal?.throwIfAborted();
      try {
        await window.electronAPI.writeFile(
          originalFile.filePath,
          operation.content,
        );
        console.log(
          "[agentNode] Arquivo salvo com sucesso:",
          originalFile.filePath,
        );
      } catch (writeErr) {
        console.error("[agentNode] Erro ao salvar arquivo:", writeErr);
      }
    }
  }

  return parsed;
}

/**
 * Constrói a instrução final para um agente que tem FileNodes de saída,
 * instruindo o modelo a responder em JSON estruturado.
 */
export function buildFileEditInstruction(instruction, outputFileNodes, handoffRequest = "") {
  const outputFiles = outputFileNodes.flatMap((node) =>
    Array.isArray(node.data?.files) ? node.data.files : [],
  );

  const currentFilesText =
    outputFiles.length > 0
      ? outputFiles
          .map(
            (file) => `
ARQUIVO: ${file.fileName}

${file.fileContent ?? ""}
`,
          )
          .join("\n")
      : "Nenhum arquivo existe atualmente no FileNode de saída.";

  return `
Você é um agente que edita arquivos.

ARQUIVOS:
${currentFilesText}

PEDIDO:
${instruction}

Execute completamente o pedido no arquivo.

Responda SOMENTE neste JSON:
{
  "fileOperations": [
    {
      "action": "update",
      "fileName": "nome exato",
      "content": "arquivo completo"
    }
  ],
  "message": "resumo curto"${handoffRequest ? `,
  "handoff": "Tarefa: ...\\nUse: ...\\nPronto quando: ..."` : ""}
}
${handoffRequest ? `
PROXIMO AGENTE:
${handoffRequest}
` : ""}
REGRAS:
- action é sempre "update".
- Use exatamente o nome de um arquivo existente.
- content deve conter o arquivo COMPLETO e FINAL.
- Implemente tudo que o usuário pediu.
- Código deve ser real, funcional e executável.
- Nunca use pseudocódigo, TODO, placeholders ou comentários no lugar da implementação.
- Não omita partes do código.
- Não crie campos extras no JSON.
- Se não precisar editar: {"fileOperations":[],"message":"resposta"${handoffRequest ? ',"handoff":"..."' : ""}}
- Responda apenas JSON válido.`;
}

