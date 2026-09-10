import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import BottomNav from "../components/Navbar";
import ChatInput from "../components/ChatInput";

// TROQUE PELO IPv4 REAL DO SEU PC
const DESKTOP_IP = "10.89.240.32";

const AI_API_URL = `http://${DESKTOP_IP}:8080`;

const colors = {
  background: "#0d0d0d",
  textPrimary: "#e8e8e8",
  textSecondary: "#c9c9c9",
  purple: "#7c5cff",
  green: "#2ecc71",
  red: "#e74c3c",
  bubbleUser: "#7c5cff",
  bubbleAgent: "#1a1a1a",
  bubbleAgentBorder: "#2a2a2a",
};

const fontFamily = Platform.select({
  ios: "Courier",
  android: "monospace",
});

async function sendPromptToDesktop(prompt) {
  const response = await fetch(`${AI_API_URL}/api/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
    }),
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("O desktop respondeu, mas a resposta não é JSON.");
  }
  if (!response.ok) {
    throw new Error(data?.error || `Erro HTTP ${response.status}`);
  }
  if (!data?.response) {
    throw new Error("A IA não retornou nenhuma resposta.");
  }
  return data.response;
}

async function checkDesktopConnection() {
  try {
    const response = await fetch(`${AI_API_URL}/api/status`);

    if (!response.ok) {
      return {
        connected: false,
        modelLoaded: false,
        modelName: null,
      };
    }

    const data = await response.json();

    return {
      connected: true,
      modelLoaded: Boolean(data.modelLoaded),
      modelName: data.activeModelName || null,
    };
  } catch (error) {
    return {
      connected: false,
      modelLoaded: false,
      modelName: null,
    };
  }
}

function StatusIndicator({ connected, modelLoaded, modelName }) {
  let label = "Desktop offline";

  if (connected && !modelLoaded) {
    label = "Desktop conectado • sem modelo";
  }

  if (connected && modelLoaded) {
    label = modelName ? `Conectado • ${modelName}` : "Conectado ao desktop";
  }

  return (
    <View style={styles.statusRow}>
      <View
        style={[
          styles.statusDot,

          {
            backgroundColor: connected ? colors.green : colors.red,
          },
        ]}
      />

      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function GreetingHeader({ userName = "Usuário" }) {
  return (
    <View style={styles.content}>
      <Text style={styles.greeting}>
        Bom dia,{"\n"}
        <Text style={styles.greetingName}>{userName}!</Text>
      </Text>
    </View>
  );
}

function MessageBubble({ role, text }) {
  const isUser = role === "user";

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,

      duration: 260,

      useNativeDriver: true,
    }).start();
  }, [anim]);

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

  return (
    <Animated.View
      style={[
        styles.bubbleRow,

        isUser ? styles.bubbleRowUser : styles.bubbleRowAgent,

        animatedStyle,
      ]}
    >
      <View
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAgent]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {text}
        </Text>
      </View>
    </Animated.View>
  );
}

function TypingIndicator() {
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
    <View style={[styles.bubbleRow, styles.bubbleRowAgent]}>
      <View style={[styles.bubble, styles.bubbleAgent, styles.typingBubble]}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.typingDot,

              {
                opacity: dot.interpolate({
                  inputRange: [0, 1],

                  outputRange: [0.3, 1],
                }),

                transform: [
                  {
                    translateY: dot.interpolate({
                      inputRange: [0, 1],

                      outputRange: [0, -4],
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

export default function HomeScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [messages, setMessages] = useState([]);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelName, setModelName] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const stored = await AsyncStorage.getItem("user");
        if (stored) {
          const parsedUser = JSON.parse(stored);
          const firstName = parsedUser?.name?.trim().split(" ")[0];
          setUserName(firstName || "Usuário");
        } else {
          setUserName("Usuário");
        }
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
        setUserName("Usuário");
      }
    }

    loadUser();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkConnection() {
      const status = await checkDesktopConnection();

      if (!mounted) {
        return;
      }

      setDesktopConnected(status.connected);
      setModelLoaded(status.modelLoaded);
      setModelName(status.modelName);
    }

    // verifica imediatamente
    checkConnection();

    // verifica novamente a cada 5 segundos
    const interval = setInterval(checkConnection, 5000);

    return () => {
      mounted = false;

      clearInterval(interval);
    };
  }, []);

  const handleSend = async () => {
    const text = message.trim();

    if (!text) {
      return;
    }
    if (isAgentTyping) {
      return;
    }

    const userMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
    };

    setMessages((previous) => [...previous, userMessage]);
    setMessage("");
    setIsAgentTyping(true);

    try {
      const aiResponse = await sendPromptToDesktop(text);
      const agentMessage = {
        id: `${Date.now()}-agent`,
        role: "agent",
        text: aiResponse,
      };

      setMessages((previous) => [...previous, agentMessage]);

      setDesktopConnected(true);
    } catch (error) {
      console.error("Erro ao falar com desktop:", error);
      setDesktopConnected(false);

      const errorMessage = {
        id: `${Date.now()}-error`,
        role: "agent",
        text: `Não consegui falar com o desktop.\n\n${error.message}`,
      };

      setMessages((previous) => [...previous, errorMessage]);
    } finally {
      setIsAgentTyping(false);
    }
  };

  useEffect(() => {
    if (messages.length > 0 || isAgentTyping) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated: true,
        });
      });
    }
  }, [messages, isAgentTyping]);

  const hasConversation = messages.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusIndicator
        connected={desktopConnected}
        modelLoaded={modelLoaded}
        modelName={modelName}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {hasConversation ? (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble role={item.role} text={item.text} />
            )}
            contentContainerStyle={styles.messagesList}
            ListFooterComponent={isAgentTyping ? <TypingIndicator /> : null}
            onContentSizeChange={() => {
              listRef.current?.scrollToEnd({
                animated: true,
              });
            }}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <GreetingHeader userName={userName} />
        )}

        <ChatInput
          value={message}
          onChangeText={setMessage}
          onSend={handleSend}
          onMicPress={() => console.log("mic pressionado")}
          onPlusPress={() => console.log("plus pressionado")}
          disabled={isAgentTyping}
        />

        <BottomNav onPressItem={(key) => console.log("nav:", key)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    justifyContent: "space-between",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  statusText: {
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
  bubble: {
    maxWidth: "80%",
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
  bubbleText: {
    fontFamily,
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: "#ffffff",
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
