// serverConfig.js — endereços que o celular usa: a API da nuvem (fixa) e o app desktop (IP do PC salvo no aparelho).
// O IP do PC é escolhido em Configurações e fica guardado no AsyncStorage.
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@osiris/desktop_ip";
const CLOUD_API_URL = "http://163.176.45.118:5000/api/osiris";

let IP = "192.168.0.7";
// Carrega o IP salvo no celular (chamar 1x ao abrir o app).
export async function loadIP() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    // Respeita o IP que o usuário salvou; o padrão só vale enquanto nada foi configurado.
    if (saved && saved.trim()) IP = saved.trim();
  } catch {}
  return IP;
}

export function getIP() {
  return IP;
}

export async function saveIP(ip) {
  IP = String(ip || "").trim();
  if (!IP) throw new Error("IP vazio");
  await AsyncStorage.setItem(KEY, IP);
}

export const apiUrl = () => CLOUD_API_URL;
export const aiUrl = () => `http://${IP}:8080`;
