const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class ToolController {
  /**
   * Create a new tool
   */
  static async create(req, res, next) {
    try {
      const { name, description, type, active } = req.body;

      // Validate required fields
      if (!name || !name.trim()) {
        throw new BadRequestError("Tool name is required.");
      }

      if (!type || !type.trim()) {
        throw new BadRequestError("Tool type is required.");
      }

      const isActive = active !== undefined ? active : true;

      const [result] = await pool.promise().execute(
        `INSERT INTO tool (name, description, type, active)
         VALUES (?, ?, ?, ?)`,
        [
          name.trim(),
          description ? description.trim() : null,
          type.trim(),
          isActive,
        ],
      );

      return res.status(201).json({
        message: "Tool created successfully.",
        tool: {
          id_tool: result.insertId,
          name: name.trim(),
          description: description ? description.trim() : null,
          type: type.trim(),
          active: isActive,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * List all tools
   */
  static async list(req, res, next) {
    try {
      const { active } = req.query;

      let query = `SELECT id_tool, name, description, type, active FROM tool`;
      const params = [];

      if (active !== undefined) {
        query += ` WHERE active = ?`;
        params.push(active === "true" ? 1 : 0);
      }

      query += ` ORDER BY id_tool DESC`;

      const [rows] = await pool.promise().execute(query, params);

      return res.status(200).json({
        tools: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get tool by ID
   */
  static async getById(req, res, next) {
    try {
      const { id_tool } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT id_tool, name, description, type, active
         FROM tool
         WHERE id_tool = ?
         LIMIT 1`,
        [id_tool],
      );

      if (!rows[0]) {
        throw new NotFoundError("Tool not found.");
      }

      return res.status(200).json({
        tool: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update tool
   */
  static async update(req, res, next) {
    try {
      const { id_tool } = req.params;
      const { name, description, type, active } = req.body;

      // Verify tool exists
      const [toolRows] = await pool.promise().execute(
        `SELECT id_tool FROM tool WHERE id_tool = ? LIMIT 1`,
        [id_tool],
      );

      if (!toolRows[0]) {
        throw new NotFoundError("Tool not found.");
      }

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (name !== undefined && name.trim()) {
        updates.push("name = ?");
        values.push(name.trim());
      }

      if (description !== undefined) {
        updates.push("description = ?");
        values.push(description ? description.trim() : null);
      }

      if (type !== undefined && type.trim()) {
        updates.push("type = ?");
        values.push(type.trim());
      }

      if (active !== undefined) {
        updates.push("active = ?");
        values.push(active ? 1 : 0);
      }

      if (updates.length === 0) {
        throw new BadRequestError("No fields to update.");
      }

      values.push(id_tool);

      await pool.promise().execute(
        `UPDATE tool SET ${updates.join(", ")} WHERE id_tool = ?`,
        values,
      );

      // Fetch updated tool
      const [updatedRows] = await pool.promise().execute(
        `SELECT id_tool, name, description, type, active
         FROM tool
         WHERE id_tool = ?
         LIMIT 1`,
        [id_tool],
      );

      return res.status(200).json({
        message: "Tool updated successfully.",
        tool: updatedRows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete tool
   */
  static async delete(req, res, next) {
    try {
      const { id_tool } = req.params;

      // Verify tool exists
      const [toolRows] = await pool.promise().execute(
        `SELECT id_tool FROM tool WHERE id_tool = ? LIMIT 1`,
        [id_tool],
      );

      if (!toolRows[0]) {
        throw new NotFoundError("Tool not found.");
      }

      // Delete tool
      await pool.promise().execute(
        `DELETE FROM tool WHERE id_tool = ?`,
        [id_tool],
      );

      return res.status(200).json({
        message: "Tool deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = ToolController;
