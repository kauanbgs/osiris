import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Bot, CaseSensitive, MousePointer2, Paperclip, SquareTerminal } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import BottomNav from '../components/Navbar';
import sheets from '../services/api';

const colors = {
  background: '#141414',
  panel: '#242326',
  border: '#35323b',
  text: '#e8e8e8',
  muted: '#85818c',
  purple: '#7c5cff',
  green: '#a3e635',
};

const CARD_WIDTH = 500;
const CARD_HEIGHT = 300;
const INITIAL_ZOOM = 0.5;

function newId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nodeDisplayName(node) {
  return node.data?.label || node.name || node.type || 'Node';
}

export default function WorkflowScreen({ navigation, route }) {
  const [workflows, setWorkflows] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const changeVersionRef = useRef(0);
  const zoomRef = useRef(zoom);
  const requestedWorkflowId = useRef(route?.params?.workflowId || null);
  const pollInFlight = useRef(false);

  const applyCanvas = useCallback((canvas, shouldFrame = false) => {
    const nextNodes = canvas?.nodes || [];
    const nextEdges = canvas?.edges || [];
    const previousGeometry = nodesRef.current.map((node) => ({ id: node.id, position: node.position }));
    const nextGeometry = nextNodes.map((node) => ({ id: node.id, position: node.position }));
    const geometryChanged = JSON.stringify(previousGeometry) !== JSON.stringify(nextGeometry);
    const changed = JSON.stringify(nodesRef.current) !== JSON.stringify(nextNodes)
      || JSON.stringify(edgesRef.current) !== JSON.stringify(nextEdges);
    if (!changed) return;

    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    if ((shouldFrame || geometryChanged) && nextNodes.length) {
      const positions = nextNodes.map((node, index) => node.position || { x: 100, y: 100 + index * 340 });
      const minX = Math.min(...positions.map((item) => item.x));
      const maxX = Math.max(...positions.map((item) => item.x));
      const minY = Math.min(...positions.map((item) => item.y));
      const maxY = Math.max(...positions.map((item) => item.y));
      const width = viewport.width || 360;
      const height = viewport.height || 500;
      const fit = Math.min(0.85, (width - 30) / (maxX - minX + CARD_WIDTH), (height - 80) / (maxY - minY + CARD_HEIGHT));
      zoomRef.current = Math.max(0.15, fit);
      setZoom(zoomRef.current);
    }
  }, [viewport.height, viewport.width]);

  const loadWorkflows = useCallback(async () => {
    const { data } = await sheets.getWorkflows();
    const list = data.workflows || [];
    setWorkflows(list);
    const desiredId = requestedWorkflowId.current;
    const selected = list.find((item) => String(item.id_workflow) === String(desiredId)) || list[0] || null;
    setWorkflow(selected);
    if (!selected) {
      applyCanvas({ nodes: [], edges: [] });
      return;
    }
    requestedWorkflowId.current = selected.id_workflow;
    const response = await sheets.getWorkflowCanvas(selected.id_workflow);
    applyCanvas(response.data?.canvas, true);
  }, [applyCanvas]);

  const refreshCanvas = useCallback(async (silent = false) => {
    if (!workflow?.id_workflow || pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const response = await sheets.getWorkflowCanvas(workflow.id_workflow);
      if (!dirtyRef.current && !saveInFlightRef.current) {
        applyCanvas(response.data?.canvas);
      }
      if (!silent) setError('');
    } catch (requestError) {
      if (!silent) setError(requestError?.response?.data?.error?.message || requestError.message || 'Falha ao atualizar o workflow.');
    } finally {
      pollInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [applyCanvas, workflow?.id_workflow]);

  useEffect(() => {
    let cancelled = false;
    async function initialLoad() {
      setLoading(true);
      try {
        await loadWorkflows();
      } catch (requestError) {
        if (!cancelled) setError(requestError?.response?.data?.error?.message || requestError.message || 'Falha ao carregar o workflow.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initialLoad();
    return () => { cancelled = true; };
  }, [loadWorkflows]);

  useEffect(() => {
    if (!workflow?.id_workflow) return undefined;
    let interval;
    const startPolling = () => {
      clearInterval(interval);
      refreshCanvas(true);
      interval = setInterval(() => refreshCanvas(true), 1200);
    };
    const stopPolling = () => clearInterval(interval);
    if (navigation.isFocused()) startPolling();
    const unsubscribeFocus = navigation.addListener('focus', startPolling);
    const unsubscribeBlur = navigation.addListener('blur', stopPolling);
    return () => {
      stopPolling();
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, refreshCanvas, workflow?.id_workflow]);

  useEffect(() => {
    if (!workflow?.id_workflow || !dirtyRef.current) return undefined;
    const version = changeVersionRef.current;
    const snapshot = { nodes, edges };
    const timeout = setTimeout(async () => {
      saveInFlightRef.current = true;
      try {
        await sheets.saveWorkflowCanvas(workflow.id_workflow, snapshot);
        if (changeVersionRef.current === version) dirtyRef.current = false;
        setError('');
      } catch (requestError) {
        setError(requestError?.response?.data?.error?.message || requestError.message || 'Falha ao salvar o workflow.');
      } finally {
        saveInFlightRef.current = false;
      }
    }, 450);
    return () => clearTimeout(timeout);
  }, [edges, nodes, workflow?.id_workflow]);

  const markCanvasChanged = useCallback((nextNodes, nextEdges = edgesRef.current) => {
    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    dirtyRef.current = true;
    changeVersionRef.current += 1;
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, []);

  const addNode = useCallback((type) => {
    const index = nodesRef.current.length;
    const definitions = {
      terminal: { label: 'Terminal', mode: 'empty' },
      agent: { label: 'Agent', mode: 'Agent' },
      file: { label: 'File', files: [] },
      text: { label: 'Text', text: '' },
    };
    const node = {
      id: newId(),
      type,
      position: { x: 250 + (index % 3) * 80, y: 150 + index * 110 },
      data: definitions[type],
      dragHandle: '.drag-handle',
    };
    markCanvasChanged([...nodesRef.current, node]);
  }, [markCanvasChanged]);

  const updateNode = useCallback((nodeId, patch) => {
    const next = nodesRef.current.map((node) => node.id === nodeId
      ? { ...node, ...patch, data: { ...node.data, ...(patch.data || {}) } }
      : node);
    markCanvasChanged(next);
  }, [markCanvasChanged]);

  const deleteNode = useCallback((nodeId) => {
    const nextNodes = nodesRef.current.filter((node) => node.id !== nodeId);
    const nextEdges = edgesRef.current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
    markCanvasChanged(nextNodes, nextEdges);
  }, [markCanvasChanged]);

  const chooseWorkflow = useCallback(async (selected) => {
    setPickerOpen(false);
    requestedWorkflowId.current = selected.id_workflow;
    setWorkflow(selected);
    setLoading(true);
    dirtyRef.current = false;
    try {
      const response = await sheets.getWorkflowCanvas(selected.id_workflow);
      applyCanvas(response.data?.canvas, true);
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || requestError.message || 'Falha ao abrir o workflow.');
    } finally {
      setLoading(false);
    }
  }, [applyCanvas]);

  const pinchResponder = useMemo(() => {
    let startDistance = 0;
    let startZoom = INITIAL_ZOOM;
    const distance = (touches) => touches.length < 2 ? 0 : Math.hypot(
      touches[0].pageX - touches[1].pageX,
      touches[0].pageY - touches[1].pageY,
    );
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event) => (event.nativeEvent.touches || []).length > 1,
      onPanResponderGrant: (event) => {
        startDistance = distance(event.nativeEvent.touches || []);
        startZoom = zoomRef.current;
      },
      onPanResponderMove: (event) => {
        const nextDistance = distance(event.nativeEvent.touches || []);
        if (startDistance) {
          zoomRef.current = Math.max(0.15, Math.min(1.5, startZoom * nextDistance / startDistance));
          setZoom(zoomRef.current);
        }
      },
    });
  }, []);

  const positions = nodes.map((node, index) => node.position || { x: 100, y: 100 + index * 340 });
  const minX = positions.length ? Math.min(...positions.map((item) => item.x)) : 0;
  const minY = positions.length ? Math.min(...positions.map((item) => item.y)) : 0;
  const visibleNodes = nodes.map((node, index) => {
    const position = node.position || { x: 100, y: 100 + index * 340 };
    return { ...node, canvasPosition: { x: 40 + position.x - minX, y: 40 + position.y - minY } };
  });
  const nodePositions = new Map(visibleNodes.map((node) => [node.id, node.canvasPosition]));

  function adjustZoom(delta) {
    zoomRef.current = Math.max(0.15, Math.min(1.5, zoomRef.current + delta));
    setZoom(zoomRef.current);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.workflowSelect} onPress={() => setPickerOpen(true)}>
          <Text style={styles.eyebrow}>WORKFLOW · {nodes.length} NÓ(S)</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{workflow?.name || 'Workflows'}</Text>
            <Feather name="chevron-down" size={15} color={colors.muted} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => refreshCanvas(false)} style={styles.headerIcon} accessibilityLabel="Atualizar">
          <Feather name="refresh-cw" size={16} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <ToolButton Icon={MousePointer2} label="Selecionar" onPress={() => {}} />
        <ToolButton Icon={SquareTerminal} label="Terminal" onPress={() => addNode('terminal')} />
        <ToolButton Icon={Bot} label="Agent" onPress={() => addNode('agent')} />
        <ToolButton Icon={Paperclip} label="File" onPress={() => addNode('file')} />
        <ToolButton Icon={CaseSensitive} label="Text" onPress={() => addNode('text')} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View
        style={styles.viewport}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setViewport((current) => current.width === width && current.height === height ? current : { width, height });
        }}
        {...pinchResponder.panHandlers}
      >
        {loading ? (
          <View style={styles.emptyState}><ActivityIndicator color={colors.purple} /></View>
        ) : !workflow ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>Crie um workflow no desktop para começar.</Text></View>
        ) : nodes.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>Este workflow ainda não tem nós.</Text></View>
        ) : (
          <View style={[styles.canvas, { transform: [{ scale: zoom }] }]}>
            <Svg width={2600} height={2600} style={StyleSheet.absoluteFill} pointerEvents="none">
              {edges.map((edge) => {
                const source = nodePositions.get(edge.source);
                const target = nodePositions.get(edge.target);
                if (!source || !target) return null;
                return <Path key={edge.id || `${edge.source}-${edge.target}`} d={`M ${source.x + 250} ${source.y + 150} C ${source.x + 400} ${source.y + 150}, ${target.x + 100} ${target.y + 150}, ${target.x + 250} ${target.y + 150}`} stroke="#8b5cf6" strokeWidth={5} fill="none" />;
              })}
            </Svg>
            {visibleNodes.map((node) => (
              <WorkflowNodeCard
                key={node.id}
                node={node}
                position={node.canvasPosition}
                zoom={zoom}
                onUpdate={updateNode}
                onDelete={deleteNode}
              />
            ))}
          </View>
        )}

        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(0.15)} accessibilityLabel="Aumentar zoom"><Feather name="plus" size={19} color={colors.text} /></TouchableOpacity>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(-0.15)} accessibilityLabel="Diminuir zoom"><Feather name="minus" size={19} color={colors.text} /></TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={() => { zoomRef.current = INITIAL_ZOOM; setZoom(INITIAL_ZOOM); }} accessibilityLabel="Redefinir zoom"><Feather name="maximize-2" size={15} color={colors.text} /></TouchableOpacity>
        </View>
        <Text style={styles.gestureHint}>Arraste o cabeçalho do nó · pinça para zoom</Text>
      </View>

      <BottomNav navigation={navigation} activeKey="workflow" />

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.workflowPicker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Selecionar workflow</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}><Feather name="x" size={20} color={colors.muted} /></TouchableOpacity>
            </View>
            <FlatList
              data={workflows}
              keyExtractor={(item) => String(item.id_workflow)}
              ListEmptyComponent={<Text style={styles.emptyText}>Nenhum workflow encontrado.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.workflowOption} onPress={() => chooseWorkflow(item)}>
                  <Feather name="git-branch" size={17} color={colors.purple} />
                  <Text style={styles.optionText} numberOfLines={1}>{item.name}</Text>
                  {String(item.id_workflow) === String(workflow?.id_workflow) ? <Feather name="check" size={17} color={colors.purple} /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ToolButton({ Icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.toolButton} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Adicionar ${label}`}>
      <Icon size={18} color="#e4e4e7" strokeWidth={2} />
    </TouchableOpacity>
  );
}

function WorkflowNodeCard({ node, position, zoom, onUpdate, onDelete }) {
  const start = useRef(node.position || { x: 0, y: 0 });
  const currentPosition = useRef(node.position || { x: 0, y: 0 });
  currentPosition.current = node.position || { x: 0, y: 0 };
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { start.current = currentPosition.current; },
    onPanResponderMove: (_, gesture) => onUpdate(node.id, {
      position: { x: start.current.x + gesture.dx / zoom, y: start.current.y + gesture.dy / zoom },
    }),
  }), [node.id, onUpdate, zoom]);

  const type = String(node.type || '').toLowerCase();
  const label = nodeDisplayName(node);
  const textStyle = type === 'terminal' ? styles.terminalText : styles.nodeText;

  return (
    <View style={[styles.nodeCard, { left: position.x, top: position.y }]}>
      <View style={styles.nodeHeader} {...panResponder.panHandlers}>
        <View style={styles.windowDots}>
          <View style={[styles.dot, { backgroundColor: '#ff6259' }]} />
          <View style={[styles.dot, { backgroundColor: '#ffbd2e' }]} />
          <View style={[styles.dot, { backgroundColor: '#28c840' }]} />
        </View>
        <Text style={styles.nodeTitle} numberOfLines={1}>{label}</Text>
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(node.id)} accessibilityLabel={`Excluir ${label}`}>
          <Feather name="x" size={16} color="#77737c" />
        </TouchableOpacity>
      </View>
      <View style={styles.nodeBody}>
        {type === 'text' ? (
          <TextInput
            value={node.data?.text || ''}
            onChangeText={(text) => onUpdate(node.id, { data: { text } })}
            placeholder="Digite..."
            placeholderTextColor={colors.muted}
            multiline
            style={styles.textInput}
          />
        ) : type === 'terminal' ? (
          <Text style={textStyle} selectable>{node.data?.terminalContent || ''}</Text>
        ) : type === 'agent' ? (
          <TextInput
            value={node.data?.prompt || ''}
            onChangeText={(prompt) => onUpdate(node.id, { data: { prompt } })}
            placeholder="Prompt do agente"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.textInput}
          />
        ) : type === 'file' ? (
          <View>{(node.data?.files || []).map((file, index) => (
            <View key={`${file.fileName}-${index}`} style={styles.fileEntry}>
              <Text style={styles.nodeText}>{file.fileName}</Text>
              {file.fileContent ? <Text style={styles.fileContent} numberOfLines={8} selectable>{file.fileContent}</Text> : null}
            </View>
          ))}</View>
        ) : (
          <Text style={textStyle} selectable>{node.data?.text || node.data?.content || ''}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerIcon: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  workflowSelect: { flex: 1, paddingHorizontal: 6 },
  eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', maxWidth: '90%' },
  toolbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, alignSelf: 'center', paddingHorizontal: 12, marginTop: 9, borderRadius: 28, borderWidth: 1, borderColor: '#3f3f46cc', backgroundColor: '#18181bb3', elevation: 8 },
  toolButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  errorText: { color: '#fca5a5', fontSize: 11, paddingHorizontal: 14, paddingTop: 6 },
  viewport: { flex: 1, marginTop: 8, overflow: 'hidden', backgroundColor: '#171619' },
  canvas: { position: 'absolute', left: 0, top: 0, width: 2600, height: 2600, transformOrigin: 'top left' },
  emptyState: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  nodeCard: { position: 'absolute', width: CARD_WIDTH, minHeight: CARD_HEIGHT, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#38363b', backgroundColor: colors.panel, elevation: 8 },
  nodeHeader: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: '#f3f3f3' },
  windowDots: { width: 55, flexDirection: 'row', gap: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  nodeTitle: { flex: 1, color: '#4b4b4b', textAlign: 'center', fontSize: 15, fontWeight: '600' },
  deleteButton: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  nodeBody: { minHeight: 250, padding: 18, backgroundColor: '#242326' },
  terminalText: { color: '#f0eff2', fontSize: 15, lineHeight: 22, fontFamily: 'monospace' },
  nodeText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  fileEntry: { marginBottom: 12 },
  fileContent: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  textInput: { minHeight: 210, color: colors.text, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' },
  zoomControls: { position: 'absolute', right: 12, bottom: 20, alignItems: 'center', borderColor: colors.border, borderWidth: 1, borderRadius: 13, padding: 5, backgroundColor: '#222126' },
  zoomButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  zoomLabel: { color: colors.muted, fontSize: 10, paddingVertical: 2 },
  gestureHint: { position: 'absolute', left: 12, bottom: 30, color: colors.muted, fontSize: 10 },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: '#000000aa', padding: 24 },
  workflowPicker: { maxHeight: '70%', backgroundColor: '#1b1a1e', borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  pickerTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  workflowOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border },
  optionText: { flex: 1, color: colors.text, fontSize: 14 },
});
