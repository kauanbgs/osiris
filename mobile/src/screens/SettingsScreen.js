import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getIP, saveIP, loadIP, apiUrl } from "../services/serverConfig";
import sheets from "../services/api";
import { NavbarSpacer } from "../components/Navbar";
import { BACKGROUND, THEMES, createThemedStyles, useTheme, useThemeColor, ACCENTS } from "../theme";
import ModelSettings from "../components/ModelSettings";
import IconTile from "../components/IconTile";
import { KeyboardScrollView } from "../components/KeyboardAware";
import { CHAT_SESSION_KEY } from "../services/chatSession";

export default function SettingsScreen({ navigation, route }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
  const { themeId, setThemeId, statusBarStyle } = useTheme();
  // guestMode = true quando vindo da LoginScreen (sem estar autenticado)
  const guestMode = route?.params?.guestMode === true;
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
    if (guestMode) {
      navigation.goBack();
    } else {
      navigation.goBack();
    }
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
              onPress: () => navigation.getParent().reset({
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
            // Revoga o token na API (registra o logout em revoked_token)
            await sheets.postLogout();
          } catch (e) {
            console.warn("Erro ao revogar token na API:", e?.message);
          }
          try {
            // Remove só os dados da sessão (o IP do servidor é mantido)
            await AsyncStorage.multiRemove([
              "token",
              "user",
              CHAT_SESSION_KEY,
            ]);
          } catch (e) {
            console.warn("Erro ao limpar sessão:", e?.message);
          }
          // Reseta a pilha para o usuário não voltar às telas logado
          navigation.getParent().reset({
            index: 0,
            routes: [{ name: "LoginScreen" }],
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={guestMode ? undefined : ["top", "left", "right"]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={themeColor("#121212")} />

      <KeyboardScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Configurações do Sistema</Text>

        {guestMode && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Voltar ao login</Text>
          </TouchableOpacity>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <IconTile icon="smartphone" color={ACCENTS.blue} />
            <Text style={styles.sectionHeadingTitle}>Celular</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Use o celular como tela desktop para conectar ao Osiris.
          </Text>

          <Text style={styles.label}>IP do desktop</Text>
          <TextInput
            style={styles.input}
            placeholder="192.168.100.202"
            placeholderTextColor={themeColor("#666")}
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

          {status ? (
            <Text style={[styles.hint, { color: themeColor(status.startsWith("OK") ? "#2ecc71" : "#e74c3c") }]}>
              {status}
            </Text>
          ) : null}
          <Text style={styles.hint}>Atual: {getIP()}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeading}>
            <IconTile icon="droplet" color={ACCENTS.pink} />
            <Text style={styles.sectionHeadingTitle}>Tema</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Escolha as cores do aplicativo. "Cores do web" acompanha o tema do desktop.
          </Text>

          <View style={styles.themeOptions}>
            {Object.entries(THEMES).map(([id, { label }]) => {
              const selected = id === themeId;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.themeOption, selected && styles.themeOptionSelected]}
                  onPress={() => setThemeId(id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.themeOptionText, selected && styles.themeOptionTextSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!guestMode && (
          <TouchableOpacity
            style={styles.sectionCard}
            activeOpacity={0.8}
            onPress={handleOpenMemory}
            accessibilityRole="button"
            accessibilityLabel="Abrir memória do usuário"
          >
            <View style={styles.sectionHeading}>
            <IconTile icon="bookmark" color={ACCENTS.amber} />
            <Text style={styles.sectionHeadingTitle}>Memória</Text>
          </View>
            <Text style={styles.memoryTitle}>Memória do usuário</Text>
            <Text style={styles.sectionDescription}>
              Memórias definidas pelo usuário para melhorar sua experiência.
            </Text>
            <Text style={styles.memoryAction}>Clique para mais informações ›</Text>
          </TouchableOpacity>
        )}

        {!guestMode && <ModelSettings />}

        <View style={styles.divider} />

        {!guestMode && (
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutText}>Sair da conta</Text>
          </TouchableOpacity>
        )}
        {!guestMode && <NavbarSpacer />}
      </KeyboardScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    color: "#fefefe",
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
    color: "#fefefe",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  sectionHeadingTitle: {
    color: "#fefefe",
    fontSize: 15,
    fontWeight: "700",
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
  themeOptions: {
    flexDirection: "row",
    gap: 10,
  },
  themeOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  themeOptionSelected: {
    backgroundColor: "#8A56FF",
    borderColor: "#8A56FF",
  },
  themeOptionText: {
    color: "#CCCCCC",
    fontSize: 14,
    fontWeight: "600",
  },
  themeOptionTextSelected: {
    color: "#FFFFFF",
  },
  memoryAction: {
    color: "#BB86FC",
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
    color: "#fefefe",
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
    backgroundColor: "#e74c3c1f",
    borderWidth: 1,
    borderColor: "#e74c3c",
  },
  logoutText: {
    color: "#e74c3c",
    fontSize: 18,
    fontWeight: "600",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backButtonText: {
    color: "#BB86FC",
    fontSize: 14,
    fontWeight: "500",
  },
});
