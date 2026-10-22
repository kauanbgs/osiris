const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class FileController {
  static async createLog(req, res, next) {
    try {
      const { id_file, file_name, action, status, message } = req.body;

      if (!file_name || !action || !status) {
        throw new BadRequestError(
          "Os campos file_name, action e status são obrigatórios.",
        );
      }

      const validActions = [
        "upload",
        "read",
        "association",
        "download",
        "delete",
      ];

      const validStatuses = ["success", "error"];

      if (!validActions.includes(action)) {
        throw new BadRequestError("Ação de log inválida.");
      }

      if (!validStatuses.includes(status)) {
        throw new BadRequestError("Status de log inválido.");
      }

      await FileController.registerLog({
        id_file: id_file || null,
        file_name,
        action,
        status,
        message: message || null,
      });

      return res.status(201).json({
        message: "Log registrado com sucesso.",
        sucesso: true,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async registerLog({
    id_file = null,
    file_name,
    action,
    status,
    message,
  }) {
    try {
      await pool.promise().execute(
        `INSERT INTO file_log
          (fk_id_file, file_name, action, status, message)
         VALUES (?, ?, ?, ?, ?)`,
        [id_file, file_name, action, status, message],
      );
    } catch (error) {
      // Um erro ao registrar o log não deve esconder o erro original.
      console.error("Falha ao registrar log de arquivo:", error.message);
    }
  }

  static async listLogs(req, res, next) {
    try {
      const { action, status, limit = "100" } = req.query;
      const parsedLimit = Number.parseInt(limit, 10);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 500
      ) {
        throw new BadRequestError("O limite deve ser um número entre 1 e 500.");
      }

      const conditions = [];
      const params = [];

      if (action) {
        conditions.push("action = ?");
        params.push(action);
      }

      if (status) {
        conditions.push("status = ?");
        params.push(status);
      }

      const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      const [logs] = await pool.promise().execute(
        `SELECT id_file_log, fk_id_file, file_name,
                action, status, message, created_at
         FROM file_log
         ${where}
         ORDER BY created_at DESC, id_file_log DESC
         LIMIT ?`,
        [...params, parsedLimit],
      );

      return res.status(200).json({
        total: logs.length,
        logs,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async upload(req, res, next) {
    let file;

    try {
      if (!req.file) {
        throw new BadRequestError("Nenhum arquivo enviado.");
      }

      file = req.file;

      const fileBuffer = fs.readFileSync(file.path);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      const extension = path.extname(file.originalname).slice(1) || null;
      const mimeType = file.mimetype || "application/octet-stream";

      const [result] = await pool.promise().execute(
        `INSERT INTO file (name, path, extension, size, hash, type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [file.originalname, file.path, extension, file.size, hash, mimeType],
      );

      await FileController.registerLog({
        id_file: result.insertId,
        file_name: file.originalname,
        action: "upload",
        status: "success",
        message: "Arquivo enviado com sucesso.",
      });

      return res.status(201).json({
        message: "Arquivo enviado com sucesso.",
        sucesso: true,
        file: {
          id_file: result.insertId,
          name: file.originalname,
          extension,
          size: file.size,
          hash,
          type: mimeType,
        },
      });
    } catch (error) {
      if (file) {
        await FileController.registerLog({
          file_name: file.originalname,
          action: "upload",
          status: "error",
          message: error.message,
        });
      }

      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path, extension, size, hash, type
         FROM file
         ORDER BY id_file DESC`,
      );

      return res.status(200).json({ files: rows });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_file } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path, extension, size, hash, type
         FROM file WHERE id_file = ? LIMIT 1`,
        [id_file],
      );

      if (!rows[0]) {
        throw new NotFoundError("Arquivo não encontrado.");
      }

      return res.status(200).json({ file: rows[0] });
    } catch (error) {
      return next(error);
    }
  }

  static async download(req, res, next) {
    let file;

    try {
      const { id_file } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path
         FROM file WHERE id_file = ? LIMIT 1`,
        [id_file],
      );

      if (!rows[0]) {
        throw new NotFoundError("Arquivo não encontrado.");
      }

      file = rows[0];

      if (!fs.existsSync(file.path)) {
        throw new NotFoundError("Arquivo físico não encontrado no servidor.");
      }

      await FileController.registerLog({
        id_file: file.id_file,
        file_name: file.name,
        action: "download",
        status: "success",
        message: "Download solicitado.",
      });

      return res.download(file.path, file.name, (error) => {
        if (error) {
          FileController.registerLog({
            id_file: file.id_file,
            file_name: file.name,
            action: "download",
            status: "error",
            message: error.message,
          });
        }
      });
    } catch (error) {
      if (file) {
        await FileController.registerLog({
          id_file: file.id_file,
          file_name: file.name,
          action: "download",
          status: "error",
          message: error.message,
        });
      }

      return next(error);
    }
  }

  static async delete(req, res, next) {
    let file;

    try {
      const { id_file } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path
         FROM file WHERE id_file = ? LIMIT 1`,
        [id_file],
      );

      if (!rows[0]) {
        throw new NotFoundError("Arquivo não encontrado.");
      }

      file = rows[0];

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      await pool
        .promise()
        .execute(`DELETE FROM file WHERE id_file = ?`, [id_file]);

      await FileController.registerLog({
        file_name: file.name,
        action: "delete",
        status: "success",
        message: "Arquivo excluído com sucesso.",
      });

      return res.status(200).json({
        message: "Arquivo excluído com sucesso.",
      });
    } catch (error) {
      if (file) {
        await FileController.registerLog({
          id_file: file.id_file,
          file_name: file.name,
          action: "delete",
          status: "error",
          message: error.message,
        });
      }

      return next(error);
    }
  }
}

module.exports = FileController;
