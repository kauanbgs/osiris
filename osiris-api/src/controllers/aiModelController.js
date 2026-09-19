const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

const ALL_FIELDS = `
  id_model, name, provider, size, status,
  download_url, description, ram_requirement,
  tags, created_at
`;

class AiModelController {
  static async create(req, res, next) {
    try {
      const {
        name,
        provider,
        size,
        status,
        download_url,
        description,
        ram_requirement,
        tags,
      } = req.body;

      if (!name || !name.trim()) {
        throw new BadRequestError("Model name is required.");
      }

      if (!status || !status.trim()) {
        throw new BadRequestError("Model status is required.");
      }

      const [result] = await pool.promise().execute(
        `INSERT INTO ai_model
          (name, provider, size, status,
           download_url, description, ram_requirement, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          provider ? provider.trim() : null,
          size || null,
          status.trim(),
          download_url ? download_url.trim() : null,
          description ? description.trim() : null,
          ram_requirement || null,
          tags ? tags.trim() : null,
        ],
      );

      return res.status(201).json({
        message: "AI model created successfully.",
        ai_model: {
          id_model: result.insertId,
          name: name.trim(),
          provider: provider ? provider.trim() : null,
          size: size || null,
          status: status.trim(),
          download_url: download_url ? download_url.trim() : null,
          description: description ? description.trim() : null,
          ram_requirement: ram_requirement || null,
          tags: tags ? tags.trim() : null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const { type, provider } = req.query;

      let query = `SELECT ${ALL_FIELDS} FROM ai_model`;
      const conditions = [];
      const params = [];

      if (type === "local") {
        conditions.push("download_url IS NOT NULL");
      } else if (type === "cloud") {
        conditions.push("download_url IS NULL");
      }

      if (provider) {
        conditions.push("provider = ?");
        params.push(provider);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += " ORDER BY id_model DESC";

      const [rows] = await pool.promise().execute(query, params);

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
        `SELECT ${ALL_FIELDS}
         FROM ai_model
         WHERE id_model = ?
         LIMIT 1`,
        [id_model],
      );

      if (!rows[0]) {
        throw new NotFoundError("AI model not found.");
      }

      return res.status(200).json({
        ai_model: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async download(req, res, next) {
    try {
      const { id_model } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_model, name, download_url, size
         FROM ai_model
         WHERE id_model = ?
         LIMIT 1`,
        [id_model],
      );

      if (!rows[0]) {
        throw new NotFoundError("AI model not found.");
      }

      const model = rows[0];

      if (!model.download_url) {
        throw new BadRequestError(
          "This model does not have a download URL configured.",
        );
      }

      const filename = model.download_url.split("/").pop();

      const wantsJson =
        req.query.redirect === "false" ||
        (req.headers.accept && req.headers.accept.includes("application/json"));

      if (wantsJson) {
        return res.status(200).json({
          id_model: model.id_model,
          name: model.name,
          filename: filename,
          download_url: model.download_url,
          size: model.size,
        });
      }

      return res.redirect(302, model.download_url);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AiModelController;
