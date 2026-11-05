// BalaoMensagem.js — balão de uma mensagem do chat (usuário ou agente): texto,
// anexo de imagem ou arquivo, e os botões de copiar e de ouvir a resposta.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Speech from "expo-speech";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";

import { CHAT_FONT } from "../theme";

const colors = {
  textPrimary: "#e8e8e8",
  purple: "#7c5cff",
  green: "#2ecc71",
  bubbleUser: "#7c5cff",
  bubbleAgent: "#1a1a1a",
  bubbleAgentBorder: "#2a2a2a",
  textMuted: "#8a8a8a",
};

export default function BalaoMensagem({ role, text, attachment }) {
  const isUser = role === "user";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef(null);
  const btnScale = useRef(new Animated.Value(1)).current;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [anim]);

  useEffect(() => {
    return () => {
      if (isSpeaking) Speech.stop();
    };
  }, [isSpeaking]);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  // Copia o texto da mensagem e mostra um "check" por um instante.
  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.warn("Não foi possível copiar a mensagem:", error?.message);
    }
  };

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
    ],
  };

  const handleTTS = () => {
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.8, duration: 100, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      Speech.speak(text, {
        language: "pt-BR",
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    }
  };

  return (
    <Animated.View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAgent,
        animatedStyle,
      ]}
    >
      <View style={styles.bubbleWrapper}>
        <View
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}
        >
          {/* Anexo de Imagem */}
          {attachment && attachment.type === "image" && (
            <Image
              source={{ uri: attachment.uri }}
              style={styles.bubbleAttachedImage}
              resizeMode="cover"
            />
          )}

          {/* Anexo de Arquivo */}
          {attachment && attachment.type === "file" && (
            <View style={styles.bubbleAttachedFile}>
              <Feather name="file-text" size={16} color="#fff" />
              <Text style={styles.bubbleAttachedFileName} numberOfLines={1}>
                {attachment.name}
              </Text>
            </View>
          )}

          {/* Texto da Mensagem */}
          {!!text && (
            <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
              {text}
            </Text>
          )}
        </View>

        {!!text && (
          <View style={[styles.messageActions, isUser && styles.messageActionsUser]}>
            <TouchableOpacity
              onPress={handleCopy}
              style={styles.actionButton}
              activeOpacity={0.7}
              accessibilityLabel={copied ? "Mensagem copiada" : "Copiar mensagem"}
            >
              <Feather
                name={copied ? "check" : "copy"}
                size={14}
                color={copied ? colors.green : colors.textMuted}
              />
            </TouchableOpacity>

            {!isUser && (
              <TouchableOpacity
                onPress={handleTTS}
                activeOpacity={0.7}
                accessibilityLabel={isSpeaking ? "Parar leitura" : "Ler mensagem em voz alta"}
              >
                <Animated.View
                  style={[
                    styles.actionButton,
                    { transform: [{ scale: btnScale }] },
                    isSpeaking && styles.actionButtonActive,
                  ]}
                >
                  <Feather
                    name={isSpeaking ? "square" : "volume-2"}
                    size={14}
                    color={isSpeaking ? colors.purple : colors.textMuted}
                  />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// Também usados pelo indicador de "digitando" da tela inicial.
export const estilosBalao = StyleSheet.create({
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowAgent: {
    justifyContent: "flex-start",
  },
  bubbleWrapper: {
    maxWidth: "82%",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: colors.bubbleUser,
    borderBottomRightRadius: 4,
  },
  bubbleAgent: {
    backgroundColor: colors.bubbleAgent,
    borderWidth: 1,
    borderColor: colors.bubbleAgentBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleAttachedImage: {
    width: 200,
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },
  bubbleAttachedFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  bubbleAttachedFileName: {
    fontFamily: CHAT_FONT.medium,
    fontSize: 12,
    color: "#ffffff",
  },
  messageActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  messageActionsUser: {
    alignSelf: "flex-end",
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonActive: {
    backgroundColor: "#1a1030",
  },
  bubbleText: {
    fontFamily: CHAT_FONT.regular,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: "#ffffff",
  },
});

const styles = estilosBalao;
