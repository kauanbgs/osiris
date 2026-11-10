// HomeScreen.js — visual da tela inicial: saudação, cabeçalho com status do modelo,
// lista de mensagens, caixa de texto e menu +. A lógica fica em hooks/useConversa.js.
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { NavbarSpacer } from "../components/Navbar";
import ChatInput from "../components/ChatInput";
import PlusActionMenu from "../components/PlusActionMenu";
import BalaoMensagem, { useEstilosBalao } from "../components/BalaoMensagem";
import { useConversa } from "../hooks/useConversa";
import { createThemedStyles, useThemeColor } from "../theme";

const colors = {
  background: "#0d0d0d",
  textPrimary: "#e8e8e8",
  textSecondary: "#c9c9c9",
  purple: "#7c5cff",
  green: "#2ecc71",
  red: "#e74c3c",
  textMuted: "#8a8a8a",
};

const fontFamily = Platform.select({
  ios: "Courier",
  android: "monospace",
});

// Resume nomes longos de modelo: tira caminho, extensão e sufixos de quantização.
// Ex.: "C:/models/Qwen2.5-7B-Instruct-Q4_K_M.gguf" → "Qwen2.5-7B-Instruct"
function shortModelName(name) {
  if (!name) return name;
  return String(name)
    .split(/[\\/]/)
    .pop()
    .replace(/\.(gguf|bin|safetensors|onnx)$/i, "")
    .replace(/[-_.](i?q\d[\w]*|f16|f32|bf16|fp16|gguf)$/i, "")
    .trim();
}

function StatusIndicator({ connected, modelLoaded, modelName, cloudModelName, onPress }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
  let label = "Desktop offline";

  if (cloudModelName) {
    connected = true;
    label = `Nuvem • ${shortModelName(cloudModelName)}`;
  } else if (connected && !modelLoaded) {
    label = "Desktop • sem modelo";
  } else if (connected && modelLoaded) {
    label = modelName ? `Desktop • ${shortModelName(modelName)}` : "Conectado ao desktop";
  }

  return (
    <TouchableOpacity style={styles.statusRow} onPress={onPress}>
      <View
        style={[
          styles.statusPill,
          { backgroundColor: themeColor(`${connected ? colors.green : colors.red}1f`) },
        ]}
      >
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: connected ? themeColor(colors.green) : themeColor(colors.red),
            },
          ]}
        />
        <Text style={styles.statusText} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function GreetingHeader({ userName = "Usuário" }) {
  const styles = useStyles();
  return (
    <View style={styles.content}>
      <Text style={styles.greeting}>
        Bom dia,{"\n"}
        <Text style={styles.greetingName}>{userName}!</Text>
      </Text>
    </View>
  );
}

function TypingIndicator() {
  const estilosBalao = useEstilosBalao();
  const styles = useStyles();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const dots = [dot1, dot2, dot3];

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
    };
  }, []);

  return (
    <View style={[estilosBalao.bubbleRow, estilosBalao.bubbleRowAgent]}>
      <View style={[estilosBalao.bubble, estilosBalao.bubbleAgent, styles.typingBubble]}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,
              {
                opacity: dot,
                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -5],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation, route }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
  const conversa = useConversa({ navigation, route });
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // Mantém a lista rolada até a última mensagem.
  useEffect(() => {
    if (conversa.mensagens.length > 0 || conversa.digitando) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [conversa.mensagens, conversa.digitando]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.headerRow}>
        {conversa.temConversa ? (
          <TouchableOpacity
            style={styles.newChatButton}
            onPress={conversa.novaConversa}
            disabled={conversa.digitando}
            accessibilityLabel="Nova conversa"
          >
            <Feather name="edit" size={15} color={themeColor(colors.purple)} />
            <Text style={styles.newChatText}>Nova conversa</Text>
          </TouchableOpacity>
        ) : (
          <View />
        )}
        <StatusIndicator
          connected={conversa.desktopConectado}
          modelLoaded={conversa.modeloCarregado}
          modelName={conversa.nomeModelo}
          cloudModelName={conversa.nomeModeloNuvem}
          onPress={() => navigation.navigate("Configuracoes")}
        />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {conversa.temConversa ? (
          <FlatList
            ref={listRef}
            data={conversa.mensagens}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BalaoMensagem
                role={item.role}
                text={item.text}
                attachment={item.attachment}
              />
            )}
            contentContainerStyle={styles.messagesList}
            ListFooterComponent={conversa.digitando ? <TypingIndicator /> : null}
            onContentSizeChange={() => {
              listRef.current?.scrollToEnd({
                animated: true,
              });
            }}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <GreetingHeader userName={conversa.nomeUsuario} />
        )}

        <ChatInput
          inputRef={inputRef}
          value={conversa.texto}
          onChangeText={conversa.setTexto}
          onSend={conversa.enviar}
          onPlusPress={conversa.abrirMenu}
          disabled={conversa.digitando}
          attachment={conversa.anexo}
          onRemoveAttachment={conversa.removerAnexo}
        />

        {/* Menu Popover acionado pelo botão + */}
        <PlusActionMenu
          visible={conversa.menuAberto}
          onClose={conversa.fecharMenu}
          onSelectCamera={conversa.escolherCamera}
          onSelectPhotos={conversa.escolherFotos}
          onSelectFiles={conversa.escolherArquivo}
        />

        <NavbarSpacer />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    justifyContent: "space-between",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  newChatText: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: 6,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    flexShrink: 1,
    marginLeft: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  statusText: {
    flexShrink: 1,
    fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  greeting: {
    fontFamily,
    fontSize: 40,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 48,
  },
  greetingName: {
    color: colors.purple,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 14,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textSecondary,
    marginHorizontal: 2,
  },
});
