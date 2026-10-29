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

/**
 * Normaliza um caminho relativo vindo do modelo. Rejeita caminhos absolutos,
 * "..", unidades de disco e vazios: o agente so enxerga a pasta do projeto.
 */
export function normalizeRelPath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("caminho vazio");
  const clean = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
  if (clean.includes("\0")) throw new Error(`caminho invalido: "${value}"`);
  if (clean.startsWith("/") || /^[a-zA-Z]:/.test(clean)) throw new Error(`use caminho relativo a pasta do projeto, nao absoluto: "${value}"`);
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "..")) throw new Error(`caminho fora da pasta do projeto: "${value}"`);
  return parts.join("/");
}

// Nome exato; se o modelo citou so o nome base ("app.js" para "src/app.js"),
// aceita quando ha exatamente um arquivo com esse final.
function findFileIndex(files, name) {
  const exact = files.findIndex((file) => file.fileName === name);
  if (exact !== -1 || name.includes("/")) return exact;
  const matches = files.map((file, index) => ({ file, index })).filter(({ file }) => file.fileName.endsWith("/" + name));
  return matches.length === 1 ? matches[0].index : -1;
}

function fileFrom(name, operation, previous = {}) {
  const content = operation.content ?? "";
  return {
    ...previous,
    fileName: previous.fileName ?? name,
    fileContent: content,
    fileType: operation.fileType ?? previous.fileType ?? "text/plain",
    fileSize: new Blob([content]).size,
    // O caminho em disco nunca vem do modelo: so de um arquivo ja conhecido
    // ou da pasta do projeto, resolvido na hora de gravar.
    filePath: previous.filePath ?? null,
  };
}

export function applyFileOperations(files, operations, errors = []) {
  let nextFiles = [...files];

  for (const operation of operations) {
    const action = operation?.action;
    if (!action || !operation?.fileName || action === "mkdir") continue;

    let name;
    try {
      name = normalizeRelPath(operation.fileName);
    } catch (err) {
      errors.push(`${operation.fileName}: ${err.message}`);
      continue;
    }
    const index = findFileIndex(nextFiles, name);

    if (action === "edit") {
      // Outro FileNode de saida pode ter o arquivo; a falta e conferida no fim.
      if (index === -1) continue;
      try {
        const content = applyEdits(
          nextFiles[index].fileContent ?? "",
          Array.isArray(operation.edits) ? operation.edits : [],
        );
        nextFiles[index] = { ...nextFiles[index], fileContent: content, fileSize: new Blob([content]).size };
      } catch (err) {
        errors.push(`${nextFiles[index].fileName}: ${err.message}`);
      }
    } else if (action === "create" || action === "update") {
      // Criar em cima de um arquivo existente o sobrescreve; "update" de um
      // arquivo inexistente o cria.
      if (index === -1) nextFiles.push(fileFrom(name, operation));
      else nextFiles[index] = fileFrom(name, operation, nextFiles[index]);
    } else if (action === "delete") {
      if (index !== -1) nextFiles = nextFiles.filter((_, i) => i !== index);
    } else {
      errors.push(`${name}: acao desconhecida "${action}"`);
    }
  }

  return nextFiles;
}

