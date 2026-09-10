import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '../components/Navbar';
import ChatInput from '../components/ChatInput';

const colors = {
  background: '#0d0d0d',
  textPrimary: '#e8e8e8',
  textSecondary: '#c9c9c9',
  purple: '#7c5cff',
  green: '#2ecc71',
};

const fontFamily = Platform.select({ ios: 'Courier', android: 'monospace' });

function StatusIndicator({ label = 'Conectado ao desktop' }) {
  return (
    <View style={styles.statusRow}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function GreetingHeader({ userName = 'Usuário' }) {
  return (
    <View style={styles.content}>
      <Text style={styles.greeting}>
        Bom dia,{'\n'}
        <Text style={styles.greetingName}>{userName}!</Text>
      </Text>
    </View>
  );
}

export default function HomeScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function loadUser() {
      try {
        const stored = await AsyncStorage.getItem('user');
        if (stored) {
          const parsedUser = JSON.parse(stored);
          const firstName = parsedUser?.name?.trim().split(' ')[0];
          setUserName(firstName || 'Usuário');
        }
      } catch (error) {
        console.error('Erro ao carregar usuário:', error);
      }
    }

    loadUser();
  }, []);

  const handleSend = () => {
    if (!message.trim()) return;
    console.log('Enviar:', message);
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusIndicator label="Conectado ao desktop" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <GreetingHeader userName={userName} />

        <ChatInput
          value={message}
          onChangeText={setMessage}
          onSend={handleSend}
          onMicPress={() => console.log('mic pressionado')}
          onPlusPress={() => console.log('plus pressionado')}
        />

        <BottomNav onPressItem={(key) => console.log('nav:', key)} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    justifyContent: 'space-between',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.green,
    marginRight: 8,
  },
  statusText: {
    fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },

  content: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  greeting: {
    fontFamily,
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 48,
  },
  greetingName: {
    color: colors.purple,
  },
});