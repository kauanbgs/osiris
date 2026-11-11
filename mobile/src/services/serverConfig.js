import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@osiris/desktop_ip";
const CLOUD_API_URL = "http://163.176.45.118:5000/api/osiris";

let IP = "192.168.0.7";
// Carrega o IP salvo no celular (chamar 1x ao abrir o app).
export async function loadIP() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved && saved.trim()) {
      if (saved.trim() === "172.20.10.3") {
        IP = "192.168.0.7";
        await AsyncStorage.setItem(KEY, IP);
      } else {
        IP = saved.trim();
      }
    }
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
