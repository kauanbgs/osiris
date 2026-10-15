const http = require("http");
const https = require("https");

class AgentExecutionService {
  static executions = new Map();

  static estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  static getExecution(agentId) {
    return this.executions.get(String(agentId));
  }

  static pause(agentId) {
    const execution = this.getExecution(agentId);

    if (!execution || execution.status !== "running") {
      return false;
    }

    execution.status = "paused";
    return true;
  }

  static resume(agentId) {
    const execution = this.getExecution(agentId);

    if (!execution || execution.status !== "paused") {
      return false;
    }

    execution.status = "running";

    if (execution.resumeExecution) {
      execution.resumeExecution();
      execution.resumeExecution = null;
    }

    return true;
  }

  static cancel(agentId) {
    const execution = this.getExecution(agentId);

    if (
      !execution ||
      ["cancelled", "completed", "error"].includes(execution.status)
    ) {
      return false;
    }

    execution.status = "cancelled";

    if (execution.request) {
      execution.request.destroy(
        Object.assign(new Error("Agent execution cancelled."), {
          code: "AGENT_EXECUTION_CANCELLED",
        }),
      );
    }

    if (execution.resumeExecution) {
      execution.resumeExecution();
      execution.resumeExecution = null;
    }

    return true;
  }

  static async waitIfPaused(execution) {
    if (execution.status === "paused") {
      await new Promise((resolve) => {
        execution.resumeExecution = resolve;
      });
    }

    if (execution.status === "cancelled") {
      throw Object.assign(new Error("Agent execution cancelled."), {
        code: "AGENT_EXECUTION_CANCELLED",
      });
    }
  }

  static async run({ agent, input, tools = [] }) {
    const agentId = String(agent.id_agent);

    const current = this.getExecution(agentId);

    if (
      current &&
      !["cancelled", "completed", "error"].includes(current.status)
    ) {
      throw Object.assign(
        new Error("This agent already has an active execution."),
        { code: "AGENT_ALREADY_RUNNING" },
      );
    }

    const execution = {
      status: "running",
      request: null,
      resumeExecution: null,
    };

    this.executions.set(agentId, execution);

    const startTime = Date.now();

    try {
      const systemPrompt =
        agent.system_prompt ||
        `You are an autonomous AI agent named ${agent.name}. Your objective is: ${agent.objective}.`;

      const toolDescriptions = tools
        .map((tool) => `- ${tool.name}: ${tool.description}`)
        .join("\n");

      const fullPrompt = `${systemPrompt}\n${
        toolDescriptions ? `Available Tools:\n${toolDescriptions}\n` : ""
      }\nTask:\n${input}`;

      const inputTokens = this.estimateTokens(fullPrompt);
      let outputText = "";

      await this.waitIfPaused(execution);

      if (process.env.LLM_ENDPOINT) {
        try {
          outputText = await this.callLlmEndpoint(
            process.env.LLM_ENDPOINT,
            systemPrompt,
            input,
            execution,
          );
        } catch (error) {
          if (
            execution.status === "cancelled" ||
            error.code === "AGENT_EXECUTION_CANCELLED"
          ) {
            throw error;
          }

          outputText = `Execution completed for agent "${agent.name}". Objective: ${agent.objective}. Output processed for input: "${input.trim()}".`;
        }
      } else {
        outputText = `Execution completed for agent "${agent.name}". Objective: ${agent.objective}. Output processed for input: "${input.trim()}".`;
      }

      await this.waitIfPaused(execution);

      execution.status = "completed";

      return {
        output: outputText,
        metrics: {
          input_tokens: inputTokens,
          output_tokens: this.estimateTokens(outputText),
          response_time_ms: Date.now() - startTime,
        },
      };
    } catch (error) {
      execution.status =
        error.code === "AGENT_EXECUTION_CANCELLED"
          ? "cancelled"
          : "error";

      throw error;
    } finally {
      execution.request = null;

      if (this.executions.get(agentId) === execution) {
        this.executions.delete(agentId);
      }
    }
  }

  static callLlmEndpoint(endpoint, systemPrompt, userMessage, execution) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      const isHttps = url.protocol === "https:";
      const client = isHttps ? https : http;

      const payload = JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
      });

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 10000,
      };

      const req = client.request(options, (res) => {
        let body = "";

        res.on("data", (chunk) => {
          body += chunk;
        });

        res.on("end", () => {
          if (execution.status === "cancelled") {
            return reject(
              Object.assign(new Error("Agent execution cancelled."), {
                code: "AGENT_EXECUTION_CANCELLED",
              }),
            );
          }

          try {
            const data = JSON.parse(body);
            const content =
              data.choices?.[0]?.message?.content ||
              data.response ||
              body;

            resolve(content);
          } catch {
            resolve(body);
          }
        });
      });

      execution.request = req;

      req.on("error", (error) => {
        if (execution.status === "cancelled") {
          error.code = "AGENT_EXECUTION_CANCELLED";
        }

        reject(error);
      });

      req.on("timeout", () => {
        req.destroy(new Error("LLM request timeout"));
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = AgentExecutionService;
