// Operacoes de arquivo pedidas pelo agente em JSON.
// Porta adaptada de agentFiles.js: aplica em FileNodes do canvas e grava no
// workspace do desktop via API.

import { extractJson } from './handoff.js';

export { extractJson };

const MAX_EDITABLE_CHARS = 30000;

function describeFile(file, index) {
  const content = String(file.fileContent ?? '');
  const full = content.length > MAX_EDITABLE_CHARS
    ? content.slice(0, MAX_EDITABLE_CHARS) + '\n[... CONTEUDO OMITIDO ...]'
    : content;
  return (
    '### ARQUIVO ' + (index + 1) + ': ' + (file.fileName ?? 'sem-nome') + (file.filePath ? ' (caminho no desktop: ' + file.filePath + ')' : '') +
    '\n' + (content.length ? full : '(arquivo vazio)') + '\n'
  );
}

// Contexto dos arquivos de saida + especificacao do JSON de resposta.
export function buildFileEditInstruction({
  instruction, outputFiles, handoffRequest, inputFiles, terminalSpec = '',
}) {
  const editableContent =
    (outputFiles.length ? outputFiles.flatMap((node) => (Array.isArray(node.data?.files) ? node.data.files : [])) : [])
      .map(describeFile).join('\n') +
    (inputFiles.length
      ? '\n### ARQUIVOS DE CONTEXTO (somente leitura; cite o nome exato para editar):\n' +
        inputFiles.map((file) => '### ARQUIVO: ' + (file.fileName ?? 'sem-nome') + '\n' + String(file.fileContent ?? '').slice(0, MAX_EDITABLE_CHARS) + '\n').join('\n')
      : '');

  const spec =
    'Responda SOMENTE com um JSON valido (sem texto fora dele e sem cercas Markdown):\n' +
    '{"fileOperations":[{"action":"create|update|delete|mkdir","fileName":"nome exato do arquivo (ou pasta no mkdir)","content":"conteudo completo do arquivo (para create/update)"}]' +
    (terminalSpec ? ',"terminalCommands":[{"terminal":"nome ou id do terminal","command":"um comando por item"}]' : '') +
    ',"message":"resumo do que voce fez","readOutput":true' +
    ',"handoff":"Use: <dados e decisoes que o proximo agente precisa> | Pronto quando: <criterio>"}\n' +
    '- Para editar apenas um trecho, use action "edit" com "fileName", "find": "<texto exato existente>" e "replace": "<novo texto>".\n' +
    '- O "content" de create/update e o arquivo COMPLETO, nao um trecho.\n' +
    '- Cite apenas arquivos que existem no contexto; para criar um novo use action "create".\n' +
    '- Se nao for editar nada, "fileOperations" fica [].\n' +
    (terminalSpec
      ? '- "terminalCommands" e opcional: peca comandos apenas quando o terminal trouxer progresso real; para de pedir quando o objetivo estiver cumprido.\n'
      : '');

  const built =
    editaHeader() +
    (editableContent ? '\nARQUIVOS (estado atual):\n\n' + editableContent + '\n' : '') +
    '\nPEDIDO:\n\n' + instruction + '\n\n' + spec + (handoffRequest || '');
  return built;
}

function editaHeader() {
  return 'Voce e um agente que trabalha com arquivos e/ou terminal.\n\n';
}

