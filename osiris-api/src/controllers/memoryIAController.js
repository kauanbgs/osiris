const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

const MIN_IMPORTANCE = 1;
const MAX_IMPORTANCE = 10;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class MemoryIAController {
  static parsePositiveInteger(value, fieldName) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestError(`${fieldName} must be a positive integer.`);
    }

    return parsed;
  }

  static parseImportance(value, required = false) {
    if (value === undefined || value === null || value === "") {
      if (required) {
        throw new BadRequestError("Memory importance is required.");
      }

      return null;
    }

    const importance = Number(value);

    if (
      !Number.isInteger(importance) ||
      importance < MIN_IMPORTANCE ||
      importance > MAX_IMPORTANCE
    ) {
      throw new BadRequestError(
        `Memory importance must be an integer between ${MIN_IMPORTANCE} and ${MAX_IMPORTANCE}.`,
      );
    }

    return importance;
  }

  static async ensureOwnedAgent(idAgent, userId) {
    const [rows] = await pool.promise().execute(
      `SELECT id_agent
       FROM agent
       WHERE id_agent = ? AND fk_id_user = ?
       LIMIT 1`,
      [idAgent, userId],
    );

    if (!rows[0]) {
      throw new NotFoundError("Agent not found.");
    }
  }

  static async create(req, res, next) {
    try {
      const idAgent = MemoryIAController.parsePositiveInteger(
        req.params.id_agent,
        "Agent ID",
      );
      const { content, importance } = req.body;
      const normalizedImportance = MemoryIAController.parseImportance(importance);

      if (typeof content !== "string" || !content.trim()) {
        throw new BadRequestError("Memory content is required.");
      }

      await MemoryIAController.ensureOwnedAgent(idAgent, req.userId);

      const normalizedContent = content.trim();
      const [result] = await pool.promise().execute(
        `INSERT INTO agent_memory (content, importance, fk_id_agent)
         VALUES (?, ?, ?)`,
        [normalizedContent, normalizedImportance, idAgent],
      );

      return res.status(201).json({
        message: "Memory saved successfully.",
        memory: {
          id_memory: result.insertId,
          content: normalizedContent,
          importance: normalizedImportance,
          fk_id_agent: idAgent,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const idAgent = MemoryIAController.parsePositiveInteger(
        req.params.id_agent,
        "Agent ID",
      );
      const limit = req.query.limit === undefined
        ? DEFAULT_LIMIT
        : MemoryIAController.parsePositiveInteger(req.query.limit, "Limit");
      const offset = req.query.offset === undefined
        ? 0
        : Number(req.query.offset);

      if (limit > MAX_LIMIT) {
        throw new BadRequestError(`Limit must not exceed ${MAX_LIMIT}.`);
      }

      if (!Number.isInteger(offset) || offset < 0) {
        throw new BadRequestError("Offset must be a non-negative integer.");
      }

      const filters = ["fk_id_agent = ?"];
      const values = [idAgent];

      if (req.query.search !== undefined) {
        if (typeof req.query.search !== "string" || !req.query.search.trim()) {
          throw new BadRequestError("Search must not be empty.");
        }

        filters.push("content LIKE ?");
        values.push(`%${req.query.search.trim()}%`);
      }

      if (req.query.min_importance !== undefined) {
        const minImportance = MemoryIAController.parseImportance(
          req.query.min_importance,
          true,
        );
        filters.push("importance >= ?");
        values.push(minImportance);
      }

      await MemoryIAController.ensureOwnedAgent(idAgent, req.userId);

      const where = filters.join(" AND ");
      const [countRows] = await pool.promise().execute(
        `SELECT COUNT(*) AS total
         FROM agent_memory
         WHERE ${where}`,
        values,
      );
      const [rows] = await pool.promise().execute(
        `SELECT id_memory, content, importance, created_at, updated_at, fk_id_agent
         FROM agent_memory
         WHERE ${where}
         ORDER BY importance DESC, updated_at DESC, id_memory DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      );

      return res.status(200).json({
        memories: rows,
        pagination: {
          total: Number(countRows[0]?.total || 0),
          limit,
          offset,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getContext(req, res, next) {
    try {
      const idAgent = MemoryIAController.parsePositiveInteger(
        req.params.id_agent,
        "Agent ID",
      );
      const limit = req.query.limit === undefined
        ? 10
        : MemoryIAController.parsePositiveInteger(req.query.limit, "Limit");

      if (limit > MAX_LIMIT) {
        throw new BadRequestError(`Limit must not exceed ${MAX_LIMIT}.`);
      }

      await MemoryIAController.ensureOwnedAgent(idAgent, req.userId);

      const [rows] = await pool.promise().execute(
        `SELECT id_memory, content, importance, created_at, updated_at
         FROM agent_memory
         WHERE fk_id_agent = ?
         ORDER BY importance DESC, updated_at DESC, id_memory DESC
         LIMIT ?`,
        [idAgent, limit],
      );

      return res.status(200).json({
        agent_id: idAgent,
        memories: rows,
        context: rows.map((memory) => memory.content).join("\n"),
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const idAgent = MemoryIAController.parsePositiveInteger(
        req.params.id_agent,
        "Agent ID",
      );
      const idMemory = MemoryIAController.parsePositiveInteger(
        req.params.id_memory,
        "Memory ID",
      );

      await MemoryIAController.ensureOwnedAgent(idAgent, req.userId);

      const [rows] = await pool.promise().execute(
        `SELECT id_memory, content, importance, created_at, updated_at, fk_id_agent
         FROM agent_memory
         WHERE id_memory = ? AND fk_id_agent = ?
         LIMIT 1`,
        [idMemory, idAgent],
      );

      if (!rows[0]) {
        throw new NotFoundError("Memory not found.");
      }

      return res.status(200).json({ memory: rows[0] });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const idAgent = MemoryIAController.parsePositiveInteger(
        req.params.id_agent,
        "Agent ID",
      );
      const idMemory = MemoryIAController.parsePositiveInteger(
        req.params.id_memory,
        "Memory ID",
      );
      const { content, importance } = req.body;
      const updates = [];
      const values = [];

      if (content !== undefined) {
        if (typeof content !== "string" || !content.trim()) {
          throw new BadRequestError("Memory content must not be empty.");
        }

        updates.push("content = ?");
        values.push(content.trim());
      }

      if (importance !== undefined) {
        updates.push("importance = ?");
        values.push(MemoryIAController.parseImportance(importance, true));
      }

      if (updates.length === 0) {
        throw new BadRequestError("No fields to update.");
      }

      await MemoryIAController.ensureOwnedAgent(idAgent, req.userId);

      const [result] = await pool.promise().execute(
        `UPDATE agent_memory
         SET ${updates.join(", ")}
         WHERE id_memory = ? AND fk_id_agent = ?`,
        [...values, idMemory, idAgent],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Memory not found.");
      }

      const [rows] = await pool.promise().execute(
        `SELECT id_memory, content, importance, created_at, updated_at, fk_id_agent
         FROM agent_memory
         WHERE id_memory = ? AND fk_id_agent = ?
         LIMIT 1`,
        [idMemory, idAgent],
      );

      return res.status(200).json({
        message: "Memory updated successfully.",
        memory: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const idAgent = MemoryIAController.parsePositiveInteger(
        req.params.id_agent,
        "Agent ID",
      );
      const idMemory = MemoryIAController.parsePositiveInteger(
        req.params.id_memory,
        "Memory ID",
      );

      await MemoryIAController.ensureOwnedAgent(idAgent, req.userId);

      const [result] = await pool.promise().execute(
        `DELETE FROM agent_memory
         WHERE id_memory = ? AND fk_id_agent = ?`,
        [idMemory, idAgent],
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
}

module.exports = MemoryIAController;
