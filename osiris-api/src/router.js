// router.js

import { OpenRouter } from "@openrouter/sdk";

const openrouter = new OpenRouter({
  apiKey: "key"
});

// ==========================================
// ROTAS DISPONÍVEIS
// ==========================================

const ROUTES = [
  "main",
  "coder",
  "researcher",
  "reviewer",
];

export async function routeTask(prompt) {
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
              "Qual agente é o mais adequado para lidar com `user_message`? Escolha somente um.",

            criteria: {
              main:
                "Conversas gerais, escrita, explicações, perguntas simples e tarefas que não exigem especialização.",

              coder:
                "Programação, código, debugging, arquitetura de software, APIs, bibliotecas, frameworks, banco de dados e desenvolvimento.",

              researcher:
                "Pesquisa, busca de informações, fatos, comparação de fontes, informações atuais ou tarefas que exigem investigação.",

              reviewer:
                "Revisar, criticar, validar ou avaliar código, textos, respostas, planos ou trabalhos já existentes.",
            },
          },
        },
      },
    });

  console.log("[JEV RAW]", decision);

  const answer = decision?.answers?.route;

  // O JEV retorna:
  // {
  //   type: "choice",
  //   choice: "coder",
  //   probabilities: {...},
  //   confidence: ...
  // }

  const route = answer?.choice;

  if (!ROUTES.includes(route)) {
    console.warn(
      `[ROUTER] Rota inválida recebida: ${route}`,
    );

    return "main";
  }

  console.log(
    `[ROUTER] ${route} | confiança: ${answer.confidence}`,
  );

  return route;
}