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
  Animated,
  ScrollView,
  Modal,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BottomNav from "../components/Navbar";
import sheets from "../services/api";
import { getIP, loadIP, saveIP, apiUrl } from "../services/serverConfig";

const colors = {
  background: "#0a0a0d",
  surface: "#111116",
  surfaceAlt: "#16161d",
  surfaceCard: "#13131a",
  border: "#242430",
  borderLight: "#38384a",
  textPrimary: "#f4f4f7",
  textSecondary: "#a1a1b2",
  textMuted: "#6b6b7f",
  purple: "#8b5cf6",
  purpleBright: "#a78bfa",
  purpleDim: "#4c1d95",
  purpleGlow: "rgba(139, 92, 246, 0.15)",
  green: "#10b981",
  greenBright: "#34d399",
  greenDim: "#064e3b",
  greenBg: "rgba(16, 185, 129, 0.1)",
  red: "#ef4444",
  redBright: "#f87171",
  redDim: "#7f1d1d",
  redBg: "rgba(239, 68, 68, 0.12)",
  yellow: "#f59e0b",
  yellowBg: "rgba(245, 158, 11, 0.12)",
  cyan: "#38bdf8",
  cyanBg: "rgba(56, 189, 248, 0.1)",
  white: "#ffffff",
};

const fontFamily = Platform.select({
  ios: "Courier",
  android: "monospace",
});

// Remove códigos de escape ANSI de saídas de terminal
function stripAnsi(str) {
  if (typeof str !== "string") return "";
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

// Formata timestamp (HH:mm:ss)
function formatTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString([], { hour12: false });
}

// Comandos rápidos para controle do PC conectado
const QUICK_COMMANDS = [
  { label: "IP Config", cmd: "ipconfig", icon: "wifi" },
  { label: "Quem sou eu", cmd: "whoami", icon: "user" },
  { label: "Listar Arquivos", cmd: "dir", icon: "folder" },
  { label: "Info Sistema", cmd: "systeminfo", icon: "cpu" },
  { label: "Node.js", cmd: "node -v", icon: "code" },
  { label: "NPM", cmd: "npm -v", icon: "package" },
  { label: "Git Status", cmd: "git status", icon: "git-branch" },
  { label: "Processos", cmd: "tasklist", icon: "activity" },
  { label: "Nome do Host", cmd: "hostname", icon: "server" },
];

