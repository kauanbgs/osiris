import { useEffect } from 'react';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CadastroScreen from './src/screens/CadastroScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MemoriaScreen from './src/screens/MemoriaScreen';
import TerminalScreen from './src/screens/TerminalScreen';
import ArquivoScreen from './src/screens/ArquivoScreen';
import WorkflowScreen from './src/screens/WorkflowScreen';
import { loadIP } from './src/services/serverConfig';
import { BACKGROUND, SCREEN_PADDING } from './src/theme';

// Criado fora do componente para não ser recriado a cada renderização.
const Stack = createNativeStackNavigator();

// Tema escuro: sem ele, o fundo branco padrão aparece entre uma tela e outra.
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: BACKGROUND,
    card: BACKGROUND,
    primary: '#7c5cff',
  },
};

const screenOptions = {
  headerShown: false,
  // As abas da navbar trocam com um fade curto, como num app de abas.
  animation: 'fade',
  animationDuration: 200,
  contentStyle: { backgroundColor: BACKGROUND, paddingHorizontal: SCREEN_PADDING },
};

// Telas que se abrem "por cima" de outra continuam deslizando da direita.
const pushOptions = { animation: 'slide_from_right' };

export default function App() {
  // Carrega o IP salvo no celular ao abrir o app.
  useEffect(() => {
    loadIP().catch(() => {});
  }, []);

  // Fonte das conversas. Se falhar ao carregar, segue com a fonte do sistema.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium });
  if (!fontsLoaded && !fontError) return null;

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator initialRouteName="LoginScreen" screenOptions={screenOptions}>
        <Stack.Screen name="LoginScreen" component={LoginScreen} />
        <Stack.Screen name="HomeScreen" component={HomeScreen} />
        <Stack.Screen name="Cadastro" component={CadastroScreen} options={pushOptions} />
        <Stack.Screen name="Chats" component={ChatsScreen} />
        <Stack.Screen name="Configuracoes" component={SettingsScreen} />
        <Stack.Screen name="Memoria" component={MemoriaScreen} options={pushOptions} />
        <Stack.Screen name="Terminal" component={TerminalScreen} />
        <Stack.Screen name="ArquivoScreen" component={ArquivoScreen} />
        <Stack.Screen name="WorkflowScreen" component={WorkflowScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
