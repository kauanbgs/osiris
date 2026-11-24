import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useThemeColor } from '../theme';

// Brilhos suaves espalhados pela tela; cx/cy é o centro e rx/ry o alcance de cada um.
const GLOWS = [
  { id: 'top', color: '#7c5cff', opacity: 0.16, cx: '50%', cy: '0%', rx: '80%', ry: '45%' },
  { id: 'bottomLeft', color: '#7c5cff', opacity: 0.1, cx: '0%', cy: '100%', rx: '75%', ry: '40%' },
  { id: 'right', color: '#bb86fc', opacity: 0.08, cx: '100%', cy: '55%', rx: '60%', ry: '35%' },
];

// Fundo das telas de login e cadastro: liso, com brilhos suaves da cor
// principal para não ficar chapado.
export default function AuthBackground() {
  const themeColor = useThemeColor();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {GLOWS.map((glow) => (
            <RadialGradient key={glow.id} id={glow.id} cx={glow.cx} cy={glow.cy} rx={glow.rx} ry={glow.ry}>
              <Stop offset="0%" stopColor={themeColor(glow.color)} stopOpacity={glow.opacity} />
              <Stop offset="100%" stopColor={themeColor(glow.color)} stopOpacity="0" />
            </RadialGradient>
          ))}
        </Defs>
        {GLOWS.map((glow) => (
          <Rect key={glow.id} width="100%" height="100%" fill={`url(#${glow.id})`} />
        ))}
      </Svg>
    </View>
  );
}
