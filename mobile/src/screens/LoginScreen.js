import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Mail, KeyRound } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DotField from "../components/DotField";
import api from "../services/api";

export default function Login({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      Alert.alert("Erro", "E-mail e senha devem ser preenchidos.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.postLogin({
        email: normalizedEmail,
        password,
      });

      const { token, user } = response.data || {};

      if (!token) {
        throw new Error("A API não retornou um token de autenticação.");
      }

      await AsyncStorage.multiSet([
        ["token", token],
        ["user", JSON.stringify(user || {})],
      ]);

      navigation.replace("HomeScreen");
    } catch (error) {
      const message =
        error.response?.data?.error ||
        (error.request
          ? "Não foi possível conectar à API. Verifique se ela está rodando e se o endereço do servidor está correto."
          : error.message) ||
        "Não foi possível realizar o login.";

      Alert.alert("Erro", message);
      console.error("Erro no login:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      <DotField
        dotRadius={1.5}
        dotSpacing={22}
        bulgeStrength={26}
        touchRadius={110}
        glowRadius={90}
        gradientFrom="#8A56FF"
        gradientTo="#BB86FC"
        glowColor="#8A56FF"
      />

      <Text style={styles.title}>Osíris</Text>

      <View style={styles.formCard}>
        <View style={styles.inputContainer}>
          <View style={styles.labelRow}>
            <Mail
              size={24}
              color="#D8D5DF"
              strokeWidth={2}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.label}>E-mail</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Digite seu e-mail"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.labelRow}>
            <KeyRound
              size={24}
              color="#D8D5DF"
              strokeWidth={2}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.label}>Senha</Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Digite sua senha"
            placeholderTextColor="#666"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sessão →</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text
          style={styles.footerText}
          onPress={() => !loading && navigation.navigate("Cadastro")}
        >
          Não tem conta?{" "}
        </Text>

        <TouchableOpacity
          onPress={() => !loading && navigation.navigate("Cadastro")}
          disabled={loading}
        >
          <Text style={styles.signUpText}>se cadastre!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  title: {
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 48,
    color: "#FFFFFF",
    fontWeight: "bold",
    marginBottom: 40,
    zIndex: 1,
  },

  formCard: {
    width: "100%",
    backgroundColor: "#1C1C1C",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },

  inputContainer: {
    marginBottom: 20,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  label: {
    fontFamily: "JetBrainsMono_400Regular",
    fontSize: 16,
    color: "#CCCCCC",
  },

  input: {
    fontFamily: "JetBrainsMono_400Regular",
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    color: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },

  button: {
    backgroundColor: "#8A56FF",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    minHeight: 50,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    fontFamily: "JetBrainsMono_400Regular",
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    marginTop: 30,
    zIndex: 1,
  },

  footerText: {
    fontFamily: "JetBrainsMono_400Regular",
    color: "#888888",
    fontSize: 16,
  },

  signUpText: {
    fontFamily: "JetBrainsMono_400Regular",
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "600",
  },
});

