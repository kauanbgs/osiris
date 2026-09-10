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
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", default: true },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
  },
  {
    id: "groq",
    name: "Groq (Llama / Mixtral)",
    placeholder: "Cole sua chave gsk_...",
    getKeyUrl: "https://console.groq.com/keys",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", default: true },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
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
      if (parsed.provider === "google" && (parsed.model === "gemini-2.5-flash" || parsed.model === "gemini-2.0-flash")) {
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
      const defModel = provider.models.find((m) => m.default) || provider.models[0];
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
  window.dispatchEvent(new CustomEvent("osiris:model-changed", { detail: modelConfig }));
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
          contents: [{ role: "user", parts: [{ text: "Hello, respond with 'OK'" }] }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erro ${res.status}: Verifique sua chave Google.`);
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
      throw new Error(err.error?.message || `Erro ${res.status}: Verifique sua chave OpenAI.`);
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
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Hello" }],
        max_tokens: 5,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erro ${res.status}: Verifique sua chave Groq.`);
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
      throw new Error(err.error?.message || `Erro ${res.status}: Verifique sua chave Anthropic.`);
    }

    return true;
  }

  throw new Error("Provedor desconhecido.");
}

// Stream Cloud Provider Call
async function streamGoogleGemini({ model, apiKey, prompt, onChunk, signal }) {
  const modelToUse = model || "gemini-3.6-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ${response.status} ao conectar com Google Gemini.`);
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

async function streamOpenAICompatible({ endpoint, model, apiKey, prompt, onChunk, signal, headers = {} }) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...headers,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ${response.status} na API de IA.`);
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
        if (jsonStr === "[DONE]") break;
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = parsed.choices?.[0]?.delta?.content || "";
          if (chunkText) {
            fullText += chunkText;
            onChunk?.(fullText);
          }
        } catch {
          // ignore
        }
      }
    }
  }

  return fullText;
}

async function streamAnthropic({ model, apiKey, prompt, onChunk, signal }) {
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
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ${response.status} ao conectar com Anthropic.`);
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

// Unified LLM Request Runner
export async function sendPrompt({ prompt, onChunk, signal, activeModelOverride }) {
  const activeModel = activeModelOverride || getActiveModel();

  if (activeModel.type === "cloud") {
    const keys = getStoredCloudKeys();
    const apiKey = keys[activeModel.provider]?.trim();

    if (!apiKey) {
      const providerObj = CLOUD_PROVIDERS.find((p) => p.id === activeModel.provider);
      throw new Error(
        `Chave de API do ${providerObj?.name || activeModel.provider} não configurada. Vá em Modelos -> Nuvem para adicionar sua chave.`
      );
    }

    if (activeModel.provider === "google") {
      return streamGoogleGemini({
        model: activeModel.model || "gemini-3.6-flash",
        apiKey,
        prompt,
        onChunk,
        signal,
      });
    }

    if (activeModel.provider === "openai") {
      return streamOpenAICompatible({
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: activeModel.model || "gpt-4o",
        apiKey,
        prompt,
        onChunk,
        signal,
      });
    }

    if (activeModel.provider === "groq") {
      return streamOpenAICompatible({
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        model: activeModel.model || "llama-3.3-70b-versatile",
        apiKey,
        prompt,
        onChunk,
        signal,
      });
    }

    if (activeModel.provider === "anthropic") {
      return streamAnthropic({
        model: activeModel.model || "claude-3-5-sonnet-20241022",
        apiKey,
        prompt,
        onChunk,
        signal,
      });
    }
  }

  // Local model via Electron window.llama
  if (typeof window !== "undefined" && window.llama?.prompt) {
  let accumulated = "";
  let cleanup = null;

  if (window.llama.onStream) {
    cleanup = window.llama.onStream((data) => {
      if (data.type === "chunk" && data.text) {
        accumulated += data.text;

        onChunk?.(accumulated);
      }
    });
  }

  try {
    const res = await window.llama.prompt(prompt);

    return accumulated || res || "";
  } finally {
    cleanup?.();
  }
}

  throw new Error(
    "Nenhum modelo selecionado ou disponível. Configure um modelo de Nuvem em 'Modelos' ou inicie um modelo Local."
  );
}
