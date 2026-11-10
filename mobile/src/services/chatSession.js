import AsyncStorage from "@react-native-async-storage/async-storage";

// Conversa aberta na Home. Ela continua aberta ao trocar de tela ou ao voltar
// do segundo plano, mas depois de um tempo sem uso a Home começa uma nova.
// Ao abrir o app do zero a Home sempre começa uma conversa nova.
export const CHAT_SESSION_KEY = "@osiris/chat_session";
export const CHAT_SESSION_TTL_MS = 30 * 60 * 1000;

export function isChatSessionExpired(lastActiveAt) {
  return !lastActiveAt || Date.now() - lastActiveAt > CHAT_SESSION_TTL_MS;
}

export async function saveChatSession(chatId) {
  if (!chatId) return;
  try {
    await AsyncStorage.setItem(
      CHAT_SESSION_KEY,
      JSON.stringify({ chatId, lastActiveAt: Date.now() })
    );
  } catch {}
}

// Devolve o id da conversa salva, ou null se não houver ou se já expirou.
export async function loadChatSession() {
  try {
    const saved = JSON.parse(await AsyncStorage.getItem(CHAT_SESSION_KEY));
    if (saved?.chatId && !isChatSessionExpired(saved.lastActiveAt)) {
      return saved.chatId;
    }
    await AsyncStorage.removeItem(CHAT_SESSION_KEY);
  } catch {}
  return null;
}

export async function clearChatSession() {
  try {
    await AsyncStorage.removeItem(CHAT_SESSION_KEY);
  } catch {}
}
