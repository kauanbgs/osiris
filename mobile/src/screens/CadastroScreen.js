import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  KeyboardAvoidingView,
  StyleSheet,
} from "react-native";
import { Octicons } from "@expo/vector-icons";
import DotField from "../components/DotField";
import api from "../services/api";

export default function Cadastro({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleCadastro() {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Erro", "Todos os campos devem ser preenchidos.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Erro", "As senhas não coincidem.");
      return;
    }

    try {
      const name = email.split("@")[0];

      const response = await api.postCadastro({
        name,
        email,
        password,
      });

      Alert.alert("Sucesso", response.data?.message || "Usuário cadastrado!");
      navigation.navigate("LoginScreen");
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || "Não foi possível realizar o cadastro.";
      Alert.alert("Erro", errorMsg);
      console.log(error.response?.data);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
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

      <View style={styles.content} pointerEvents="box-none">
        <Text style={styles.title}>Osíris</Text>

        <View style={styles.card}>
          {/* E-mail */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Octicons name="mail" size={24} color="#D8D5DF" style={{ marginRight: 8 }} />
              <Text style={styles.label}>E-mail</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="arthurMarques@gmail.com"
              placeholderTextColor="#666"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Senha */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Octicons name="key" size={24} color="#D8D5DF" style={{ marginRight: 8 }} />
              <Text style={styles.label}>Senha</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha"
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Confirmar Senha */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Octicons name="key" size={24} color="#D8D5DF" style={{ marginRight: 8 }} />
              <Text style={styles.label}>Confirmar senha</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Digite sua senha novamente"
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          {/* Botão Criar */}
          <TouchableOpacity style={styles.button} onPress={handleCadastro}>
            <Text style={styles.buttonText}>Criar</Text>
            <Octicons name="sign-in" size={18} color="#FFFFFF" style={styles.buttonIcon} />
          </TouchableOpacity>
        </View>

        {/* Link para Login */}
        <View style={styles.footer}>
          <Text style={styles.footerText} onPress={() => navigation.navigate("LoginScreen")}>
            Já tem uma conta?{' '}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate("LoginScreen")}>
            <Text style={styles.signUpText}>faça login!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
    zIndex: 1,
  },
  title: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 48,
    color: "#FFFFFF",
    fontWeight: "bold",
    marginBottom: 40,
    zIndex: 1,
  },
  card: {
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
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 16,
    color: "#CCCCCC",
  },
  input: {
    fontFamily: 'JetBrainsMono_400Regular',
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonIcon: {
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    marginTop: 30,
    zIndex: 1,
  },
  footerText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: "#888888",
    fontSize: 16,
  },
  signUpText: {
    fontFamily: 'JetBrainsMono_400Regular',
    color: "#BB86FC",
    fontSize: 16,
    fontWeight: "600",
  },
});