import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const colors = {
  textMuted: '#444444',
  active: '#7c5cff',
  border: '#1c1c1c',
  backgroundPure: '#0a0a0a',
};

const NAV_ITEMS = [
  { key: 'home',     icon: 'home',           route: 'HomeScreen' },
  { key: 'chats',   icon: 'message-square', route: 'Chats' },
  { key: 'folder',  icon: 'folder',          route: null },
  { key: 'terminal',icon: 'terminal',        route: 'Terminal' },
  { key: 'settings',icon: 'settings',        route: 'Configuracoes' },
];

/**
 * Navbar centralizada.
 * Props:
 *   - navigation  (obrigatório) — objeto de navegação do React Navigation
 *   - activeKey   (obrigatório) — key do item atual ('home' | 'chats' | 'folder' | 'terminal' | 'settings')
 *   - onPressItem (opcional)    — callback extra para casos especiais (ex: home com chatId: null)
 */
export default function Navbar({ navigation, activeKey, onPressItem }) {
  function handlePress(item) {
    // Callback customizado tem prioridade (ex: HomeScreen passa chatId: null)
    if (onPressItem) {
      onPressItem(item.key);
      return;
    }

    // Não navega se já está na tela ativa
    if (item.key === activeKey) return;

    if (item.route) {
      // Home sempre inicia um novo chat
      if (item.key === 'home') {
        navigation.navigate(item.route, { chatId: null });
      } else {
        navigation.navigate(item.route);
      }
    }
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