import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

function formatDuration(seconds) {
  const s = Math.floor(seconds || 0);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m < 10 ? "0" : ""}${m}:${rem < 10 ? "0" : ""}${rem}`;
}

export default function VoiceModal({
  visible,
  onClose,
  onSendVoice,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const timerRef = useRef(null);
  const animRef = useRef(null);

  // Animação das 5 barras de ondas sonoras azuis (estilo ChatGPT)
  const wave1 = useRef(new Animated.Value(10)).current;
  const wave2 = useRef(new Animated.Value(18)).current;
  const wave3 = useRef(new Animated.Value(28)).current;
  const wave4 = useRef(new Animated.Value(18)).current;
  const wave5 = useRef(new Animated.Value(10)).current;

  // Hook nativo do expo-audio para gravar o microfone real
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, () => {});

  const startWaveAnimations = () => {
    const createWaveAnimation = (animVal, min, max, duration) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(animVal, {
            toValue: max,
            duration,
            useNativeDriver: false,
          }),
          Animated.timing(animVal, {
            toValue: min,
            duration,
            useNativeDriver: false,
          }),
        ])
      );

    animRef.current = Animated.parallel([
      createWaveAnimation(wave1, 8, 34, 310),
      createWaveAnimation(wave2, 14, 50, 240),
      createWaveAnimation(wave3, 20, 62, 190),
      createWaveAnimation(wave4, 14, 48, 260),
      createWaveAnimation(wave5, 8, 36, 330),
    ]);
    animRef.current.start();
  };

  const stopWaveAnimations = () => {
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }
    wave1.setValue(10);
    wave2.setValue(18);
    wave3.setValue(28);
    wave4.setValue(18);
    wave5.setValue(10);
  };

  const stopAndCleanup = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopWaveAnimations();
    setIsRecording(false);
    try {
      if (recorder?.isRecording) {
        await recorder.stop();
      }
    } catch {}
  };

  useEffect(() => {
    let active = true;

    async function startRecordingFlow() {
      Keyboard.dismiss(); // Teclado NUNCA abre
      setDuration(0);
      setIsRecording(false);

      try {
        // 1. Solicita permissão real do microfone
        const perm = await requestRecordingPermissionsAsync();
        if (!active) return;

        if (!perm.granted) {
          Alert.alert(
            "Permissão de Microfone",
            "O Osíris precisa de permissão para acessar o microfone. Ative o microfone nos ajustes do seu aparelho."
          );
          onClose();
          return;
        }

        // 2. Configura a sessão de áudio para gravação
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        // 3. Prepara e inicia a captura do microfone
        await recorder.prepareToRecordAsync();
        recorder.record();

        if (!active) return;
        setIsRecording(true);

        // 4. Inicia contador de tempo em segundos
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);

        // 5. Inicia ondas sonoras animadas
        startWaveAnimations();
      } catch (err) {
        console.warn("Erro ao iniciar gravação do microfone:", err);
        Alert.alert(
          "Erro no microfone",
          "Não foi possível acessar o microfone: " + (err?.message || "")
        );
        onClose();
      }
    }

    if (visible) {
      startRecordingFlow();
    } else {
      stopAndCleanup();
    }

    return () => {
      active = false;
      stopAndCleanup();
    };
  }, [visible]);

  const handleFinishAndSend = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopWaveAnimations();

    let uri = null;
    try {
      if (recorder?.isRecording) {
        await recorder.stop();
      }
      uri = recorder?.uri;
    } catch (err) {
      console.warn("Erro ao parar recorder:", err);
    }

    setIsRecording(false);
    onClose();

    if (uri && onSendVoice) {
      onSendVoice({
        uri,
        duration: Math.max(duration, 1),
        name: `Mensagem de voz (${formatDuration(Math.max(duration, 1))})`,
      });
    }
  };

  const handleToggleRecord = async () => {
    try {
      if (isRecording) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopWaveAnimations();
        await recorder.pause();
        setIsRecording(false);
      } else {
        recorder.record();
        setIsRecording(true);
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
        startWaveAnimations();
      }
    } catch (err) {
      console.warn("Erro ao pausar/retomar gravação:", err);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Barra indicadora superior */}
          <View style={styles.dragIndicator} />

          {/* Header com status de gravação */}
          <View style={styles.header}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.pulsingDot,
                  !isRecording && { backgroundColor: "#f59e0b" },
                ]}
              />
              <Text style={styles.statusTitle}>
                {isRecording ? "Gravando áudio..." : "Pausado"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeIconBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="x" size={18} color="#85818c" />
            </TouchableOpacity>
          </View>

          {/* Área central com cronômetro e instrução */}
          <View style={styles.centerContainer}>
            <Text style={styles.timerText}>{formatDuration(duration)}</Text>
            <Text style={styles.subtitleText}>
              {isRecording
                ? "Microfone ativo • Fale agora com o Osíris..."
                : "Gravação pausada • Toque na seta para enviar"}
            </Text>
          </View>

          {/* Visualizador de Ondas Sonoras Azuis Animadas (Estilo ChatGPT) */}
          <View style={styles.waveVisualizerContainer}>
            <Animated.View style={[styles.waveBar, { height: wave1 }]} />
            <Animated.View style={[styles.waveBar, { height: wave2 }]} />
            <Animated.View
              style={[
                styles.waveBar,
                { height: wave3, backgroundColor: "#60a5fa" },
              ]}
            />
            <Animated.View style={[styles.waveBar, { height: wave4 }]} />
            <Animated.View style={[styles.waveBar, { height: wave5 }]} />
          </View>

          {/* Controles de Ação na parte inferior */}
          <View style={styles.controlsRow}>
            {/* Cancelar / Descartar gravação */}
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color="#e8e8e8" />
            </TouchableOpacity>

            {/* Botão Central de Microfone Azul (Pausar / Retomar gravação) */}
            <TouchableOpacity
              style={[
                styles.micCircleButton,
                !isRecording && styles.micCircleButtonPaused,
              ]}
              onPress={handleToggleRecord}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isRecording ? "radio" : "mic"}
                size={30}
                color="#ffffff"
              />
            </TouchableOpacity>

            {/* Concluir e Enviar áudio */}
            <TouchableOpacity
              style={[
                styles.sendVoiceBtn,
                duration === 0 && styles.sendVoiceBtnDisabled,
              ]}
              onPress={handleFinishAndSend}
              disabled={duration === 0}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#16161c",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#262632",
    alignItems: "center",
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#363644",
    marginBottom: 12,
  },
  header: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e8e8e8",
  },
  closeIconBtn: {
    padding: 4,
  },
  centerContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  timerText: {
    fontSize: 34,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitleText: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },

  // Ondas Sonoras Azuis Animadas
  waveVisualizerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 70,
    marginBottom: 28,
  },
  waveBar: {
    width: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 3,
  },

  // Controles inferiores
  controlsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 16,
  },
  cancelBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#272732",
    justifyContent: "center",
    alignItems: "center",
  },
  micCircleButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  micCircleButtonPaused: {
    backgroundColor: "#475569",
    shadowOpacity: 0.2,
  },
  sendVoiceBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  sendVoiceBtnDisabled: {
    backgroundColor: "#272732",
    opacity: 0.4,
  },
});
