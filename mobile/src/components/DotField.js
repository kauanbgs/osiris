import React, { useMemo, useState, useCallback } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

export default function DotField({
  children, 
  dotRadius = 1.5,
  dotSpacing = 22,
  bulgeStrength = 26,
  touchRadius = 110,
  glowRadius = 90,
  gradientFrom = '#A855F7',
  gradientTo = '#B497CF',
  glowColor = '#7C3AED',
}) {
  const { width, height } = Dimensions.get('window');
  const [touch, setTouch] = useState(null);

  const dots = useMemo(() => {
    const cols = Math.ceil(width / dotSpacing) + 1;
    const rows = Math.ceil(height / dotSpacing) + 1;
    const list = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        list.push({ id: `${r}-${c}`, ax: c * dotSpacing, ay: r * dotSpacing });
      }
    }
    return list;
  }, [width, height, dotSpacing]);

  const getDotPosition = useCallback(
    (ax, ay) => {
      if (!touch) return { x: ax, y: ay };
      const dx = ax - touch.x;
      const dy = ay - touch.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > touchRadius || dist === 0) return { x: ax, y: ay };
      const force = (1 - dist / touchRadius) * bulgeStrength;
      return { x: ax + (dx / dist) * force, y: ay + (dy / dist) * force };
    },
    [touch, touchRadius, bulgeStrength]
  );


  const handleTouch = (evt) => {
    setTouch({ x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY });
  };
  
  const clearTouch = () => setTouch(null);

  return (
    <View 
      style={{ flex: 1 }}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={clearTouch}
      onTouchCancel={clearTouch}
    >

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="dotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientFrom} />
              <Stop offset="100%" stopColor={gradientTo} />
            </LinearGradient>
            {touch && (
              <RadialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={glowColor} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={glowColor} stopOpacity="0" />
              </RadialGradient>
            )}
          </Defs>
          {touch && <Circle cx={touch.x} cy={touch.y} r={glowRadius} fill="url(#glowGradient)" />}
          {dots.map((dot) => {
            const { x, y } = getDotPosition(dot.ax, dot.ay);
            return <Circle key={dot.id} cx={x} cy={y} r={dotRadius} fill="url(#dotGradient)" />;
          })}
        </Svg>
      </View>

  
      {children}
    </View>
  );
}