const pool = require("../db/connect");

class ChatController {
  static async create(req, res, next) {
    try {
      const { title } = req.body;
      const userId = req.userId;

      if (!title || !title.trim()) {
        return res.status(400).json({
          error: "O título do chat é obrigatório.",
        });
      }

      const [result] = await pool.promise().execute(
        "INSERT INTO chat (title, fk_id_user) VALUES (?, ?)",
        [title.trim(), userId],
      );

      return res.status(201).json({
        message: "Chat criado com sucesso.",
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
        return res.status(404).json({
          error: "Chat não encontrado.",
        });
      }

      return res.status(200).json({
        chat: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = ChatController;