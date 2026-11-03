const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const MAX_TEXT_LENGTH = 60000;

async function extractFileContent(buffer, extension) {
  const ext = (extension || "").toLowerCase();

  let content = "";

  switch (ext) {
    case "pdf": {
      try {
        console.log("Iniciando leitura do PDF...");
        console.log("Tamanho do buffer:", buffer.length);

        const result = await pdfParse(buffer);

        console.log("Número de páginas:", result.numpages);
        console.log("Texto extraído:", result.text?.length || 0, "caracteres");

        content = result.text || "";
        break;
      } catch (error) {
        console.error("Erro ao extrair PDF:", error);

        return {
          readable: false,
          content: "",
          message: "Erro ao processar o PDF.",
        };
      }
    }

    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      content = result.value;
      break;
    }

    case "txt":
    case "csv":
    case "json":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "py":
    case "html":
    case "css":
    case "sql":
    case "md":
    case "xml":
    case "yaml":
    case "yml":
    case "log":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "php":
    case "sh": {
      content = buffer.toString("utf8");
      break;
    }

    default:
      return {
        readable: false,
        content: "",
        message: `Formato .${ext || "desconhecido"} não suportado para leitura.`,
      };
  }

  content = content.trim();

  if (!content) {
    return {
      readable: false,
      content: "",
      message: "Não foi possível encontrar texto legível no arquivo.",
    };
  }

  const truncated = content.length > MAX_TEXT_LENGTH;

  if (truncated) {
    content = content.slice(0, MAX_TEXT_LENGTH);
  }

  return {
    readable: true,
    content,
    truncated,
    message: truncated
      ? "Parte do conteúdo foi limitada devido ao tamanho do arquivo."
      : "Conteúdo extraído com sucesso.",
  };
}

module.exports = extractFileContent;
