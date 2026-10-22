import { getAgentFileNodes } from "./getConnectedFiles.js";

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

function preview(text) {
  const line = text.trim().split("\n")[0];
  return line.length > 60 ? line.slice(0, 60) + "..." : line;
}

/**
 * Aplica trechos find/replace em sequência. Cada "find" precisa aparecer
 * exatamente uma vez; senão nada do arquivo é alterado.
 */
export function applyEdits(content, edits) {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  let next = content;

  for (const edit of edits) {
    if (typeof edit?.find !== "string" || !edit.find) {
      throw new Error("edicao sem o trecho \"find\"");
    }

    // O modelo escreve "\n"; o arquivo pode usar CRLF.
    let find = edit.find.replace(/\r?\n/g, eol);
    const replace = String(edit.replace ?? "").replace(/\r?\n/g, eol);
    if (!next.includes(find) && next.includes(find.trim())) find = find.trim();

    const index = next.indexOf(find);
    if (index === -1) {
      throw new Error(`trecho nao encontrado: "${preview(edit.find)}"`);
    }
    if (next.indexOf(find, index + 1) !== -1) {
      throw new Error(`trecho aparece mais de uma vez: "${preview(edit.find)}"`);
    }

    next = next.slice(0, index) + replace + next.slice(index + find.length);
  }

  return next;
}

export function applyFileOperations(files, operations, errors = []) {
  let nextFiles = [...files];

  for (const operation of operations) {
    const action = operation?.action;
    const fileName = operation?.fileName;

    if (!action || !fileName) {
      continue;
    }

    if (action === "edit") {
      const existingIndex = nextFiles.findIndex(
        (file) => file.fileName === fileName,
      );

      // Outro FileNode de saida pode ter o arquivo; a falta e conferida no fim.
      if (existingIndex === -1) continue;

      try {
        const content = applyEdits(
          nextFiles[existingIndex].fileContent ?? "",
          Array.isArray(operation.edits) ? operation.edits : [],
        );

        nextFiles[existingIndex] = {
          ...nextFiles[existingIndex],
          fileContent: content,
          fileSize: new Blob([content]).size,
        };
      } catch (err) {
        errors.push(`${fileName}: ${err.message}`);
      }
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
  const outputFileNodes = getAgentFileNodes(agentId, nodes, edges).outputs;

  if (outputFileNodes.length === 0) return null;

  const parsed = extractJson(result);

  if (!parsed || !Array.isArray(parsed.fileOperations)) return null;

  const errors = [];

  for (const fileNode of outputFileNodes) {
    signal?.throwIfAborted();
    const currentFiles = Array.isArray(fileNode.data?.files)
      ? fileNode.data.files
      : [];

    const nextFiles = applyFileOperations(currentFiles, parsed.fileOperations, errors);

    // Atualiza o FileNode visualmente
    updateNodeData(fileNode.id, { files: nextFiles });

    // Escrever no arquivo real (Electron) apenas o que mudou de fato
    for (const originalFile of currentFiles) {
      const nextFile = nextFiles.find((f) => f.fileName === originalFile.fileName);
      if (!nextFile || nextFile.fileContent === originalFile.fileContent) continue;

      if (!originalFile.filePath) {
        console.warn("[agentNode] Arquivo sem filePath:", originalFile.fileName);
        continue;
      }

      signal?.throwIfAborted();
      try {
        await window.electronAPI.writeFile(originalFile.filePath, nextFile.fileContent);
        console.log("[agentNode] Arquivo salvo com sucesso:", originalFile.filePath);
      } catch (writeErr) {
        console.error("[agentNode] Erro ao salvar arquivo:", writeErr);
        errors.push(`${originalFile.fileName}: falha ao salvar no disco`);
      }
    }
  }

  const knownNames = new Set(outputFileNodes.flatMap((node) => (node.data?.files || []).map((file) => file.fileName)));
  for (const operation of parsed.fileOperations) {
    if (operation?.action === "edit" && !knownNames.has(operation.fileName)) {
      errors.push(`${operation.fileName}: arquivo nao existe no FileNode de saida`);
    }
  }

  return { ...parsed, errors: [...new Set(errors)] };
}

/**
 * Monta o pedido para um agente com FileNodes de saida. Retorna a instrucao
 * (pedido do usuario + formato) e o bloco com os arquivos editaveis, que vai
 * para o contexto. Arquivos ja presentes em `contextFiles` (entrada do agente)
 * nao sao repetidos.
 *
 * @returns {{ instruction: string, fileContext: string }}
 */
export function buildFileEditInstruction(instruction, outputFileNodes, handoffRequest = "", contextFiles = []) {
  const outputFiles = outputFileNodes.flatMap((node) =>
    Array.isArray(node.data?.files) ? node.data.files : [],
  );
  const key = (file) => file.filePath || file.fileName;
  const inContext = new Set(contextFiles.map(key));
  const missing = outputFiles.filter((file) => !inContext.has(key(file)));

  const fileContext = outputFiles.length === 0
    ? "ARQUIVOS EDITAVEIS: nenhum arquivo existe no FileNode de saida."
    : "ARQUIVOS EDITAVEIS: " + outputFiles.map((file) => file.fileName).join(", ") +
      (missing.length
        ? "\n\n" + missing.map((file) => `### Arquivo: ${file.fileName}\n\n${file.fileContent || "(arquivo vazio)"}`).join("\n\n---\n\n")
        : " (conteudo atual acima, em ARQUIVOS / CONTEXTO)");

  const request = instruction.trim() || "(este agente nao tem pedido proprio: siga a TAREFA ENCAMINHADA acima)";
  const handoffField = handoffRequest ? `,
  "handoff": "Tarefa: ...\\nUse: ...\\nPronto quando: ..."` : "";

  return {
    fileContext,
    instruction: `PEDIDO DO USUARIO (prioridade maxima):
${request}

Faca exatamente o que o pedido diz, e nada alem disso.

FORMATO DA RESPOSTA - responda apenas com este JSON:
{
  "fileOperations": [
    {
      "action": "edit",
      "fileName": "nome exato do arquivo",
      "edits": [
        { "find": "trecho copiado exatamente do arquivo atual", "replace": "trecho novo" }
      ]
    }
  ],
  "message": "o que voce fez, ou a resposta ao pedido"${handoffField}
}
${handoffRequest ? `
PROXIMO AGENTE:
${handoffRequest}
` : ""}
REGRAS:
- Altere somente o que o pedido exige. Nao reformate, renomeie, reorganize nem "melhore" o resto do arquivo.
- "edit": cada "find" e um trecho do arquivo atual, copiado caractere por caractere, que aparece uma unica vez. Use trechos curtos, com as linhas necessarias para serem unicos.
- Para apagar um trecho, use "replace": "".
- Use {"action": "update", "fileName": "...", "content": "arquivo completo"} somente se o arquivo estiver vazio ou se o pedido for reescreve-lo inteiro.
- Se o pedido nao exige mudar arquivos (pergunta, explicacao, analise, revisao), responda com "fileOperations": [] e coloque a resposta em "message".
- Codigo novo deve ser real e funcional, sem placeholders nem TODO.

LEMBRETE DO PEDIDO: ${request}`,
  };
}
