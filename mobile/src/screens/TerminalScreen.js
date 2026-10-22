import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import BottomNav from "../components/Navbar";
import sheets from "../services/api";
import { getIP, loadIP } from "../services/serverConfig";

const colors = {
  background: "#0d0d0d",
  surface: "#141414",
  surfaceCard: "#19191d",
  border: "#262626",
  textPrimary: "#f0f0f0",
  textSecondary: "#85818c",
  textMuted: "#52525b",
  purple: "#7c5cff",
  purpleBright: "#9d85ff",
  green: "#2ecc71",
  red: "#ef4444",
};

const fontFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
});

// Remove códigos ANSI de escape das saídas do terminal
function stripAnsi(str) {
  if (typeof str !== "string") return "";
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

export default function TerminalScreen({ navigation }) {
  const [currentIp, setCurrentIp] = useState(getIP());
  const [connected, setConnected] = useState(null); // true | false | null

  // Abas do terminal (múltiplas sessões simultâneas)
  const [tabs, setTabs] = useState([
    {
      id: "term-1",
      label: "Terminal 1",
      lines: [
        {
          id: "init-1",
          type: "system",
          text: `Osíris Terminal — Conectado ao PC (${getIP()}:5000)`,
        },
        {
          id: "init-2",
          type: "system",
          text: "Digite qualquer comando do sistema operacional do seu desktop.",
        },
      ],
      command: "",
      loading: false,
      cmdHistory: [],
      historyIdx: -1,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("term-1");

  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // Aba atualmente selecionada
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Carrega IP e testa status da API do PC
  const checkConnection = useCallback(async () => {
    try {
      const ip = await loadIP();
      if (ip) setCurrentIp(ip);
      await sheets.health();
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Scroll automático para o final quando novas linhas chegam
  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab.lines.length, activeTab.loading]);

  // Atualiza propriedades da aba ativa
  const updateActiveTab = useCallback(
    (updater) => {
      setTabs((prevTabs) =>
        prevTabs.map((t) => (t.id === activeTabId ? updater(t) : t))
      );
    },
    [activeTabId]
  );

  // Adicionar nova aba
  const handleAddTab = () => {
    if (tabs.length >= 6) return;
    const newIdx = tabs.length + 1;
    const newId = `term-${Date.now()}`;
    const newTab = {
      id: newId,
      label: `Terminal ${newIdx}`,
      lines: [
        {
          id: `init-${Date.now()}-1`,
          type: "system",
          text: `Osíris Terminal [Sessão ${newIdx}] — PC (${currentIp}:5000)`,
        },
        {
          id: `init-${Date.now()}-2`,
          type: "system",
          text: "Sessão iniciada. Digite qualquer comando do PC.",
        },
      ],
      command: "",
      loading: false,
      cmdHistory: [...(activeTab.cmdHistory || [])],
      historyIdx: -1,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Fechar aba
  const handleRemoveTab = (tabIdToRemove) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabIdToRemove);
    setTabs(nextTabs);
    if (activeTabId === tabIdToRemove) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Limpar a aba atual
  const handleClear = () => {
    updateActiveTab((t) => ({
      ...t,
      lines: [
        {
          id: `clear-${Date.now()}`,
          type: "system",
          text: "Terminal limpo.",
        },
      ],
    }));
  };

  // Navegar no histórico de comandos (↑ / ↓)
  const navigateHistory = (direction) => {
    const history = activeTab.cmdHistory;
    if (!history.length) return;
    let nextIdx = activeTab.historyIdx;
    if (direction === "up") {
      nextIdx = Math.min(activeTab.historyIdx + 1, history.length - 1);
    } else {
      nextIdx = Math.max(activeTab.historyIdx - 1, -1);
    }
    updateActiveTab((t) => ({
      ...t,
      historyIdx: nextIdx,
      command: nextIdx === -1 ? "" : history[nextIdx],
    }));
  };

  // Executar comando no PC
  const handleExecute = async () => {
    const cmd = activeTab.command.trim();
    if (!cmd || activeTab.loading) return;

    // Atualiza histórico de comandos digitados
    const updatedHistory = [
      cmd,
      ...activeTab.cmdHistory.filter((c) => c !== cmd),
    ].slice(0, 30);

    const cmdLine = {
      id: `cmd-${Date.now()}`,
      type: "command",
      text: cmd,
    };

    updateActiveTab((t) => ({
      ...t,
      command: "",
      loading: true,
      cmdHistory: updatedHistory,
      historyIdx: -1,
      lines: [...t.lines, cmdLine],
    }));

    try {
      const response = await sheets.executeCommand(cmd, 30000);
      const data = response?.data || {};

      const stdout = stripAnsi(data.stdout || "").trimEnd();
      const stderr = stripAnsi(data.stderr || "").trimEnd();
      const newItems = [];

      if (stdout) {
        newItems.push({
          id: `out-${Date.now()}`,
          type: "stdout",
          text: stdout,
        });
      }

      if (stderr) {
        newItems.push({
          id: `err-${Date.now()}`,
          type: "stderr",
          text: stderr,
        });
      }

      if (!stdout && !stderr) {
        newItems.push({
          id: `done-${Date.now()}`,
          type: "system",
          text: `[Comando finalizado com sucesso — código ${data.exit_code ?? 0}]`,
        });
      }

      setConnected(true);
      updateActiveTab((t) => ({
        ...t,
        loading: false,
        lines: [...t.lines, ...newItems],
      }));
    } catch (err) {
      let errMsg = "Erro de conexão com o terminal do PC.";
      if (err?.response?.status === 401) {
        errMsg = "Não autorizado (401). Faça login no aplicativo.";
      } else if (err?.response?.data?.error?.message) {
        errMsg = err.response.data.error.message;
      } else if (err?.message) {
        errMsg = err.message;
      }

      setConnected(false);
      updateActiveTab((t) => ({
        ...t,
        loading: false,
        lines: [
          ...t.lines,
          {
            id: `err-${Date.now()}`,
            type: "stderr",
            text: errMsg,
          },
        ],
      }));
    }
  };

  const renderLine = ({ item }) => {
    if (item.type === "command") {
      return (
        <View style={styles.commandRow}>
          <Text style={styles.promptSign}>❯</Text>
          <Text style={styles.commandText} selectable>
            {item.text}
          </Text>
        </View>
      );
    }

    if (item.type === "stderr") {
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <Text style={styles.stderrText} selectable>
            {item.text}
          </Text>
        </ScrollView>
      );
    }

    if (item.type === "stdout") {
      return (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <Text style={styles.stdoutText} selectable>
            {item.text}
          </Text>
        </ScrollView>
      );
    }

    return (
      <Text style={styles.systemText} selectable>
        {item.text}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header enxuto e limpo */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Terminal</Text>
          <TouchableOpacity
            style={styles.statusPill}
            onPress={checkConnection}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    connected === true
                      ? colors.green
                      : connected === false
                      ? colors.red
                      : colors.textMuted,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {connected === true
                ? `${currentIp}`
                : connected === false
                ? "Offline"
                : "Conectando..."}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="trash-2" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Barra de Abas compacta e moderna */}
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTabId(tab.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.tabDot,
                    isActive ? styles.tabDotActive : styles.tabDotInactive,
                  ]}
                />
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {tabs.length > 1 && (
                  <TouchableOpacity
                    style={styles.tabCloseBtn}
                    onPress={() => handleRemoveTab(tab.id)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Feather name="x" size={11} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}

          {tabs.length < 6 && (
            <TouchableOpacity
              style={styles.addTabBtn}
              onPress={handleAddTab}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Feather name="plus" size={13} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Viewport do Terminal */}
      <KeyboardAvoidingView
        style={styles.flexContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={activeTab.lines}
          keyExtractor={(item) => item.id}
          renderItem={renderLine}
          contentContainerStyle={styles.terminalContent}
          style={styles.terminalList}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            activeTab.loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.purple} />
                <Text style={styles.loadingText}>Executando...</Text>
              </View>
            ) : null
          }
        />

        {/* Barra de input enxuta */}
        <View style={styles.inputArea}>
          {activeTab.cmdHistory.length > 0 && (
            <View style={styles.historyRow}>
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => navigateHistory("up")}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="arrow-up" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={() => navigateHistory("down")}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="arrow-down" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputBox}>
            <Text style={styles.inputPrompt}>❯</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Digite um comando..."
              placeholderTextColor={colors.textMuted}
              value={activeTab.command}
              onChangeText={(text) =>
                updateActiveTab((t) => ({ ...t, command: text }))
              }
              onSubmitEditing={handleExecute}
              returnKeyType="send"
              editable={!activeTab.loading}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!activeTab.command.trim() || activeTab.loading) &&
                  styles.sendBtnDisabled,
              ]}
              onPress={handleExecute}
              disabled={!activeTab.command.trim() || activeTab.loading}
            >
              {activeTab.loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Navbar */}
        <BottomNav activeKey="terminal" navigation={navigation} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flexContainer: {
    flex: 1,
  },

  // Header minimalista
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontFamily,
    color: colors.textSecondary,
  },
  clearBtn: {
    padding: 6,
    borderRadius: 6,
  },

  // Barra de abas compacta
  tabsBar: {
    height: 36,
    backgroundColor: "#111114",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsScroll: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  tabItemActive: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tabDotActive: {
    backgroundColor: colors.purpleBright,
  },
  tabDotInactive: {
    backgroundColor: colors.textMuted,
  },
  tabText: {
    fontSize: 11,
    fontFamily,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  tabCloseBtn: {
    marginLeft: 2,
    padding: 2,
  },
  addTabBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
  },

  // Área de terminal pura
  terminalList: {
    flex: 1,
    backgroundColor: colors.background,
  },
  terminalContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
    gap: 6,
  },
  commandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    gap: 8,
  },
  promptSign: {
    fontFamily,
    fontSize: 13,
    fontWeight: "900",
    color: colors.purpleBright,
    lineHeight: 18,
  },
  commandText: {
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 18,
    flex: 1,
  },
  stdoutText: {
    fontFamily,
    fontSize: 12,
    color: "#d4d4d8",
    lineHeight: 18,
  },
  stderrText: {
    fontFamily,
    fontSize: 12,
    color: colors.red,
    lineHeight: 18,
  },
  systemText: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    marginVertical: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
  },

  // Área de input limpa
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    gap: 4,
  },
  historyBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  inputPrompt: {
    fontFamily,
    fontSize: 14,
    fontWeight: "900",
    color: colors.purpleBright,
  },
  input: {
    flex: 1,
    fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  sendBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.purple,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
