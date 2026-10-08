import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const colors = {
  textMuted: '#444444',
  active: '#7c5cff',
  border: '#1c1c1c',
  backgroundPure: '#0a0a0a',
};

const NAV_ITEMS = [
  { key: 'home',     icon: 'home' },
  { key: 'chats',   icon: 'message-square' },
  { key: 'folder',  icon: 'folder' },
  { key: 'terminal',icon: 'terminal' },
  { key: 'settings',icon: 'settings' },
];

export default function Navbar({ items = NAV_ITEMS, activeKey, onPressItem }) {
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => onPressItem?.(item.key)}
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