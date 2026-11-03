import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BACKGROUND, SCREEN_PADDING } from '../theme';
import { useKeyboardVisible } from './KeyboardAware';

const colors = {
  textMuted: '#444444',
  active: '#7c5cff',
  border: '#1c1c1c',
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
 *   - onPressItem (opcional)    — callback extra para casos especiais
 */
export default function Navbar({ navigation, activeKey, onPressItem }) {
  const route = useRoute();
  const keyboardVisible = useKeyboardVisible();
  const insets = useSafeAreaInsets();

  function handlePress(item) {
    // Callback customizado tem prioridade
    if (onPressItem) {
      onPressItem(item.key);
      return;
    }

    // Só ignora o toque se já estiver exatamente nessa tela (ex.: em Memória,
    // o ícone de configurações fica aceso, mas precisa levar de volta a ela).
    if (item.route === route.name) return;

    // pop: true volta para a tela se ela já estiver aberta na pilha, em vez de
    // empilhar uma cópia nova a cada toque (cada cópia mantinha seus timers
    // e requisições rodando em segundo plano).
    // merge: true mantém os parâmetros da tela; na Home isso preserva a
    // conversa aberta (a nova conversa é pelo botão no topo da Home).
    navigation.navigate(item.route, undefined, { pop: true, merge: true });
  }

  // Some enquanto o teclado está aberto, deixando espaço para o que se digita.
  if (keyboardVisible) return null;

  return (
    <View
      style={[
        styles.bottomNav,
        // Vai de borda a borda: desfaz o respiro lateral das telas e desce
        // sobre a área segura de baixo (barra de gestos), em vez de deixar
        // uma faixa vazia embaixo dela.
        {
          marginBottom: -insets.bottom,
          paddingBottom: 12 + insets.bottom,
        },
      ]}
    >
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
              size={26}
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
    marginHorizontal: -SCREEN_PADDING,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: BACKGROUND,
  },
  navItem: {
    padding: 8,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: '#1e1a2e',
  },
});