function TerminalLineItem({ item }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, []);

  const animStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [4, 0],
        }),
      },
    ],
  };

  // Comando digitado pelo usuário
  if (item.type === "command") {
    return (
      <Animated.View style={[styles.commandRow, animStyle]}>
        <View style={styles.promptSign}>
          <Text style={styles.promptChevron}>❯</Text>
        </View>
        <Text style={styles.commandText} selectable>
          {item.text}
        </Text>
        {item.timestamp && (
          <Text style={styles.commandTimestamp}>{item.timestamp}</Text>
        )}
      </Animated.View>
    );
  }

  // Saída stdout do comando no PC
  if (item.type === "stdout") {
    return (
      <Animated.View style={[styles.stdoutContainer, animStyle]}>
        <View style={styles.stdoutMetaBar}>
          <View style={styles.stdoutStatusPill}>
            <View style={styles.stdoutStatusDot} />
            <Text style={styles.stdoutStatusText}>
              {item.exitCode !== undefined ? `exit ${item.exitCode}` : "sucesso"}
            </Text>
          </View>
          <View style={styles.metaRight}>
            {item.executionTimeMs !== undefined && (
              <View style={styles.timeTag}>
                <Feather name="clock" size={10} color={colors.textMuted} />
                <Text style={styles.timeTagText}>{item.executionTimeMs}ms</Text>
              </View>
            )}
            {item.timestamp && (
              <Text style={styles.stdoutTimestamp}>{item.timestamp}</Text>
            )}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stdoutScrollContent}
        >
          <Text style={styles.stdoutText} selectable>
            {item.text}
          </Text>
        </ScrollView>
      </Animated.View>
    );
  }

  // Saída stderr ou erro de execução no PC
  if (item.type === "stderr") {
    return (
      <Animated.View style={[styles.stderrContainer, animStyle]}>
        <View style={styles.stderrHeader}>
          <View style={styles.stderrTitleRow}>
            <Feather name="alert-triangle" size={13} color={colors.redBright} />
            <Text style={styles.stderrTitle}>Erro de Execução</Text>
          </View>
          <View style={styles.metaRight}>
            {item.exitCode !== undefined && (
              <View style={styles.exitCodeBadge}>
                <Text style={styles.exitCodeText}>exit {item.exitCode}</Text>
              </View>
            )}
            {item.executionTimeMs !== undefined && (
              <Text style={styles.timeTagText}>{item.executionTimeMs}ms</Text>
            )}
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stdoutScrollContent}
        >
          <Text style={styles.stderrText} selectable>
            {item.text}
          </Text>
        </ScrollView>
      </Animated.View>
    );
  }

  // Comando executado com sucesso sem saída de texto (ex: mkdir, cls)
  if (item.type === "success") {
    return (
      <Animated.View style={[styles.successRow, animStyle]}>
        <Feather name="check-circle" size={13} color={colors.greenBright} />
        <Text style={styles.successText} selectable>
          {item.text}
        </Text>
        {item.executionTimeMs !== undefined && (
          <Text style={styles.successTimeText}>({item.executionTimeMs}ms)</Text>
        )}
      </Animated.View>
    );
  }

  // Mensagem do sistema / informativa
  return (
    <Animated.View style={[styles.systemRow, animStyle]}>
      <Text style={styles.systemText} selectable>
        {item.text}
      </Text>
    </Animated.View>
  );
}

