const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");
const ModelScanService = require("../services/modelScanService");
const ModelRecommendationService = require("../services/modelRecommendationService");

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

  static async scanModels(req, res, next) {
    try {
      const { directory_path } = req.body || {};
      const files = ModelScanService.scanDirectory(directory_path);

      const [modelRows] = await pool.promise().execute(
        `SELECT id_model, name, download_url FROM ai_model`,
      );

      const matchedInstallations = [];

      for (const file of files) {
        // Try to match file with a model by name or download_url basename
        const matchedModel = modelRows.find((m) => {
          const urlBasename = m.download_url?.split("/").pop()?.toLowerCase();
          const fileNameLower = file.filename.toLowerCase();
          return (
            (urlBasename && fileNameLower.includes(urlBasename)) ||
            fileNameLower.includes(m.name.toLowerCase().split(" ")[0])
          );
        });

        if (matchedModel) {
          // Check if already in model_installation
          const [instRows] = await pool.promise().execute(
            `SELECT id_installation FROM model_installation WHERE fk_id_model = ? LIMIT 1`,
            [matchedModel.id_model],
          );

          if (instRows[0]) {
            await pool.promise().execute(
              `UPDATE model_installation
               SET installation_status = 'installed', local_path = ?, download_date = NOW()
               WHERE id_installation = ?`,
              [file.path, instRows[0].id_installation],
            );
          } else {
            await pool.promise().execute(
              `INSERT INTO model_installation
                (installation_status, local_path, download_date, fk_id_model)
               VALUES ('installed', ?, NOW(), ?)`,
              [file.path, matchedModel.id_model],
            );
          }

          matchedInstallations.push({
            id_model: matchedModel.id_model,
            name: matchedModel.name,
            file: file.filename,
            path: file.path,
            size_mb: file.size_mb,
          });
        }
      }

      return res.status(200).json({
        message: "Model scan completed successfully.",
        scanned_files_count: files.length,
        matched_models_count: matchedInstallations.length,
        installed: matchedInstallations,
        files,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listInstalled(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT
          i.id_installation,
          i.installation_status,
          i.local_path,
          i.download_date,
          i.fk_id_model,
          m.name,
          m.provider,
          m.size,
          m.ram_requirement,
          m.tags
         FROM model_installation i
         INNER JOIN ai_model m ON i.fk_id_model = m.id_model
         WHERE i.installation_status = 'installed'
         ORDER BY i.id_installation DESC`,
      );

      return res.status(200).json({ installed_models: rows });
    } catch (error) {
      return next(error);
    }
  }

  static async recommendModels(req, res, next) {
    try {
      const { task, target_ram_mb, target_free_ram_mb } = req.query;

      const [models] = await pool.promise().execute(
        `SELECT id_model, name, provider, size, status, download_url, description, ram_requirement, tags
         FROM ai_model
         WHERE status = 'available' OR status IS NULL`,
      );

      const result = ModelRecommendationService.evaluateModels(models, {
        task,
        target_ram_mb: target_ram_mb ? Number(target_ram_mb) : undefined,
        target_free_ram_mb: target_free_ram_mb ? Number(target_free_ram_mb) : undefined,
      });

      return res.status(200).json(result);
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AiModelController;
