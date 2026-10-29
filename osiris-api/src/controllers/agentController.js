const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");
const AgentExecutionService = require("../services/agentExecutionService");
const {
  validateAgent,
  validateExecutionInput,
} = require("../validators/validateAgent");

class AgentController {
  static async create(req, res, next) {
    try {
      const { name, objective, system_prompt, fk_id_model } = req.body;

      const validationError = validateAgent(req.body, false);
      if (validationError) {
        throw new BadRequestError(validationError);
      }

      if (fk_id_model) {
        const [modelRows] = await pool
          .promise()
          .execute("SELECT id_model FROM ai_model WHERE id_model = ? LIMIT 1", [
            fk_id_model,
          ]);

        if (!modelRows[0]) {
          throw new NotFoundError("AI model not found.");
        }
      }

      const [result] = await pool.promise().execute(
        `INSERT INTO agent
          (name, objective, execution_log, system_prompt, fk_id_model)
         VALUES (?, ?, ?, ?, ?)`,
        [
          name.trim(),
          objective.trim(),
          "idle",
          system_prompt.trim(),
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
          fk_id_model: fk_id_model || null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT
          a.id_agent,
          a.name,
          a.objective,
          a.execution_log,
          a.system_prompt,
          a.fk_id_model,
          m.name AS model_name,
          m.provider AS model_provider
         FROM agent a
         LEFT JOIN ai_model m ON a.fk_id_model = m.id_model
         ORDER BY a.id_agent DESC`,
      );

      return res.status(200).json({ agents: rows });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_agent } = req.params;

      const [rows] = await pool.promise().execute(
        `SELECT
          a.id_agent,
          a.name,
          a.objective,
          a.execution_log,
          a.system_prompt,
          a.fk_id_model,
          m.name AS model_name,
          m.provider AS model_provider
         FROM agent a
         LEFT JOIN ai_model m ON a.fk_id_model = m.id_model
         WHERE a.id_agent = ?
         LIMIT 1`,
        [id_agent],
      );

      if (!rows[0]) {
        throw new NotFoundError("Agent not found.");
      }

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

  static async update(req, res, next) {
    try {
      const { id_agent } = req.params;
      const { name, objective, system_prompt, fk_id_model } = req.body;

      const [agentRows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const validationError = validateAgent(req.body, true);
      if (validationError) {
        throw new BadRequestError(validationError);
      }

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
          const [modelRows] = await pool
            .promise()
            .execute(
              "SELECT id_model FROM ai_model WHERE id_model = ? LIMIT 1",
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

      values.push(id_agent);

      await pool.promise().execute(
        `UPDATE agent
         SET ${updates.join(", ")}
         WHERE id_agent = ?`,
        values,
      );

      const [updatedRows] = await pool.promise().execute(
        `SELECT
          id_agent,
          name,
          objective,
          execution_log,
          system_prompt,
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

  static async delete(req, res, next) {
    try {
      const { id_agent } = req.params;

      const [agentRows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      await pool
        .promise()
        .execute("DELETE FROM agent WHERE id_agent = ?", [id_agent]);

      return res.status(200).json({
        message: "Agent deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  static async addTool(req, res, next) {
    try {
      const { id_agent } = req.params;
      const { fk_id_tool } = req.body;

      if (!fk_id_tool) {
        throw new BadRequestError("Tool ID is required.");
      }

      const [agentRows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const [toolRows] = await pool
        .promise()
        .execute("SELECT id_tool FROM tool WHERE id_tool = ? LIMIT 1", [
          fk_id_tool,
        ]);

      if (!toolRows[0]) {
        throw new NotFoundError("Tool not found.");
      }

      const [existingRows] = await pool.promise().execute(
        `SELECT id_tool_agent
         FROM tool_agent
         WHERE fk_id_agent = ? AND fk_id_tool = ?
         LIMIT 1`,
        [id_agent, fk_id_tool],
      );

      if (existingRows[0]) {
        throw new BadRequestError("Tool already linked to this agent.");
      }

      await pool
        .promise()
        .execute(
          "INSERT INTO tool_agent (fk_id_agent, fk_id_tool) VALUES (?, ?)",
          [id_agent, fk_id_tool],
        );

      return res.status(201).json({
        message: "Tool added to agent successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  static async removeTool(req, res, next) {
    try {
      const { id_agent, id_tool } = req.params;

      const [agentRows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const [result] = await pool.promise().execute(
        `DELETE FROM tool_agent
         WHERE fk_id_agent = ? AND fk_id_tool = ?`,
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

  static async execute(req, res, next) {
    let idExecution = null;
    let idAgent = null;
    let startTime = null;

    try {
      const { id_agent } = req.params;
      const { input } = req.body;

      idAgent = id_agent;

      const inputError = validateExecutionInput(input);
      if (inputError) {
        throw new BadRequestError(inputError);
      }

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
         WHERE a.id_agent = ?
         LIMIT 1`,
        [id_agent],
      );

      if (!agentRows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const agent = agentRows[0];
      startTime = Date.now();

      const [insertResult] = await pool.promise().execute(
        `INSERT INTO agent_execution_log
          (fk_id_agent, status, input)
         VALUES (?, 'running', ?)`,
        [id_agent, input.trim()],
      );

      idExecution = insertResult.insertId;

      await pool
        .promise()
        .execute("UPDATE agent SET execution_log = ? WHERE id_agent = ?", [
          "running",
          id_agent,
        ]);

      const executionResult = await AgentExecutionService.run({
        agent,
        input: input.trim(),
      });

      const metrics = executionResult.metrics;

      await pool.promise().execute(
        `UPDATE agent_execution_log
         SET status = 'completed',
             output = ?,
             input_tokens = ?,
             output_tokens = ?,
             response_time_ms = ?
         WHERE id_execution = ?`,
        [
          executionResult.output,
          metrics.input_tokens,
          metrics.output_tokens,
          Date.now() - startTime,
          idExecution,
        ],
      );

      await pool
        .promise()
        .execute("UPDATE agent SET execution_log = ? WHERE id_agent = ?", [
          "idle",
          id_agent,
        ]);

      return res.status(200).json({
        message: "Agent executed successfully.",
        execution: {
          agent_id: agent.id_agent,
          agent_name: agent.name,
          input: input.trim(),
          output: executionResult.output,
          model_used: agent.model_name || "No model configured",
          execution_time: new Date().toISOString(),
          metrics,
        },
      });
    } catch (error) {
      if (idExecution !== null) {
        try {
          const status =
            error.code === "AGENT_EXECUTION_CANCELLED" ? "cancelled" : "error";

          await pool.promise().execute(
            `UPDATE agent_execution_log
             SET status = ?,
                 output = ?,
                 response_time_ms = ?
             WHERE id_execution = ?`,
            [
              status,
              error.message,
              startTime ? Date.now() - startTime : 0,
              idExecution,
            ],
          );

          await pool
            .promise()
            .execute("UPDATE agent SET execution_log = ? WHERE id_agent = ?", [
              status,
              idAgent,
            ]);
        } catch (logError) {
          console.error("Failed to update execution history:", logError);
        }
      }

      return next(error);
    }
  }

  static async pause(req, res, next) {
    try {
      const { id_agent } = req.params;

      const [rows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!rows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const paused = AgentExecutionService.pause(id_agent);

      if (!paused) {
        throw new BadRequestError("Agent is not running or cannot be paused.");
      }

      await pool
        .promise()
        .execute("UPDATE agent SET execution_log = ? WHERE id_agent = ?", [
          "paused",
          id_agent,
        ]);

      await pool.promise().execute(
        `UPDATE agent_execution_log
         SET status = 'paused'
         WHERE fk_id_agent = ?
           AND status = 'running'
         ORDER BY id_execution DESC
         LIMIT 1`,
        [id_agent],
      );

      return res.status(200).json({
        message: "Agent paused successfully.",
        status: "paused",
      });
    } catch (error) {
      return next(error);
    }
  }

  static async resume(req, res, next) {
    try {
      const { id_agent } = req.params;

      const [rows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!rows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const resumed = AgentExecutionService.resume(id_agent);

      if (!resumed) {
        throw new BadRequestError("Agent is not paused.");
      }

      await pool
        .promise()
        .execute("UPDATE agent SET execution_log = ? WHERE id_agent = ?", [
          "running",
          id_agent,
        ]);

      await pool.promise().execute(
        `UPDATE agent_execution_log
         SET status = 'running'
         WHERE fk_id_agent = ?
           AND status = 'paused'
         ORDER BY id_execution DESC
         LIMIT 1`,
        [id_agent],
      );

      return res.status(200).json({
        message: "Agent resumed successfully.",
        status: "running",
      });
    } catch (error) {
      return next(error);
    }
  }

  static async cancel(req, res, next) {
    try {
      const { id_agent } = req.params;

      const [rows] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!rows[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const cancelled = AgentExecutionService.cancel(id_agent);

      if (!cancelled) {
        throw new BadRequestError("Agent has no active execution to cancel.");
      }

      await pool
        .promise()
        .execute("UPDATE agent SET execution_log = ? WHERE id_agent = ?", [
          "cancelled",
          id_agent,
        ]);

      await pool.promise().execute(
        `UPDATE agent_execution_log
         SET status = 'cancelled'
         WHERE fk_id_agent = ?
           AND status IN ('running', 'paused')
         ORDER BY id_execution DESC
         LIMIT 1`,
        [id_agent],
      );

      return res.status(200).json({
        message: "Agent execution cancelled successfully.",
        status: "cancelled",
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getExecutionLog(req, res, next) {
    try {
      const { id_agent } = req.params;

      const [agents] = await pool
        .promise()
        .execute("SELECT id_agent FROM agent WHERE id_agent = ? LIMIT 1", [
          id_agent,
        ]);

      if (!agents[0]) {
        throw new NotFoundError("Agent not found.");
      }

      const [logs] = await pool.promise().execute(
        `SELECT
          id_execution,
          fk_id_agent,
          status,
          input,
          output,
          input_tokens,
          output_tokens,
          response_time_ms,
          created_at
         FROM agent_execution_log
         WHERE fk_id_agent = ?
         ORDER BY created_at DESC, id_execution DESC
         LIMIT 100`,
        [id_agent],
      );

      return res.status(200).json({ logs });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = AgentController;
