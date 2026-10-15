import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
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
};

export default function ArquivoScreen({ navigation }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFiles = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const response = await sheets.listFiles();
      setFiles(response.data?.files || []);
    } catch (error) {
      console.warn("Não foi possível carregar os arquivos:", error?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => loadFiles());
    return unsubscribe;
  }, [navigation, loadFiles]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Text style={styles.pageLabel}>arquivos</Text>

      <View style={styles.panel}>
        <Text style={styles.title}>Arquivos</Text>

        <View style={styles.locationBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Feather name="chevron-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.locationText}>Este computador</Text>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => loadFiles(true)}
            accessibilityRole="button"
            accessibilityLabel="Atualizar arquivos"
          >
            <Feather name="refresh-cw" size={15} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.blue} />
          </View>
        ) : files.length ? (
          <FlatList
            data={files}
            keyExtractor={(file) => String(file.id_file)}
            contentContainerStyle={styles.fileList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => loadFiles(true)}
                tintColor={colors.blue}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.fileRow}>
                <Feather name="folder" size={15} color={colors.muted} />
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            )}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhum arquivo encontrado.</Text>
          </View>
        )}
      </View>

      <BottomNav activeKey="folder" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageLabel: {
    color: "#68656c",
    fontSize: 10,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  panel: {
    flex: 1,
    backgroundColor: colors.panel,
    marginHorizontal: 10,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingTop: 26,
    paddingBottom: 14,
  },
  locationBar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#29262e",
    marginHorizontal: -10,
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  backButton: {
    width: 28,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  locationText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
  },
  refreshButton: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  fileList: {
    paddingTop: 0,
    paddingBottom: 12,
  },
  fileRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#625d69",
    borderRadius: 6,
    paddingHorizontal: 8,
    marginTop: 5,
  },
  fileName: {
    flex: 1,
    color: colors.blue,
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 12,
  },
});
