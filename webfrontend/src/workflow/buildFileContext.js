/**
 * Constrói o bloco de contexto textual a partir de uma lista de arquivos.
 *
 * @param {{ fileName: string; fileContent: string }[]} files
 * @returns {string} Contexto formatado, ou string vazia se não houver arquivos.
 */
export function buildFileContext(files) {
  if (!files || files.length === 0) return "";

  const blocks = files.map(
    (file) =>
      `### Arquivo: ${file.fileName}\n\n${file.fileContent || "(arquivo vazio)"}`
  );

  return `ARQUIVOS / CONTEXTO:\n\n${blocks.join("\n\n---\n\n")}`;
}

/**
 * Monta o prompt final que será enviado ao modelo.
 *
 * @param {string} instruction  Instrução escrita no AgentNode
 * @param {string} fileContext  Resultado de buildFileContext()
 * @returns {string}
 */
export function buildFinalPrompt(instruction, fileContext) {
  if (!fileContext) return instruction;

  return `${fileContext}\n\n---\n\nINSTRUÇÃO DO USUÁRIO:\n\n${instruction}`;
}
