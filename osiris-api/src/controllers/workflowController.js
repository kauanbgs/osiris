const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class WorkflowController {
  static async create(req, res, next) {
    try {
      const { name, description } = req.body;
      const userId = req.userId;

      if (!name || !name.trim()) {
        throw new BadRequestError("Workflow name is required.");
      }

      if (!description || !description.trim()) {
        throw new BadRequestError("Workflow description is required.");
      }

      const [result] = await pool.promise().execute(
        `INSERT INTO workflows
          (name, description, fk_id_user)
         VALUES (?, ?, ?)`,
        [name.trim(), description.trim(), userId],
      );

      return res.status(201).json({
        message: "Workflow created successfully.",
        workflow: {
          id_workflow: result.insertId,
          name: name.trim(),
          description: description.trim(),
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
            id_workflow,
            name,
            description,
            fk_id_user
         FROM workflows
         WHERE fk_id_user = ?
         ORDER BY id_workflow DESC`,
        [userId],
      );

      return res.status(200).json({
        workflows: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_workflow } = req.params;
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
            id_workflow,
            name,
            description,
            fk_id_user
         FROM workflows
         WHERE id_workflow = ?
           AND fk_id_user = ?
         LIMIT 1`,
        [id_workflow, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Workflow not found.");
      }

      return res.status(200).json({
        workflow: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id_workflow } = req.params;
      const { name, description } = req.body;
      const userId = req.userId;

      if (!name || !name.trim()) {
        throw new BadRequestError("Workflow name is required.");
      }

      if (!description || !description.trim()) {
        throw new BadRequestError("Workflow description is required.");
      }

      const [result] = await pool.promise().execute(
        `UPDATE workflows
         SET name = ?, description = ?
         WHERE id_workflow = ?
           AND fk_id_user = ?`,
        [name.trim(), description.trim(), id_workflow, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Workflow not found.");
      }

      return res.status(200).json({
        message: "Workflow updated successfully.",
        workflow: {
          id_workflow: Number(id_workflow),
          name: name.trim(),
          description: description.trim(),
          fk_id_user: Number(userId),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id_workflow } = req.params;
      const userId = req.userId;

      const [result] = await pool.promise().execute(
        `DELETE FROM workflows
         WHERE id_workflow = ?
           AND fk_id_user = ?`,
        [id_workflow, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Workflow not found.");
      }

      return res.status(200).json({
        message: "Workflow deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = WorkflowController;
