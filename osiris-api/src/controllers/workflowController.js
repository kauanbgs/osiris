const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

const canvasKey = (id) => `workflow_canvas_${id}`;

class WorkflowController {
  static async getCanvas(req, res, next) {
    try {
      const { id_workflow } = req.params;
      const [workflowRows] = await pool.promise().execute(
        "SELECT id_workflow, name FROM workflows WHERE id_workflow = ? AND fk_id_user = ? LIMIT 1",
        [id_workflow, req.userId],
      );
      if (!workflowRows[0]) throw new NotFoundError("Workflow not found.");

      const [rows] = await pool.promise().execute(
        "SELECT value FROM configuration WHERE fk_id_user = ? AND `key` = ? ORDER BY id_configuration DESC LIMIT 1",
        [req.userId, canvasKey(id_workflow)],
      );
      let canvas = { nodes: [], edges: [] };
      if (rows[0]?.value) {
        try {
          canvas = JSON.parse(rows[0].value);
        } catch {
          throw new BadRequestError("Saved workflow canvas is invalid.");
        }
      }
      return res.status(200).json({ workflow: workflowRows[0], canvas });
    } catch (error) {
      return next(error);
    }
  }

  static async saveCanvas(req, res, next) {
    try {
      const { id_workflow } = req.params;
      const { nodes, edges } = req.body;
      if (!Array.isArray(nodes) || !Array.isArray(edges)) {
        throw new BadRequestError("Canvas nodes and edges must be arrays.");
      }
      if (nodes.length > 200 || edges.length > 500) {
        throw new BadRequestError("Workflow canvas is too large.");
      }

      const [workflowRows] = await pool.promise().execute(
        "SELECT id_workflow FROM workflows WHERE id_workflow = ? AND fk_id_user = ? LIMIT 1",
        [id_workflow, req.userId],
      );
      if (!workflowRows[0]) throw new NotFoundError("Workflow not found.");

      const key = canvasKey(id_workflow);
      const [rows] = await pool.promise().execute(
        "SELECT id_configuration FROM configuration WHERE fk_id_user = ? AND `key` = ? ORDER BY id_configuration DESC LIMIT 1",
        [req.userId, key],
      );
      const value = JSON.stringify({ nodes, edges });
      if (rows[0]) {
        await pool.promise().execute(
          "UPDATE configuration SET value = ? WHERE id_configuration = ? AND fk_id_user = ?",
          [value, rows[0].id_configuration, req.userId],
        );
      } else {
        await pool.promise().execute(
          "INSERT INTO configuration (fk_id_user, `key`, value) VALUES (?, ?, ?)",
          [req.userId, key, value],
        );
      }
      return res.status(200).json({ message: "Workflow canvas saved." });
    } catch (error) {
      return next(error);
    }
  }

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
