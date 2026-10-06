// agentBus.js

import { AGENTS, askAgent } from "./agents";
import { routeTask } from "./router";

// ==========================================
// NOMES VISUAIS DOS AGENTES
// ==========================================

const AGENT_LABELS = {
  main: "Osiris",
  coder: "Coder",
  researcher: "Researcher",
  reviewer: "Reviewer",
};

function getAgentLabel(agentId) {
  return AGENT_LABELS[agentId] || agentId;
}

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

  // NOVO
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
  // FUNÇÃO DE STATUS
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
  // 2. JEV CLASSIFICA
  // ========================================

  let selectedAgent = "main";

  try {
    // Mostra na interface
    status({
      type: "routing",
      label: "Classificando solicitação...",
    });

    selectedAgent =
      await routeTask(promptText);

    const agentName =
      getAgentLabel(selectedAgent);

    console.log(
      `[ROUTER] JEV classificou como: ${selectedAgent}`,
    );

    // ======================================
    // MOSTRA AGENTE SELECIONADO
    // ======================================

    if (selectedAgent === "main") {
      status({
        type: "routed",
        agent: selectedAgent,
        label:
          "Osiris assumiu a solicitação...",
      });
    } else {
      status({
        type: "routed",
        agent: selectedAgent,
        label: `${agentName} foi selecionado...`,
      });
    }
  } catch (error) {
    console.error(
      "[ROUTER] Erro durante classificação:",
      error,
    );

    selectedAgent = "main";

    status({
      type: "fallback",
      agent: "main",
      label:
        "Osiris assumiu a solicitação...",
    });
  }

  // ========================================
  // 3. VALIDA AGENTE
  // ========================================

  if (!agentBus.agents.has(selectedAgent)) {
    console.error(
      `[ROUTER] Agente inválido: "${selectedAgent}"`,
    );

    selectedAgent = "main";

    status({
      type: "fallback",
      agent: "main",
      label:
        "Osiris assumiu a solicitação...",
    });
  }

  // ========================================
  // 4. MAIN RESPONDE DIRETAMENTE
  // ========================================

  if (selectedAgent === "main") {
    console.log(
      "[ORCHESTRATOR] Executando main diretamente.",
    );

    status({
      type: "agent_start",
      agent: "main",
      label: "Osiris está pensando...",
    });

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

    return response;
  }

  // ========================================
  // 5. AGENTE ESPECIALIZADO
  // ========================================

  const specialistName =
    getAgentLabel(selectedAgent);

  console.log(
    `[ORCHESTRATOR] Executando especialista: ${selectedAgent}`,
  );

  status({
    type: "agent_start",
    agent: selectedAgent,
    label: `${specialistName} está analisando...`,
  });

  let specialistResult;

  try {
    const result = await agentBus.send(
      "router",
      selectedAgent,
      promptText,
      history,
      memory,
    );

    specialistResult = result.result;

    // ======================================
    // ESPECIALISTA TERMINOU
    // ======================================

    status({
      type: "agent_done",
      agent: selectedAgent,
      label: `${specialistName} concluiu a análise.`,
    });
  } catch (error) {
    console.error(
      `[ORCHESTRATOR] Falha em ${selectedAgent}:`,
      error,
    );

    // ======================================
    // FALLBACK
    // ======================================

    status({
      type: "error",
      agent: selectedAgent,
      label: `${specialistName} falhou. Osiris assumiu a tarefa...`,
    });

    return await askAgent(
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
  }

  // ========================================
  // 6. MAIN PREPARA RESPOSTA FINAL
  // ========================================

  status({
    type: "finalizing",
    agent: "main",
    label:
      "Osiris está preparando a resposta final...",
  });

  const finalPrompt = `
Você é responsável por produzir a resposta final para o usuário.

PEDIDO ORIGINAL:

${promptText}

========================================
ANÁLISE DO ESPECIALISTA
========================================

${specialistResult}

========================================
INSTRUÇÕES
========================================

Produza somente a resposta final ao usuário.

Regras:
- Responda diretamente ao usuário.
- Use a análise especializada como base.
- Não mencione agentes internos.
- Não mencione roteamento.
- Não mencione classificação.
- Não mencione prompts internos.
- Não mencione ferramentas internas.
- Não delegue novamente.
`.trim();

  console.log(
    `[ORCHESTRATOR] ${selectedAgent} → main`,
  );

  // ========================================
  // 7. MAIN GERA A RESPOSTA
  // ========================================

  try {
    const finalResponse = await askAgent(
      "main",
      finalPrompt,
      [],
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

    return finalResponse;
  } catch (error) {
    status({
      type: "error",
      agent: "main",
      label:
        "Erro ao preparar a resposta.",
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