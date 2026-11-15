// desktopModels.js — fala com o app desktop: status, terminal e modelos locais (porta 8080 na rede local).
// Se o PC não estiver na mesma rede, terminal e arquivos usam a API, que repassa o pedido ao desktop da mesma conta.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { aiUrl } from "./serverConfig";

// Por onde o celular alcança o PC: "local" (mesma rede, porta 8080) ou "api" (pela nuvem).
let rotaDesktop = "local";

export function rotaAtualDesktop() {
  return rotaDesktop;
}

// Fala com o servidor de IA do app desktop (Electron, porta 8080).
async function request(path, { method = "GET", body, timeoutMs = 10000, token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${aiUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      // resposta sem JSON
    }

    if (!response.ok) {
      if (response.status === 404 && !data?.error) {
        throw new Error(
          "O desktop não reconheceu o pedido. Atualize o app desktop do Osíris."
        );
      }
      const erro = new Error(data?.error || `Erro HTTP ${response.status}`);
      erro.status = response.status;
      throw erro;
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const erro = new Error("O desktop demorou demais para responder.");
      erro.demorou = true;
      throw erro;
    }
    if (error instanceof TypeError) {
      const erro = new Error(
        "Não foi possível conectar ao desktop. Verifique se o app desktop está aberto e se o IP está correto."
      );
      erro.semConexao = true;
      throw erro;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Usado pelos outros serviços que falam com o app desktop (ex.: pasta compartilhada).
export { request as requisitarDesktop };

// Converte o erro do axios (API) no mesmo formato dos erros da rede local.
export async function pelaApi(chamada) {
  try {
    const resposta = await chamada();
    return resposta.data;
  } catch (error) {
    const erro = new Error(
      error?.response?.data?.error?.message || error?.message || "Não foi possível falar com o servidor do Osíris."
    );
    erro.status = error?.response?.status;
    throw erro;
  }
}

// Confere se este celular pode usar o PC (mesma conta logada no app desktop).
// Tenta a rede local; se o PC não responder, pergunta à API se o desktop da conta está conectado.
export async function verificarAcessoDesktop() {
  const token = await AsyncStorage.getItem("token");
  try {
    const dados = await request("/api/acesso", { timeoutMs: 5000, token });
    rotaDesktop = "local";
    return dados;
  } catch (error) {
    if (!error.semConexao && !error.demorou) throw error;
    const { conectado } = await pelaApi(() => api.get("/desktop/conectado", { timeout: 8000 }));
    if (!conectado) throw error;
    rotaDesktop = "api";
    return { liberado: true, viaApi: true };
  }
}

export function getDesktopStatus() {
  return request("/api/status", { timeoutMs: 5000 });
}

// Roda o comando no PC onde o app desktop está aberto.
// `pasta` é a pasta atual da aba do terminal (devolvida pelo PC no comando anterior).
export async function executeDesktopCommand(command, timeoutMs = 30000, pasta = null) {
  const corpo = { command, timeout_ms: timeoutMs, cwd: pasta };
  const pelaNuvem = () => pelaApi(() => api.post("/terminal/exec", corpo, { timeout: timeoutMs + 20000 }));
  if (rotaDesktop === "api") return pelaNuvem();

  const token = await AsyncStorage.getItem("token");
  try {
    return await request("/api/terminal/exec", {
      method: "POST",
      body: corpo,
      timeoutMs: timeoutMs + 5000,
      token,
    });
  } catch (error) {
    // PC fora da rede local: o comando segue pela API até o desktop da mesma conta.
    if (!error.semConexao) throw error;
    rotaDesktop = "api";
    return pelaNuvem();
  }
}

export function getDesktopModels() {
  return request("/api/models");
}

export function downloadDesktopModel(filename) {
  return request("/api/models/download", { method: "POST", body: { filename } });
}

export function cancelDesktopDownload(filename) {
  return request("/api/models/cancel", { method: "POST", body: { filename } });
}

// Carregar um modelo GGUF na memória do PC pode levar bastante tempo.
export function loadDesktopModel(filename) {
  return request("/api/models/load", {
    method: "POST",
    body: { filename },
    timeoutMs: 180000,
  });
}
