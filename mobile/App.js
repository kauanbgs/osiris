// App.js — ponto de entrada do app mobile: carrega as fontes, o tema e as telas de navegação.
// As fontes Inter e JetBrains Mono são carregadas antes de mostrar qualquer tela.
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
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

// A logo fica na tela por este tempo, no mínimo, antes de ir para o login.
const SPLASH_MIN_MS = 1200;
const SPLASH_BACKGROUND = '#0d0d0d';

// A abertura nativa segura a tela enquanto as fontes e o tema carregam.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

// Mesma imagem e fundo da abertura nativa (app.json), então a troca não aparece.
// No Expo Go, que mostra a própria abertura, é esta tela que exibe a logo.
function OsirisSplash() {
  return (
    <View style={styles.splash} onLayout={() => SplashScreen.hideAsync().catch(() => {})}>
      <Image source={require('./assets/splash-icon.png')} style={styles.splashLogo} resizeMode="contain" />
    </View>
  );
}

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

  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  // Fonte das conversas. Se falhar ao carregar, segue com a fonte do sistema.
  // JetBrains Mono é usada nas telas de login e cadastro.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, JetBrainsMono_400Regular });
  const fontsReady = fontsLoaded || Boolean(fontError);

  // Se as fontes demorarem mais que a logo, o app vai direto ao login: a
  // abertura nativa precisa sair mesmo sem a OsirisSplash ter aparecido.
  useEffect(() => {
    if (fontsReady && splashDone) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady, splashDone]);

  if (!fontsReady) return null;

  return (
    <ThemeProvider>
      {splashDone ? <AppNavigator /> : <OsirisSplash />}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SPLASH_BACKGROUND,
  },
  splashLogo: {
    width: 140,
    height: 140,
  },
});
