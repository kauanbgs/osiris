const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class MemoryController {
  static async create(req, res, next) {
    try {
      const { content, importance } = req.body;
      const userId = req.userId;

      if (!content || !content.trim()) {
        throw new BadRequestError("Memory content is required.");
      }

      const normalizedImportance =
        importance !== undefined && importance !== null
          ? Number(importance)
          : null;

      const [result] = await pool.promise().execute(
        `INSERT INTO user_memory
          (content, importance, fk_id_user)
         VALUES (?, ?, ?)`,
        [content.trim(), normalizedImportance, userId],
      );

      return res.status(201).json({
        message: "Memory created successfully.",
        memory: {
          id_memory: result.insertId,
          content: content.trim(),
          importance: normalizedImportance,
          fk_id_user: userId,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
          id_memory,
          content,
          importance,
          created_at,
          updated_at,
          fk_id_user
         FROM user_memory
         WHERE fk_id_user = ?
         ORDER BY importance DESC, created_at DESC`,
        [userId],
      );

      return res.status(200).json({
        memories: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_memory } = req.params;
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
          id_memory,
          content,
          importance,
          created_at,
          updated_at,
          fk_id_user
         FROM user_memory
         WHERE id_memory = ?
           AND fk_id_user = ?
         LIMIT 1`,
        [id_memory, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Memory not found.");
      }

      return res.status(200).json({
        memory: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id_memory } = req.params;
      const { content, importance } = req.body;
      const userId = req.userId;

      if (content === undefined && importance === undefined) {
        throw new BadRequestError(
          "At least one field must be provided.",
        );
      }

      const [rows] = await pool.promise().execute(
        `SELECT id_memory, content, importance
         FROM user_memory
         WHERE id_memory = ?
           AND fk_id_user = ?
         LIMIT 1`,
        [id_memory, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Memory not found.");
      }

      const currentMemory = rows[0];

      const newContent =
        content !== undefined
          ? content.trim()
          : currentMemory.content;

      const newImportance =
        importance !== undefined
          ? importance === null
            ? null
            : Number(importance)
          : currentMemory.importance;

      await pool.promise().execute(
        `UPDATE user_memory
         SET content = ?, importance = ?
         WHERE id_memory = ?
           AND fk_id_user = ?`,
        [
          newContent,
          newImportance,
          id_memory,
          userId,
        ],
      );

      return res.status(200).json({
        message: "Memory updated successfully.",
        memory: {
          id_memory: Number(id_memory),
          content: newContent,
          importance: newImportance,
          fk_id_user: Number(userId),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id_memory } = req.params;
      const userId = req.userId;

      const [result] = await pool.promise().execute(
        `DELETE FROM user_memory
         WHERE id_memory = ?
           AND fk_id_user = ?`,
        [id_memory, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Memory not found.");
      }

      return res.status(200).json({
        message: "Memory deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  // =====================================================
  // BUSCAR MEMÓRIAS PARA USAR NO PROMPT DO CHAT
  // =====================================================

  static async getMemoryContext(userId) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT content, importance
         FROM user_memory
         WHERE fk_id_user = ?
         ORDER BY importance DESC, updated_at DESC
         LIMIT 50`,
        [userId],
      );

      if (rows.length === 0) {
        return "";
      }

      return rows
        .map((memory) => `- ${memory.content}`)
        .join("\n");
    } catch (error) {
      console.error(
        "Erro ao buscar contexto de memória:",
        error,
      );

      return "";
    }
  }
}

module.exports = MemoryController;