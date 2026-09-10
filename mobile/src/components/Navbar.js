import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

const colors = {
  textMuted: '#9a9a9a',
  border: '#1c1c1c',
  backgroundPure: '#0a0a0a',
};

const NAV_ITEMS = [
  { key: 'home', icon: 'home' },
  { key: 'folder', icon: 'folder' },
  { key: 'terminal', icon: 'terminal' },
  { key: 'settings', icon: 'settings' },
];

export default function Navbar({ items = NAV_ITEMS, onPressItem }) {
  return (
    <View style={styles.bottomNav}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.navItem}
          onPress={() => onPressItem?.(item.key)}
        >
          <Feather name={item.icon} size={22} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.backgroundPure,
  },
  navItem: {
    padding: 8,
  },
});