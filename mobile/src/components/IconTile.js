import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createThemedStyles, useThemeColor } from '../theme';

// Ícone colorido sobre um quadrado com um tom suave da mesma cor.
export default function IconTile({ icon, color, style }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
  return (
    <View style={[styles.tile, { backgroundColor: themeColor(`${color}26`) }, style]}>
      <Feather name={icon} size={16} color={themeColor(color)} />
    </View>
  );
}

const useStyles = createThemedStyles({
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
