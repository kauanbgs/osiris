import { scheduleGroqRequest } from "./groqRateLimit.js";

export const CLOUD_PROVIDERS = [
  {
    id: "google",
    name: "Google (Gemini)",
    placeholder: "Cole sua chave do Google AI Studio...",
    getKeyUrl: "https://aistudio.google.com/app/apikey",
    models: [
      { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", default: true },
      { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash" },
      { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
      { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    placeholder: "Cole sua chave sk-...",
    getKeyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o", name: "GPT-4o", default: true },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    placeholder: "Cole sua chave sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        default: true,
      },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    placeholder: "Cole sua chave gsk_...",
    getKeyUrl: "https://console.groq.com/keys",
    // https://console.groq.com/docs/models (verified 2026-10-20)
    models: [
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", default: true },
      { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
      { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B (Preview)" },
      { id: "openai/gpt-oss-safeguard-20b", name: "GPT-OSS Safeguard 20B (Moderacao)" },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Enterprise)" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B (Enterprise)" },
      { id: "meta-models/muse-spark-open", name: "Muse Spark Open (Enterprise)" },
      { id: "minimaxai/minimax-m2.7", name: "MiniMax M2.7 (Enterprise)" },
    ],
  },
];

export function getStoredCloudKeys() {
  try {
    return JSON.parse(localStorage.getItem("osiris_cloud_model_keys") || "{}");
  } catch {
    return {};
  }
}

export function saveStoredCloudKeys(keys) {
  localStorage.setItem("osiris_cloud_model_keys", JSON.stringify(keys));
}

export function getActiveModel() {
  try {
    const saved = localStorage.getItem("osiris_active_model");
    if (saved) {
      const parsed = JSON.parse(saved);
      // If user had previous gemini-2.5-flash saved, upgrade it to gemini-3.6-flash
      if (
        parsed.provider === "google" &&
        (parsed.model === "gemini-2.5-flash" ||
          parsed.model === "gemini-2.0-flash")
      ) {
        parsed.model = "gemini-3.6-flash";
        parsed.name = "Google (Gemini) - Gemini 3.6 Flash";
        localStorage.setItem("osiris_active_model", JSON.stringify(parsed));
      }
      return parsed;
    }
  } catch {
    // fallback
  }

  // Default fallback: check if any cloud key exists
  const keys = getStoredCloudKeys();
  for (const provider of CLOUD_PROVIDERS) {
    if (keys[provider.id]) {
      const defModel =
        provider.models.find((m) => m.default) || provider.models[0];
      return {
        type: "cloud",
        provider: provider.id,
        model: defModel.id,
        name: `${provider.name} - ${defModel.name}`,
      };
    }
  }

  return {
    type: "local",
    name: "Motor Local",
  };
}

export function setActiveModel(modelConfig) {
  localStorage.setItem("osiris_active_model", JSON.stringify(modelConfig));
  window.dispatchEvent(
    new CustomEvent("osiris:model-changed", { detail: modelConfig }),
  );
}

// Test Provider API Key
export async function testProviderKey(providerId, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Chave de API vazia.");
  }

  const trimmedKey = apiKey.trim();

  if (providerId === "google") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${trimmedKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: "Hello, respond with 'OK'" }] },
          ],
        }),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Erro ${res.status}: Verifique sua chave Google.`,
      );
    }

    return true;
  }

  if (providerId === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Erro ${res.status}: Verifique sua chave OpenAI.`,
      );
    }

    return true;
  }

  if (providerId === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmedKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `Erro ${res.status}: Verifique sua chave Groq.`,
      );
    }

    return true;
  }

  if (providerId === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": trimmedKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 5,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        err.error?.message ||
          `Erro ${res.status}: Verifique sua chave Anthropic.`,
      );
    }

    return true;
  }

  throw new Error("Provedor desconhecido.");
}

// Stream Cloud Provider Call
async function streamGoogleGemini({
  model,
  apiKey,
  prompt,
  history = [],
  onChunk,
  signal,
}) {
  const modelToUse = model || "gemini-3.6-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    })),
    { role: "user", parts: [{ text: prompt }] },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error?.message ||
        `Erro ${response.status} ao conectar com Google Gemini.`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText =
            parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chunkText) {
            fullText += chunkText;
            onChunk?.(fullText);
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }
  }

  return fullText;
}

