import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@osiris/desktop_ip";

let IP = "10.89.240.114";
// Carrega o IP salvo no celular (chamar 1x ao abrir o app).
export async function loadIP() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
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

export const apiUrl = () => `http://${IP}:5000/api/osiris`;
export const aiUrl = () => `http://${IP}:8080`;
