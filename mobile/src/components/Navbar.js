import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';

const colors = {
  textMuted: '#444444',
  active: '#7c5cff',
  border: '#1c1c1c',
  backgroundPure: '#0a0a0a',
};

const NAV_ITEMS = [
  { key: 'home',     icon: 'home',           route: 'HomeScreen' },
  { key: 'chats',   icon: 'message-square', route: 'Chats' },
  { key: 'folder',  icon: 'folder',          route: 'ArquivoScreen' },
  { key: 'workflow',icon: 'git-branch',      route: 'WorkflowScreen' },
  { key: 'terminal',icon: 'terminal',        route: 'Terminal' },
  { key: 'settings',icon: 'settings',        route: 'Configuracoes' },
];

/**
 * Navbar centralizada.
 * Props:
 *   - navigation  (obrigatório) — objeto de navegação do React Navigation
 *   - activeKey   (obrigatório) — key do item atual ('home' | 'chats' | 'folder' | 'workflow' | 'terminal' | 'settings')
 *   - onPressItem (opcional)    — callback extra para casos especiais (ex: home com chatId: null)
 */
export default function Navbar({ navigation, activeKey, onPressItem }) {
  const route = useRoute();

  function handlePress(item) {
    // Callback customizado tem prioridade
    if (onPressItem) {
      onPressItem(item.key);
      return;
    }

    // Home sempre inicia um novo chat, mesmo estando nela (newChat muda a cada
    // toque para a Home limpar a conversa atual).
    if (item.key === 'home') {
      navigation.navigate('HomeScreen', { chatId: null, newChat: Date.now() }, { pop: true });
      return;
    }

    // Só ignora o toque se já estiver exatamente nessa tela (ex.: em Memória,
    // o ícone de configurações fica aceso, mas precisa levar de volta a ela).
    if (item.route === route.name) return;

    // pop: true volta para a tela se ela já estiver aberta na pilha, em vez de
    // empilhar uma cópia nova a cada toque (cada cópia mantinha seus timers
    // e requisições rodando em segundo plano).
    navigation.navigate(item.route, undefined, { pop: true });
  }

  return (
    <View style={styles.bottomNav}>
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => handlePress(item)}
            activeOpacity={0.7}
          >
            <Feather
              name={item.icon}
              size={22}
              color={isActive ? colors.active : colors.textMuted}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundPure,
  },
  navItem: {
    padding: 8,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#1e1a2e',
  },
});