async function streamOpenAICompatible({
  endpoint, model, apiKey, prompt, history = [], onChunk, signal,
  headers = {}, maxOutputTokens, onNotice, continueOnLength = false,
}) {
  const isGroq = endpoint.startsWith("https://api.groq.com/");
  const messages = [...history.map((msg) => ({ role: msg.role, content: msg.content })), { role: "user", content: prompt }];
  const maxParts = isGroq && continueOnLength ? 3 : 1;
  let fullText = "";
  for (let part = 0; part < maxParts; part++) {
    signal?.throwIfAborted();
    const estimatedInput = Math.ceil(new TextEncoder().encode(JSON.stringify(messages)).length / 3);
    const outputBudget = isGroq ? Math.min(maxOutputTokens || 4096, 7000 - estimatedInput) : maxOutputTokens;
    if (isGroq && outputBudget < 256) throw new Error("A resposta e o contexto excederam o espaco seguro da cota de 8000 tokens do Groq. Divida esta etapa em mais agentes. Nenhum resultado incompleto foi aplicado aos arquivos.");
    const request = () => fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...headers },
      body: JSON.stringify({ model, messages, stream: true,
        ...(outputBudget ? { max_completion_tokens: outputBudget } : {}),
        ...(isGroq && ["openai/gpt-oss-20b", "openai/gpt-oss-120b"].includes(model) ? { reasoning_effort: "low" } : {}),
      }), signal,
    });
    const response = isGroq ? await scheduleGroqRequest({ model, signal, onNotice, request, estimatedTokens: estimatedInput + outputBudget }) : await request();
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || "Erro " + response.status + " na API de IA.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "", partText = "", truncated = false;
    function consume(line) {
      if (!line.startsWith("data:")) return;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") return;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { return; }
      if (parsed.error) throw new Error(parsed.error.message || "Erro na resposta do modelo.");
      if (parsed.choices?.[0]?.finish_reason === "length") truncated = true;
      const content = parsed.choices?.[0]?.delta?.content || "";
      if (content) { partText += content; onChunk?.(fullText + partText); }
    }
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        signal?.throwIfAborted();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) consume(line);
      }
      consume(buffer + decoder.decode());
    } finally { reader.releaseLock(); }
    fullText += partText;
    if (!truncated) return fullText;
    if (part + 1 === maxParts) throw new Error("A resposta atingiu o limite de tokens mesmo apos as continuacoes permitidas. Divida esta etapa em mais agentes; o resultado incompleto nao foi aplicado aos arquivos.");
    onNotice?.({ type: "continuation", message: "A resposta precisa de mais espaco. Continuando automaticamente (parte " + (part + 2) + "/" + maxParts + "), respeitando a cota do Groq." });
    // Send the complete prefix, so continuation can close an unfinished JSON
    // string or source file without restarting or discarding previous output.
    if (partText) {
      messages.splice(history.length + 1);
      messages.push({ role: "assistant", content: fullText }, { role: "user", content: "Continue exatamente do ponto em que a resposta parou. Retorne apenas a continuacao, sem repetir o prefixo, sem comentarios e sem novas cercas Markdown. Termine o JSON ou arquivo iniciado." });
    }
  }
}

