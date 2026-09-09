import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import CadastroScreen from './src/screens/CadastroScreen';

export default function App() {
  const stack = createNativeStackNavigator();

  return (
    <NavigationContainer>
      <stack.Navigator initialRouteName="Cadastro" screenOptions={{ headerShown: false }}>
        <stack.Screen name="LoginScreen" component={LoginScreen} />
        <stack.Screen name="HomeScreen" component={HomeScreen} />
        <stack.Screen name="Cadastro" component={CadastroScreen} />
      </stack.Navigator>
    </NavigationContainer>
  );
}