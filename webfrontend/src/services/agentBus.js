// agentBus.js

import { AGENTS, askAgent } from "./agents";


// ==========================================
// AGENT BUS
// ==========================================

class AgentBus {
  constructor() {
    this.agents = new Map();

    // Registra automaticamente todos os agentes
    for (const agentId of Object.keys(AGENTS)) {
      this.register(agentId);
    }
  }

  // ========================================
  // REGISTER
  // ========================================

  register(agentId) {
    if (!AGENTS[agentId]) {
      throw new Error(
        `Agente "${agentId}" não existe em AGENTS.`,
      );
    }

    if (this.agents.has(agentId)) {
      return;
    }

    this.agents.set(agentId, {
      id: agentId,
      name: AGENTS[agentId].name,
      status: "idle",
    });

    console.log(
      `[AGENT BUS] Agente registrado: ${agentId}`,
    );
  }

  // ========================================
  // UNREGISTER
  // ========================================

  unregister(agentId) {
    if (!this.agents.has(agentId)) {
      return false;
    }

    this.agents.delete(agentId);

    console.log(
      `[AGENT BUS] Agente removido: ${agentId}`,
    );

    return true;
  }

  // ========================================
  // GET AGENT
  // ========================================

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  // ========================================
  // GET ALL AGENTS
  // ========================================

  getAgents() {
    return Array.from(this.agents.values());
  }

  // ========================================
  // SEND TASK
  // ========================================

  async send(
    from,
    to,
    task,
    history = [],
    memory = [],
  ) {
    console.log(`[AGENT BUS] ${from} → ${to}`);
    console.log("[AGENT BUS] Task:", task);

    const target = this.agents.get(to);

    if (!target) {
      throw new Error(
        `Agente "${to}" não está registrado.`,
      );
    }

    if (target.status === "working") {
      throw new Error(
        `Agente "${to}" já está trabalhando.`,
      );
    }

    target.status = "working";

    try {
      const result = await askAgent(
        to,
        task,
        history,
        {
          stream: false,
          memory,
        },
      );

      console.log(
        `[AGENT BUS] ${to} terminou.`,
      );

      return {
        from,
        to,
        status: "completed",
        result,
      };
    } catch (error) {
      console.error(
        `[AGENT BUS] Erro em ${to}:`,
        error,
      );

      throw error;
    } finally {
      // Sempre libera o agente
      target.status = "idle";
    }
  }
}

// ==========================================
// SINGLETON
// ==========================================

const agentBus = new AgentBus();

// ==========================================
// MAIN ORCHESTRATOR
// ==========================================

async function runMainAgent(
  payload,
  historyArg = [],
) {
  let promptText = "";
  let history = historyArg;

  let onChunk = null;
  let onStatus = null;
  let memory = [];

  // ========================================
  // 1. NORMALIZA PAYLOAD
  // ========================================

  if (
    typeof payload === "object" &&
    payload !== null
  ) {
    promptText = payload.prompt || "";

    if (payload.history) {
      history = payload.history;
    }

    if (payload.onChunk) {
      onChunk = payload.onChunk;
    }

    if (payload.onStatus) {
      onStatus = payload.onStatus;
    }

    if (payload.memory) {
      memory = payload.memory;
    }
  } else {
    promptText = String(payload || "");
  }

  // ========================================
  // 2. FUNÇÃO DE STATUS
  // ========================================

  const status = (event) => {
    console.log(
      "[AGENT STATUS]",
      event,
    );

    if (typeof onStatus === "function") {
      onStatus(event);
    }
  };

  console.log(
    "========================================",
  );

  console.log(
    "[ORCHESTRATOR] Nova tarefa:",
  );

  console.log(promptText);

  console.log(
    "========================================",
  );

  // ========================================
  // 3. OSIRIS ASSUME DIRETAMENTE
  // ========================================

  console.log(
    "[ORCHESTRATOR] Executando Osiris diretamente.",
  );

  status({
    type: "agent_start",
    agent: "main",
    label: "Osiris está pensando...",
  });

  try {
    const response = await askAgent(
      "main",
      promptText,
      history,
      {
        stream: true,
        onChunk,
        memory,
        includeRole: false,
      },
    );

    status({
      type: "done",
      agent: "main",
      label: "Resposta concluída.",
    });

    console.log(
      "========================================",
    );

    console.log(
      "[ORCHESTRATOR] Finalizado.",
    );

    console.log(
      "========================================",
    );

    return response;
  } catch (error) {
    console.error(
      "[ORCHESTRATOR] Erro ao executar Osiris:",
      error,
    );

    status({
      type: "error",
      agent: "main",
      label: "Erro ao processar a solicitação.",
    });

    throw error;
  }
}

// ==========================================
// EXPORTS
// ==========================================

export {
  AgentBus,
  agentBus,
  runMainAgent,
};