import { OpenRouter } from "@openrouter/sdk";

const ROUTES = [
  "main",
  "coder",
  "researcher",
  "reviewer",
];

const openrouter = new OpenRouter({
  apiKey: "key",
});

export async function routeTask(prompt) {
  if (!prompt || typeof prompt !== "string") {
    console.warn("[JEV] Prompt vazio ou inválido.");
    return "main";
  }

  console.log("====================================");
  console.log("[JEV] Classificando solicitação");
  console.log("[JEV] Prompt:", prompt);
  console.log("====================================");

  try {
    const decision =
      await openrouter.alpha.decisions.create({
        decisionsRequest: {
          model: "typesafe/jev-1.13",

          state: {
            user_message: prompt,
          },

          questions: {
            route: {
              type: "choice",

              instructions:
                "Qual agente deve processar a solicitação contida em `user_message`? Escolha exatamente uma das opções disponíveis.",

              criteria: {
                main:
                  "Use quando for uma conversa geral, explicação simples, escrita, criatividade, pergunta comum ou tarefa que não precise de programação, pesquisa especializada ou revisão.",

                coder:
                  "Use quando a solicitação envolver programação, criação ou alteração de código, debugging, erros, APIs, bibliotecas, frameworks, React, JavaScript, TypeScript, Python, Electron, banco de dados, arquitetura de software ou desenvolvimento.",

                researcher:
                  "Use quando a solicitação exigir pesquisa, investigação, busca de informações, fatos atuais, comparação de fontes ou levantamento de informações.",

                reviewer:
                  "Use quando a solicitação pedir para revisar, analisar, validar, criticar, verificar ou melhorar código, texto, arquitetura, plano ou trabalho já existente.",
              },
            },
          },
        },
      });

    console.log(
      "[JEV] Resposta completa:",
      decision,
    );

    const answer =
      decision?.answers?.route;

    if (!answer) {
      console.warn(
        "[JEV] Nenhuma resposta recebida.",
      );

      return "main";
    }

    if (answer.type !== "choice") {
      console.warn(
        "[JEV] Tipo inesperado:",
        answer.type,
      );

      return "main";
    }

    const route = answer.choice;

    console.log(
      "[JEV] Agente escolhido:",
      route,
    );

    console.log(
      "[JEV] Confiança:",
      answer.confidence,
    );

    console.log(
      "[JEV] Probabilidades:",
      answer.probabilities,
    );

    if (!ROUTES.includes(route)) {
      console.warn(
        `[JEV] Rota inválida: ${route}`,
      );

      return "main";
    }

    return route;
  } catch (error) {
    console.error(
      "[JEV] Erro durante classificação:",
      error,
    );

    return "main";
  }
}