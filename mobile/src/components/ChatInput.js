import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

const colors = {
  card: '#1a1a1a',
  cardAlt: '#232323',
  backgroundPure: '#000000',

  textPrimary: '#e8e8e8',
  textSecondary: '#c9c9c9',
  textMuted: '#9a9a9a',
  textPlaceholder: '#6b6b6b',

  purple: '#7c5cff',
  purpleDisabled: '#4a3f80',
  green: '#2ecc71',
  white: '#ffffff',
};

const fontFamily = Platform.select({ ios: 'Courier', android: 'monospace' });

export default function ChatInput({
  value,
  onChangeText,
  onSend,
  onMicPress,
  onPlusPress,
  placeholder = 'O que você quer construir?',
  disabled = false,
}) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.inputBox}>
          <Text style={styles.prompt}>{'>'}</Text>
          <TextInput
            style={styles.input}
            placeholder={disabled ? 'Aguardando resposta do agente…' : placeholder}
            placeholderTextColor={colors.textPlaceholder}
            value={value}
            onChangeText={onChangeText}
            editable={!disabled}
          />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.plusButton} onPress={onPlusPress} disabled={disabled}>
            <Feather name="plus" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.rightActions}>
            <TouchableOpacity style={styles.micButton} onPress={onMicPress} disabled={disabled}>
              <Feather name="mic" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
              onPress={onSend}
              disabled={disabled}
            >
              <Ionicons name="send" size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  prompt: {
    color: colors.green,
    fontFamily,
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: colors.textMuted,
    fontFamily,
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.backgroundPure,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  plusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  micButton: {
    marginRight: 16,
    padding: 6,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.purple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.purpleDisabled,
  },
});