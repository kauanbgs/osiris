import { useEffect, useMemo } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import LoginScreen from './src/screens/LoginScreen';
import CadastroScreen from './src/screens/CadastroScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MemoriaScreen from './src/screens/MemoriaScreen';
import MainTabs from './src/screens/MainTabs';
import { loadIP } from './src/services/serverConfig';
import { BACKGROUND, SCREEN_PADDING, ThemeProvider, useThemeColor } from './src/theme';

// Criado fora do componente para não ser recriado a cada renderização.
const Stack = createNativeStackNavigator();

// Telas que se abrem "por cima" de outra continuam deslizando da direita.
const pushOptions = { animation: 'slide_from_right' };

// As abas deslizam de borda a borda; o respiro lateral fica dentro de cada tela.
const mainTabsOptions = { contentStyle: { paddingHorizontal: 0 } };

function AppNavigator() {
  const themeColor = useThemeColor();
  const background = themeColor(BACKGROUND);

  // Tema escuro: sem ele, o fundo branco padrão aparece entre uma tela e outra.
  const navigationTheme = useMemo(() => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background,
      card: background,
      primary: themeColor('#7c5cff'),
    },
  }), [background, themeColor]);

  const screenOptions = useMemo(() => ({
    headerShown: false,
    animation: 'fade',
    animationDuration: 200,
    contentStyle: { backgroundColor: background, paddingHorizontal: SCREEN_PADDING },
  }), [background]);

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator initialRouteName="LoginScreen" screenOptions={screenOptions}>
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="MainTabs" component={MainTabs} options={mainTabsOptions} />
        <Stack.Screen name="Cadastro" component={CadastroScreen} options={pushOptions} />
        <Stack.Screen name="ConfiguracoesConvidado" component={SettingsScreen} />
        <Stack.Screen name="Memoria" component={MemoriaScreen} options={pushOptions} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // Carrega o IP salvo no celular ao abrir o app.
  useEffect(() => {
    loadIP().catch(() => {});
  }, []);

  // Fonte das conversas. Se falhar ao carregar, segue com a fonte do sistema.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <AppNavigator />
    </ThemeProvider>
  );
}
