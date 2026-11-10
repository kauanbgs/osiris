import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import Navbar, { NAV_ITEMS } from '../components/Navbar';
import { BACKGROUND, SCREEN_PADDING, useThemeColor } from '../theme';
import HomeScreen from './HomeScreen';
import ChatsScreen from './ChatsScreen';
import ArquivoScreen from './ArquivoScreen';
import WorkflowScreen from './WorkflowScreen';
import TerminalScreen from './TerminalScreen';
import SettingsScreen from './SettingsScreen';

const Tab = createMaterialTopTabNavigator();

const TAB_SCREENS = [
  { name: 'HomeScreen', component: HomeScreen },
  { name: 'Chats', component: ChatsScreen },
  { name: 'ArquivoScreen', component: ArquivoScreen },
  // Arrastar no Workflow move o canvas, então lá a troca é só pela barra.
  { name: 'WorkflowScreen', component: WorkflowScreen, options: { swipeEnabled: false } },
  { name: 'Terminal', component: TerminalScreen },
  { name: 'Configuracoes', component: SettingsScreen },
];

// O desfoque do Android exige que a barra fique fora do BlurTargetView, que contém
// o navegador. Este componente só repassa o estado das abas para a barra lá fora.
function TabStatePublisher({ state, position, navigation, onChange }) {
  const { index } = state;
  useEffect(() => {
    onChange({ index, position, navigation });
  }, [index, position, navigation, onChange]);
  return null;
}

export default function MainTabs() {
  const themeColor = useThemeColor();
  const blurTarget = useRef(null);
  const [tabs, setTabs] = useState(null);
  const background = themeColor(BACKGROUND);

  return (
    <View style={styles.root}>
      <BlurTargetView ref={blurTarget} style={[styles.root, { backgroundColor: background }]}>
        <Tab.Navigator
          tabBarPosition="bottom"
          backBehavior="history"
          tabBar={(props) => <TabStatePublisher {...props} onChange={setTabs} />}
          screenOptions={{
            // Prepara só a tela vizinha, para ela já aparecer durante o arraste.
            lazy: true,
            lazyPreloadDistance: 1,
            sceneStyle: { backgroundColor: background, paddingHorizontal: SCREEN_PADDING },
          }}
        >
          {TAB_SCREENS.map((screen) => <Tab.Screen key={screen.name} {...screen} />)}
        </Tab.Navigator>
      </BlurTargetView>

      {tabs && (
        <View pointerEvents="box-none" style={styles.navbarArea}>
          <Navbar
            navigation={tabs.navigation}
            activeKey={NAV_ITEMS[tabs.index].key}
            position={tabs.position}
            blurTarget={blurTarget}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  navbarArea: {
    ...StyleSheet.absoluteFill,
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
  },
});
