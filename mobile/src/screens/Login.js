import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { Mail, KeyRound } from 'lucide-react-native';
import DotField from '../components/DotField';

export default function OsirisLoginScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />

      {/* Background animado de pontos, atrás de tudo */}
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
            <Mail size={24} color="#D8D5DF" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.label}>E-mail</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Digite seu e-mail"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <View style={styles.labelRow}>
            <KeyRound size={24} color="#D8D5DF" strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={styles.label}>Senha</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Digite sua senha"
            placeholderTextColor="#666"
            secureTextEntry={true}
          />
        </View>

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Iniciar Sessão →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Não tem conta? </Text>
        <TouchableOpacity>
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
    fontFamily: 'JetBrainsMono_400Regular',
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
  inputContainer: { marginBottom: 20 },
  labelRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  label: { fontFamily: 'JetBrainsMono_400Regular', fontSize: 16, color: "#CCCCCC" },
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
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { fontFamily: 'JetBrainsMono_400Regular', color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  footer: { flexDirection: "row", marginTop: 30, zIndex: 1 },
  footerText: { fontFamily: 'JetBrainsMono_400Regular', color: "#888888", fontSize: 16 },
  signUpText: { fontFamily: 'JetBrainsMono_400Regular', color: "#BB86FC", fontSize: 16, fontWeight: "600" },
});