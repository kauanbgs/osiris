const BrowserService = require("../services/browserService");
const BrowserCaptureService = require("../services/browserCaptureService");
const BrowserProxyService = require("../services/browserProxyService");
const { BadRequestError } = require("../errors");

class BrowserController {

  // Capturar screenshot e extrair dados estruturados
  static async capture(req, res, next) {
    try {
      const { url } = req.body || {};

      if (typeof url !== "string" || !url.trim()) {
        throw new BadRequestError("Informe uma URL válida.");
      }

      const result = await BrowserCaptureService.capturePage(url);

      return res.status(200).json({
        message: "Página capturada com sucesso.",
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Criar uma sessão no navegador
  static async createSession(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { initial_url } = req.body || {};

      const session = BrowserService.createSession(
        userId,
        initial_url
      );

      return res.status(201).json({
        message: "Browser session created successfully.",
        session,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Listar sessões do usuário
  static async listSessions(req, res, next) {
    try {
      const userId = Number(req.userId);
      const sessions = BrowserService.listUserSessions(userId);
      return res.status(200).json({ sessions });
    } catch (error) {
      return next(error);
    }
  }

  // Consultar uma sessão existente
  static async getSession(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session } = req.params;

      const session = BrowserService.getSession(
        id_session,
        userId
      );

      return res.status(200).json({
        session,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Encerrar uma sessão
  static async closeSession(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session } = req.params;

      const result = BrowserService.closeSession(
        id_session,
        userId
      );

      return res.status(200).json({
        message: "Browser session closed successfully.",
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Navegar para uma URL
  static async navigate(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session, url } = req.body || {};

      const result = await BrowserService.navigate(
        id_session,
        url,
        userId
      );

      return res.status(200).json({
        message: "Navigation successful.",
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Clicar em um elemento da página
  static async click(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session, selector, x, y } = req.body || {};

      const result = await BrowserService.click(
        id_session,
        { selector, x, y },
        userId
      );

      return res.status(200).json({
        message: "Element clicked successfully.",
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Proxy web para contornar X-Frame-Options e CSP em clientes web/iframe
  static async proxy(req, res, next) {
    try {
      const rawUrl = req.query?.url || req.body?.url;

      if (typeof rawUrl !== "string" || !rawUrl.trim()) {
        throw new BadRequestError("Informe o parâmetro 'url'.");
      }

      return await BrowserProxyService.handleProxy(req, res, rawUrl.trim());
    } catch (error) {
      if (req.headers.accept && req.headers.accept.includes("text/html")) {
        res.status(error.statusCode || 500);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b0b0f;color:#e4e4e7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;max-width:420px"><h3 style="margin:0 0 8px">Não foi possível abrir a página</h3><p style="color:#a1a1aa;font-size:13px">${String(error.message).replace(/[<>&]/g, "")}</p></div></body>`);
      }
      return next(error);
    }
  }
}

module.exports = BrowserController;
