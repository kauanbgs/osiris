import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";

// No Expo SDK 57 o Android desenha a tela de ponta a ponta (edge-to-edge) e
// não encolhe mais a janela quando o teclado abre. Por isso o "padding" do
// KeyboardAvoidingView precisa valer nas duas plataformas.

// Para telas com o campo fixo embaixo (chat, terminal, editor).
export function KeyboardAvoider({ children, style, offset = 0 }) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior="padding"
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// Para formulários com rolagem: a tela encolhe e rola até o campo em foco.
export function KeyboardScrollView({ children, style, contentContainerStyle, ...props }) {
  if (Platform.OS === "ios") {
    return (
      <ScrollView
        style={[styles.flex, style]}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={[styles.flex, style]}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // No iOS os eventos "will" deixam a transição mais suave.
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