// Aplica as operacoes nos arquivos do FileNode e devolve um resumo.
export function applyAgentResultToFileNodes(operations, currentFiles) {
  let nextFiles = [...currentFiles];
  const written = [];
  const warnings = [];
  const errors = [];
  for (const operation of Array.isArray(operations) ? operations : []) {
    const action = operation?.action;
    if (!operation?.fileName) { continue; }
    // mkdir/delete de pasta nao tem representacao no FileNode do celular.
    if (action === 'mkdir') {
      warnings.push(operation.fileName + ': pastas sao gerenciadas pelo desktop; pasta nao criada.');
      continue;
    }
    if (!['create', 'update', 'edit', 'delete'].includes(action)) {
      errors.push(operation.fileName + ':acao invalida "' + action + '"');
      continue;
    }
    const index = nextFiles.findIndex((file) => file.fileName === operation.fileName);
    if (index === -1 && ['update', 'edit', 'delete'].includes(action)) {
      warnings.push(operation.fileName + ': nao existe no no; operacao ignorada.');
      continue;
    }
    if (action === 'delete') {
      nextFiles = nextFiles.filter((_, fileIndex) => fileIndex !== index);
      written.push(operation.fileName + ' (removido)');
      continue;
    }
    let content;
    if (action === 'edit') {
      if (typeof operation.find !== 'string' || !nextFiles[index]) {
        errors.push(operation.fileName + ': "find" ausente ou arquivo inexistente.');
        continue;
      }
      const current = nextFiles[index].fileContent || '';
      const count = current.split(operation.find).length - 1;
      if (count === 0) {
        errors.push(operation.fileName + ': texto "find" nao encontrado.');
        continue;
      }
      if (count > 1) {
        errors.push(operation.fileName + ': "find" precisa ser unico no arquivo para editar.');
        continue;
      }
      content = current.replace(operation.find, typeof operation.replace === 'string' ? operation.replace : '');
    } else {
      content = typeof operation.content === 'string' ? operation.content : '';
    }
    const nextFile = {
      ...nextFiles[index],
      fileName: operation.fileName,
      fileContent: content,
      fileSize: content.length,
    };
    if (index >= 0) nextFiles[index] = nextFile;
    else nextFiles.push(nextFile);
    written.push(operation.fileName + (index >= 0 ? ' (atualizado)' : ' (criado)'));
  }
  return { files: nextFiles, written, warnings, errors };
}

const OPERATION_LABELS = { edit: 'editado', create: 'criado', update: 'reescrito', delete: 'apagado', mkdir: 'pasta criada' };

function partialMessage(text) {
  const start = /"message"\s*:\s*"/.exec(text);
  if (!start) return null;
  let out = '';
  for (let i = start.index + start[0].length; i < text.length; i++) {
    const char = text[i];
    if (char === '"') break;
    if (char !== '\\') { out += char; continue; }
    const next = text[++i];
    if (next === undefined) break;
    out += { n: '\n', t: '\t', r: '' }[next] ?? next;
  }
  return out;
}

// O que o usuario ve de uma resposta de agente. Agentes de arquivo respondem
// em JSON ({ fileOperations, message, handoff }); o usuario ve a mensagem e a
// lista de alteracoes, nunca o JSON bruto.
export function formatAgentOutput(output) {
  if (typeof output !== 'string') return output ? String(output) : '';
  const trimmed = output.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('```')) return output;
  const parsed = extractJson(trimmed);
  if (parsed && typeof parsed === 'object' && ('fileOperations' in parsed || 'message' in parsed)) {
    const operations = Array.isArray(parsed.fileOperations) ? parsed.fileOperations : [];
    const changes = operations
      .filter((item) => item?.action && item?.fileName)
      .map((item) => '- ' + (OPERATION_LABELS[item.action] || item.action) + ' ' + item.fileName);
    const commands = (Array.isArray(parsed.terminalCommands) ? parsed.terminalCommands : [])
      .map((item) => (typeof item === 'string' ? item : item?.command))
      .filter((command) => typeof command === 'string' && command.trim())
      .map((command) => '- $ ' + command.trim());
    const message = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    return [message,
      changes.length ? 'Arquivos:\n' + changes.join('\n') : '',
      commands.length ? 'Comandos no terminal:\n' + commands.join('\n') : '',
    ].filter(Boolean).join('\n\n') || 'Nenhuma alteracao em arquivos.';
  }
  const message = partialMessage(trimmed);
  return message?.trim() ? message : 'Preparando alteracoes...';
}
