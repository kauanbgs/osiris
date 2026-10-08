const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class NodeController {
  static async create(req, res, next) {
    try {
      const { type, name, priority, fk_id_agent, fk_id_workflow } = req.body;

      const userId = req.userId;

      if (!type || !type.trim()) {
        throw new BadRequestError("Node type is required.");
      }

      if (!name || !name.trim()) {
        throw new BadRequestError("Node name is required.");
      }

      if (priority === undefined || priority === null) {
        throw new BadRequestError("Node priority is required.");
      }

      if (!fk_id_workflow) {
        throw new BadRequestError("Node workflow is required.");
      }

      const [workflowRows] = await pool.promise().execute(
        `SELECT id_workflow
           FROM workflows
           WHERE id_workflow = ?
             AND fk_id_user = ?
           LIMIT 1`,
        [fk_id_workflow, userId],
      );

      if (!workflowRows[0]) {
        throw new NotFoundError("Workflow not found.");
      }

      if (fk_id_agent) {
        const [agentRows] = await pool.promise().execute(
          `SELECT id_agent
             FROM agent
             WHERE id_agent = ?
             LIMIT 1`,
          [fk_id_agent],
        );

        if (!agentRows[0]) {
          throw new NotFoundError("Agent not found.");
        }
      }

      const [result] = await pool.promise().execute(
        `INSERT INTO node
            (
              type,
              name,
              priority,
              fk_id_agent,
              fk_id_workflow
            )
           VALUES (?, ?, ?, ?, ?)`,
        [
          type.trim(),
          name.trim(),
          priority,
          fk_id_agent || null,
          fk_id_workflow,
        ],
      );

      return res.status(201).json({
        message: "Node created successfully.",
        node: {
          id_node: result.insertId,
          type: type.trim(),
          name: name.trim(),
          priority,
          fk_id_agent: fk_id_agent || null,
          fk_id_workflow: Number(fk_id_workflow),
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
              n.id_node,
              n.type,
              n.name,
              n.priority,
              n.fk_id_agent,
              n.fk_id_workflow
           FROM node n
           INNER JOIN workflows w
             ON n.fk_id_workflow = w.id_workflow
           WHERE w.fk_id_user = ?
           ORDER BY n.priority ASC,
                    n.id_node ASC`,
        [userId],
      );

      return res.status(200).json({
        nodes: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listByWorkflow(req, res, next) {
    try {
      const { id_workflow } = req.params;

      const userId = req.userId;

      const [workflowRows] = await pool.promise().execute(
        `SELECT id_workflow
           FROM workflows
           WHERE id_workflow = ?
             AND fk_id_user = ?
           LIMIT 1`,
        [id_workflow, userId],
      );

      if (!workflowRows[0]) {
        throw new NotFoundError("Workflow not found.");
      }

      const [rows] = await pool.promise().execute(
        `SELECT
              id_node,
              type,
              name,
              priority,
              fk_id_agent,
              fk_id_workflow
           FROM node
           WHERE fk_id_workflow = ?
           ORDER BY priority ASC,
                    id_node ASC`,
        [id_workflow],
      );

      return res.status(200).json({
        nodes: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_node } = req.params;

      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
              n.id_node,
              n.type,
              n.name,
              n.priority,
              n.fk_id_agent,
              n.fk_id_workflow
           FROM node n
           INNER JOIN workflows w
             ON n.fk_id_workflow =
                w.id_workflow
           WHERE n.id_node = ?
             AND w.fk_id_user = ?
           LIMIT 1`,
        [id_node, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Node not found.");
      }

      return res.status(200).json({
        node: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id_node } = req.params;

      const { type, name, priority, fk_id_agent, fk_id_workflow } = req.body;

      const userId = req.userId;

      if (!type || !type.trim()) {
        throw new BadRequestError("Node type is required.");
      }

      if (!name || !name.trim()) {
        throw new BadRequestError("Node name is required.");
      }

      if (priority === undefined || priority === null) {
        throw new BadRequestError("Node priority is required.");
      }

      if (!fk_id_workflow) {
        throw new BadRequestError("Node workflow is required.");
      }

      const [workflowRows] = await pool.promise().execute(
        `SELECT id_workflow
           FROM workflows
           WHERE id_workflow = ?
             AND fk_id_user = ?
           LIMIT 1`,
        [fk_id_workflow, userId],
      );

      if (!workflowRows[0]) {
        throw new NotFoundError("Workflow not found.");
      }

      const [nodeRows] = await pool.promise().execute(
        `SELECT n.id_node
           FROM node n
           INNER JOIN workflows w
             ON n.fk_id_workflow =
                w.id_workflow
           WHERE n.id_node = ?
             AND w.fk_id_user = ?
           LIMIT 1`,
        [id_node, userId],
      );

      if (!nodeRows[0]) {
        throw new NotFoundError("Node not found.");
      }

      if (fk_id_agent) {
        const [agentRows] = await pool.promise().execute(
          `SELECT id_agent
             FROM agent
             WHERE id_agent = ?
             LIMIT 1`,
          [fk_id_agent],
        );

        if (!agentRows[0]) {
          throw new NotFoundError("Agent not found.");
        }
      }

      await pool.promise().execute(
        `UPDATE node
         SET
           type = ?,
           name = ?,
           priority = ?,
           fk_id_agent = ?,
           fk_id_workflow = ?
         WHERE id_node = ?`,
        [
          type.trim(),
          name.trim(),
          priority,
          fk_id_agent || null,
          fk_id_workflow,
          id_node,
        ],
      );

      return res.status(200).json({
        message: "Node updated successfully.",
        node: {
          id_node: Number(id_node),
          type: type.trim(),
          name: name.trim(),
          priority,
          fk_id_agent: fk_id_agent || null,
          fk_id_workflow: Number(fk_id_workflow),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id_node } = req.params;

      const userId = req.userId;

      const [result] = await pool.promise().execute(
        `DELETE n
           FROM node n
           INNER JOIN workflows w
             ON n.fk_id_workflow =
                w.id_workflow
           WHERE n.id_node = ?
             AND w.fk_id_user = ?`,
        [id_node, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Node not found.");
      }

      return res.status(200).json({
        message: "Node deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = NodeController;