async function streamAnthropic({
  model,
  apiKey,
  prompt,
  history = [],
  onChunk,
  signal,
}) {
  const messages = [
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: "user", content: prompt },
  ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error?.message ||
        `Erro ${response.status} ao conectar com Anthropic.`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.type === "content_block_delta") {
            const chunkText = parsed.delta?.text || "";
            if (chunkText) {
              fullText += chunkText;
              onChunk?.(fullText);
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return fullText;
}

function formatMemoryForPrompt(memory) {
  if (!memory) {
    return "";
  }

  if (typeof memory === "string") {
    return memory.trim();
  }

  if (!Array.isArray(memory)) {
    return "";
  }

  return memory
    .filter(
      (item) => item && typeof item.content === "string" && item.content.trim(),
    )
    .map((item) => {
      const category = item.category || "geral";

      return `- [${category}] ${item.content.trim()}`;
    })
    .join("\n");
}

// Unified LLM Request Runner

// llama.cpp uses a shared session: serialize local calls so agents cannot
// swap the loaded model or consume another request's stream mid-generation.
let localPromptQueue = Promise.resolve();
let groqPromptQueue = Promise.resolve();

export function sendPrompt(options) {
  const activeModel = options.activeModelOverride || getActiveModel();
  const run = async () => {
    options.signal?.throwIfAborted();
    return runPrompt({ ...options, activeModelOverride: activeModel });
  };
  if (activeModel.type === "cloud" && activeModel.provider === "groq") {
    const result = groqPromptQueue.then(run);
    groqPromptQueue = result.catch(() => {});
    return result;
  }
  if (activeModel.type === "cloud") return run();
  const result = localPromptQueue.then(run);
  localPromptQueue = result.catch(() => {});
  return result;
}

async function runPrompt({
  prompt,
  history = [],
  memory = [],
  onChunk,
  signal,
  activeModelOverride,
  maxOutputTokens,
  onNotice,
  continueOnLength,
}) {
  const activeModel = activeModelOverride || getActiveModel();

  const memoryText = formatMemoryForPrompt(memory);

  const promptWithMemory = memoryText
    ? `
CONTEXTO PERSISTENTE DO USUÁRIO:

${memoryText}

Use essas informações apenas quando forem relevantes.
Não trate essas memórias como uma nova mensagem do usuário.
Não mencione a memória explicitamente sem necessidade.

MENSAGEM ATUAL DO USUÁRIO:

${prompt}
`.trim()
    : prompt;

  // ============================================
  // MODELOS CLOUD
  // ============================================

  if (activeModel.type === "cloud") {
    const keys = getStoredCloudKeys();

    const apiKey = keys[activeModel.provider]?.trim();

    if (!apiKey) {
      const providerObj = CLOUD_PROVIDERS.find(
        (p) => p.id === activeModel.provider,
      );

      throw new Error(
        `Chave de API do ${
          providerObj?.name || activeModel.provider
        } não configurada. Vá em Modelos -> Nuvem para adicionar sua chave.`,
      );
    }

    if (activeModel.provider === "google") {
      return streamGoogleGemini({
        model: activeModel.model || "gemini-3.6-flash",

        apiKey,

        prompt: promptWithMemory,

        history,
        onChunk,
        signal,
      });
    }

    if (activeModel.provider === "openai") {
      return streamOpenAICompatible({
        endpoint: "https://api.openai.com/v1/chat/completions",

        model: activeModel.model || "gpt-4o",

        apiKey,

        prompt: promptWithMemory,

        history,
        onChunk,
        signal,
      });
    }

    if (activeModel.provider === "groq") {
      return streamOpenAICompatible({
        endpoint: "https://api.groq.com/openai/v1/chat/completions",

        model: activeModel.model || "openai/gpt-oss-120b",

        apiKey,

        prompt: promptWithMemory,

        history,
        onChunk,
        signal,
        maxOutputTokens: maxOutputTokens || 4096,
        onNotice,
        continueOnLength,
      });
    }

    if (activeModel.provider === "anthropic") {
      return streamAnthropic({
        model: activeModel.model || "claude-3-5-sonnet-20241022",

        apiKey,

        prompt: promptWithMemory,

        history,
        onChunk,
        signal,
      });
    }
  }

  if (activeModel.type === "cloud") throw new Error("Provedor de nuvem desconhecido: " + activeModel.provider);

  // MODELO LOCAL
  if (typeof window !== "undefined" && window.llama?.prompt) {
    signal?.throwIfAborted();
    if (activeModel.modelPath) {
      if (!window.llama.getStatus || !window.llama.loadModel) throw new Error("Motor local indisponivel.");
      const status = await window.llama.getStatus();
      if (!status.isLoaded || status.activeModelPath !== activeModel.modelPath) {
        await window.llama.loadModel(activeModel.modelPath);
      }
      signal?.throwIfAborted();
    }
    let accumulated = "";
    let cleanup = null;

    if (window.llama.onStream && onChunk) {
      cleanup = window.llama.onStream((data) => {
        if (!signal?.aborted && data.type === "chunk" && data.text) {
          accumulated += data.text;
          onChunk(accumulated);
        }
      });
    }

    let res = "";

    try {
      // ==============================
      // RESPOSTA PRINCIPAL
      // ==============================

      res = await window.llama.prompt({
        prompt: promptWithMemory,
        history,
      });

      console.log("[CHAT] Resposta principal finalizada");
    } finally {
      // Muito importante:
      // encerra o listener da resposta
      // principal ANTES de pedir análise
      // de memória.
      cleanup?.();
    }

    // ==============================
    // RETORNO DA RESPOSTA
    // ==============================

    signal?.throwIfAborted();
    return accumulated || res || "";
  }

  throw new Error(
    "Nenhum modelo selecionado ou disponível. Configure um modelo de Nuvem em 'Modelos' ou inicie um modelo Local.",
  );
}
