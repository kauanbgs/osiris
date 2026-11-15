// ponteDesktopController.js — rotas do terminal e da pasta compartilhada que passam pela API até o app desktop.
// A API só repassa: o comando roda e os arquivos ficam no PC do próprio usuário, nunca no servidor.
const { BadRequestError } = require("../errors");
const ponte = require("../services/ponteDesktop");

const TEMPO_PADRAO_MS = 30000;
const TEMPO_MINIMO_MS = 1000;
const TEMPO_MAXIMO_MS = 120000;
const TAMANHO_MAXIMO_COMANDO = 4096;
// Folga além do tempo do comando, para o pedido ir e voltar do desktop.
const FOLGA_DESKTOP_MS = 15000;
const TEMPO_ARQUIVOS_MS = 20000;
const MAXIMO_HISTORICO = 50;

// Histórico de comandos de cada usuário, só em memória (some quando a API reinicia).
const historicos = new Map();

function ajustarTempo(valor) {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return TEMPO_PADRAO_MS;
  return Math.min(Math.max(numero, TEMPO_MINIMO_MS), TEMPO_MAXIMO_MS);
}

function registrarHistorico(idUsuario, comando, resultado) {
  const chave = String(idUsuario);
  const lista = historicos.get(chave) || [];
  lista.unshift({
    command: comando,
    stdout: resultado?.stdout ?? "",
    stderr: resultado?.stderr ?? "",
    exit_code: resultado?.exit_code ?? null,
    execution_time_ms: resultado?.execution_time_ms ?? null,
    created_at: new Date().toISOString(),
  });
  historicos.set(chave, lista.slice(0, MAXIMO_HISTORICO));
}

function caminhoValido(caminho) {
  if (typeof caminho !== "string" || !caminho.trim() || caminho.includes("\0")) {
    throw new BadRequestError("Caminho de arquivo inválido.");
  }
  return caminho.trim();
}

class PonteDesktopController {
  // ---------- usadas pelo app desktop ----------

  // O desktop pergunta se há pedidos para a conta dele (espera até ~25 s).
  static async proximoPedido(req, res, next) {
    try {
      const controle = new AbortController();
      res.on("close", () => controle.abort());
      const pedido = await ponte.aguardarPedido(req.userId, undefined, controle.signal);
      if (res.writableEnded || controle.signal.aborted) return undefined;
      if (!pedido) return res.status(204).end();
      return res.status(200).json({ pedido });
    } catch (error) {
      return next(error);
    }
  }

  // O desktop devolve o resultado de um pedido.
  static async responderPedido(req, res, next) {
    try {
      const entregue = ponte.responderPedido(req.userId, req.params.id_pedido, req.body || {});
      return res.status(entregue ? 200 : 404).json({ entregue });
    } catch (error) {
      return next(error);
    }
  }

  // O celular pergunta se o app desktop da conta está ligado (quando não alcança o PC na rede local).
  static async desktopConectado(req, res, next) {
    try {
      return res.status(200).json({ conectado: ponte.desktopConectado(req.userId) });
    } catch (error) {
      return next(error);
    }
  }

  // ---------- terminal (celular, Workflow e navegador) ----------

  static async executarComando(req, res, next) {
    try {
      const { command, timeout_ms: tempoPedido, cwd } = req.body || {};
      if (typeof command !== "string" || !command.trim()) {
        throw new BadRequestError("Comando não informado.");
      }
      if (command.length > TAMANHO_MAXIMO_COMANDO) {
        throw new BadRequestError("Comando longo demais.");
      }
      const tempo = ajustarTempo(tempoPedido);
      const resultado = await ponte.enviarParaDesktop(
        req.userId,
        "terminal",
        { command, timeout_ms: tempo, cwd: typeof cwd === "string" ? cwd : null },
        tempo + FOLGA_DESKTOP_MS,
      );
      registrarHistorico(req.userId, command, resultado);
      return res.status(200).json({
        stdout: resultado?.stdout ?? "",
        stderr: resultado?.stderr ?? "",
        exit_code: resultado?.exit_code ?? null,
        execution_time_ms: resultado?.execution_time_ms ?? null,
        pasta: resultado?.pasta ?? null,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async historico(req, res, next) {
    try {
      const lista = historicos.get(String(req.userId)) || [];
      const limite = Math.max(1, Number.parseInt(req.query.limit, 10) || MAXIMO_HISTORICO);
      const deslocamento = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
      return res.status(200).json({
        total: lista.length,
        limit: limite,
        offset: deslocamento,
        history: lista.slice(deslocamento, deslocamento + limite),
      });
    } catch (error) {
      return next(error);
    }
  }

  static async limparHistorico(req, res, next) {
    try {
      const chave = String(req.userId);
      const total = (historicos.get(chave) || []).length;
      historicos.delete(chave);
      return res.status(200).json({ message: "Histórico do terminal apagado.", cleared_count: total });
    } catch (error) {
      return next(error);
    }
  }

  // ---------- pasta compartilhada (arquivos do PC) ----------

  static async listarPasta(req, res, next) {
    try {
      const resultado = await ponte.enviarParaDesktop(req.userId, "listarPasta", {}, TEMPO_ARQUIVOS_MS);
      return res.status(200).json({ workspace: resultado?.workspace ?? null });
    } catch (error) {
      return next(error);
    }
  }

  static async lerArquivo(req, res, next) {
    try {
      const caminho = caminhoValido(req.query.path);
      const resultado = await ponte.enviarParaDesktop(req.userId, "lerArquivo", { path: caminho }, TEMPO_ARQUIVOS_MS);
      return res.status(200).json(resultado);
    } catch (error) {
      return next(error);
    }
  }

  static async gravarArquivo(req, res, next) {
    try {
      const { path: caminho, content } = req.body || {};
      if (typeof content !== "string") throw new BadRequestError("O conteúdo do arquivo é inválido.");
      await ponte.enviarParaDesktop(
        req.userId,
        "gravarArquivo",
        { path: caminhoValido(caminho), content },
        TEMPO_ARQUIVOS_MS,
      );
      return res.status(200).json({ message: "Arquivo salvo com sucesso." });
    } catch (error) {
      return next(error);
    }
  }

  static async apagarArquivo(req, res, next) {
    try {
      const caminho = caminhoValido(req.query.path);
      await ponte.enviarParaDesktop(req.userId, "apagarArquivo", { path: caminho }, TEMPO_ARQUIVOS_MS);
      return res.status(200).json({ message: "Arquivo excluído com sucesso." });
    } catch (error) {
      return next(error);
    }
  }

  // Usado só pelos testes.
  static limparHistoricos() {
    historicos.clear();
  }
}

module.exports = PonteDesktopController;
