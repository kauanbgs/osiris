import axios from "axios";

const api = axios.create({
  baseURL: "http://10.89.240.59:3000/api/osiris",
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
  postMessage: (id_chat, message) => api.post(`/chat/${id_chat}/messages`, message),
  getMessages: (id_chat) => api.get(`/chat/${id_chat}/messages`),
}
export const auth = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (name, email, password) => api.post("/auth/register", { name, email, password }),
  getUser: () => api.get("/auth/me"),
};

export { api };
export default sheets;