function parentFolders(relPath) {
  const parts = relPath.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/**
 * Aplica o resultado de um agente nos FileNodes de saida conectados e grava
 * no disco. Com uma pasta de projeto (`data.rootPath`) o agente cria, edita e
 * apaga arquivos e cria pastas, sempre dentro dela. Reutilizavel tanto na
 * execucao isolada quanto na cadeia.
 */
export async function applyAgentResultToFileNodes({
  agentId,
  result,
  nodes,
  edges,
  updateNodeData,
  signal,
  fsApi = typeof window === "undefined" ? undefined : window.electronAPI,
}) {
  const outputFileNodes = getAgentFileNodes(agentId, nodes, edges).outputs;

  if (outputFileNodes.length === 0) return null;

  const parsed = extractJson(result);

  if (!parsed || !Array.isArray(parsed.fileOperations)) return null;

  const errors = [];
  const warnings = [];
  const written = [];
  const filesOf = (node) => (Array.isArray(node.data?.files) ? node.data.files : []);

  // Cada operacao vai para o FileNode que ja tem o arquivo; o que e novo vai
  // para o primeiro FileNode com pasta de projeto (ou o primeiro de saida).
  const homeForNew = outputFileNodes.find((node) => node.data?.rootPath) || outputFileNodes[0];
  const opsByNode = new Map(outputFileNodes.map((node) => [node.id, []]));
  const foldersByNode = new Map(outputFileNodes.map((node) => [node.id, []]));
  for (const operation of parsed.fileOperations) {
    if (!operation?.action || !operation?.fileName) continue;
    let name;
    try {
      name = normalizeRelPath(operation.fileName);
    } catch (err) {
      errors.push(`${operation.fileName}: ${err.message}`);
      continue;
    }
    if (operation.action === "mkdir") {
      foldersByNode.get(homeForNew.id).push(name);
      continue;
    }
    const owner = outputFileNodes.find((node) => findFileIndex(filesOf(node), name) !== -1);
    if (owner) opsByNode.get(owner.id).push(operation);
    else if (operation.action === "edit") errors.push(`${name}: arquivo nao existe no FileNode de saida`);
    else if (operation.action !== "delete") opsByNode.get(homeForNew.id).push(operation);
  }

  for (const fileNode of outputFileNodes) {
    signal?.throwIfAborted();
    const currentFiles = filesOf(fileNode);
    const operations = opsByNode.get(fileNode.id);
    const newFolders = foldersByNode.get(fileNode.id);
    if (!operations.length && !newFolders.length) continue;

    const rootPath = fileNode.data?.rootPath || null;
    const disk = fsApi;
    let nextFiles = applyFileOperations(currentFiles, operations, errors);
    const before = new Map(currentFiles.map((file) => [file.fileName, file]));
    const after = new Set(nextFiles.map((file) => file.fileName));

    for (const folder of newFolders) {
      if (!rootPath) { warnings.push(`${folder}/: pasta so no workflow (conecte uma pasta do projeto para criar no disco)`); continue; }
      if (typeof disk?.workspaceMkdir !== "function") { warnings.push(`${folder}/: disco indisponivel fora do Electron`); continue; }
      try {
        await disk.workspaceMkdir(rootPath, folder);
        written.push(`pasta ${folder}/`);
      } catch (err) {
        errors.push(`${folder}/: falha ao criar pasta (${err.message})`);
      }
    }

    for (const original of currentFiles) {
      if (after.has(original.fileName)) continue;
      signal?.throwIfAborted();
      if (!rootPath) { warnings.push(`${original.fileName}: removido so do workflow (o arquivo no disco foi mantido)`); continue; }
      if (typeof disk?.workspaceDelete !== "function") { warnings.push(`${original.fileName}: disco indisponivel fora do Electron`); continue; }
      try {
        await disk.workspaceDelete(rootPath, original.fileName);
        written.push(`apagado ${original.fileName}`);
      } catch (err) {
        errors.push(`${original.fileName}: falha ao apagar (${err.message})`);
      }
    }

    nextFiles = await Promise.all(nextFiles.map(async (file) => {
      const previous = before.get(file.fileName);
      if (previous && previous.fileContent === file.fileContent) return file;
      signal?.throwIfAborted();
      const label = previous ? "salvo" : "criado";
      try {
        if (rootPath && typeof disk?.workspaceWrite === "function") {
          const saved = await disk.workspaceWrite(rootPath, file.fileName, file.fileContent);
          written.push(`${label} ${file.fileName}`);
          return { ...file, filePath: saved?.filePath || file.filePath };
        }
        if (file.filePath && typeof disk?.writeFile === "function") {
          await disk.writeFile(file.filePath, file.fileContent);
          written.push(`${label} ${file.fileName}`);
        } else {
          warnings.push(`${file.fileName}: ${previous ? "alterado" : "criado"} so no workflow (${rootPath ? "disco indisponivel fora do Electron" : "conecte uma pasta do projeto para gravar no disco"})`);
        }
      } catch (err) {
        errors.push(`${file.fileName}: falha ao salvar no disco (${err.message})`);
      }
      return file;
    }));

    const folders = new Set([...(fileNode.data?.folders || []), ...newFolders, ...newFolders.flatMap((folder) => parentFolders(folder + "/x"))]);
    for (const file of nextFiles) if (!before.has(file.fileName)) parentFolders(file.fileName).forEach((folder) => folders.add(folder));
    updateNodeData(fileNode.id, { files: nextFiles, folders: [...folders].sort() });
  }

  return { ...parsed, errors: [...new Set(errors)], warnings: [...new Set(warnings)], written };
}

const MAX_EDITABLE_CHARS = 30000;

/**
 * Monta o pedido para um agente com FileNodes de saida. Retorna a instrucao
 * (pedido do usuario + formato) e o bloco com os arquivos editaveis, que vai
 * para o contexto. Arquivos ja presentes em `contextFiles` (entrada do agente)
 * nao sao repetidos.
 *
 * @returns {{ instruction: string, fileContext: string }}
 */
export function buildFileEditInstruction(instruction, outputFileNodes, handoffRequest = "", contextFiles = [], { terminals = [], history = "", shell = "" } = {}) {
  const outputFiles = outputFileNodes.flatMap((node) =>
    Array.isArray(node.data?.files) ? node.data.files : [],
  );
  const roots = outputFileNodes.filter((node) => node.data?.rootPath);
  const key = (file) => file.filePath || file.fileName;
  const inContext = new Set(contextFiles.map(key));
  const missing = outputFiles.filter((file) => !inContext.has(key(file)));

  // Conteudo dos arquivos editaveis, dentro de um orcamento: o que passar dele
  // fica so listado e nao pode ser editado (edit exige o trecho exato).
  let budget = MAX_EDITABLE_CHARS;
  const shown = [];
  const omitted = [];
  for (const file of missing) {
    const size = (file.fileContent || "").length;
    if (size <= budget) { budget -= size; shown.push(file); } else omitted.push(file);
  }

  const parts = [];
  if (roots.length) {
    parts.push(roots.map((node) => {
      const folders = (node.data.folders || []).map((folder) => folder + "/");
      const files = (node.data.files || []).map((file) => file.fileName);
      return `PASTA DO PROJETO: ${node.data.rootName || node.data.rootPath}\nESTRUTURA (caminhos relativos a pasta):\n` +
        ([...folders, ...files].sort().map((entry) => "- " + entry).join("\n") || "(pasta vazia)");
    }).join("\n\n"));
  }
  parts.push(outputFileNodes.length === 0
    ? "ARQUIVOS EDITAVEIS: este agente nao tem FileNode de saida; nao altere arquivos (\"fileOperations\" deve ser [])."
    : outputFiles.length === 0
    ? "ARQUIVOS EDITAVEIS: nenhum arquivo existe no FileNode de saida."
    : "ARQUIVOS EDITAVEIS: " + outputFiles.map((file) => file.fileName).join(", ") +
      (shown.length ? "\n\n" + shown.map((file) => `### Arquivo: ${file.fileName}\n\n${file.fileContent || "(arquivo vazio)"}`).join("\n\n---\n\n") : "") +
      (missing.length === 0 ? " (conteudo atual acima, em ARQUIVOS / CONTEXTO)" : "") +
      (omitted.length ? `\n\nCONTEUDO OMITIDO (grande demais; NAO edite estes arquivos, so crie novos): ${omitted.map((file) => file.fileName).join(", ")}` : ""));
  const fileContext = parts.join("\n\n");

  const request = instruction.trim() || "(este agente nao tem pedido proprio: siga a TAREFA ENCAMINHADA acima)";
  const handoffField = handoffRequest ? `,
  "handoff": "Tarefa: ...\\nUse: ...\\nPronto quando: ..."` : "";
  const where = roots.length
    ? "Todos os caminhos sao relativos a PASTA DO PROJETO e ficam dentro dela. Pastas intermediarias sao criadas automaticamente."
    : "Nao ha pasta do projeto conectada: arquivos novos ficam apenas no workflow (nao sao gravados no disco).";
  const terminalField = terminals.length ? `"terminalCommands": ["comando 1", "comando 2"],
  ` : "";
  const pathRules = outputFileNodes.length === 0 ? "" : `CAMINHOS:
- ${where}
- Escreva caminhos com "/", sem "/" no inicio, sem letra de unidade e sem "..". Para arquivo que ja existe, use exatamente o caminho listado em ESTRUTURA / ARQUIVOS EDITAVEIS.
- "mkdir" cria uma pasta (mesmo vazia). Para um arquivo novo, "create" ja cria as pastas do caminho.

`;
  const terminalRules = terminals.length ? `TERMINAL (voce pode digitar comandos):
- Terminais conectados a voce: ${terminals.map((node) => `"${node.data?.label || "Terminal"}"`).join(", ")}. ${shell}
- Liste em "terminalCommands" os comandos, um por linha, na ordem. Eles rodam no terminal e voce recebe a saida de cada um na proxima rodada. Para escolher o terminal use {"terminal": "nome", "command": "..."} em vez de texto.
- Use comandos nao interativos (flags como --yes / -y) e que terminem sozinhos. Nao rode servidores que ficam abertos nem comandos que pecam senha.
- So rode o que o pedido exige. Nao rode comandos destrutivos (apagar pastas, formatar, git reset --hard, force push) a menos que o pedido mande.
- Depois dos comandos voce recebe a saida e responde de novo. Se NAO precisa ler a saida (ex.: so criar pastas ou instalar algo e terminar), inclua "readOutput": false: os comandos rodam e a tarefa termina sem nova chamada. Se precisa ver o resultado (testes, erros, listagens), omita ou use true.
- Faca tudo o que e preciso na PRIMEIRA resposta (arquivos e comandos juntos). Na resposta seguinte nao repita edicoes ja feitas.
- Quando terminar, ou se nao precisar de comandos, deixe "terminalCommands" fora do JSON (ou []) e descreva o resultado COMPLETO em "message".

` : "";

  return {
    fileContext,
    instruction: `PEDIDO DO USUARIO (prioridade maxima):
${request}

Faca exatamente o que o pedido diz, e nada alem disso.

FORMATO DA RESPOSTA - responda apenas com este JSON (sem texto fora dele, sem cercas Markdown):
{
  "fileOperations": [
    { "action": "edit", "fileName": "src/app.js", "edits": [ { "find": "trecho copiado exatamente do arquivo atual", "replace": "trecho novo" } ] },
    { "action": "create", "fileName": "src/utils/novo.js", "content": "conteudo completo do arquivo novo" },
    { "action": "update", "fileName": "README.md", "content": "arquivo completo reescrito" },
    { "action": "mkdir", "fileName": "src/components" },
    { "action": "delete", "fileName": "src/velho.js" }
  ],
  ${terminalField}"message": "o que voce fez, ou a resposta ao pedido"${handoffField}
}
(o exemplo acima mostra todas as acoes possiveis; inclua so as que o pedido exige)
${handoffRequest ? `
PROXIMO AGENTE:
${handoffRequest}
` : ""}
${pathRules}${terminalRules}REGRAS:
- Altere somente o que o pedido exige. Nao reformate, renomeie, reorganize nem "melhore" o resto do arquivo.
- "edit": cada "find" e um trecho do arquivo atual, copiado caractere por caractere, que aparece uma unica vez. Use trechos curtos, com as linhas necessarias para serem unicos. Se uma edicao falhar, o arquivo inteiro fica como estava.
- Para apagar um trecho, use "replace": "".
- "create" serve para arquivos que nao existem; "update" somente se o arquivo estiver vazio ou se o pedido for reescreve-lo inteiro.
- "delete" so se o pedido mandar apagar o arquivo.
- JSON valido: dentro de "content", "find" e "replace" escape aspas (\\") e quebras de linha (\\n).
- Se o pedido nao exige mudar arquivos (pergunta, explicacao, analise, revisao), responda com "fileOperations": [] e coloque a resposta em "message".
- Codigo novo deve ser real e funcional, sem placeholders nem TODO.
${history ? `
${history}
` : ""}
LEMBRETE DO PEDIDO: ${request}`,
  };
}

const OPERATION_LABELS = { edit: "editado", create: "criado", update: "reescrito", delete: "apagado", mkdir: "pasta criada" };

// Text of the "message" string of a JSON answer that may still be streaming
// (cut anywhere), or null when it has not started yet.
function partialMessage(text) {
  const start = /"message"\s*:\s*"/.exec(text);
  if (!start) return null;
  let out = "";
  for (let i = start.index + start[0].length; i < text.length; i++) {
    const char = text[i];
    if (char === '"') break;
    if (char !== "\\") { out += char; continue; }
    const next = text[++i];
    if (next === undefined) break;
    out += { n: "\n", t: "\t", r: "" }[next] ?? next;
  }
  return out;
}

/**
 * What to show the user for an agent answer. File agents answer in JSON
 * ({ fileOperations, message, handoff }); the user sees the message and a
 * short list of what changed, never the JSON. Safe to call on partial text
 * while the answer is streaming. The raw answer is kept for the handoff.
 */
export function formatAgentOutput(output) {
  if (typeof output !== "string") return output ? String(output) : "";
  const trimmed = output.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("```")) return output;

  const parsed = extractJson(trimmed);
  if (parsed && typeof parsed === "object" && ("fileOperations" in parsed || "message" in parsed)) {
    const operations = Array.isArray(parsed.fileOperations) ? parsed.fileOperations : [];
    const changes = operations
      .filter((item) => item?.action && item?.fileName)
      .map((item) => `• ${OPERATION_LABELS[item.action] || item.action} ${item.fileName}`);
    const commands = (Array.isArray(parsed.terminalCommands) ? parsed.terminalCommands : [])
      .map((item) => (typeof item === "string" ? item : item?.command))
      .filter((command) => typeof command === "string" && command.trim())
      .map((command) => `• $ ${command.trim()}`);
    const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
    return [message, changes.length ? "Arquivos:\n" + changes.join("\n") : "", commands.length ? "Comandos no terminal:\n" + commands.join("\n") : ""]
      .filter(Boolean).join("\n\n") || "Nenhuma alteracao em arquivos.";
  }

  // Still streaming: show the message as it arrives, or a placeholder.
  const message = partialMessage(trimmed);
  return message?.trim() ? message : "Preparando alteracoes...";
}
