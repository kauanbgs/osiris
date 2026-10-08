import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getIP, saveIP, loadIP, apiUrl } from "../services/serverConfig";
import sheets from "../services/api";
import BottomNav from "../components/Navbar";

export default function SettingsScreen({ navigation }) {
  const [ip, setIp] = useState("");
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    loadIP().then(setIp).catch(() => {});
  }, []);

  async function handleSave() {
    const value = ip.trim();
    if (!value) {
      Alert.alert("Erro", "Digite o IP do desktop (ex.: 192.168.100.202).");
      return;
    }
    await saveIP(value);
    navigation.goBack();
  }

  async function handleTest() {
    const value = ip.trim();
    if (!value) {
      Alert.alert("Erro", "Digite o IP antes de testar.");
      return;
    }
    try {
      setTesting(true);
      setStatus("");
      await saveIP(value);
      await sheets.health();
      setStatus("OK: API alcançável.");
      Alert.alert("Sucesso", `API respondeu em ${apiUrl()}`);
    } catch (e) {
      const msg =
        e.code === "ECONNABORTED" || String(e.message || "").includes("timeout")
          ? "Timeout: IP inacessível ou API fora do ar."
          : e.response?.data?.error?.message || e.message;
      setStatus(`Falha: ${msg}`);
      Alert.alert("Falha", `${msg}\n\nTentado: ${apiUrl()}/health`);
    } finally {
      setTesting(false);
    }
  }

  async function handleOpenMemory() {
    try {
      // A tela de configurações também pode ser aberta antes do login.
      // Verifica a sessão antes de navegar para uma tela protegida.
      await sheets.getMe();
      navigation.navigate("Memoria");
    } catch (error) {
      if (error.response?.status === 401) {
        Alert.alert(
          "Sessão necessária",
          "Entre na sua conta para acessar a memória.",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Fazer login",
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: "LoginScreen" }],
              }),
            },
          ],
        );
        return;
      }
      Alert.alert("Erro", "Não foi possível validar sua sessão. Verifique a conexão com o servidor.");
    }
  }

  function handleLogout() {
    Alert.alert("Sair da conta", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          try {
            // Remove só os dados da sessão (o IP do servidor é mantido)
            await AsyncStorage.multiRemove([
              "token",
              "user",
              "@osiris/active_chat_id",
            ]);
          } catch (e) {
            console.warn("Erro ao limpar sessão:", e?.message);
          }
          // Reseta a pilha para o usuário não voltar às telas logado
          navigation.reset({
            index: 0,
            routes: [{ name: "LoginScreen" }],
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Configurações do Sistema</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Celular</Text>
          <Text style={styles.sectionDescription}>
            Use o celular como tela desktop para conectar ao Osiris.
          </Text>

          <Text style={styles.label}>IP do desktop</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.100.202"
            placeholderTextColor="#666"
            autoCapitalize="none"
            autoCorrect={false}
            value={ip}
            onChangeText={setIp}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <TouchableOpacity style={styles.button} onPress={handleSave}>
            <Text style={styles.buttonText}>Salvar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTest}
            disabled={testing}
          >
            <Text style={styles.buttonText}>
              {testing ? "Testando..." : "Testar conexão"}
            </Text>
          </TouchableOpacity>

          {status ? <Text style={styles.hint}>{status}</Text> : null}
          <Text style={styles.hint}>Atual: {getIP()}</Text>
        </View>

        <TouchableOpacity
          style={styles.sectionCard}
          activeOpacity={0.8}
          onPress={handleOpenMemory}
          accessibilityRole="button"
          accessibilityLabel="Abrir memória do usuário"
        >
          <Text style={styles.sectionTitle}>Memória</Text>
          <Text style={styles.memoryTitle}>Memória do usuário</Text>
          <Text style={styles.sectionDescription}>
            Memórias definidas pelo usuário para melhorar sua experiência.
          </Text>
          <Text style={styles.memoryAction}>Clique para mais informações ›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav
        activeKey="settings"
        onPressItem={(key) => {
          if (key === "settings") return;
          if (key === "home") navigation.navigate("HomeScreen");
          else if (key === "chats") navigation.navigate("Chats");
          else console.log("nav:", key);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "bold",
    marginBottom: 18,
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#292929",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionDescription: {
    color: "#9A9A9A",
    fontSize: 12,
    marginBottom: 14,
  },
  memoryTitle: {
    color: "#DDDDDD",
    fontSize: 13,
    marginBottom: 4,
  },
  memoryAction: {
    color: "#D0D0D0",
    fontSize: 12,
    marginTop: 6,
  },
  label: {
    fontSize: 16,
    color: "#CCCCCC",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1C1C1C",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    color: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#8A56FF",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: "#2E7D32",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  back: {
    alignItems: "center",
    paddingVertical: 10,
  },
  backText: {
    color: "#BB86FC",
    fontSize: 16,
  },
  hint: {
    color: "#888888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginTop: 24,
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#e74c3c",
  },
  logoutText: {
    color: "#e74c3c",
    fontSize: 18,
    fontWeight: "600",
  },
});
