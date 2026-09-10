import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "http://10.89.240.32:5000/api/osiris";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
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
  getMessages: (id_chat) =>{
    api.get(`/chat/${id_chat}/messages`)
  }
};
export default sheets;
export { api, API_BASE_URL };

