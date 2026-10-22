import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Image,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";

const colors = {
  card: "#1a1a1a",
  cardAlt: "#232323",
  backgroundPure: "#000000",

  textPrimary: "#e8e8e8",
  textSecondary: "#c9c9c9",
  textMuted: "#9a9a9a",
  textPlaceholder: "#6b6b6b",

  purple: "#7c5cff",
  purpleDisabled: "#4a3f80",
  blueWave: "#3b82f6",
  green: "#2ecc71",
  red: "#ef4444",
  white: "#ffffff",
};

const fontFamily = Platform.select({ ios: "Courier", android: "monospace" });

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  onMicPress,
  onPlusPress,
  placeholder = "O que você quer construir?",
  disabled = false,
  isListening = false,
  attachment = null,
  onRemoveAttachment,
}) {
  return (
    <View style={styles.wrapper}>
      {/* Pré-visualização do Anexo (Foto ou Arquivo) */}
      {attachment && (
        <View style={styles.attachmentPreview}>
          <View style={styles.attachmentInfo}>
            {attachment.type === "image" ? (
              <Image
                source={{ uri: attachment.uri }}
                style={styles.attachmentThumb}
              />
            ) : (
              <View style={styles.attachmentFileIcon}>
                <Feather name="file-text" size={18} color={colors.purple} />
              </View>
            )}
            <View style={styles.attachmentTextWrap}>
              <Text style={styles.attachmentName} numberOfLines={1}>
                {attachment.name || (attachment.type === "image" ? "Foto anexada" : "Arquivo anexado")}
              </Text>
              {attachment.size && (
                <Text style={styles.attachmentSize}>
                  {(attachment.size / 1024).toFixed(1)} KB
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={styles.removeAttachmentBtn}
            onPress={onRemoveAttachment}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="x" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Caixa Principal de Entrada */}
      <View style={styles.card}>
        <View style={styles.inputBox}>
          <Text style={styles.prompt}>{">"}</Text>
          <TextInput
            style={styles.input}
            placeholder={
              isListening
                ? "Ouvindo... Fale sua mensagem"
                : disabled
                ? "Aguardando resposta do agente…"
                : placeholder
            }
            placeholderTextColor={
              isListening ? colors.blueWave : colors.textPlaceholder
            }
            value={value}
            onChangeText={onChangeText}
            editable={!disabled && !isListening}
          />
        </View>

        <View style={styles.actionsRow}>
          {/* Botão + (Abre painel de ações: Câmera, Fotos, Arquivos) */}
          <TouchableOpacity
            style={styles.plusButton}
            onPress={onPlusPress}
            disabled={disabled}
            activeOpacity={0.7}
          >
            <Feather name="plus" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.rightActions}>
            {/* Botão de Microfone / Voice-to-Text */}
            <TouchableOpacity
              style={[
                styles.micButton,
                isListening && styles.micButtonActive,
              ]}
              onPress={onMicPress}
              disabled={disabled}
              activeOpacity={0.7}
            >
              {isListening ? (
                <Ionicons name="radio" size={20} color={colors.white} />
              ) : (
                <Feather name="mic" size={20} color={colors.textPrimary} />
              )}
            </TouchableOpacity>

            {/* Botão Enviar */}
            <TouchableOpacity
              style={[
                styles.sendButton,
                (disabled || (!value?.trim() && !attachment)) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={onSend}
              disabled={disabled || (!value?.trim() && !attachment)}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  // Barra de anexo anexado
  attachmentPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16161a",
    borderWidth: 1,
    borderColor: "#282832",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  attachmentInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
    gap: 10,
  },
  attachmentThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  attachmentFileIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
  },
  attachmentTextWrap: {
    flex: 1,
  },
  attachmentName: {
    fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  attachmentSize: {
    fontFamily,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  removeAttachmentBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#24242e",
    justifyContent: "center",
    alignItems: "center",
  },

  // Card do chat input
  card: {
    borderRadius: 20,
    overflow: "hidden",
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  prompt: {
    color: colors.green,
    fontFamily,
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily,
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.backgroundPure,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    justifyContent: "center",
    alignItems: "center",
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  micButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonActive: {
    backgroundColor: colors.blueWave,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.purple,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.purpleDisabled,
    opacity: 0.5,
  },
});