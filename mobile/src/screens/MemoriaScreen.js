import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../components/Navbar';
import sheets from '../services/api';

const colors = {
  background: '#0d0d0d',
  card: '#161616',
  cardBorder: '#242424',
  textPrimary: '#e8e8e8',
  textSecondary: '#8a8a8a',
  purple: '#7c5cff',
  inputBg: '#0d0d0d',
  inputBorder: '#2a2a2a',
};

export default function MemoriaScreen({ navigation }) {
  const [newItem, setNewItem] = useState('');
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMemories = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await sheets.getMemories();
      setMemories((data.memories || []).map((m) => ({ id: String(m.id_memory), text: m.content })));
    } catch (error) {
      if (error?.response?.status === 401) {
        Alert.alert(
          'Sessão expirada',
          'Entre novamente na sua conta para acessar suas memórias.',
          [{
            text: 'Ir para login',
            onPress: () => navigation.reset({
              index: 0,
              routes: [{ name: 'LoginScreen' }],
            }),
          }],
        );
        return;
      }
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Não foi possível carregar as memórias.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  async function handleSave() {
    const text = newItem.trim();
    if (!text || saving) return;

    try {
      setSaving(true);
      const { data } = await sheets.postMemory(text);

      setMemories((prev) => [
        ...prev,
        { id: String(data.memory.id_memory), text: data.memory.content },
      ]);
      setNewItem('');
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        'Não foi possível salvar a memória.';
      Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id) {
    Alert.alert('Excluir memória', 'Deseja excluir esta memória?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          await sheets.deleteMemory(id);
          setMemories((items) => items.filter((item) => item.id !== id));
        } catch (error) {
          Alert.alert('Erro', error?.response?.data?.message || 'Não foi possível excluir a memória.');
        }
      } },
    ]);
  }

  function handleNavPress(key) {
    if (key === 'home') {
      navigation.navigate('HomeScreen');
      return;
    }

    console.log('nav:', key);
  }

  const hasMemories = memories.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Memória</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Adicionar novo item à memória</Text>

          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="Digite aqui"
              placeholderTextColor="#666"
              value={newItem}
              onChangeText={setNewItem}
              onSubmitEditing={handleSave}
              editable={!saving}
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.listCard}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.purple} />
            </View>
          ) : hasMemories ? (
            <FlatList
              data={memories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.memoryItem} onLongPress={() => handleDelete(item.id)}>
                  <Text style={styles.memoryItemText}>{item.text}</Text>
                  <Text style={styles.deleteHint}>Segure para excluir</Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Nenhuma memória até o momento.
              </Text>
            </View>
          )}
        </View>
      </View>

      <BottomNav
        activeKey="settings"
        onPressItem={(key) => {
          if (key === 'settings') navigation.navigate('Configuracoes');
          else handleNavPress(key);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  cardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    marginRight: 10,
  },

  saveButton: {
    backgroundColor: colors.purple,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  listCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    marginBottom: 16,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  emptyStateText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  listContent: {
    padding: 16,
  },

  memoryItem: {
    backgroundColor: '#1f1f1f',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },

  memoryItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },

  deleteHint: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 6,
  },
});
