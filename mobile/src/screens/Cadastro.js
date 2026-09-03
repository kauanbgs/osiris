    import React, { useState } from "react";
    import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    } from "react-native";
    import { Octicons } from "@expo/vector-icons";
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
        navigation.navigate("Login");
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
        <ScrollView contentContainerStyle={styles.scrollContainer}>
            <Text style={styles.title}>Osíris</Text>

            <View style={styles.card}>
            {/* E-mail */}
            <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                <Octicons name="mail" size={16} color="#CCCCCC" />
                <Text style={styles.label}>E-mail</Text>
                </View>
                <TextInput
                style={styles.input}
                placeholder="arthurMarques@gmail.com"
                placeholderTextColor="#55555C"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                />
            </View>

            {/* Senha */}
            <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                <Octicons name="key" size={16} color="#CCCCCC" />
                <Text style={styles.label}>Senha</Text>
                </View>
                <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#55555C"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                />
            </View>

            {/* Confirmar Senha */}
            <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                <Octicons name="key" size={16} color="#CCCCCC" />
                <Text style={styles.label}>Confirmar senha</Text>
                </View>
                <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#55555C"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                />
            </View>

            {/* Botão Criar */}
            <TouchableOpacity style={styles.button} onPress={handleCadastro}>
                <Text style={styles.buttonText}>Criar</Text>
                <Octicons name="sign-in" size={16} color="#FFFFFF" style={styles.buttonIcon} />
            </TouchableOpacity>
            </View>

            {/* Link para Login */}
            <View style={styles.footerRow}>
            <Text style={styles.footerText}>Já tem uma conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.footerLink}>faça login!</Text>
            </TouchableOpacity>
            </View>
        </ScrollView>
        </KeyboardAvoidingView>
    );
    }

    const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#121214",
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingVertical: 40,
    },
    title: {
        fontSize: 38,
        fontWeight: "bold",
        color: "#FFFFFF",
        marginBottom: 36,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    card: {
        width: "100%",
        backgroundColor: "#18171C",
        borderRadius: 8,
        padding: 24,
        borderWidth: 1,
        borderColor: "#232228",
    },
    inputGroup: {
        marginBottom: 20,
    },
    labelRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
        gap: 8,
    },
    label: {
        color: "#E1E1E6",
        fontSize: 14,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    input: {
        width: "100%",
        height: 46,
        backgroundColor: "#0D0D0E",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#2A2930",
        paddingHorizontal: 14,
        color: "#FFFFFF",
        fontSize: 14,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    button: {
        width: "100%",
        height: 48,
        backgroundColor: "#8257E5",
        borderRadius: 8,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
    },
    buttonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    buttonIcon: {
        marginLeft: 8,
    },
    footerRow: {
        flexDirection: "row",
        marginTop: 32,
        alignItems: "center",
    },
    footerText: {
        color: "#A8A8B3",
        fontSize: 14,
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    footerLink: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "bold",
        fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    });