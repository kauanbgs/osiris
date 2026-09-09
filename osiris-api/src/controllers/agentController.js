const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class AgentController {
  /**
   * Create a new agent
   */
  static async create(req, res, next) {
    try {
      const {
        name,
        objective,
        system_prompt,
        fk_id_model,
      } = req.body;
      const userId = req.userId;

      // Validate required fields
      if (!name || !name.trim()) {
        throw new BadRequestError("Agent name is required.");
      }

      if (!objective || !objective.trim()) {
        throw new BadRequestError("Agent objective is required.");
      }

      if (!system_prompt || !system_prompt.trim()) {
        throw new BadRequestError("Agent system prompt is required.");
      }

      // Verify model exists if provided
      if (fk_id_model) {
        const [modelRows] = await pool.promise().execute(
          `SELECT id_model FROM ai_model WHERE id_model = ? LIMIT 1`,
          [fk_id_model],
        );

        if (!modelRows[0]) {
          throw new NotFoundError("AI model not found.");
        }
      }

      // Create agent with 'idle' as default execution log
      const [result] = await pool.promise().execute(
        `INSERT INTO agent
          (name, objective, execution_log, system_prompt, fk_id_user, fk_id_model)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          name.trim(),
          objective.trim(),
          "idle",
          system_prompt.trim(),
          userId,
          fk_id_model || null,
        ],
      );

      return res.status(201).json({
        message: "Agent created successfully.",
        agent: {
          id_agent: result.insertId,
          name: name.trim(),
          objective: objective.trim(),
          execution_log: "idle",
          system_prompt: system_prompt.trim(),
          fk_id_user: userId,
          fk_id_model: fk_id_model || null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * List all agents for the authenticated user
   */
  static async list(req, res, next) {
    try {
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
          a.id_agent,
          a.name,
          a.objective,
          a.execution_log,
          a.system_prompt,
          a.fk_id_user,
          a.fk_id_model,
          m.name AS model_name,
          m.provider AS model_provider
         FROM agent a
         LEFT JOIN ai_model m ON a.fk_id_model = m.id_model
         WHERE a.fk_id_user = ?
         ORDER BY a.id_agent DESC`,
        [userId],
      );

      return res.status(200).json({
        agents: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Get agent by ID
   */
  static async getById(req, res, next) {
    try {
      const { id_agent } = req.params;
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
          a.id_agent,
          a.name,
          a.objective,
          a.execution_log,
          a.system_prompt,
          a.fk_id_user,
          a.fk_id_model,
          m.name AS model_name,
          m.provider AS model_provider
         FROM agent a
         LEFT JOIN ai_model m ON a.fk_id_model = m.id_model
         WHERE a.id_agent = ? AND a.fk_id_user = ?
         LIMIT 1`,
        [id_agent, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      // Get tools associated with this agent
      const [tools] = await pool.promise().execute(
        `SELECT
          t.id_tool,
          t.name,
          t.description,
          t.type,
          t.active
         FROM tool t
         INNER JOIN tool_agent ta ON t.id_tool = ta.fk_id_tool
         WHERE ta.fk_id_agent = ?`,
        [id_agent],
      );

      // Get files associated with this agent
      const [files] = await pool.promise().execute(
        `SELECT
          f.id_file,
          f.name,
          f.path,
          f.extension,
          f.size,
          f.type
         FROM file f
         INNER JOIN file_agent fa ON f.id_file = fa.fk_id_file
         WHERE fa.fk_id_agent = ?`,
        [id_agent],
      );

      return res.status(200).json({
        agent: {
          ...rows[0],
          tools,
          files,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Update agent
   */
  static async update(req, res, next) {
    try {
      const { id_agent } = req.params;
      const {
        name,
        objective,
        system_prompt,
        fk_id_model,
      } = req.body;
      const userId = req.userId;

      // Verify agent exists and belongs to user
      const [agentRows] = await pool.promise().execute(
        `SELECT id_agent FROM agent WHERE id_agent = ? AND fk_id_user = ? LIMIT 1`,
        [id_agent, userId],
      );

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      // Build dynamic update query
      const updates = [];
      const values = [];

      if (name !== undefined && name.trim()) {
        updates.push("name = ?");
        values.push(name.trim());
      }

      if (objective !== undefined && objective.trim()) {
        updates.push("objective = ?");
        values.push(objective.trim());
      }

      if (system_prompt !== undefined && system_prompt.trim()) {
        updates.push("system_prompt = ?");
        values.push(system_prompt.trim());
      }

      if (fk_id_model !== undefined) {
        if (fk_id_model === null) {
          updates.push("fk_id_model = NULL");
        } else {
          // Verify model exists
          const [modelRows] = await pool.promise().execute(
            `SELECT id_model FROM ai_model WHERE id_model = ? LIMIT 1`,
            [fk_id_model],
          );

          if (!modelRows[0]) {
            throw new NotFoundError("AI model not found.");
          }

          updates.push("fk_id_model = ?");
          values.push(fk_id_model);
        }
      }

      if (updates.length === 0) {
        throw new BadRequestError("No fields to update.");
      }

      // Add id_agent to values for WHERE clause
      values.push(id_agent, userId);

      await pool.promise().execute(
        `UPDATE agent SET ${updates.join(", ")} WHERE id_agent = ? AND fk_id_user = ?`,
        values,
      );

      // Fetch updated agent
      const [updatedRows] = await pool.promise().execute(
        `SELECT
          id_agent,
          name,
          objective,
          execution_log,
          system_prompt,
          fk_id_user,
          fk_id_model
         FROM agent
         WHERE id_agent = ?
         LIMIT 1`,
        [id_agent],
      );

      return res.status(200).json({
        message: "Agent updated successfully.",
        agent: updatedRows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Delete agent
   */
  static async delete(req, res, next) {
    try {
      const { id_agent } = req.params;
      const userId = req.userId;

      // Verify agent exists and belongs to user
      const [agentRows] = await pool.promise().execute(
        `SELECT id_agent FROM agent WHERE id_agent = ? AND fk_id_user = ? LIMIT 1`,
        [id_agent, userId],
      );

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      // Delete agent (CASCADE will handle related records)
      await pool.promise().execute(
        `DELETE FROM agent WHERE id_agent = ? AND fk_id_user = ?`,
        [id_agent, userId],
      );

      return res.status(200).json({
        message: "Agent deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Add tool to agent
   */
  static async addTool(req, res, next) {
    try {
      const { id_agent } = req.params;
      const { fk_id_tool } = req.body;
      const userId = req.userId;

      if (!fk_id_tool) {
        throw new BadRequestError("Tool ID is required.");
      }

      // Verify agent exists and belongs to user
      const [agentRows] = await pool.promise().execute(
        `SELECT id_agent FROM agent WHERE id_agent = ? AND fk_id_user = ? LIMIT 1`,
        [id_agent, userId],
      );

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      // Verify tool exists
      const [toolRows] = await pool.promise().execute(
        `SELECT id_tool FROM tool WHERE id_tool = ? LIMIT 1`,
        [fk_id_tool],
      );

      if (!toolRows[0]) {
        throw new NotFoundError("Tool not found.");
      }

      // Check if tool is already linked
      const [existingRows] = await pool.promise().execute(
        `SELECT id_tool_agent FROM tool_agent WHERE fk_id_agent = ? AND fk_id_tool = ? LIMIT 1`,
        [id_agent, fk_id_tool],
      );

      if (existingRows[0]) {
        throw new BadRequestError("Tool already linked to this agent.");
      }

      // Link tool to agent
      await pool.promise().execute(
        `INSERT INTO tool_agent (fk_id_agent, fk_id_tool) VALUES (?, ?)`,
        [id_agent, fk_id_tool],
      );

      return res.status(201).json({
        message: "Tool added to agent successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Remove tool from agent
   */
  static async removeTool(req, res, next) {
    try {
      const { id_agent, id_tool } = req.params;
      const userId = req.userId;

      // Verify agent exists and belongs to user
      const [agentRows] = await pool.promise().execute(
        `SELECT id_agent FROM agent WHERE id_agent = ? AND fk_id_user = ? LIMIT 1`,
        [id_agent, userId],
      );

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      // Delete tool link
      const [result] = await pool.promise().execute(
        `DELETE FROM tool_agent WHERE fk_id_agent = ? AND fk_id_tool = ?`,
        [id_agent, id_tool],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Tool not linked to this agent.");
      }

      return res.status(200).json({
        message: "Tool removed from agent successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Execute agent (basic implementation)
   */
  static async execute(req, res, next) {
    try {
      const { id_agent } = req.params;
      const { input } = req.body;
      const userId = req.userId;

      if (!input || !input.trim()) {
        throw new BadRequestError("Input is required to execute agent.");
      }

      // Verify agent exists and belongs to user
      const [agentRows] = await pool.promise().execute(
        `SELECT
          a.id_agent,
          a.name,
          a.objective,
          a.system_prompt,
          a.fk_id_model,
          m.name AS model_name
         FROM agent a
         LEFT JOIN ai_model m ON a.fk_id_model = m.id_model
         WHERE a.id_agent = ? AND a.fk_id_user = ?
         LIMIT 1`,
        [id_agent, userId],
      );

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const agent = agentRows[0];

      // Update execution log to 'running'
      await pool.promise().execute(
        `UPDATE agent SET execution_log = ? WHERE id_agent = ?`,
        ["running", id_agent],
      );

      // TODO: Integrate with actual AI model execution
      // For now, return a mock response
      const response = {
        agent_id: agent.id_agent,
        agent_name: agent.name,
        input: input.trim(),
        output: `Agent "${agent.name}" executed with objective: ${agent.objective}. (Mock response - AI integration pending)`,
        model_used: agent.model_name || "No model configured",
        execution_time: new Date().toISOString(),
      };

      // Update execution log back to 'idle'
      await pool.promise().execute(
        `UPDATE agent SET execution_log = ? WHERE id_agent = ?`,
        ["idle", id_agent],
      );

      return res.status(200).json({
        message: "Agent executed successfully.",
        execution: response,
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AgentController;
