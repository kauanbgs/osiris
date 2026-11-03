import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../components/Navbar";
import sheets from "../services/api";

const colors = {
  background: "#0d0d0d",
  panel: "#141414",
  border: "#35323b",
  text: "#e8e8e8",
  muted: "#85818c",
  blue: "#4f9cff",
  accent: "#8b5cf6",
};

function buildTree(files) {
  const root = [];
  const entries = new Map();

  for (const file of files) {
    const parts = file.relativePath.split("/").filter(Boolean);
    let siblings = root;
    let currentPath = "";
    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = entries.get(currentPath);
      if (!node) {
        const isLeaf = index === parts.length - 1;
        node = {
          name: part,
          relativePath: currentPath,
          type: isLeaf ? file.type : "folder",
          children: [],
        };
        entries.set(currentPath, node);
        siblings.push(node);
      }
      siblings = node.children;
    });
  }

  const sort = (items) => {
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    items.forEach((item) => sort(item.children));
  };
  sort(root);
  return root;
}

function getFileIcon(name) {
  const extension = name?.split(".").pop()?.toLowerCase();
  if (["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "html", "css"].includes(extension)) return "code";
  if (extension === "json") return "braces";
  if (["md", "txt", "log"].includes(extension)) return "file-text";
  return "file";
}

export default function ArquivoScreen({ navigation }) {
  const [files, setFiles] = useState([]);
  const [workspaceName, setWorkspaceName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [rootExpanded, setRootExpanded] = useState(true);
  const [activeFile, setActiveFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeFileRef = useRef(null);
  const fileContentRef = useRef("");
  const originalContentRef = useRef("");

  const tree = useMemo(() => buildTree(files), [files]);
  const dirty = fileContent !== originalContent;

  const loadFiles = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      const response = await sheets.getDesktopWorkspace();
      const workspace = response.data?.workspace;
      setWorkspaceName(workspace?.folderName || null);
      setFiles(workspace?.files || []);
      if (!workspace) {
        setExpanded({});
        setRootExpanded(false);
      } else {
        setRootExpanded(true);
      }
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.warn("Não foi possível carregar os arquivos:", error?.message);
        Alert.alert("Erro", error?.response?.data?.error?.message || "Não foi possível carregar a pasta compartilhada.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let timer;
    const stopSync = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const syncWorkspace = async () => {
      try {
        const response = await sheets.getDesktopWorkspace();
        const workspace = response.data?.workspace;
        const nextFiles = workspace?.files || [];
        setWorkspaceName(workspace?.folderName || null);
        setFiles((current) => JSON.stringify(current) === JSON.stringify(nextFiles) ? current : nextFiles);
        if (!workspace) {
          setRootExpanded(false);
          return;
        }

        const opened = activeFileRef.current;
        if (opened && fileContentRef.current === originalContentRef.current) {
          const contentResponse = await sheets.getWorkspaceFile(opened.relativePath);
          const latest = contentResponse.data?.fileContent ?? "";
          if (activeFileRef.current?.relativePath === opened.relativePath
            && fileContentRef.current === originalContentRef.current) {
            fileContentRef.current = latest;
            originalContentRef.current = latest;
            setFileContent(latest);
            setOriginalContent(latest);
          }
        }
      } catch (error) {
        // Poll quietly; the manual refresh and file actions surface actionable errors.
        if (error?.response?.status !== 401) console.warn("Falha ao sincronizar arquivos:", error?.message);
      }
    };
    const startSync = () => {
      stopSync();
      loadFiles();
      syncWorkspace();
      timer = setInterval(syncWorkspace, 1500);
    };
    if (navigation.isFocused()) startSync();
    const unsubscribeFocus = navigation.addListener("focus", startSync);
    const unsubscribeBlur = navigation.addListener("blur", stopSync);
    return () => {
      stopSync();
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, loadFiles]);

  const openFile = useCallback(async (item) => {
    setOpening(true);
    try {
      const response = await sheets.getWorkspaceFile(item.relativePath);
      const content = response.data?.fileContent ?? "";
      activeFileRef.current = item;
      fileContentRef.current = content;
      originalContentRef.current = content;
      setActiveFile(item);
      setFileContent(content);
      setOriginalContent(content);
    } catch (error) {
      const serverMessage = error?.response?.data?.error?.message;
      const message = error?.response?.status === 404 && serverMessage === "Route not found."
        ? "A API do desktop ainda não carregou as rotas de arquivos. Reinicie o serviço osiris-api e tente novamente."
        : serverMessage || "Este arquivo não pôde ser aberto como texto.";
      Alert.alert("Não foi possível abrir", message);
    } finally {
      setOpening(false);
    }
  }, []);

  const closeEditor = useCallback(() => {
    if (dirty) {
      Alert.alert("Alterações não salvas", "Deseja descartar as alterações?", [
        { text: "Continuar editando", style: "cancel" },
        { text: "Descartar", style: "destructive", onPress: () => { activeFileRef.current = null; setActiveFile(null); } },
      ]);
      return;
    }
    activeFileRef.current = null;
    setActiveFile(null);
  }, [dirty]);

  const saveFile = useCallback(async () => {
    if (!activeFile || !dirty || saving) return;
    setSaving(true);
    try {
      await sheets.saveWorkspaceFile(activeFile.relativePath, fileContent);
      fileContentRef.current = fileContent;
      originalContentRef.current = fileContent;
      setOriginalContent(fileContent);
      Alert.alert("Arquivo salvo", activeFile.name);
    } catch (error) {
      Alert.alert("Erro ao salvar", error?.response?.data?.error?.message || "Não foi possível salvar o arquivo.");
    } finally {
      setSaving(false);
    }
  }, [activeFile, dirty, fileContent, saving]);

  const deleteFile = useCallback((item) => {
    Alert.alert("Excluir arquivo", `Deseja excluir ${item.name}? Esta ação não pode ser desfeita.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await sheets.deleteWorkspaceFile(item.relativePath);
            setFiles((current) => current.filter((file) => file.relativePath !== item.relativePath));
            if (activeFile?.relativePath === item.relativePath) {
              activeFileRef.current = null;
              setActiveFile(null);
            }
          } catch (error) {
            Alert.alert("Erro ao excluir", error?.response?.data?.error?.message || "Não foi possível excluir o arquivo.");
          }
        },
      },
    ]);
  }, [activeFile]);

  const renderItems = (items, depth = 0) => items.map((item) => {
    const isFolder = item.type === "folder";
    const isExpanded = Boolean(expanded[item.relativePath]);
    const isActive = activeFile?.relativePath === item.relativePath;
    return (
      <View key={item.relativePath}>
        <View style={[styles.treeRow, isActive && styles.treeRowActive, { paddingLeft: 8 + depth * 16 }]}>
          <TouchableOpacity
            style={styles.treeMain}
            onPress={() => {
              if (isFolder) setExpanded((current) => ({ ...current, [item.relativePath]: !current[item.relativePath] }));
              else openFile(item);
            }}
            accessibilityRole="button"
            accessibilityLabel={isFolder ? `${isExpanded ? "Recolher" : "Expandir"} pasta ${item.name}` : `Abrir arquivo ${item.name}`}
          >
            {isFolder ? (
              <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={14} color={colors.muted} />
            ) : <View style={styles.chevronSpace} />}
            <Feather
              name={isFolder ? (isExpanded ? "folder" : "folder") : getFileIcon(item.name)}
              size={15}
              color={isFolder ? colors.accent : (isActive ? colors.blue : colors.muted)}
            />
            <Text style={[styles.fileName, isActive && styles.activeFileName]} numberOfLines={1}>{item.name}</Text>
            {!isFolder && opening && isActive ? <ActivityIndicator size="small" color={colors.blue} /> : null}
          </TouchableOpacity>
        </View>
        {isFolder && isExpanded ? renderItems(item.children, depth + 1) : null}
      </View>
    );
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>Arquivos</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{workspaceName || "Pasta compartilhada do desktop"}</Text>
        </View>
        <TouchableOpacity onPress={() => loadFiles(true)} style={styles.headerButton} accessibilityLabel="Atualizar arquivos">
          <Feather name="refresh-cw" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.explorerHeader}>
        <Text style={styles.explorerLabel}>EXPLORER</Text>
        <Text style={styles.itemCount}>{files.length} itens</Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}><ActivityIndicator color={colors.accent} /></View>
      ) : tree.length ? (
        <ScrollView
          style={styles.treeScroll}
          contentContainerStyle={styles.treeContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFiles(true)} tintColor={colors.accent} />}
        >
          {workspaceName ? (
            <View>
              <TouchableOpacity
                style={styles.rootRow}
                onPress={() => setRootExpanded((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={`${rootExpanded ? "Recolher" : "Expandir"} pasta ${workspaceName}`}
              >
                <Feather name={rootExpanded ? "chevron-down" : "chevron-right"} size={14} color={colors.text} />
                <Feather name="folder" size={17} color="#c084fc" />
                <Text style={styles.rootName} numberOfLines={1}>{workspaceName}</Text>
              </TouchableOpacity>
              {rootExpanded ? renderItems(tree) : null}
            </View>
          ) : renderItems(tree)}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Feather name="folder" size={30} color="#4b4652" />
          <Text style={styles.emptyText}>{workspaceName ? "Esta pasta está vazia." : "Abra uma pasta no desktop para compartilhar os arquivos."}</Text>
          <Text style={styles.emptyHint}>As pastas compartilhadas no desktop aparecem aqui.</Text>
        </View>
      )}

      <BottomNav activeKey="folder" navigation={navigation} />

      <Modal visible={Boolean(activeFile)} animationType="slide" onRequestClose={closeEditor}>
        <SafeAreaView style={styles.editorSafeArea}>
          <KeyboardAvoidingView style={styles.editorContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.editorHeader}>
              <TouchableOpacity onPress={closeEditor} style={styles.editorIconButton} accessibilityLabel="Fechar editor">
                <Feather name="chevron-left" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.editorTitleWrap}>
                <Text style={styles.editorTitle} numberOfLines={1}>{activeFile?.name}</Text>
                <Text style={styles.editorPath} numberOfLines={1}>{activeFile?.relativePath}</Text>
              </View>
              <TouchableOpacity
                onPress={saveFile}
                disabled={!dirty || saving}
                style={[styles.saveButton, (!dirty || saving) && styles.saveButtonDisabled]}
                accessibilityLabel="Salvar arquivo"
              >
                {saving ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="save" size={16} color="#fff" />}
                <Text style={styles.saveButtonText}>{saving ? "Salvando" : "Salvar"}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              value={fileContent}
              onChangeText={(content) => { fileContentRef.current = content; setFileContent(content); }}
              style={styles.editorInput}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              textAlignVertical="top"
              placeholder="Conteúdo do arquivo"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
            />
            <View style={styles.editorStatus}>
              <Text style={styles.statusText}>{dirty ? "Alterações não salvas" : "Salvo"}</Text>
              <TouchableOpacity onPress={() => deleteFile(activeFile)} style={styles.editorDelete}>
                <Feather name="trash-2" size={14} color="#f87171" />
                <Text style={styles.deleteText}>Excluir arquivo</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 66, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerButton: { width: 42, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitleWrap: { flex: 1, paddingHorizontal: 4 },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  subtitle: { color: colors.muted, fontSize: 11, marginTop: 2 },
  explorerHeader: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: "#25232a", backgroundColor: "#111" },
  explorerLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  itemCount: { color: "#615d67", fontSize: 10 },
  treeScroll: { flex: 1 },
  treeContent: { paddingBottom: 20 },
  rootRow: { height: 36, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: "#25232a" },
  rootName: { flex: 1, color: "#e4e4e7", fontSize: 12, fontWeight: "700" },
  treeRow: { minHeight: 36, flexDirection: "row", alignItems: "center", paddingRight: 8 },
  treeRowActive: { backgroundColor: "#8b5cf618" },
  treeMain: { flex: 1, minWidth: 0, minHeight: 36, flexDirection: "row", alignItems: "center", gap: 7 },
  chevronSpace: { width: 14 },
  fileName: { flex: 1, color: "#c8c5ce", fontSize: 12 },
  activeFileName: { color: colors.text },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", marginTop: 12 },
  emptyHint: { color: "#5f5a64", fontSize: 11, textAlign: "center", marginTop: 6 },
  editorSafeArea: { flex: 1, backgroundColor: colors.background },
  editorContainer: { flex: 1 },
  editorHeader: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  editorIconButton: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  editorTitleWrap: { flex: 1, paddingHorizontal: 7 },
  editorTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  editorPath: { color: colors.muted, fontSize: 10, marginTop: 3 },
  saveButton: { height: 36, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.accent },
  saveButtonDisabled: { opacity: 0.45 },
  saveButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  editorInput: { flex: 1, color: "#ddd9e2", backgroundColor: "#101012", padding: 16, fontSize: 13, lineHeight: 20, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  editorStatus: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: colors.border },
  statusText: { color: colors.muted, fontSize: 10 },
  editorDelete: { flexDirection: "row", alignItems: "center", gap: 6, padding: 8 },
  deleteText: { color: "#f87171", fontSize: 11 },
});
