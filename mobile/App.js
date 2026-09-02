import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import Login from './src/screens/Login';

export default function App() {

  const stack = createNativeStackNavigator();

  return (
    <NavigationContainer>
      <stack.Navigator initialRouteName="Login">
        <stack.Screen name="Login" component={Login} />
      </stack.Navigator>
    </NavigationContainer>
  );
}
