const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class FileController {
  static async upload(req, res, next) {
    try {
      if (!req.file) {
        throw new BadRequestError("Nenhum arquivo enviado.");
      }

      const file = req.file;
      const fileBuffer = fs.readFileSync(file.path);
      const hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
      const extension = path.extname(file.originalname).slice(1) || null;
      const mimeType = file.mimetype || "application/octet-stream";

      const [result] = await pool.promise().execute(
        `INSERT INTO file (name, path, extension, size, hash, type)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          file.originalname,
          file.path,
          extension,
          file.size,
          hash,
          mimeType,
        ],
      );

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
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path, extension, size, hash, type FROM file ORDER BY id_file DESC`,
      );

      return res.status(200).json({
        files: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_file } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path, extension, size, hash, type FROM file WHERE id_file = ? LIMIT 1`,
        [id_file],
      );

      if (!rows[0]) {
        throw new NotFoundError("Arquivo não encontrado.");
      }

      return res.status(200).json({
        file: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async download(req, res, next) {
    try {
      const { id_file } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_file, name, path FROM file WHERE id_file = ? LIMIT 1`,
        [id_file],
      );

      if (!rows[0]) {
        throw new NotFoundError("Arquivo não encontrado.");
      }

      const file = rows[0];
      if (!fs.existsSync(file.path)) {
        throw new NotFoundError("Arquivo físico não encontrado no servidor.");
      }

      return res.download(file.path, file.name);
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id_file } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_file, path FROM file WHERE id_file = ? LIMIT 1`,
        [id_file],
      );

      if (!rows[0]) {
        throw new NotFoundError("Arquivo não encontrado.");
      }

      const file = rows[0];
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch {
          // Continue if already deleted
        }
      }

      await pool.promise().execute(
        `DELETE FROM file WHERE id_file = ?`,
        [id_file],
      );

      return res.status(200).json({
        message: "Arquivo excluído com sucesso.",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = FileController;
