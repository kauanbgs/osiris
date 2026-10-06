// src/router.js

const ROUTES = [
  "main",
  "coder",
  "researcher",
  "reviewer",
];

export async function routeTask(prompt) {
  const route =
    await window.electronAPI.routeAgent(prompt);

  if (!ROUTES.includes(route)) {
    return "main";
  }

  return route;
}