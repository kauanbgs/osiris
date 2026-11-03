import { File } from "expo-file-system";
import sheets from "./api";

// Limite de texto do arquivo enviado à IA, para não estourar o contexto do
// modelo (≈ 15 mil tokens). É o mesmo limite usado pela API.
export const MAX_ATTACHMENT_CHARS = 60000;

// Imagens maiores que isso são recusadas pelos provedores (a Anthropic aceita
// até 5 MB por imagem).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "jsonl", "xml", "yaml", "yml",
  "toml", "ini", "cfg", "conf", "env", "log", "html", "htm", "css", "scss",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "py", "java", "kt", "c", "h", "cpp",
  "hpp", "cs", "go", "rs", "rb", "php", "swift", "dart", "sql", "sh", "bash",
  "ps1", "bat", "lua", "r", "vue", "svelte", "gradle", "properties",
]);

const TEXT_MIME_TYPES = [
  "application/json",
  "application/xml",
  "application/javascript",
  "application/x-sh",
  "application/x-yaml",
  "application/sql",
];

function extensionOf(name = "") {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isTextFile({ name, mimeType } = {}) {
  if (mimeType?.startsWith("text/")) return true;
  if (mimeType && TEXT_MIME_TYPES.includes(mimeType)) return true;
  return TEXT_EXTENSIONS.has(extensionOf(name));
}

// Lê o conteúdo de um arquivo de texto. Devolve null se não der para ler.
export async function readTextFile(uri) {
  try {
    return await new File(uri).text();
  } catch (error) {
    console.warn("Não foi possível ler o arquivo:", error?.message);
    return null;
  }
}

function imageMimeType({ mimeType, name, uri }) {
  if (mimeType?.startsWith("image/")) return mimeType;
  const ext = extensionOf(name) || extensionOf(uri);
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

// Extrai o texto de PDF, DOCX e outros formatos mandando o arquivo para a
// API (POST /file), a mesma usada pela versão web.
async function extractWithApi(attachment) {
  try {
    const res = await sheets.uploadFile(attachment);
    const reading = res.data?.reading;
    if (reading?.readable && reading.content?.trim()) {
      return { content: reading.content, truncated: Boolean(reading.truncated) };
    }
    return { error: reading?.message || "Não foi possível ler o arquivo." };
  } catch (error) {
    const apiMessage = error?.response?.data?.message || error?.response?.data?.error;
    return {
      error:
        apiMessage ||
        (error?.response
          ? `A API recusou o arquivo (HTTP ${error.response.status}).`
          : "Não foi possível conectar à API para ler o arquivo."),
    };
  }
}

function withFileContent(name, content, truncated, request) {
  const note = truncated
    ? `\n[O arquivo foi cortado: só os primeiros ${MAX_ATTACHMENT_CHARS} caracteres foram enviados.]`
    : "";
  return `O usuário anexou o arquivo "${name}". Use o conteúdo abaixo como referência para responder ao pedido; não reproduza o documento inteiro, a menos que isso seja pedido.

<conteudo_arquivo>
${content}
</conteudo_arquivo>${note}

${request}`;
}

function withUnreadableFile(name, reason, request) {
  return `[O usuário anexou "${name}", mas o conteúdo não pôde ser lido: ${reason} Avise o usuário se precisar do arquivo para responder.]\n\n${request}`;
}

/**
 * Prepara o que vai para a IA a partir do texto digitado e do anexo.
 *
 * - Arquivo de texto: lido no próprio celular.
 * - PDF, DOCX e outros: o texto é extraído pela API.
 * - Imagem: enviada como imagem quando o modelo aceita (nuvem); senão, a IA é
 *   avisada de que não consegue vê-la.
 *
 * Devolve { prompt, images }, em que images é uma lista de
 * { mimeType, base64 } (vazia quando não há imagem).
 */
export async function prepareAttachment(text, attachment, { supportsImages = false } = {}) {
  if (!attachment) return { prompt: text, images: [] };

  const name = attachment.name || "arquivo";

  if (attachment.type === "image") {
    const request = text || "Descreva a imagem anexada.";
    if (!supportsImages) {
      return {
        prompt: withUnreadableFile(name, "o modelo do desktop não recebe imagens.", request),
        images: [],
      };
    }
    try {
      const file = new File(attachment.uri);
      if (file.size > MAX_IMAGE_BYTES) {
        return {
          prompt: withUnreadableFile(name, "a imagem passa de 5 MB.", request),
          images: [],
        };
      }
      return {
        prompt: request,
        images: [{ mimeType: imageMimeType(attachment), base64: await file.base64() }],
      };
    } catch (error) {
      console.warn("Não foi possível ler a imagem:", error?.message);
      return {
        prompt: withUnreadableFile(name, "não foi possível ler a imagem no celular.", request),
        images: [],
      };
    }
  }

  const request = text || "Analise o arquivo anexado.";

  if (isTextFile(attachment)) {
    const content = await readTextFile(attachment.uri);
    if (content !== null && content.trim()) {
      const truncated = content.length > MAX_ATTACHMENT_CHARS;
      const body = truncated ? content.slice(0, MAX_ATTACHMENT_CHARS) : content;
      return { prompt: withFileContent(name, body, truncated, request), images: [] };
    }
  }

  const extracted = await extractWithApi(attachment);
  if (extracted.content) {
    return {
      prompt: withFileContent(name, extracted.content, extracted.truncated, request),
      images: [],
    };
  }
  return { prompt: withUnreadableFile(name, extracted.error, request), images: [] };
}
