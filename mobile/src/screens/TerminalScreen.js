import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import BottomNav from '../components/Navbar';
import { aiUrl } from '../services/serverConfig';

const colors = {
  background: '#0a0a0a',
  surface: '#111111',
  surfaceAlt: '#161616',
  border: '#1f1f1f',
  borderActive: '#2a2a2a',
  textPrimary: '#e8e8e8',
  textSecondary: '#888888',
  textMuted: '#555555',
  green: '#32cd17dd',
  greenDim: '#1a7a08',
  purple: '#7c5cff',
  purpleDim: '#3d2e80',
  red: '#ff4444',
  yellow: '#f5a623',
  cyan: '#00d4ff',
  white: '#ffffff',
};

const fontFamily = Platform.select({ ios: 'Courier', android: 'monospace' });

// Histórico de comandos sugeridos
const QUICK_COMMANDS = [
  { label: 'ls', cmd: 'ls' },
  { label: 'pwd', cmd: 'pwd' },
  { label: 'whoami', cmd: 'whoami' },
  { label: 'dir', cmd: 'dir' },
  { label: 'ipconfig', cmd: 'ipconfig' },
  { label: 'top', cmd: 'top -bn1 | head -20' },
];

function TerminalLine({ item, index }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, []);

  const animStyle = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };

  if (item.type === 'command') {
    return (
      <Animated.View style={[styles.lineRow, animStyle]}>
        <Text style={styles.promptArrow}>❯</Text>
        <Text style={styles.commandText}>{item.text}</Text>
      </Animated.View>
    );
  }

  if (item.type === 'separator') {
    return <View style={styles.separator} />;
  }

  const isError = item.type === 'stderr' || item.type === 'error';
  const isInfo = item.type === 'info';
  const isSuccess = item.type === 'success';

  return (
    <Animated.View style={[styles.lineRow, animStyle]}>
      {isError && <Text style={styles.errorPrefix}>✗ </Text>}
      {isSuccess && <Text style={styles.successPrefix}>✓ </Text>}
      {isInfo && <Text style={styles.infoPrefix}>ℹ </Text>}
      <Text
        style={[
          styles.outputText,
          isError && styles.outputError,
          isInfo && styles.outputInfo,
          isSuccess && styles.outputSuccess,
        ]}
        selectable
      >
        {item.text}
      </Text>
    </Animated.View>
  );
}

