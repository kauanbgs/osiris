import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
} from "react-native";
import { getIP, saveIP, loadIP, apiUrl } from "../services/serverConfig";
import sheets from "../services/api";

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
      const msg = e.code === "ECONNABORTED" || String(e.message || "").includes("timeout")
        ? "Timeout: IP inacessível ou API fora do ar."
        : e.response?.data?.error?.message || e.message;
      setStatus(`Falha: ${msg}`);
      Alert.alert("Falha", `${msg}\n\nTentado: ${apiUrl()}/health`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <Text style={styles.title}>Conexão</Text>

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

      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Atual: {getIP()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    color: "#FFFFFF",
    fontWeight: "bold",
    marginBottom: 24,
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
});
