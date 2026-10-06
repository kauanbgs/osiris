import { askAgent } from "./agents";

class AgentBus {
  constructor() {
    this.agents = new Map();
  }

  register(agentId) {
    this.agents.set(agentId, {
      id: agentId,
      status: "idle"
    });
  }

  async send(from, to, task) {
    console.log(
      `[AGENT BUS] ${from} → ${to}`
    );

    const target = this.agents.get(to);

    if (!target) {
      throw new Error(
        `Agente "${to}" não está registrado.`
      );
    }

    target.status = "working";

    try {
      const result = await askAgent(
        to,
        task
      );

      target.status = "idle";

      return {
        from,
        to,
        status: "completed",
        result
      };

    } catch (error) {
      target.status = "error";

      throw error;
    }
  }
}

const agentBus = new AgentBus();

agentBus.register("main");
agentBus.register("coder");
agentBus.register("researcher");
agentBus.register("reviewer");

async function runMainAgent(prompt, history = []) {
  const response = await askAgent(
    "main",
    prompt,
    history
  );

  const delegateMatch = response.match(
    /<delegate>([\s\S]*?)<\/delegate>/
  );

  if (!delegateMatch) {
    return response;
  }

  let delegation;

  try {
    delegation = JSON.parse(
      delegateMatch[1]
    );
  } catch {
    return response;
  }

  const { agent, task } = delegation;

  if (!agent || !task) {
    return response;
  }

  console.log(
    `[ORCHESTRATOR] Delegando para ${agent}`
  );

  const result = await agentBus.send(
    "main",
    agent,
    task
  );

  const finalPrompt = `
Você é o agente principal.

O usuário pediu:

${prompt}

Você delegou uma parte da tarefa para outro agente.

Resultado recebido:

${result.result}

Agora produza a resposta final para o usuário.

Não mencione a arquitetura interna dos agentes.
`.trim();

  return await askAgent(
    "main",
    finalPrompt,
    []
  );
}

export {
  AgentBus,
  runMainAgent
};