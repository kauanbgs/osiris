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
  config.baseURL = apiUrl(); // usa sempre o IP atual
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const sheets = {
  postLogin: (credentials) =>
    api.post("/auth/login", credentials),
  postCadastro: (user) =>
    api.post("/auth/register", user),
  getMe: () =>
    api.get("/auth/me"),
  getMessages: (id_chat) =>
    api.get(`/chat/${id_chat}/messages`),
  health: () =>
    api.get("/health", { timeout: 5000 }),
};
export default sheets;
export { api };

