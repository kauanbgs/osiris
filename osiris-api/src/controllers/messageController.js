const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class MessageController {
  static async create(req, res, next) {
    try {
      const { id_chat } = req.params;
      const { type, content, fk_id_model } = req.body;
      const userId = req.userId;

      // Validate content
      if (!content || !content.trim()) {
        throw new BadRequestError("Message content is required.");
      }

      // Allowed types
      const allowedTypes = [
        "user",
        "assistant",
        "system",
        "tool",
      ];

      if (!type || !allowedTypes.includes(type)) {
        throw new BadRequestError("Invalid message type.");
      }

      // Verify chat belongs to user
      const [chatRows] = await pool.promise().execute(
        `SELECT id_chat
         FROM chat
         WHERE id_chat = ? AND fk_id_user = ?
         LIMIT 1`,
        [id_chat, userId],
      );

      if (!chatRows[0]) {
        throw new NotFoundError("Chat not found.");
      }

      // Verify model if provided
      if (
        fk_id_model !== undefined &&
        fk_id_model !== null
      ) {
        const [modelRows] = await pool.promise().execute(
          `SELECT id_model
           FROM ai_model
           WHERE id_model = ?
           LIMIT 1`,
          [fk_id_model],
        );

        if (!modelRows[0]) {
          throw new NotFoundError("AI model not found.");
        }
      }

      // Save message
      const [result] = await pool.promise().execute(
        `INSERT INTO messages
          (type, content, fk_id_chat, fk_id_model)
         VALUES (?, ?, ?, ?)`,
        [
          type,
          content.trim(),
          id_chat,
          fk_id_model ?? null,
        ],
      );

      return res.status(201).json({
        message: "Message created successfully.",
        data: {
          id_message: result.insertId,
          type,
          content: content.trim(),
          fk_id_chat: Number(id_chat),
          fk_id_model: fk_id_model ?? null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listByChat(req, res, next) {
    try {
      const { id_chat } = req.params;
      const userId = req.userId;

      // Verify chat belongs to user
      const [chatRows] = await pool.promise().execute(
        `SELECT id_chat
         FROM chat
         WHERE id_chat = ? AND fk_id_user = ?
         LIMIT 1`,
        [id_chat, userId],
      );

      if (!chatRows[0]) {
        throw new NotFoundError("Chat not found.");
      }

      // Fetch messages
      const [rows] = await pool.promise().execute(
        `SELECT
            id_message,
            type,
            content,
            created_at,
            fk_id_chat,
            fk_id_model
         FROM messages
         WHERE fk_id_chat = ?
         ORDER BY id_message ASC`,
        [id_chat],
      );

      return res.status(200).json({
        messages: rows,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = MessageController;