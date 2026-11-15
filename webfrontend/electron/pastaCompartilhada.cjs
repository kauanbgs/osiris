// pastaCompartilhada.cjs — guarda a pasta que o desktop compartilhou com o celular e lê/grava os arquivos dela.
// Usado pelo servidor local (porta 8080): os arquivos ficam no PC, e não na API da nuvem.
const fs = require("fs");
const path = require("path");
const { resolveInside } = require("./workspaceFs.cjs");

const NOME_ARQUIVO_CONFIG = "pasta-compartilhada.json";
const IGNORADAS = new Set(["node_modules", ".git", "dist", "build"]);
const PROFUNDIDADE_MAXIMA = 12;
const MAXIMO_ITENS = 2000;
const TAMANHO_MAXIMO_EDITAVEL = 512 * 1024;

// Erro com status HTTP, para o servidor local responder certo ao celular.
function erroComStatus(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

function caminhoConfig(pastaDados) {
  return path.join(pastaDados, NOME_ARQUIVO_CONFIG);
}

async function salvarPastaCompartilhada(pastaDados, caminhoPasta) {
  if (typeof caminhoPasta !== "string" || !path.isAbsolute(caminhoPasta)) {
    throw erroComStatus(400, "Pasta inválida.");
  }
  const real = await fs.promises.realpath(caminhoPasta);
  const info = await fs.promises.stat(real);
  if (!info.isDirectory()) throw erroComStatus(400, "O caminho escolhido não é uma pasta.");
  await fs.promises.writeFile(caminhoConfig(pastaDados), JSON.stringify({ pasta: real }), "utf8");
  return real;
}

async function lerPastaCompartilhada(pastaDados) {
  try {
    const { pasta } = JSON.parse(await fs.promises.readFile(caminhoConfig(pastaDados), "utf8"));
    const info = await fs.promises.stat(pasta);
    return info.isDirectory() ? pasta : null;
  } catch {
    return null;
  }
}

async function listarItens(raiz) {
  const itens = [];

  async function percorrer(pastaAtual, relativa = "", profundidade = 0) {
    if (profundidade > PROFUNDIDADE_MAXIMA || itens.length >= MAXIMO_ITENS) return;
    let entradas;
    try {
      entradas = await fs.promises.readdir(pastaAtual, { withFileTypes: true });
    } catch {
      return;
    }
    entradas.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const entrada of entradas) {
      if (itens.length >= MAXIMO_ITENS) break;
      if (IGNORADAS.has(entrada.name) || entrada.isSymbolicLink()) continue;
      const caminhoRelativo = path.posix.join(relativa, entrada.name);
      const ehPasta = entrada.isDirectory();
      itens.push({ name: entrada.name, relativePath: caminhoRelativo, type: ehPasta ? "folder" : "file" });
      if (ehPasta) await percorrer(path.join(pastaAtual, entrada.name), caminhoRelativo, profundidade + 1);
    }
  }

  await percorrer(raiz);
  return itens;
}

// Caminho real de um arquivo dentro da pasta compartilhada; recusa qualquer coisa fora dela.
async function resolverArquivo(raiz, caminhoRelativo) {
  let alvo;
  try {
    alvo = resolveInside(raiz, caminhoRelativo);
  } catch (erro) {
    throw erroComStatus(400, erro.message);
  }
  let real;
  try {
    real = await fs.promises.realpath(alvo);
  } catch {
    throw erroComStatus(404, "Arquivo não encontrado.");
  }
  const relativo = path.relative(await fs.promises.realpath(raiz), real);
  if (!relativo || relativo.startsWith("..") || path.isAbsolute(relativo)) {
    throw erroComStatus(400, "O arquivo precisa estar dentro da pasta compartilhada.");
  }
  const info = await fs.promises.stat(real);
  if (!info.isFile()) throw erroComStatus(400, "O caminho escolhido não é um arquivo.");
  return { caminho: real, tamanho: info.size };
}

async function lerArquivo(raiz, caminhoRelativo) {
  const { caminho, tamanho } = await resolverArquivo(raiz, caminhoRelativo);
  if (tamanho > TAMANHO_MAXIMO_EDITAVEL) throw erroComStatus(400, "O arquivo é muito grande para edição no celular.");
  const bytes = await fs.promises.readFile(caminho);
  const texto = bytes.toString("utf8");
  if (!Buffer.from(texto, "utf8").equals(bytes)) {
    throw erroComStatus(400, "Este arquivo não parece ser um arquivo de texto editável.");
  }
  return { fileContent: texto, size: tamanho };
}

async function gravarArquivo(raiz, caminhoRelativo, conteudo) {
  if (typeof conteudo !== "string") throw erroComStatus(400, "O conteúdo do arquivo é inválido.");
  if (Buffer.byteLength(conteudo, "utf8") > TAMANHO_MAXIMO_EDITAVEL) {
    throw erroComStatus(400, "O arquivo é muito grande para edição no celular.");
  }
  const { caminho } = await resolverArquivo(raiz, caminhoRelativo);
  await fs.promises.writeFile(caminho, conteudo, "utf8");
}

async function apagarArquivo(raiz, caminhoRelativo) {
  const { caminho } = await resolverArquivo(raiz, caminhoRelativo);
  await fs.promises.unlink(caminho);
}

module.exports = {
  salvarPastaCompartilhada,
  lerPastaCompartilhada,
  listarItens,
  lerArquivo,
  gravarArquivo,
  apagarArquivo,
};
