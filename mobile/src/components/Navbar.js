import { useRef, useState } from 'react';
import { Animated, Platform, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { createThemedStyles, useTheme, useThemeColor } from '../theme';
import { useKeyboardVisible } from './KeyboardAware';

const colors = {
  textMuted: '#71717a',
  active: '#7c5cff',
  activeBackground: '#7c5cff26',
  border: '#2a2a2a',
  glassTint: '#0d0d0d33',
};

const BAR_HEIGHT = 60;
const BAR_GAP = 10;
const INDICATOR_SIZE = 44;

// O vidro de verdade só existe no iOS 26 ou mais novo.
const HAS_LIQUID_GLASS = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export const NAV_ITEMS = [
  { key: 'home',     icon: 'home',           route: 'HomeScreen' },
  { key: 'chats',   icon: 'message-square', route: 'Chats' },
  { key: 'folder',  icon: 'folder',          route: 'ArquivoScreen' },
  { key: 'workflow',icon: 'git-branch',      route: 'WorkflowScreen' },
  { key: 'terminal',icon: 'terminal',        route: 'Terminal' },
  { key: 'settings',icon: 'settings',        route: 'Configuracoes' },
];

// A barra flutua sobre o conteúdo: é este o espaço que ela ocupa embaixo da tela.
export function useNavbarSpace() {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return keyboardVisible ? 0 : BAR_HEIGHT + BAR_GAP + insets.bottom;
}

// Reserva esse espaço, para o fim de uma lista não ficar escondido atrás da barra.
export function NavbarSpacer() {
  return <View style={{ height: useNavbarSpace() }} />;
}

function NavItem({ item, index, position, onPress, styles, themeColor }) {
  const activeAmount = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  // Os dois ícones se alternam conforme a tela é arrastada.
  return (
    <TouchableOpacity style={styles.navItem} onPress={() => onPress(item)} activeOpacity={0.7}>
      <Animated.View style={{ opacity: Animated.subtract(1, activeAmount) }}>
        <Feather name={item.icon} size={22} color={themeColor(colors.textMuted)} />
      </Animated.View>
      <Animated.View style={[styles.activeIcon, { opacity: activeAmount }]}>
        <Feather name={item.icon} size={22} color={themeColor(colors.active)} />
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Barra de navegação flutuante; o elemento pai define a área onde ela flutua.
 * Props:
 *   - navigation  (obrigatório) — navegação do React Navigation
 *   - activeKey   (obrigatório) — key do item atual
 *   - position    (opcional)    — posição animada das abas, para seguir o arraste
 *   - blurTarget  (opcional)    — ref do BlurTargetView; sem ele o Android usa um
 *                                 fundo translúcido, sem desfoque
 *   - onPressItem (opcional)    — substitui a navegação padrão; recebe o item
 */
export default function Navbar({ navigation, activeKey, position, blurTarget, onPressItem }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
  const { statusBarStyle } = useTheme();
  const keyboardVisible = useKeyboardVisible();
  const insets = useSafeAreaInsets();
  const [itemsWidth, setItemsWidth] = useState(0);

  const activeIndex = NAV_ITEMS.findIndex((item) => item.key === activeKey);
  const staticPosition = useRef(new Animated.Value(activeIndex)).current;
  const currentPosition = position ?? staticPosition;

  function handlePress(item) {
    if (onPressItem) onPressItem(item);
    else navigation.navigate(item.route);
  }

  // Some enquanto o teclado está aberto, deixando espaço para o que se digita.
  if (keyboardVisible) return null;

  const slotWidth = itemsWidth / NAV_ITEMS.length;
  const content = (
    <View style={styles.items} onLayout={(event) => setItemsWidth(event.nativeEvent.layout.width)}>
      {itemsWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              transform: [{
                translateX: currentPosition.interpolate({
                  inputRange: NAV_ITEMS.map((_, index) => index),
                  outputRange: NAV_ITEMS.map((_, index) =>
                    index * slotWidth + (slotWidth - INDICATOR_SIZE) / 2),
                }),
              }],
            },
          ]}
        />
      )}
      {NAV_ITEMS.map((item, index) => (
        <NavItem
          key={item.key}
          item={item}
          index={index}
          position={currentPosition}
          onPress={handlePress}
          styles={styles}
          themeColor={themeColor}
        />
      ))}
    </View>
  );

  const isLightTheme = statusBarStyle === 'dark-content';
  let bar;
  if (HAS_LIQUID_GLASS) {
    bar = (
      <GlassView
        style={styles.bar}
        glassEffectStyle="regular"
        colorScheme={isLightTheme ? 'light' : 'dark'}
        tintColor={themeColor(colors.glassTint)}
      >
        {content}
      </GlassView>
    );
  } else if (Platform.OS === 'ios' || blurTarget) {
    bar = (
      <BlurView
        style={[styles.bar, styles.barBlur]}
        tint={isLightTheme ? 'light' : 'dark'}
        intensity={60}
        blurTarget={blurTarget}
        // No Android 11 ou mais antigo o desfoque é pesado: fica só o translúcido.
        blurMethod="dimezisBlurViewSdk31Plus"
      >
        {content}
      </BlurView>
    );
  } else {
    bar = <View style={[styles.bar, styles.barTranslucent]}>{content}</View>;
  }

  return (
    <View pointerEvents="box-none" style={[styles.floatingArea, { paddingBottom: BAR_GAP + insets.bottom }]}>
      {bar}
    </View>
  );
}

const useStyles = createThemedStyles({
  floatingArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: BAR_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: BAR_HEIGHT / 2,
    justifyContent: 'center',
  },
  barBlur: {
    overflow: 'hidden',
    backgroundColor: '#17171766',
    borderWidth: 1,
    borderColor: colors.border,
  },
  barTranslucent: {
    backgroundColor: '#171717e0',
    borderWidth: 1,
    borderColor: colors.border,
  },
  items: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
    width: INDICATOR_SIZE,
    height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    backgroundColor: colors.activeBackground,
  },
  navItem: {
    flex: 1,
    height: INDICATOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIcon: {
    position: 'absolute',
  },
});
