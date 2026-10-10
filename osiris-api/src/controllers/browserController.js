const BrowserService = require("../services/browserService");

class BrowserController {
  static async createSession(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { initial_url } = req.body || {};
      const session = BrowserService.createSession(userId, initial_url);
      return res.status(201).json({
        message: "Browser session created successfully.",
        session,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getSession(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session } = req.params;
      const session = BrowserService.getSession(id_session, userId);
      return res.status(200).json({ session });
    } catch (error) {
      return next(error);
    }
  }

  static async closeSession(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session } = req.params;
      const result = BrowserService.closeSession(id_session, userId);
      return res.status(200).json({
        message: "Browser session closed successfully.",
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async navigate(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session, url } = req.body || {};
      const result = await BrowserService.navigate(id_session, url, userId);
      return res.status(200).json({
        message: "Navigation successful.",
        ...result,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async click(req, res, next) {
    try {
      const userId = Number(req.userId);
      const { id_session, selector, x, y } = req.body || {};
      const result = await BrowserService.click(id_session, { selector, x, y }, userId);
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
