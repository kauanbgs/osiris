// Coleta de contexto de nos conectados ao agente.
// Porta de getConnectedFiles.js / getConnectedNotes.js / buildFileContext.js.

export function getAgentFileNodes(agentId, nodes, edges) {
  const files = new Map(nodes.filter((node) => node.type === 'file').map((node) => [node.id, node]));
  const inputs = new Map();
  const outputs = new Map();
  for (const edge of edges) {
    const agentIsSource = edge.source === agentId;
    if (!agentIsSource && edge.target !== agentId) continue;
    const file = files.get(agentIsSource ? edge.target : edge.source);
    if (!file) continue;
    const handle = agentIsSource ? edge.sourceHandle : edge.targetHandle;
    const isOutput = handle === 'files' ? false : handle === 'output' ? true : agentIsSource;
    (isOutput ? outputs : inputs).set(file.id, file);
  }
  return { inputs: [...inputs.values()], outputs: [...outputs.values()] };
}

export function getConnectedFiles(agentId, nodes, edges) {
  const files = [];
  for (const node of getAgentFileNodes(agentId, nodes, edges).inputs) {
    const nodeFiles = node.data?.files;
    if (!Array.isArray(nodeFiles)) continue;
    for (const file of nodeFiles) {
      files.push({
        fileName: file.fileName ?? 'sem-nome',
        fileType: file.fileType ?? '',
        fileSize: file.fileSize ?? 0,
        fileContent: file.fileContent ?? '',
        filePath: file.filePath ?? null,
      });
    }
  }
  return files;
}

export function getConnectedNotes(agentId, nodes, edges) {
  const notes = new Map(nodes.filter((node) => node.type === 'text').map((node) => [node.id, node]));
  const ids = new Set();
  for (const edge of edges) {
    if (edge.target === agentId && notes.has(edge.source)) ids.add(edge.source);
    if (edge.source === agentId && notes.has(edge.target)) ids.add(edge.target);
  }
  return [...ids].map((id) => notes.get(id)?.data?.text?.trim()).filter(Boolean);
}

export const NOTES_TASK = 'Cumpra o que esta descrito nas NOTAS CONECTADAS.';

export function buildNoteContext(notes) {
  if (!notes.length) return '';
  return (
    'NOTAS CONECTADAS (escritas pelo proprio usuario para este agente: sao pedidos e informacoes validos, leia e siga):\n\n' +
    notes.map((note) => '- ' + note.replace(/\n/g, '\n  ')).join('\n')
  );
}

export function buildFileContext(files) {
  if (!files || files.length === 0) return '';
  const blocks = files.map(
    (file) => '### Arquivo: ' + file.fileName + '\n\n' + (file.fileContent || '(arquivo vazio)'),
  );
  return 'ARQUIVOS / CONTEXTO:\n\n' + blocks.join('\n\n---\n\n');
}

export function buildFinalPrompt(instruction, fileContext) {
  if (!fileContext) return instruction;
  return fileContext + '\n\n---\n\nSUA TAREFA:\n\n' + instruction;
}
