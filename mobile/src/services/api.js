import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "./serverConfig";

const api = axios.create({
  baseURL: apiUrl(),
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  config.baseURL = apiUrl();
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const sheets = {
  // ── Auth ──────────────────────────────────────────────────────────
  postLogin: (credentials) => api.post("/auth/login", credentials),
  postCadastro: (user) => api.post("/auth/register", user),
  getMe: () => api.get("/auth/me"),
  postLogout: () => api.post("/auth/logout"),

  // ── Health ────────────────────────────────────────────────────────
  health: () => api.get("/health", { timeout: 5000 }),

  // ── Chats ─────────────────────────────────────────────────────────
  createChat: (title) => api.post("/chat", { title }),
  listChats: () => api.get("/chat"),
  getChat: (id_chat) => api.get(`/chat/${id_chat}`),
  updateChat: (id_chat, title) => api.put(`/chat/${id_chat}`, { title }),
  deleteChat: (id_chat) => api.delete(`/chat/${id_chat}`),

  // ── Messages ──────────────────────────────────────────────────────
  getMessages: (id_chat) => api.get(`/chat/${id_chat}/messages`),
  createMessage: (id_chat, payload) => api.post(`/chat/${id_chat}/messages`, payload),

  // ── AI Models ─────────────────────────────────────────────────────
  listModels: () => api.get("/ai-model"),
  getModel: (id_model) => api.get(`/ai-model/${id_model}`),
  createModel: (payload) => api.post("/ai-model", payload),

  // ── Agents ────────────────────────────────────────────────────────
  listAgents: () => api.get("/agent"),
  getAgent: (id_agent) => api.get(`/agent/${id_agent}`),
  createAgent: (payload) => api.post("/agent", payload),
  updateAgent: (id_agent, payload) => api.put(`/agent/${id_agent}`, payload),
  deleteAgent: (id_agent) => api.delete(`/agent/${id_agent}`),
  executeAgent: (id_agent, input) => api.post(`/agent/${id_agent}/execute`, { input }),

  // ── User memories ──────────────────────────────────────────────────
  getMemories: () => api.get("/memory"),
  postMemory: (content) => api.post("/memory", { content }),
  deleteMemory: (id_memory) => api.delete(`/memory/${id_memory}`),

  // ── Tools ─────────────────────────────────────────────────────────
  listTools: () => api.get("/tool"),
  createTool: (payload) => api.post("/tool", payload),
  updateTool: (id_tool, payload) => api.put(`/tool/${id_tool}`, payload),
  deleteTool: (id_tool) => api.delete(`/tool/${id_tool}`),
};

export default sheets;
export { api };
