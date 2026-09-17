import { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CadastroScreen from './src/screens/CadastroScreen';
import MemoriaScreen from './src/screens/MemoriaScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { loadIP } from './src/services/serverConfig';

export default function App() {
  const stack = createNativeStackNavigator();

  // Carrega o IP salvo no celular ao abrir o app.
  useEffect(() => {
    loadIP().catch(() => {});
  }, []);

  return (
    <NavigationContainer>
      <stack.Navigator initialRouteName="LoginScreen" screenOptions={{ headerShown: false }}>
        <stack.Screen name="LoginScreen" component={LoginScreen} />
        <stack.Screen name="HomeScreen" component={HomeScreen} />
        <stack.Screen name="Cadastro" component={CadastroScreen} />
        <stack.Screen name="MemoriaScreen" component={MemoriaScreen} />
        <stack.Screen name="Configuracoes" component={SettingsScreen} />
      </stack.Navigator>
    </NavigationContainer>
  );
}