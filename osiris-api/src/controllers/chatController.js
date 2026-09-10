const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class ChatController {
  static async create(req, res, next) {
    try {
      const { title } = req.body;
      const userId = req.userId;

      if (!title || !title.trim()) {
        throw new BadRequestError("Chat title is required.");
      }

      const [result] = await pool.promise().execute(
        "INSERT INTO chat (title, fk_id_user) VALUES (?, ?)",
        [title.trim(), userId],
      );

      return res.status(201).json({
        message: "Chat created successfully.",
        chat: {
          id_chat: result.insertId,
          title: title.trim(),
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
        `SELECT id_chat, title, fk_id_user
         FROM chat
         WHERE fk_id_user = ?
         ORDER BY id_chat DESC`,
        [userId],
      );

      return res.status(200).json({
        chats: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_chat } = req.params;
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT id_chat, title, fk_id_user
         FROM chat
         WHERE id_chat = ? AND fk_id_user = ?
         LIMIT 1`,
        [id_chat, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Chat not found.");
      }

      return res.status(200).json({
        chat: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id_chat } = req.params;
      const { title } = req.body;
      const userId = req.userId;

      if (typeof title !== "string" || !title.trim()) {
        throw new BadRequestError("Chat title is required.");
      }

      const normalizedTitle = title.trim();

      if (normalizedTitle.length > 255) {
        throw new BadRequestError(
          "Chat title must not exceed 255 characters.",
        );
      }

      const [result] = await pool.promise().execute(
        `UPDATE chat
         SET title = ?
         WHERE id_chat = ? AND fk_id_user = ?`,
        [normalizedTitle, id_chat, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Chat not found.");
      }

      return res.status(200).json({
        message: "Chat updated successfully.",
        chat: {
          id_chat: Number(id_chat),
          title: normalizedTitle,
          fk_id_user: Number(userId),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    let connection;

    try {
      const { id_chat } = req.params;
      const userId = req.userId;

      connection = await pool.promise().getConnection();
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `SELECT id_chat
         FROM chat
         WHERE id_chat = ? AND fk_id_user = ?
         LIMIT 1
         FOR UPDATE`,
        [id_chat, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Chat not found.");
      }

      // The current schema uses ON DELETE SET NULL for these relationships.
      // Remove dependent records explicitly so deleting a chat does not leave
      // messages or file associations without a parent chat.
      await connection.execute(
        "DELETE FROM messages WHERE fk_id_chat = ?",
        [id_chat],
      );
      await connection.execute(
        "DELETE FROM file_chat WHERE fk_id_chat = ?",
        [id_chat],
      );
      await connection.execute(
        "DELETE FROM chat WHERE id_chat = ? AND fk_id_user = ?",
        [id_chat, userId],
      );

      await connection.commit();

      return res.status(200).json({
        message: "Chat deleted successfully.",
      });
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      return next(error);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  }
}

module.exports = ChatController;
