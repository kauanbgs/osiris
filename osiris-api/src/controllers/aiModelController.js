const pool = require("../db/connect");

class AiModelController {
  static async create(req, res, next) {
    try {
      const {
        name,
        provider,
        model_name,
        size,
        status,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          error: "O nome do modelo é obrigatório.",
        });
      }

      if (!model_name || !model_name.trim()) {
        return res.status(400).json({
          error: "O nome técnico do modelo é obrigatório.",
        });
      }

      if (!status || !status.trim()) {
        return res.status(400).json({
          error: "O status do modelo é obrigatório.",
        });
      }

      const [result] = await pool.promise().execute(
        `INSERT INTO ai_model
          (name, provider, model_name, size, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          name.trim(),
          provider ? provider.trim() : null,
          model_name.trim(),
          size || null,
          status.trim(),
        ],
      );

      return res.status(201).json({
        message: "Modelo de IA criado com sucesso.",
        ai_model: {
          id_model: result.insertId,
          name: name.trim(),
          provider: provider ? provider.trim() : null,
          model_name: model_name.trim(),
          size: size || null,
          status: status.trim(),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT
          id_model,
          name,
          provider,
          model_name,
          size,
          status,
          created_at
         FROM ai_model
         ORDER BY id_model DESC`,
      );

      return res.status(200).json({
        ai_models: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_model } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT
          id_model,
          name,
          provider,
          model_name,
          size,
          status,
          created_at
         FROM ai_model
         WHERE id_model = ?
         LIMIT 1`,
        [id_model],
      );

      if (!rows[0]) {
        return res.status(404).json({
          error: "Modelo de IA não encontrado.",
        });
      }

      return res.status(200).json({
        ai_model: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AiModelController;