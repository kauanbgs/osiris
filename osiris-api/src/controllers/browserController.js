
const BrowserService = require("../services/browserService");
const BrowserCaptureService = require("../services/browserCaptureService");

class BrowserController {

  // Capturar screenshot e extrair dados estruturados
  static async capture(req, res, next) {
    try {
      const { url } = req.body || {};

      if (typeof url !== "string" || !url.trim()) {
        return res.status(400).json({
          error: {
            message: "Informe uma URL válida.",
            statusCode: 400,
          },
        });
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
}

module.exports = BrowserController;