export default function TerminalScreen({ navigation }) {
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState([
    { id: 'welcome-1', type: 'info', text: 'Osiris Terminal — conectado ao PC desktop' },
    { id: 'welcome-2', type: 'info', text: `Digite um comando e pressione ›` },
    { id: 'welcome-sep', type: 'separator' },
  ]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  function addLines(newLines) {
    setLines(prev => [...prev, ...newLines]);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }

  async function executeCommand(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed || loading) return;

    // Adiciona comando ao histórico
    setHistory(prev => [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 50));
    setHistoryIndex(-1);
    setCommand('');
    setLoading(true);

    const cmdLine = { id: `cmd-${Date.now()}`, type: 'command', text: trimmed };
    addLines([cmdLine]);

    try {
      const res = await fetch(`${aiUrl()}/api/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed }),
        timeout: 32000,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const newLines = [];

      if (data.stdout) {
        const stdoutLines = data.stdout.trimEnd().split('\n');
        stdoutLines.forEach((line, i) => {
          newLines.push({
            id: `stdout-${Date.now()}-${i}`,
            type: 'output',
            text: line,
          });
        });
      }

      if (data.stderr) {
        const stderrLines = data.stderr.trimEnd().split('\n');
        stderrLines.forEach((line, i) => {
          newLines.push({
            id: `stderr-${Date.now()}-${i}`,
            type: 'stderr',
            text: line,
          });
        });
      }

      if (!data.stdout && !data.stderr && !data.error) {
        newLines.push({
          id: `done-${Date.now()}`,
          type: 'success',
          text: 'Comando executado (sem output)',
        });
      }

      if (data.error) {
        newLines.push({
          id: `err-${Date.now()}`,
          type: 'error',
          text: data.error,
        });
      }

      newLines.push({ id: `sep-${Date.now()}`, type: 'separator' });
      addLines(newLines);
    } catch (err) {
      addLines([
        {
          id: `fetch-err-${Date.now()}`,
          type: 'error',
          text: `Não foi possível conectar ao desktop: ${err.message}`,
        },
        { id: `sep-err-${Date.now()}`, type: 'separator' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleClear() {
    setLines([{ id: `clear-${Date.now()}`, type: 'info', text: 'Terminal limpo.' }]);
  }

  function handleQuickCommand(cmd) {
    executeCommand(cmd);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.terminalDots}>
            <View style={[styles.dot, { backgroundColor: colors.red }]} />
            <View style={[styles.dot, { backgroundColor: colors.yellow }]} />
            <View style={[styles.dot, { backgroundColor: colors.green }]} />
          </View>
        </View>
        <Text style={styles.headerTitle}>Terminal</Text>
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Feather name="trash-2" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Quick commands */}
      <View style={styles.quickRow}>
        <FlatList
          horizontal
          data={QUICK_COMMANDS}
          keyExtractor={item => item.cmd}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.quickChip}
              onPress={() => handleQuickCommand(item.cmd)}
              activeOpacity={0.7}
            >
              <Text style={styles.quickChipText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Output area */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ref={listRef}
          data={lines}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => <TerminalLine item={item} index={index} />}
          contentContainerStyle={styles.outputContainer}
          style={styles.outputList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.green} />
                <Text style={styles.loadingText}>Executando...</Text>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View style={styles.inputWrapper}>
          <View style={styles.inputCard}>
            <Text style={styles.inputPrompt}>❯</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Comando no PC"
              placeholderTextColor={colors.textMuted}
              value={command}
              onChangeText={setCommand}
              onSubmitEditing={() => executeCommand(command)}
              returnKeyType="send"
              editable={!loading}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor={colors.green}
            />
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={() => executeCommand(command)}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="send" size={16} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Nav */}
        <BottomNav
          activeKey="terminal"
          navigation={navigation}
        />
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
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flex: 1,
  },
  terminalDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerTitle: {
    fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  clearButton: {
    flex: 1,
    alignItems: 'flex-end',
    padding: 4,
  },

  // Quick commands
  quickRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  quickList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  quickChip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  quickChipText: {
    fontFamily,
    fontSize: 12,
    color: colors.green,
  },

  // Output
  outputList: {
    flex: 1,
    backgroundColor: colors.background,
  },
  outputContainer: {
    padding: 12,
    paddingBottom: 4,
    flexGrow: 1,
  },

  // Lines
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  promptArrow: {
    fontFamily,
    fontSize: 13,
    color: colors.purple,
    marginRight: 8,
    lineHeight: 20,
  },
  commandText: {
    fontFamily,
    fontSize: 13,
    color: colors.white,
    lineHeight: 20,
    flex: 1,
  },
  outputText: {
    fontFamily,
    fontSize: 12,
    color: colors.textPrimary,
    lineHeight: 19,
    flex: 1,
  },
  outputError: {
    color: colors.red,
  },
  outputInfo: {
    color: colors.cyan,
  },
  outputSuccess: {
    color: colors.green,
  },
  errorPrefix: {
    fontFamily,
    fontSize: 12,
    color: colors.red,
    lineHeight: 19,
  },
  successPrefix: {
    fontFamily,
    fontSize: 12,
    color: colors.green,
    lineHeight: 19,
  },
  infoPrefix: {
    fontFamily,
    fontSize: 12,
    color: colors.cyan,
    lineHeight: 19,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    fontFamily,
    fontSize: 12,
    color: colors.green,
  },

  // Input
  inputWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderActive,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputPrompt: {
    fontFamily,
    fontSize: 15,
    color: colors.green,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontFamily,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  sendButtonDisabled: {
    backgroundColor: colors.purpleDim,
  },
});
