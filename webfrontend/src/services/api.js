import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api/osiris",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("osiris_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const sheets = {
  getUser: () => api.get("/auth/me"),
  postChat: (chat) => api.post("/chat", chat),
  getChats: () => api.get("/chat"),
  updateChat: (id_chat, data) => api.put(`/chat/${id_chat}`, data),
  deleteChat: (id_chat) => api.delete(`/chat/${id_chat}`),
  postMessage: (id_chat, message) => api.post(`/chat/${id_chat}/messages`, message),
  getMessages: (id_chat) => api.get(`/chat/${id_chat}/messages`),
  saveMemory: (data) => api.post("/memory", data),
  getMemory: () => api.get("/memory"),
  updateMemory: (id_memory, data) => api.put(`/memory/${id_memory}`, data),
  deleteMemory: (id_memory) => api.delete(`/memory/${id_memory}`),
  getWorkflows: () => api.get("/workflow"),
  createWorkflow: (data) => api.post("/workflow", data),
  getWorkflowCanvas: (id) => api.get(`/workflow/${id}/canvas`),
  saveWorkflowCanvas: (id, canvas) => api.put(`/workflow/${id}/canvas`, canvas),
  syncDesktopWorkspace: (folderPath) => api.post("/file/workspace", { folderPath }),
  getDesktopWorkspace: () => api.get("/file/workspace"),
  // Terminal
  terminalExecute: (data) => api.post("/terminal/exec", data),
  executeCommand: (command, timeout_ms) => api.post("/terminal/exec", { command, timeout_ms }),
  terminalHistory: (params) => api.get("/terminal/history", { params }),
  terminalClearHistory: () => api.delete("/terminal/history"),
  // Browser
  createBrowserSession: (initial_url) => api.post("/browser/session", { initial_url }),
  listBrowserSessions: () => api.get("/browser/sessions"),
  getBrowserSession: (id_session) => api.get(`/browser/session/${id_session}`),
  navigateBrowser: (id_session, url) => api.post("/browser/navigate", { id_session, url }),
  clickBrowserElement: (id_session, { selector, x, y } = {}) => api.post("/browser/click", { id_session, selector, x, y }),
  closeBrowserSession: (id_session) => api.delete(`/browser/session/${id_session}`),
}
export const auth = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (name, email, password) => api.post("/auth/register", { name, email, password }),
  getUser: () => api.get("/auth/me"),
};

export { api };
export default sheets;
