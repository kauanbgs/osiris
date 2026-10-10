const pool = require("../db/connect");
const SystemService = require("../services/systemService");
const { BadRequestError } = require("../errors");

class SystemController {
  static async getInfo(req, res, next) {
    try {
      const info = SystemService.getSystemInfo();
      return res.status(200).json({ system: info });
    } catch (error) {
      return next(error);
    }
  }

  static async recordMetric(req, res, next) {
    try {
      const {
        input_tokens,
        output_tokens,
        response_time,
        cpu_usage,
        ram_usage,
        fk_id_chat,
        fk_id_model,
        fk_id_agent,
      } = req.body;
      const userId = Number(req.userId);

      if (!fk_id_model) {
        throw new BadRequestError("Model ID is required to record metric.");
      }

      const sysInfo = SystemService.getSystemInfo();
      const finalCpu = cpu_usage !== undefined ? Number(cpu_usage) : sysInfo.cpu.usage_percent;
      const finalRam = ram_usage !== undefined ? Number(ram_usage) : sysInfo.memory.usage_percent;

      const [result] = await pool.promise().execute(
        `INSERT INTO usage_metrics
          (input_tokens, output_tokens, response_time, cpu_usage, ram_usage,
           fk_id_chat, fk_id_model, fk_id_agent, fk_id_user)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input_tokens || 0,
          output_tokens || 0,
          response_time || 0,
          finalCpu,
          finalRam,
          fk_id_chat || null,
          fk_id_model,
          fk_id_agent || null,
          userId,
        ],
      );

      return res.status(201).json({
        message: "Metric recorded successfully.",
        metric: {
          id_metric: result.insertId,
          input_tokens: input_tokens || 0,
          output_tokens: output_tokens || 0,
          response_time: response_time || 0,
          cpu_usage: finalCpu,
          ram_usage: finalRam,
          fk_id_model,
          fk_id_user: userId,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listMetrics(req, res, next) {
    try {
      const userId = req.userId;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const offset = Number(req.query.offset) || 0;

      const [rows] = await pool.promise().execute(
        `SELECT
          m.id_metric,
          m.input_tokens,
          m.output_tokens,
          m.response_time,
          m.cpu_usage,
          m.ram_usage,
          m.created_at,
          m.fk_id_chat,
          m.fk_id_model,
          m.fk_id_agent,
          model.name AS model_name
         FROM usage_metrics m
         LEFT JOIN ai_model model ON m.fk_id_model = model.id_model
         WHERE m.fk_id_user = ?
         ORDER BY m.id_metric DESC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
      );

      return res.status(200).json({
        metrics: rows,
        limit,
        offset,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getDashboard(req, res, next) {
    try {
      const userId = Number(req.userId);

      const [summaryRows] = await pool.promise().execute(
        `SELECT
          COUNT(*) AS total_requests,
          COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
          COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
          COALESCE(ROUND(AVG(response_time), 2), 0) AS avg_response_time_ms,
          COALESCE(ROUND(AVG(cpu_usage), 2), 0) AS avg_cpu_usage,
          COALESCE(ROUND(AVG(ram_usage), 2), 0) AS avg_ram_usage
         FROM usage_metrics
         WHERE fk_id_user = ?`,
        [userId],
      );

      const [timelineRows] = await pool.promise().execute(
        `SELECT
          DATE(created_at) AS date,
          COUNT(*) AS requests,
          COALESCE(SUM(input_tokens), 0) AS input_tokens,
          COALESCE(SUM(output_tokens), 0) AS output_tokens,
          COALESCE(ROUND(AVG(response_time), 2), 0) AS avg_response_time
         FROM usage_metrics
         WHERE fk_id_user = ?
         GROUP BY DATE(created_at)
         ORDER BY date ASC
         LIMIT 30`,
        [userId],
      );

      const [modelRows] = await pool.promise().execute(
        `SELECT
          m.id_model,
          m.name AS model_name,
          COUNT(u.id_metric) AS requests,
          COALESCE(SUM(u.input_tokens + u.output_tokens), 0) AS total_tokens,
          COALESCE(ROUND(AVG(u.response_time), 2), 0) AS avg_response_time
         FROM ai_model m
         INNER JOIN usage_metrics u ON m.id_model = u.fk_id_model
         WHERE u.fk_id_user = ?
         GROUP BY m.id_model, m.name
         ORDER BY total_tokens DESC`,
        [userId],
      );

      const liveSysInfo = SystemService.getSystemInfo();

      return res.status(200).json({
        summary: summaryRows[0] || {},
        timeline: timelineRows,
        models: modelRows,
        live_hardware: liveSysInfo,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = SystemController;
