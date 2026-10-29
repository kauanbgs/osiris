import { aiUrl } from "./serverConfig";

// Fala com o servidor de IA do app desktop (Electron, porta 8080).
async function request(path, { method = "GET", body, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${aiUrl()}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
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
      throw new Error(data?.error || `Erro HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("O desktop demorou demais para responder.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Não foi possível conectar ao desktop. Verifique se o app desktop está aberto e se o IP está correto."
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
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