export default function TerminalScreen({ navigation }) {
  const [currentIp, setCurrentIp] = useState(getIP());
  const [connectionStatus, setConnectionStatus] = useState("checking"); // checking | connected | disconnected | unauthorized
  const [latencyMs, setLatencyMs] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  // Modal para ajuste rápido de IP do PC
  const [ipModalVisible, setIpModalVisible] = useState(false);
  const [modalIpInput, setModalIpInput] = useState("");
  const [testingIp, setTestingIp] = useState(false);

  // Abas do terminal (múltiplas sessões simultâneas)
  const [tabs, setTabs] = useState([
    {
      id: "term-1",
      label: "Terminal 1",
      lines: [
        {
          id: "welcome-1",
          type: "system",
          text: `Osíris Terminal — Conectado ao PC (${getIP()}:5000)`,
        },
        {
          id: "welcome-2",
          type: "system",
          text: "Pronto para enviar comandos e receber respostas do desktop em tempo real.",
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

  // Aba ativa atual
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Testar conexão com o servidor do PC
  const checkConnection = useCallback(async () => {
    setConnectionStatus("checking");
    const startTime = Date.now();
    try {
      await sheets.health();
      const elapsed = Date.now() - startTime;
      setLatencyMs(elapsed);
      setConnectionStatus("connected");

      // Verificar se há token de autenticação
      const token = await AsyncStorage.getItem("token");
      setIsAuthenticated(!!token);
    } catch (err) {
      if (err?.response?.status === 401) {
        setConnectionStatus("unauthorized");
        setIsAuthenticated(false);
      } else {
        setConnectionStatus("disconnected");
        setLatencyMs(null);
      }
    }
  }, []);

  // Carregar IP e sincronizar ao abrir a tela
  useEffect(() => {
    loadIP()
      .then((ip) => {
        if (ip) {
          setCurrentIp(ip);
          setModalIpInput(ip);
        }
      })
      .catch(() => {});

    checkConnection();

    // Carregar histórico recente do backend caso exista
    sheets
      .terminalHistory({ limit: 15 })
      .then((res) => {
        const historyData = res?.data?.history || [];
        if (Array.isArray(historyData) && historyData.length > 0) {
          const cmds = historyData
            .map((h) => h.command)
            .filter(Boolean)
            .slice(0, 30);
          if (cmds.length > 0) {
            setTabs((prevTabs) =>
              prevTabs.map((t) => ({
                ...t,
                cmdHistory: Array.from(new Set([...t.cmdHistory, ...cmds])),
              }))
            );
          }
        }
      })
      .catch(() => {});
  }, [checkConnection]);

  // Scroll automático suave ao receber novas respostas
  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 90);
    return () => clearTimeout(timer);
  }, [activeTab.lines.length, activeTab.loading]);

  // Atualiza campo na aba ativa
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
    if (tabs.length >= 6) {
      Alert.alert("Limite", "Você já atingiu o limite de 6 abas abertas.");
      return;
    }
    const newIdx = tabs.length + 1;
    const newId = `term-${Date.now()}`;
    const newTab = {
      id: newId,
      label: `Terminal ${newIdx}`,
      lines: [
        {
          id: `welcome-${Date.now()}-1`,
          type: "system",
          text: `Osíris Terminal [Sessão ${newIdx}] — PC (${currentIp}:5000)`,
        },
        {
          id: `welcome-${Date.now()}-2`,
          type: "system",
          text: "Sessão iniciada. Digite qualquer comando do PC conectado.",
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

  // Remover aba
  const handleRemoveTab = (tabIdToRemove) => {
    if (tabs.length <= 1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabIdToRemove);
    setTabs(nextTabs);
    if (activeTabId === tabIdToRemove) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  // Limpar tela da aba atual ou histórico
  const handleClear = () => {
    Alert.alert(
      "Limpar Terminal",
      "Escolha o que deseja limpar nesta sessão:",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpar Tela",
          onPress: () => {
            updateActiveTab((t) => ({
              ...t,
              lines: [
                {
                  id: `clear-${Date.now()}`,
                  type: "system",
                  text: `Terminal limpo em ${formatTime()}.`,
                },
              ],
            }));
          },
        },
        {
          text: "Limpar Tudo (com Servidor)",
          style: "destructive",
          onPress: async () => {
            try {
              await sheets.terminalClearHistory();
            } catch {}
            updateActiveTab((t) => ({
              ...t,
              cmdHistory: [],
              historyIdx: -1,
              lines: [
                {
                  id: `clear-all-${Date.now()}`,
                  type: "system",
                  text: `Terminal e histórico do servidor limpos com sucesso.`,
                },
              ],
            }));
          },
        },
      ]
    );
  };

  // Navegação no histórico de comandos digitados (↑ e ↓)
  const handleHistoryNav = (direction) => {
    const history = activeTab.cmdHistory;
    if (!history || history.length === 0) return;

    let nextIdx = activeTab.historyIdx;
    if (direction === "up") {
      nextIdx = Math.min(activeTab.historyIdx + 1, history.length - 1);
    } else {
      nextIdx = Math.max(activeTab.historyIdx - 1, -1);
    }

    const nextCmd = nextIdx === -1 ? "" : history[nextIdx];
    updateActiveTab((t) => ({
      ...t,
      historyIdx: nextIdx,
      command: nextCmd,
    }));
  };

  // Executar comando no terminal do PC usando a função nativa do projeto
  const executeCommand = async (rawCmd) => {
    const cmdToRun = (rawCmd !== undefined ? rawCmd : activeTab.command).trim();
    if (!cmdToRun || activeTab.loading) return;

    const timeStr = formatTime();

    // Atualiza histórico local de comandos
    const updatedCmdHistory = [
      cmdToRun,
      ...activeTab.cmdHistory.filter((h) => h !== cmdToRun),
    ].slice(0, 50);

    const cmdEntry = {
      id: `cmd-${Date.now()}`,
      type: "command",
      text: cmdToRun,
      timestamp: timeStr,
    };

    updateActiveTab((t) => ({
      ...t,
      command: "",
      loading: true,
      cmdHistory: updatedCmdHistory,
      historyIdx: -1,
      lines: [...t.lines, cmdEntry],
    }));

    try {
      // Usa a função do serviço da API mobile: sheets.executeCommand
      const response = await sheets.executeCommand(cmdToRun, 30000);
      const data = response?.data || {};

      const cleanedStdout = stripAnsi(data.stdout || "").trimEnd();
      const cleanedStderr = stripAnsi(data.stderr || "").trimEnd();
      const newEntries = [];

      if (cleanedStdout) {
        newEntries.push({
          id: `out-${Date.now()}`,
          type: "stdout",
          text: cleanedStdout,
          exitCode: data.exit_code,
          executionTimeMs: data.execution_time_ms,
          timestamp: formatTime(),
        });
      }

      if (cleanedStderr) {
        newEntries.push({
          id: `err-${Date.now()}`,
          type: "stderr",
          text: cleanedStderr,
          exitCode: data.exit_code !== undefined ? data.exit_code : 1,
          executionTimeMs: data.execution_time_ms,
          timestamp: formatTime(),
        });
      }

      // Se executou com sucesso mas não gerou saída de texto
      if (!cleanedStdout && !cleanedStderr) {
        newEntries.push({
          id: `done-${Date.now()}`,
          type: "success",
          text: "Comando executado com sucesso no PC (sem retorno de texto).",
          exitCode: data.exit_code,
          executionTimeMs: data.execution_time_ms,
          timestamp: formatTime(),
        });
      }

      setConnectionStatus("connected");

      updateActiveTab((t) => ({
        ...t,
        loading: false,
        lines: [...t.lines, ...newEntries],
      }));
    } catch (err) {
      let errMsg = "Falha na comunicação com o terminal do PC.";

      if (err?.response?.status === 401) {
        errMsg =
          "Sessão não autorizada ou expirada (401). Faça login novamente para executar comandos no desktop.";
        setIsAuthenticated(false);
        setConnectionStatus("unauthorized");
      } else if (err?.response?.data?.error?.message) {
        errMsg = err.response.data.error.message;
      } else if (err?.response?.data?.message) {
        errMsg = err.response.data.message;
      } else if (
        err?.code === "ECONNABORTED" ||
        String(err?.message || "").includes("timeout")
      ) {
        errMsg = `Tempo limite esgotado (30s) ao aguardar resposta do PC (${currentIp}:5000).`;
      } else if (err?.message) {
        errMsg = `Não foi possível conectar ao PC em ${apiUrl()}: ${err.message}`;
        setConnectionStatus("disconnected");
      }

      updateActiveTab((t) => ({
        ...t,
        loading: false,
        lines: [
          ...t.lines,
          {
            id: `err-${Date.now()}`,
            type: "stderr",
            text: errMsg,
            timestamp: formatTime(),
          },
        ],
      }));
    }
  };

  // Salvar novo IP a partir do modal rápido
  const handleSaveModalIp = async () => {
    const val = modalIpInput.trim();
    if (!val) {
      Alert.alert("Erro", "O IP não pode ser vazio.");
      return;
    }
    try {
      setTestingIp(true);
      await saveIP(val);
      setCurrentIp(val);
      await sheets.health();
      setConnectionStatus("connected");
      setIpModalVisible(false);
      Alert.alert("Conectado", `Conexão bem-sucedida com o PC em ${val}:5000`);
    } catch (error) {
      Alert.alert(
        "Aviso de Conexão",
        `IP salvo (${val}), mas o PC não respondeu no momento. Verifique se a API está rodando.`
      );
      setConnectionStatus("disconnected");
      setIpModalVisible(false);
    } finally {
      setTestingIp(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />

      {/* Header do Terminal com status de conexão real */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.dots}>
            <View style={[styles.dot, { backgroundColor: colors.red }]} />
            <View style={[styles.dot, { backgroundColor: colors.yellow }]} />
            <View style={[styles.dot, { backgroundColor: colors.green }]} />
          </View>

          <View style={styles.headerTitleWrap}>
            <Feather name="terminal" size={15} color={colors.purpleBright} />
            <Text style={styles.headerTitle}>TERMINAL PC</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* Badge Interativo com Status de Conexão */}
          <TouchableOpacity
            style={[
              styles.statusBadge,
              connectionStatus === "connected" && styles.statusBadgeConnected,
              connectionStatus === "disconnected" && styles.statusBadgeDisconnected,
              connectionStatus === "unauthorized" && styles.statusBadgeWarning,
            ]}
            onPress={() => {
              setModalIpInput(currentIp);
              setIpModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.statusIndicator,
                connectionStatus === "connected" && styles.indicatorConnected,
                connectionStatus === "disconnected" && styles.indicatorDisconnected,
                connectionStatus === "unauthorized" && styles.indicatorWarning,
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                connectionStatus === "connected" && styles.statusTextConnected,
                connectionStatus === "disconnected" && styles.statusTextDisconnected,
              ]}
              numberOfLines={1}
            >
              {connectionStatus === "connected"
                ? `${latencyMs ? `${latencyMs}ms • ` : ""}${currentIp}`
                : connectionStatus === "checking"
                ? "Verificando..."
                : connectionStatus === "unauthorized"
                ? "Não Autenticado"
                : "PC Offline"}
            </Text>
            <Feather name="sliders" size={11} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Botão Limpar Tela */}
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={13} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de Abas (Múltiplas sessões simultâneas) */}
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
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
                    styles.tabButtonText,
                    isActive && styles.tabButtonTextActive,
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
            >
              <Feather name="plus" size={13} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Barra de Comandos Rápidos do PC */}
      <View style={styles.quickCommandsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickCommandsList}
        >
          <Text style={styles.quickCommandsLabel}>ATALHOS:</Text>
          {QUICK_COMMANDS.map((qc) => (
            <TouchableOpacity
              key={qc.cmd}
              style={styles.quickChip}
              onPress={() => executeCommand(qc.cmd)}
              disabled={activeTab.loading}
              activeOpacity={0.7}
            >
              <Feather
                name={qc.icon}
                size={11}
                color={colors.greenBright}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.quickChipText}>{qc.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Aviso de Sessão / Token, se não autenticado */}
      {!isAuthenticated && (
        <View style={styles.authWarningCard}>
          <Feather name="alert-circle" size={14} color={colors.yellow} />
          <Text style={styles.authWarningText}>
            Aviso: Faça login para ter permissão total de executar comandos no PC.
          </Text>
          <TouchableOpacity
            style={styles.authLoginBtn}
            onPress={() => navigation.navigate("LoginScreen")}
          >
            <Text style={styles.authLoginBtnText}>Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Viewport Principal com KeyboardAvoidingView */}
      <KeyboardAvoidingView
        style={styles.flexContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={activeTab.lines}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TerminalLineItem item={item} />}
          contentContainerStyle={styles.linesListContainer}
          style={styles.linesList}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            activeTab.loading ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={colors.purpleBright} />
                <Text style={styles.loadingText}>
                  Executando comando no terminal do PC...
                </Text>
              </View>
            ) : null
          }
        />

        {/* Toolbar de Histórico Recente (↑ e ↓) */}
        {activeTab.cmdHistory.length > 0 && (
          <View style={styles.historyToolbar}>
            <View style={styles.historyNavButtons}>
              <TouchableOpacity
                style={styles.historyArrowBtn}
                onPress={() => handleHistoryNav("up")}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Feather name="arrow-up" size={13} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyArrowBtn}
                onPress={() => handleHistoryNav("down")}
                activeOpacity={0.7}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Feather name="arrow-down" size={13} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentCommandsScroll}
            >
              {activeTab.cmdHistory.slice(0, 5).map((hCmd, idx) => (
                <TouchableOpacity
                  key={`${hCmd}-${idx}`}
                  style={styles.recentChip}
                  onPress={() => {
                    updateActiveTab((t) => ({ ...t, command: hCmd }));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.recentChipText} numberOfLines={1}>
                    {hCmd}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Campo de Entrada de Comando */}
        <View style={styles.inputContainer}>
          <View style={styles.inputCard}>
            <Text style={styles.inputPromptSymbol}>❯</Text>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Digite um comando (ex: dir, ipconfig, node -v)..."
              placeholderTextColor={colors.textMuted}
              value={activeTab.command}
              onChangeText={(text) =>
                updateActiveTab((t) => ({ ...t, command: text }))
              }
              onSubmitEditing={() => executeCommand()}
              returnKeyType="send"
              editable={!activeTab.loading}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              selectionColor={colors.purpleBright}
            />

            {activeTab.command.length > 0 && !activeTab.loading && (
              <TouchableOpacity
                style={styles.clearInputBtn}
                onPress={() => updateActiveTab((t) => ({ ...t, command: "" }))}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Feather name="x" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.execButton,
                (activeTab.loading || !activeTab.command.trim()) &&
                  styles.execButtonDisabled,
              ]}
              onPress={() => executeCommand()}
              disabled={activeTab.loading || !activeTab.command.trim()}
              activeOpacity={0.8}
            >
              {activeTab.loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="send" size={14} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Modal de Conexão Rápida com o PC */}
        <Modal
          visible={ipModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIpModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Feather name="server" size={16} color={colors.purpleBright} />
                  <Text style={styles.modalTitle}>Conexão com o PC</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIpModalVisible(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDescription}>
                Digite o IP do computador onde o Osíris Desktop / API está em execução (porta 5000):
              </Text>

              <View style={styles.modalInputWrapper}>
                <TextInput
                  style={styles.modalTextInput}
                  value={modalIpInput}
                  onChangeText={setModalIpInput}
                  placeholder="Ex: 192.168.1.100"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIpModalVisible(false)}
                >
                  <Text style={styles.modalCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveModalIp}
                  disabled={testingIp}
                >
                  {testingIp ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalSaveBtnText}>Conectar e Salvar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Barra de Navegação Inferior */}
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

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontFamily,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 165,
  },
  statusBadgeConnected: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  statusBadgeDisconnected: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusBadgeWarning: {
    backgroundColor: colors.yellowBg,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.yellow,
  },
  indicatorConnected: {
    backgroundColor: colors.greenBright,
  },
  indicatorDisconnected: {
    backgroundColor: colors.redBright,
  },
  indicatorWarning: {
    backgroundColor: colors.yellow,
  },
  statusBadgeText: {
    fontFamily,
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    flexShrink: 1,
  },
  statusTextConnected: {
    color: colors.greenBright,
  },
  statusTextDisconnected: {
    color: colors.redBright,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },

  // Tabs Bar
  tabsBar: {
    height: 38,
    backgroundColor: "#0d0d11",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabsContainer: {
    paddingHorizontal: 10,
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabDotActive: {
    backgroundColor: colors.purpleBright,
  },
  tabDotInactive: {
    backgroundColor: colors.textMuted,
  },
  tabButtonText: {
    fontFamily,
    fontSize: 11,
    color: colors.textMuted,
  },
  tabButtonTextActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  tabCloseBtn: {
    marginLeft: 2,
    padding: 2,
  },
  addTabBtn: {
    width: 26,
    height: 26,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
  },

  // Comandos rápidos
  quickCommandsBar: {
    backgroundColor: "#0f0f14",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 6,
  },
  quickCommandsList: {
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickCommandsLabel: {
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    marginRight: 2,
    letterSpacing: 0.5,
  },
  quickChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  quickChipText: {
    fontFamily,
    fontSize: 11,
    color: colors.greenBright,
    fontWeight: "500",
  },

  // Warning card
  authWarningCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 158, 11, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  authWarningText: {
    fontFamily,
    fontSize: 10,
    color: colors.yellow,
    flex: 1,
  },
  authLoginBtn: {
    backgroundColor: colors.yellow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  authLoginBtnText: {
    fontFamily,
    fontSize: 10,
    fontWeight: "700",
    color: "#000",
  },

  // Lista de linhas do terminal
  linesList: {
    flex: 1,
    backgroundColor: colors.background,
  },
  linesListContainer: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    flexGrow: 1,
  },

  // Linha de comando do usuário
  commandRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
    marginBottom: 4,
    gap: 6,
  },
  promptSign: {
    marginTop: 1,
  },
  promptChevron: {
    fontFamily,
    fontSize: 14,
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
  commandTimestamp: {
    fontFamily,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Saída stdout do comando
  stdoutContainer: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
  },
  stdoutMetaBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  stdoutStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stdoutStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.greenBright,
  },
  stdoutStatusText: {
    fontFamily,
    fontSize: 9,
    fontWeight: "700",
    color: colors.greenBright,
    textTransform: "uppercase",
  },
  metaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stdoutTimestamp: {
    fontFamily,
    fontSize: 9,
    color: colors.textMuted,
  },
  stdoutScrollContent: {
    flexGrow: 1,
  },
  stdoutText: {
    fontFamily,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timeTagText: {
    fontFamily,
    fontSize: 9,
    color: colors.textMuted,
  },

  // Saída stderr do comando
  stderrContainer: {
    backgroundColor: colors.redBg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 8,
    padding: 10,
    marginVertical: 4,
  },
  stderrHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  stderrTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stderrTitle: {
    fontFamily,
    fontSize: 11,
    fontWeight: "700",
    color: colors.redBright,
  },
  exitCodeBadge: {
    backgroundColor: colors.redDim,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  exitCodeText: {
    fontFamily,
    fontSize: 9,
    fontWeight: "600",
    color: colors.redBright,
  },
  stderrText: {
    fontFamily,
    fontSize: 12,
    color: colors.redBright,
    lineHeight: 18,
  },

  // Linha de sucesso sem texto
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4,
    backgroundColor: colors.greenBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  successText: {
    fontFamily,
    fontSize: 11,
    color: colors.greenBright,
    flex: 1,
  },
  successTimeText: {
    fontFamily,
    fontSize: 10,
    color: colors.textMuted,
  },

  // Linha de sistema
  systemRow: {
    marginVertical: 3,
  },
  systemText: {
    fontFamily,
    fontSize: 11,
    fontStyle: "italic",
    color: colors.textMuted,
    lineHeight: 16,
  },

  // Loading footer
  loadingFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontFamily,
    fontSize: 11,
    color: colors.purpleBright,
  },

  // History Toolbar
  historyToolbar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0d0d12",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
  },
  historyNavButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyArrowBtn: {
    width: 26,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  recentCommandsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  recentChip: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 140,
  },
  recentChipText: {
    fontFamily,
    fontSize: 10,
    color: colors.textSecondary,
  },

  // Área de input
  inputContainer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  inputPromptSymbol: {
    fontFamily,
    fontSize: 14,
    fontWeight: "900",
    color: colors.purpleBright,
  },
  textInput: {
    flex: 1,
    fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  clearInputBtn: {
    padding: 3,
  },
  execButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.purple,
    justifyContent: "center",
    alignItems: "center",
  },
  execButtonDisabled: {
    backgroundColor: colors.purpleDim,
    opacity: 0.6,
  },

  // Modal de IP
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontFamily,
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  modalDescription: {
    fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 16,
  },
  modalInputWrapper: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  modalTextInput: {
    fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelBtnText: {
    fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.purple,
    minWidth: 120,
    alignItems: "center",
  },
  modalSaveBtnText: {
    fontFamily,
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
});
