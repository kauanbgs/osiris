import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Mesmos provedores da tela Modelos -> Nuvem da web.
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
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    placeholder: "Cole sua chave sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    models: [
      { id: "claude-opus-5-5", name: "Claude Opus 5.5", default: true },
      { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
      { id: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
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
    ],
  },
];

const ACTIVE_MODEL_KEY = "@osiris/active_model";
const LOCAL_MODEL = { type: "local", name: "Modelo do desktop" };

export function getProvider(providerId) {
  return CLOUD_PROVIDERS.find((provider) => provider.id === providerId);
}

export function getDefaultModel(provider) {
  return provider.models.find((model) => model.default) || provider.models[0];
}

// ── Modelo ativo do chat (desktop ou nuvem) ──────────────────────────
export async function getActiveModel() {
  try {
    const saved = await AsyncStorage.getItem(ACTIVE_MODEL_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return LOCAL_MODEL;
}

export async function setActiveModel(config) {
  await AsyncStorage.setItem(ACTIVE_MODEL_KEY, JSON.stringify(config));
}

export function selectDesktopModel() {
  return setActiveModel(LOCAL_MODEL);
}

export function selectCloudModel(providerId, modelId) {
  const provider = getProvider(providerId);
  const model = provider?.models.find((m) => m.id === modelId);
  if (!provider || !model) throw new Error("Modelo de nuvem desconhecido.");

  return setActiveModel({
    type: "cloud",
    provider: provider.id,
    model: model.id,
    name: `${provider.name.split(" ")[0]} • ${model.name}`,
  });
}

// ── Chaves de API (guardadas com criptografia no celular) ─────────────
const keyName = (providerId) => `osiris_cloud_key_${providerId}`;

export async function getCloudKey(providerId) {
  try {
    return (await SecureStore.getItemAsync(keyName(providerId))) || "";
  } catch {
    return "";
  }
}

export async function saveCloudKey(providerId, apiKey) {
  const trimmed = (apiKey || "").trim();
  if (trimmed) {
    await SecureStore.setItemAsync(keyName(providerId), trimmed);
  } else {
    await SecureStore.deleteItemAsync(keyName(providerId));
  }
}

// ── Chamadas aos provedores ──────────────────────────────────────────
async function readError(response, fallback) {
  const data = await response.json().catch(() => ({}));
  return new Error(data?.error?.message || `${fallback} (HTTP ${response.status})`);
}

// Erros temporários do provedor: limite de uso (429), servidor sobrecarregado
// (503 no Gemini, 529 na Anthropic) e falhas momentâneas do servidor.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529]);
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_RETRY_AFTER_MS = 10000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Faz a requisição e, se o provedor responder com um erro temporário, tenta
// de novo (até 3 vezes, esperando 1s, 2s e 4s). Se o provedor mandar o
// cabeçalho Retry-After, respeita esse tempo (até 10s).
async function fetchWithRetry(url, options) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt >= RETRY_DELAYS_MS.length) {
      return response;
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delay =
      retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS)
        : RETRY_DELAYS_MS[attempt];
    await wait(delay);
  }
}

const OPENAI_COMPATIBLE = {
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
};

// Confere a chave listando os modelos (não gasta créditos).
export async function testCloudKey(providerId, apiKey) {
  const key = (apiKey || "").trim();
  if (!key) throw new Error("Chave de API vazia.");

  let response;
  if (providerId === "google") {
    response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": key },
    });
  } else if (providerId === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
  } else if (OPENAI_COMPATIBLE[providerId]) {
    response = await fetch(`${OPENAI_COMPATIBLE[providerId]}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
  } else {
    throw new Error("Provedor desconhecido.");
  }

  if (!response.ok) throw await readError(response, "Chave inválida");
}

// Cada provedor recebe imagens num formato diferente.
// images: lista de { mimeType, base64 }.
async function callGoogle(model, apiKey, prompt, images = []) {
  const parts = [
    ...images.map((image) => ({
      inline_data: { mime_type: image.mimeType, data: image.base64 },
    })),
    { text: prompt },
  ];
  const response = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    }
  );
  if (!response.ok) throw await readError(response, "Erro no Google Gemini");

  const data = await response.json();
  return (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("");
}

async function callOpenAICompatible(baseUrl, model, apiKey, prompt, images = []) {
  const content = images.length
    ? [
        { type: "text", text: prompt },
        ...images.map((image) => ({
          type: "image_url",
          image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
        })),
      ]
    : prompt;
  const response = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content }] }),
  });
  if (!response.ok) throw await readError(response, "Erro na API de IA");

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAnthropic(model, apiKey, prompt, images = []) {
  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  const body = {
    model,
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          ...images.map((image) => ({
            type: "image",
            source: { type: "base64", media_type: image.mimeType, data: image.base64 },
          })),
          { type: "text", text: prompt },
        ],
      },
    ],
  };

  // Se o modelo recusar o pedido, a API tenta de novo em outro modelo Claude.
  // O Haiku não tem essa opção.
  if (model !== "claude-haiku-5-5") {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.fallbacks = "default";
  }

  const response = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await readError(response, "Erro na Anthropic");

  const data = await response.json();
  if (data.stop_reason === "refusal") {
    throw new Error("O Claude recusou responder a esse pedido.");
  }
  return (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

// Modelos que recebem imagens. Os do Groq listados aqui (Llama) e o modelo do
// desktop só recebem texto.
export function modelSupportsImages(model) {
  return model?.type === "cloud" && model.provider !== "groq";
}

export async function sendCloudPrompt({ provider, model }, prompt, images = []) {
  const apiKey = await getCloudKey(provider);
  if (!apiKey) {
    const name = getProvider(provider)?.name || provider;
    throw new Error(
      `Chave de API do ${name} não configurada. Vá em Configurações → Modelos em nuvem.`
    );
  }

  let text;
  if (provider === "google") text = await callGoogle(model, apiKey, prompt, images);
  else if (provider === "anthropic") text = await callAnthropic(model, apiKey, prompt, images);
  else if (OPENAI_COMPATIBLE[provider])
    text = await callOpenAICompatible(OPENAI_COMPATIBLE[provider], model, apiKey, prompt, images);
  else throw new Error("Provedor desconhecido.");

  if (!text) throw new Error("A IA não retornou nenhuma resposta.");
  return text;
}
