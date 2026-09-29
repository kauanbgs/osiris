import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import BottomNav from '../components/Navbar';
import sheets from '../services/api';

const colors = {
  background: '#0d0d0d',
  card: '#141414',
  cardBorder: '#222222',
  textPrimary: '#e8e8e8',
  textSecondary: '#6a6a6a',
  textMuted: '#444444',
  purple: '#7c5cff',
  purpleDim: '#3a2d70',
  red: '#e74c3c',
  border: '#1c1c1c',
};

function ChatItem({ chat, onPress, onDelete }) {
  return (
    <TouchableOpacity style={styles.chatCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.chatCardLeft}>
        <View style={styles.chatIconWrap}>
          <Feather name="message-square" size={16} color={colors.purple} />
        </View>
        <View style={styles.chatCardText}>
          <Text style={styles.chatTitle} numberOfLines={1}>{chat.title}</Text>
          <Text style={styles.chatMeta}>Chat #{chat.id_chat}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onDelete}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Feather name="trash-2" size={15} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function ChatsScreen({ navigation }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await sheets.listChats();
      setChats(res.data?.chats || []);
    } catch (err) {
      console.warn('Erro ao carregar chats:', err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Recarrega toda vez que a tela recebe foco
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => fetchChats());
    return unsubscribe;
  }, [navigation, fetchChats]);

  function handleOpenChat(chat) {
    navigation.navigate('HomeScreen', { chatId: chat.id_chat, chatTitle: chat.title });
  }

  function handleNewChat() {
    navigation.navigate('HomeScreen', { chatId: null, chatTitle: null });
  }

  function handleDeleteChat(chat) {
    Alert.alert(
      'Excluir conversa',
      'Tem certeza que deseja excluir esta conversa? Todas as mensagens serao perdidas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await sheets.deleteChat(chat.id_chat);
              setChats((prev) => prev.filter((c) => c.id_chat !== chat.id_chat));
            } catch (err) {
              Alert.alert('Erro', 'Nao foi possivel excluir a conversa.');
            }
          },
        },
      ],
    );
  }

  function handleNavPress(key) {
    if (key === 'home') navigation.navigate('HomeScreen', { chatId: null });
    else if (key === 'settings') navigation.navigate('Configuracoes');
    else console.log('nav:', key);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversas</Text>
        <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.newChatText}>Novo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.purple} size="large" />
        </View>
      ) : chats.length === 0 ? (
        <View style={styles.centerState}>
          <Feather name="message-square" size={42} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Nenhuma conversa ainda</Text>
          <Text style={styles.emptySubtitle}>Inicie uma nova conversa para comecar.</Text>
          <TouchableOpacity style={styles.startBtn} onPress={handleNewChat}>
            <Text style={styles.startBtnText}>Iniciar conversa</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => String(item.id_chat)}
          renderItem={({ item }) => (
            <ChatItem
              chat={item}
              onPress={() => handleOpenChat(item)}
              onDelete={() => handleDeleteChat(item)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchChats(true)}
              tintColor={colors.purple}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <BottomNav activeKey="chats" onPressItem={handleNavPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.purple,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 5,
  },
  newChatText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 8,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  chatCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.purpleDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatCardText: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  chatMeta: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  deleteBtn: {
    padding: 4,
  },
  separator: {
    height: 8,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  startBtn: {
    marginTop: 8,
    backgroundColor: colors.purple,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  startBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});