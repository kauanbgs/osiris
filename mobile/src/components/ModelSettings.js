import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  cancelDesktopDownload,
  downloadDesktopModel,
  getDesktopModels,
  loadDesktopModel,
} from '../services/desktopModels';
import {
  CLOUD_PROVIDERS,
  getActiveModel,
  getCloudKey,
  getDefaultModel,
  saveCloudKey,
  testCloudKey,
  selectCloudModel,
  selectDesktopModel,
} from '../services/modelConfig';

const colors = {
  background: '#0d0d0d',
  card: '#161616',
  cardBorder: '#242424',
  textPrimary: '#e8e8e8',
  textSecondary: '#8a8a8a',
  purple: '#7c5cff',
  green: '#2ecc71',
  red: '#e74c3c',
  inputBg: '#0d0d0d',
  inputBorder: '#2a2a2a',
};

function ProgressBar({ progress }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(progress, 3)}%` }]} />
    </View>
  );
}

function DesktopTab({ activeModel, onActivate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(true);
  const [loadingFile, setLoadingFile] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setData(await getDesktopModels());
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const downloads = data?.downloads || {};
  const isDownloading = Object.keys(downloads).length > 0;

  // Acompanha o progresso enquanto houver download em andamento no desktop.
  useEffect(() => {
    if (!isDownloading) return undefined;
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [isDownloading, refresh]);

  async function handleDownload(model) {
    try {
      await downloadDesktopModel(model.filename);
      await refresh();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleCancel(model) {
    try {
      await cancelDesktopDownload(model.filename);
      await refresh();
    } catch (err) {
      Alert.alert('Erro', err.message);
    }
  }

  async function handleLoad(filename) {
    setLoadingFile(filename);
    try {
      await loadDesktopModel(filename);
      await onActivate();
      await refresh();
    } catch (err) {
      Alert.alert('Erro ao carregar modelo', err.message);
    } finally {
      setLoadingFile(null);
    }
  }

  const isActive = activeModel?.type === 'local';
  const installed = data?.installed || [];
  const available = (data?.catalog || []).filter((model) => !model.installed);
  const catalogNames = Object.fromEntries(
    (data?.catalog || []).map((model) => [model.filename, model.name])
  );

  let statusText = 'Verificando...';
  let statusColor = colors.textSecondary;
  if (error) {
    statusText = 'Desktop offline';
    statusColor = colors.red;
  } else if (data && !data.modelLoaded) {
    statusText = 'Nenhum modelo carregado';
    statusColor = '#f1c40f';
  } else if (data) {
    statusText = catalogNames[data.activeModelName] || data.activeModelName;
    statusColor = colors.green;
  }

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardLabel}>Modelo carregado no desktop</Text>
          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              refresh();
            }}
            hitSlop={10}
          >
            <Feather name="refresh-cw" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          {refreshing && !data ? (
            <ActivityIndicator size="small" color={colors.purple} />
          ) : (
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
          )}
          <Text style={styles.statusText}>{statusText}</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryButton, isActive && styles.activeButton]}
          onPress={onActivate}
          disabled={isActive}
        >
          <Text style={styles.primaryButtonText}>
            {isActive ? 'Em uso no chat' : 'Usar modelo do desktop no chat'}
          </Text>
        </TouchableOpacity>
      </View>

      {data && (
        <>
          <Text style={styles.sectionHeader}>Instalados no desktop</Text>
          {installed.length === 0 && (
            <Text style={styles.hint}>Nenhum modelo baixado ainda.</Text>
          )}
          {installed.map((model) => {
            const loaded = model.isActive;
            const loading = loadingFile === model.filename;
            return (
              <View key={model.filename} style={[styles.card, loaded && styles.cardActive]}>
                <Text style={styles.cardLabel}>
                  {catalogNames[model.filename] || model.filename}
                </Text>
                <Text style={styles.hint}>{model.sizeGB} GB</Text>
                <TouchableOpacity
                  style={[styles.smallButton, (loaded || loadingFile) && styles.buttonDisabled]}
                  onPress={() => handleLoad(model.filename)}
                  disabled={loaded || Boolean(loadingFile)}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.smallButtonText}>
                      {loaded ? 'Carregado' : 'Carregar e usar'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={styles.sectionHeader}>Disponíveis para baixar</Text>
          {available.length === 0 && (
            <Text style={styles.hint}>Todos os modelos do catálogo já estão no desktop.</Text>
          )}
          {available.map((model) => {
            const download = downloads[model.filename];
            return (
              <View key={model.filename} style={styles.card}>
                <Text style={styles.cardLabel}>{model.name}</Text>
                <Text style={styles.hint}>
                  {model.size} • {model.ram}
                </Text>
                <Text style={styles.description}>{model.description}</Text>

                {download ? (
                  <View>
                    <ProgressBar progress={download.progress} />
                    <View style={styles.buttonRow}>
                      <Text style={styles.hint}>Baixando... {download.progress}%</Text>
                      <TouchableOpacity onPress={() => handleCancel(model)}>
                        <Text style={[styles.link, { color: colors.red }]}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.smallButton} onPress={() => handleDownload(model)}>
                    <Text style={styles.smallButtonText}>Baixar no desktop</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

function ProviderCard({ provider, activeModel, onActivate }) {
  const [key, setKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    getCloudKey(provider.id).then((value) => {
      setKey(value);
      setSavedKey(value);
    });
  }, [provider.id]);

  const hasSavedKey = Boolean(savedKey);
  const isActiveProvider =
    activeModel?.type === 'cloud' && activeModel.provider === provider.id;

  async function handleSave() {
    setBusy(true);
    setResult(null);
    try {
      const trimmed = key.trim();
      if (trimmed) await testCloudKey(provider.id, trimmed);
      await saveCloudKey(provider.id, trimmed);
      setSavedKey(trimmed);
      setResult(
        trimmed
          ? { ok: true, msg: 'Chave válida e salva.' }
          : { ok: true, msg: 'Chave removida.' }
      );
      // Primeira chave salva: já deixa o modelo padrão do provedor pronto.
      if (trimmed && activeModel?.type !== 'cloud') {
        await onActivate(provider.id, getDefaultModel(provider).id);
      }
    } catch (error) {
      setResult({ ok: false, msg: error.message || 'Não foi possível validar a chave.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectModel(modelId) {
    if (!hasSavedKey) {
      Alert.alert('Chave necessária', `Salve uma chave do ${provider.name} primeiro.`);
      return;
    }
    await onActivate(provider.id, modelId);
  }

  return (
    <View style={[styles.card, isActiveProvider && styles.cardActive]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardLabel}>{provider.name}</Text>
        {hasSavedKey && <Text style={styles.badge}>Chave salva</Text>}
      </View>

      <View style={styles.keyRow}>
        <TextInput
          style={styles.input}
          placeholder={provider.placeholder}
          placeholderTextColor="#555"
          value={key}
          onChangeText={(value) => {
            setKey(value);
            setResult(null);
          }}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
        <TouchableOpacity onPress={() => setVisible((v) => !v)} hitSlop={10}>
          <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.smallButton, busy && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={busy || key.trim() === savedKey}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.smallButtonText}>Testar e salvar</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL(provider.getKeyUrl)}>
          <Text style={styles.link}>Obter chave ›</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <Text style={[styles.resultText, { color: result.ok ? colors.green : colors.red }]}>
          {result.msg}
        </Text>
      )}

      <View style={styles.chips}>
        {provider.models.map((model) => {
          const selected = isActiveProvider && activeModel.model === model.id;
          return (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.chip,
                selected && styles.chipSelected,
                !hasSavedKey && styles.chipDisabled,
              ]}
              onPress={() => handleSelectModel(model.id)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {model.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// Seção "Modelos de IA" da tela de Configurações.
export default function ModelSettings() {
  const [openSection, setOpenSection] = useState(null);
  const [activeModel, setActiveModelState] = useState(null);

  useEffect(() => {
    getActiveModel().then(setActiveModelState);
  }, []);

  async function activateDesktop() {
    await selectDesktopModel();
    setActiveModelState(await getActiveModel());
  }

  async function activateCloud(providerId, modelId) {
    await selectCloudModel(providerId, modelId);
    setActiveModelState(await getActiveModel());
  }

  const sections = [
    {
      key: 'desktop',
      title: 'Modelos do desktop',
      hint: 'Baixar e escolher os modelos locais do PC',
    },
    {
      key: 'cloud',
      title: 'Modelos em nuvem',
      hint: 'Gemini, ChatGPT, Claude e Groq com sua chave de API',
    },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Modelos de IA</Text>
      <Text style={styles.subtitle}>
        Usando no chat: {activeModel ? activeModel.name : '...'}
      </Text>

      {sections.map((section) => {
        const open = openSection === section.key;
        return (
          <View key={section.key}>
            <TouchableOpacity
              style={styles.toggleRow}
              activeOpacity={0.8}
              onPress={() => setOpenSection(open ? null : section.key)}
            >
              <View style={styles.toggleTextBox}>
                <Text style={styles.cardLabel}>{section.title}</Text>
                <Text style={styles.toggleHint}>{section.hint}</Text>
              </View>
              <Feather
                name={open ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.purple}
              />
            </TouchableOpacity>

            {open && section.key === 'desktop' && (
              <View style={styles.sectionBody}>
                <DesktopTab activeModel={activeModel} onActivate={activateDesktop} />
              </View>
            )}

            {open && section.key === 'cloud' && (
              <View style={styles.sectionBody}>
                <Text style={styles.hint}>
                  As chaves ficam guardadas com criptografia só neste celular.
                </Text>
                {CLOUD_PROVIDERS.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    activeModel={activeModel}
                    onActivate={activateCloud}
                  />
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#292929',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#262626',
  },
  toggleTextBox: {
    flex: 1,
    marginRight: 8,
  },
  toggleHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  sectionBody: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardActive: {
    borderColor: colors.purple,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    color: colors.textPrimary,
    fontSize: 14,
    marginLeft: 10,
    flexShrink: 1,
  },
  sectionHeader: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 10,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inputBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.purple,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.purple,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#2a2440',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  badge: {
    color: colors.green,
    fontSize: 11,
    fontWeight: '600',
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    fontSize: 14,
    marginRight: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallButton: {
    backgroundColor: colors.purple,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minWidth: 130,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  smallButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  link: {
    color: colors.purple,
    fontSize: 13,
  },
  resultText: {
    fontSize: 12,
    marginTop: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    marginBottom: 6,
  },
  chipSelected: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
});
