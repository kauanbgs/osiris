const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

const WORKSPACE_CONFIG_KEY = "desktop_workspace_root";
const MAX_WORKSPACE_DEPTH = 12;
const MAX_WORKSPACE_ITEMS = 2000;

async function listWorkspaceItems(rootPath) {
  const items = [];

  async function walk(currentPath, relativeDirectory = "", depth = 0) {
    if (depth > MAX_WORKSPACE_DEPTH || items.length >= MAX_WORKSPACE_ITEMS) return;

    let entries;
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      if (items.length >= MAX_WORKSPACE_ITEMS) break;
      if (["node_modules", ".git", "dist", "build"].includes(entry.name)) continue;
      // Avoid following symlinks outside the selected workspace.
      if (entry.isSymbolicLink()) continue;

      const relativePath = path.posix.join(relativeDirectory, entry.name);
      const isDirectory = entry.isDirectory();
      items.push({
        name: entry.name,
        relativePath,
        type: isDirectory ? "folder" : "file",
      });

      if (isDirectory) {
        await walk(path.join(currentPath, entry.name), relativePath, depth + 1);
      }
    }
  }

  await walk(rootPath);
  return items;
}

class FileController {
  static async saveWorkspace(req, res, next) {
    try {
      const { folderPath } = req.body;
      if (typeof folderPath !== "string" || !folderPath.trim() || !path.isAbsolute(folderPath)) {
        throw new BadRequestError("A valid desktop folder path is required.");
      }

      const normalizedPath = await fs.promises.realpath(folderPath.trim());
      const stats = await fs.promises.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new BadRequestError("The selected path is not a folder.");
      }

      const userId = req.userId;
      const [rows] = await pool.promise().execute(
        `SELECT id_configuration
         FROM configuration
         WHERE fk_id_user = ? AND \`key\` = ?
         ORDER BY id_configuration DESC
         LIMIT 1`,
        [userId, WORKSPACE_CONFIG_KEY],
      );

      if (rows[0]) {
        await pool.promise().execute(
          `UPDATE configuration SET value = ? WHERE id_configuration = ? AND fk_id_user = ?`,
          [normalizedPath, rows[0].id_configuration, userId],
        );
      } else {
        await pool.promise().execute(
          "INSERT INTO configuration (fk_id_user, `key`, value) VALUES (?, ?, ?)",
          [userId, WORKSPACE_CONFIG_KEY, normalizedPath],
        );
      }

      return res.status(200).json({
        message: "Desktop folder linked successfully.",
        folderName: path.basename(normalizedPath),
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getWorkspace(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT value
         FROM configuration
         WHERE fk_id_user = ? AND \`key\` = ?
         ORDER BY id_configuration DESC
         LIMIT 1`,
        [req.userId, WORKSPACE_CONFIG_KEY],
      );

      const folderPath = rows[0]?.value;
      if (!folderPath) {
        return res.status(200).json({ workspace: null });
      }

      let stats;
      try {
        stats = await fs.promises.stat(folderPath);
      } catch {
        return res.status(200).json({ workspace: null });
      }
      if (!stats.isDirectory()) {
        return res.status(200).json({ workspace: null });
      }

      return res.status(200).json({
        workspace: {
          folderName: path.basename(folderPath),
          files: await listWorkspaceItems(folderPath),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

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
