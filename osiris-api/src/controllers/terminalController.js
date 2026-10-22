const TerminalService = require("../services/terminalService");

class TerminalController {
  static async exec(req, res, next) {
    try {
      const userId = req.userId;
      const { command, timeout_ms, cwd } = req.body || {};

      const result = await TerminalService.executeCommand(command, {
        userId,
        timeoutMs: timeout_ms,
        cwd,
      });

      return res.status(200).json({
        stdout: result.stdout,
        stderr: result.stderr,
        exit_code: result.exit_code,
        execution_time_ms: result.execution_time_ms,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getHistory(req, res, next) {
    try {
      const userId = req.userId;
      const { limit, offset } = req.query || {};

      const result = TerminalService.getHistory(userId, { limit, offset });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }

  static async clearHistory(req, res, next) {
    try {
      const userId = req.userId;

      const result = TerminalService.clearHistory(userId);

      return res.status(200).json({
        message: "Terminal history cleared successfully.",
        cleared_count: result.cleared_count,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = TerminalController;
