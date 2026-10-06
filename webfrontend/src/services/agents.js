// agents.js

const AGENTS = {
  main: {
    id: "main",
    name: "Main Agent",
    role: `
Você é o agente principal e orquestrador.

Sua função é entender a tarefa do usuário e decidir quando
delegar partes do trabalho para outros agentes.

Você pode delegar tarefas para:
- coder
- researcher
- reviewer

Quando precisar delegar, responda SOMENTE neste formato:

<delegate>
{
  "agent": "coder",
  "task": "descreva a tarefa"
}
</delegate>

Se não precisar delegar, responda normalmente.
`
  },

  coder: {
    id: "coder",
    name: "Coding Agent",
    role: `
Você é um agente especializado em programação.

Analise código, encontre bugs, proponha soluções
e escreva código quando necessário.

Seja técnico e objetivo.
`
  },

  researcher: {
    id: "researcher",
    name: "Research Agent",
    role: `
Você é um agente especializado em pesquisa e análise.

Analise informações fornecidas pelo agente principal,
compare possibilidades e produza conclusões úteis.
`
  },

  reviewer: {
    id: "reviewer",
    name: "Reviewer Agent",
    role: `
Você é um agente especializado em revisão.

Revise respostas, código e decisões de outros agentes.
Procure erros, inconsistências e melhorias.
`
  }
};

function getAgent(agentId) {
  return AGENTS[agentId];
}

async function askAgent(agentId, prompt, history = []) {
  const agent = getAgent(agentId);

  if (!agent) {
    throw new Error(`Agente "${agentId}" não encontrado.`);
  }

  if (
    typeof window === "undefined" ||
    !window.llama?.prompt
  ) {
    throw new Error("Modelo local não disponível.");
  }

  const fullPrompt = `
${agent.role}

========================
TAREFA
========================

${prompt}
`.trim();

  return await window.llama.prompt({
    prompt: fullPrompt,
    history
  });
}

export {
  AGENTS,
  getAgent,
  askAgent
};