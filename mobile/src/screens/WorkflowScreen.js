import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import BottomNav from '../components/Navbar';
import sheets from '../services/api';
import { aiUrl, loadIP } from '../services/serverConfig';

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
const CANVAS_PADDING = 1400;
const AGENT_MODELS = [
  { value: 'qwen2.5-coder:7b', label: 'Qwen 2.5 Coder 7B' },
  { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
  { value: 'llama3.2:3b', label: 'Llama 3.2 3B' },
  { value: 'mistral:7b', label: 'Mistral 7B' },
];

function newId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nodeDisplayName(node) {
  return node.data?.label || node.name || node.type || 'Node';
}

function extractFileOperations(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return null;
}

function applyAgentFileOperations(files, operations) {
  let nextFiles = [...files];
  for (const operation of operations) {
    if (!operation?.fileName || !['create', 'update', 'delete'].includes(operation.action)) continue;
    const index = nextFiles.findIndex((file) => file.fileName === operation.fileName);
    if (operation.action === 'delete') {
      nextFiles = nextFiles.filter((file) => file.fileName !== operation.fileName);
      continue;
    }
    const content = typeof operation.content === 'string' ? operation.content : '';
    const nextFile = {
      ...(index >= 0 ? nextFiles[index] : {}),
      fileName: operation.fileName,
      fileContent: content,
      fileSize: content.length,
      fileType: operation.fileType || nextFiles[index]?.fileType || 'text/plain',
    };
    if (index >= 0) nextFiles[index] = nextFile;
    else nextFiles.push(nextFile);
  }
  return nextFiles;
}

export default function WorkflowScreen({ navigation, route }) {
  const [workflows, setWorkflows] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [agentRuns, setAgentRuns] = useState({});
  const [terminalRuns, setTerminalRuns] = useState({});
  const [desktopOnline, setDesktopOnline] = useState(false);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const activeWorkflowIdRef = useRef(workflow?.id_workflow ?? null);
  activeWorkflowIdRef.current = workflow?.id_workflow ?? null;
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const changeVersionRef = useRef(0);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const requestedWorkflowId = useRef(route?.params?.workflowId || null);
  const pollInFlight = useRef(false);
  const agentAbortRefs = useRef(new Map());
  const saveQueueRef = useRef(Promise.resolve());
  const saveRetryTimerRef = useRef(null);

  const frameCanvas = useCallback((canvasNodes = nodesRef.current, frameSize = viewport) => {
    if (!canvasNodes.length) return;
    const positions = canvasNodes.map((node, index) => node.position || { x: 100, y: 100 + index * 340 });
    const minX = Math.min(...positions.map((item) => item.x));
    const maxX = Math.max(...positions.map((item) => item.x)) + CARD_WIDTH;
    const minY = Math.min(...positions.map((item) => item.y));
    const maxY = Math.max(...positions.map((item) => item.y)) + CARD_HEIGHT;
    const width = frameSize.width || 360;
    const height = frameSize.height || 500;
    const fit = Math.max(0.2, Math.min(0.9, (width - 36) / (maxX - minX), (height - 110) / (maxY - minY)));
    const nextPan = {
      x: (width - (maxX - minX) * fit) / 2 - (CANVAS_PADDING + minX) * fit,
      y: (height - (maxY - minY) * fit) / 2 - (CANVAS_PADDING + minY) * fit,
    };
    zoomRef.current = fit;
    panRef.current = nextPan;
    setZoom(fit);
    setPan(nextPan);
  }, [viewport]);

  const applyCanvas = useCallback((canvas, shouldFrame = false) => {
    const nextNodes = canvas?.nodes || [];
    const nextEdges = canvas?.edges || [];
    const changed = JSON.stringify(nodesRef.current) !== JSON.stringify(nextNodes)
      || JSON.stringify(edgesRef.current) !== JSON.stringify(nextEdges);
    if (!changed) return;

    nodesRef.current = nextNodes;
    edgesRef.current = nextEdges;
    setNodes(nextNodes);
    setEdges(nextEdges);
    if (shouldFrame) frameCanvas(nextNodes);
  }, [frameCanvas]);

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
    const requestedId = workflow?.id_workflow;
    if (!requestedId || pollInFlight.current) return;
    pollInFlight.current = true;
    try {
      const response = await sheets.getWorkflowCanvas(requestedId);
      if (String(activeWorkflowIdRef.current) !== String(requestedId)) return;
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

  const queueCanvasSave = useCallback((snapshot, version) => {
    const workflowId = workflow?.id_workflow;
    if (!workflowId) return;
    const job = saveQueueRef.current.catch(() => {}).then(async () => {
      saveInFlightRef.current = true;
      try {
        await sheets.saveWorkflowCanvas(workflowId, snapshot);
        if (changeVersionRef.current === version) {
          dirtyRef.current = false;
          setError('');
        }
        if (saveRetryTimerRef.current) {
          clearTimeout(saveRetryTimerRef.current);
          saveRetryTimerRef.current = null;
        }
      } catch (requestError) {
        setError(requestError?.response?.data?.error?.message || requestError.message || 'Falha ao salvar o workflow. Tentando novamente…');
        if (dirtyRef.current) {
          clearTimeout(saveRetryTimerRef.current);
          saveRetryTimerRef.current = setTimeout(() => {
            queueCanvasSave({ nodes: nodesRef.current, edges: edgesRef.current }, changeVersionRef.current);
          }, 1800);
        }
      } finally {
        saveInFlightRef.current = false;
      }
    });
    saveQueueRef.current = job.catch(() => {});
    return job;
  }, [workflow?.id_workflow]);

  const refreshDesktopStatus = useCallback(async () => {
    try {
      await loadIP();
      const response = await fetch(`${aiUrl()}/api/status`);
      const status = response.ok ? await response.json() : null;
      setDesktopOnline(Boolean(status?.online));
    } catch {
      setDesktopOnline(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    refreshDesktopStatus();
    return undefined;
  }, [refreshDesktopStatus]));

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
      refreshDesktopStatus();
      interval = setInterval(() => {
        refreshCanvas(true);
        refreshDesktopStatus();
      }, 1500);
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
  }, [navigation, refreshCanvas, refreshDesktopStatus, workflow?.id_workflow]);

  useEffect(() => {
    if (!workflow?.id_workflow || !dirtyRef.current) return undefined;
    const version = changeVersionRef.current;
    const snapshot = { nodes, edges };
    const timeout = setTimeout(() => queueCanvasSave(snapshot, version), 350);
    return () => clearTimeout(timeout);
  }, [edges, nodes, queueCanvasSave, workflow?.id_workflow]);

  useEffect(() => () => {
    if (saveRetryTimerRef.current) clearTimeout(saveRetryTimerRef.current);
  }, []);

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
    const position = {
      x: ((viewport.width || 360) / 2 - panRef.current.x) / zoomRef.current - CANVAS_PADDING - CARD_WIDTH / 2,
      y: ((viewport.height || 500) / 2 - panRef.current.y) / zoomRef.current - CANVAS_PADDING - CARD_HEIGHT / 2,
    };
    const definitions = {
      terminal: { label: 'Terminal', mode: 'empty' },
      agent: { label: 'Agent', mode: 'Agent' },
      file: { label: 'File', files: [] },
      text: { label: 'Text', text: '' },
    };
    const node = {
      id: newId(),
      type,
      position: { x: position.x + (index % 3) * 30, y: position.y + index * 30 },
      data: definitions[type],
      dragHandle: '.drag-handle',
    };
    markCanvasChanged([...nodesRef.current, node]);
  }, [markCanvasChanged, viewport.height, viewport.width]);

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

  const connectNodes = useCallback((source, target) => {
    if (!source || !target || source === target) return;
    if (edgesRef.current.some((edge) => edge.source === source && edge.target === target)) {
      markCanvasChanged(nodesRef.current, edgesRef.current.filter((edge) => !(edge.source === source && edge.target === target)));
      return;
    }
    const sourceNode = nodesRef.current.find((node) => node.id === source);
    const targetNode = nodesRef.current.find((node) => node.id === target);
    const sourceHandle = sourceNode?.type === 'file' ? 'files' : sourceNode?.type === 'agent' ? 'output' : undefined;
    const targetHandle = targetNode?.type === 'agent' ? 'files' : 'input';
    markCanvasChanged(nodesRef.current, [...edgesRef.current, {
      id: newId(),
      source,
      target,
      sourceHandle,
      targetHandle,
      type: 'curved',
    }]);
  }, [markCanvasChanged]);

  const handleNodeLink = useCallback((nodeId) => {
    if (!connectMode) return;
    if (!connectSource) {
      setConnectSource(nodeId);
      return;
    }
    connectNodes(connectSource, nodeId);
    setConnectSource(null);
  }, [connectMode, connectNodes, connectSource]);

  const runAgent = useCallback(async (nodeId) => {
    const runningController = agentAbortRefs.current.get(nodeId);
    if (runningController) {
      runningController.abort();
      agentAbortRefs.current.delete(nodeId);
      updateNode(nodeId, { data: { runStatus: 'idle', runError: '' } });
      setAgentRuns((current) => ({ ...current, [nodeId]: { ...current[nodeId], status: 'idle' } }));
      return;
    }

    const agent = nodesRef.current.find((node) => node.id === nodeId);
    if (!agent) return;
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const incomingFiles = currentEdges
      .filter((edge) => edge.target === nodeId && (edge.targetHandle === 'files' || !edge.targetHandle))
      .map((edge) => currentNodes.find((node) => node.id === edge.source))
      .filter((node) => node?.type === 'file')
      .flatMap((node) => Array.isArray(node.data?.files) ? node.data.files : []);
    const outputFileNodes = currentEdges
      .filter((edge) => edge.source === nodeId && ['output', 'bottom', undefined].includes(edge.sourceHandle))
      .map((edge) => currentNodes.find((node) => node.id === edge.target))
      .filter((node) => node?.type === 'file');

    let instruction = agent.data?.prompt || '';
    if (outputFileNodes.length) {
      const targetFiles = outputFileNodes.flatMap((node) => Array.isArray(node.data?.files) ? node.data.files : []);
      instruction = `Você é um agente que edita arquivos.\n\nARQUIVOS:\n${targetFiles.map((file) => `ARQUIVO: ${file.fileName}\n\n${file.fileContent || ''}`).join('\n\n')}\n\nPEDIDO:\n${instruction}\n\nResponda SOMENTE com JSON no formato {"fileOperations":[{"action":"update","fileName":"nome exato","content":"arquivo completo"}],"message":"resumo curto"}. Atualize/crie apenas arquivos conectados ao nó. Para remover, use action "delete". Sem pseudocódigo e sem blocos markdown.`;
    }
    const fileContext = incomingFiles.length
      ? `ARQUIVOS DE CONTEXTO:\n${incomingFiles.map((file) => `\n### ${file.fileName}\n${String(file.fileContent || '').slice(0, 100000)}`).join('\n')}\n\n` : '';
    const prompt = `${fileContext}${instruction}`.trim();
    if (!prompt) {
      setAgentRuns((current) => ({ ...current, [nodeId]: { status: 'error', output: '', error: 'Descreva primeiro a tarefa deste agente.' } }));
      return;
    }

    const controller = new AbortController();
    agentAbortRefs.current.set(nodeId, controller);
    updateNode(nodeId, { data: { runStatus: 'running', runError: '', output: '' } });
    setAgentRuns((current) => ({ ...current, [nodeId]: { status: 'running', output: '', error: '' } }));
    try {
      await loadIP();
      const response = await fetch(`${aiUrl()}/api/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      const resultBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(resultBody?.error || `Erro HTTP ${response.status}.`);
      const result = resultBody?.response;
      if (typeof result !== 'string' || !result.trim()) throw new Error('O modelo não retornou uma resposta.');
      if (controller.signal.aborted) return;

      updateNode(nodeId, { data: { output: result, runStatus: 'idle', runError: '' } });
      let displayOutput = result;
      if (outputFileNodes.length) {
        const parsed = extractFileOperations(result);
        if (!parsed || !Array.isArray(parsed.fileOperations)) {
          throw new Error('O agente não retornou operações de arquivo em JSON válido.');
        }
        for (const fileNode of outputFileNodes) {
          const files = Array.isArray(fileNode.data?.files) ? fileNode.data.files : [];
          const updatedFiles = applyAgentFileOperations(files, parsed.fileOperations);
          updateNode(fileNode.id, { data: { files: updatedFiles } });
          for (const operation of parsed.fileOperations) {
            if (!['create', 'update'].includes(operation.action) || typeof operation.content !== 'string') continue;
            const original = files.find((file) => file.fileName === operation.fileName);
            if (!original?.filePath) continue;
            try {
              await sheets.saveWorkspaceFile(original.filePath, operation.content);
            } catch (writeError) {
              console.warn('Não foi possível gravar o arquivo conectado:', writeError?.message);
            }
          }
        }
        displayOutput = parsed.message || `${parsed.fileOperations.length} operação(ões) de arquivo aplicada(s).`;
      }
      setAgentRuns((current) => ({ ...current, [nodeId]: { status: 'idle', output: displayOutput, error: '' } }));
    } catch (requestError) {
      if (requestError?.name === 'AbortError') {
        updateNode(nodeId, { data: { runStatus: 'idle', runError: '' } });
        setAgentRuns((current) => ({ ...current, [nodeId]: { ...current[nodeId], status: 'idle' } }));
      } else {
        updateNode(nodeId, { data: { runStatus: 'error', runError: requestError?.message || 'Falha ao executar o agente.' } });
        setAgentRuns((current) => ({ ...current, [nodeId]: { status: 'error', output: '', error: requestError?.message || 'Falha ao executar o agente.' } }));
      }
    } finally {
      if (agentAbortRefs.current.get(nodeId) === controller) agentAbortRefs.current.delete(nodeId);
    }
  }, [updateNode]);

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
    let startPan = { x: 0, y: 0 };
    const distance = (touches) => touches.length < 2 ? 0 : Math.hypot(
      touches[0].pageX - touches[1].pageX,
      touches[0].pageY - touches[1].pageY,
    );
    return PanResponder.create({
      onStartShouldSetPanResponder: (event) => (event.nativeEvent.touches || []).length > 1,
      onMoveShouldSetPanResponder: (event) => (event.nativeEvent.touches || []).length > 1,
      onPanResponderGrant: (event) => {
        startDistance = distance(event.nativeEvent.touches || []);
        startZoom = zoomRef.current;
        startPan = panRef.current;
      },
      onPanResponderMove: (event, gesture) => {
        const nextDistance = distance(event.nativeEvent.touches || []);
        if (startDistance) {
          const nextZoom = Math.max(0.2, Math.min(2, startZoom * nextDistance / startDistance));
          const centerX = (viewport.width || 360) / 2;
          const centerY = (viewport.height || 500) / 2;
          const worldX = (centerX - startPan.x) / startZoom;
          const worldY = (centerY - startPan.y) / startZoom;
          zoomRef.current = nextZoom;
          setZoom(zoomRef.current);
          const nextPan = {
            x: centerX - worldX * nextZoom + gesture.dx,
            y: centerY - worldY * nextZoom + gesture.dy,
          };
          panRef.current = nextPan;
          setPan(nextPan);
        }
      },
    });
  }, [viewport.height, viewport.width]);

  const canvasPanResponder = useMemo(() => {
    let startPan = { x: 0, y: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (event, gesture) => (event.nativeEvent.touches || []).length < 2
        && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => { startPan = panRef.current; },
      onPanResponderMove: (_, gesture) => {
        const nextPan = { x: startPan.x + gesture.dx, y: startPan.y + gesture.dy };
        panRef.current = nextPan;
        setPan(nextPan);
      },
    });
  }, []);

  const nodePositions = useMemo(() => new Map(nodes.map((node, index) => {
    const position = node.position || { x: 100, y: 100 + index * 340 };
    return [node.id, { x: CANVAS_PADDING + position.x, y: CANVAS_PADDING + position.y }];
  })), [nodes]);

  function adjustZoom(delta) {
    const oldZoom = zoomRef.current;
    const nextZoom = Math.max(0.2, Math.min(2, oldZoom + delta));
    const centerX = (viewport.width || 360) / 2;
    const centerY = (viewport.height || 500) / 2;
    const nextPan = {
      x: centerX - ((centerX - panRef.current.x) / oldZoom) * nextZoom,
      y: centerY - ((centerY - panRef.current.y) / oldZoom) * nextZoom,
    };
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
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
        <ToolButton Icon={MousePointer2} label={connectMode ? 'Cancelar conexão' : 'Selecionar / conectar'} active={connectMode} onPress={() => { setConnectMode((current) => !current); setConnectSource(null); }} />
        <ToolButton Icon={SquareTerminal} label="Terminal" onPress={() => addNode('terminal')} />
        <ToolButton Icon={Bot} label="Agent" onPress={() => addNode('agent')} />
        <ToolButton Icon={Paperclip} label="File" onPress={() => addNode('file')} />
        <ToolButton Icon={CaseSensitive} label="Text" onPress={() => addNode('text')} />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {connectMode ? <Text style={styles.connectHint}>{connectSource ? 'Escolha o destino. Repetir uma conexão existente a remove.' : 'Toque no ícone de conexão do nó de origem.'}</Text> : null}

      <View
        style={styles.viewport}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setViewport((current) => current.width === width && current.height === height ? current : { width, height });
          if (nodesRef.current.length) frameCanvas(nodesRef.current, { width, height });
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
          <View style={[styles.panLayer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}>
            <View style={[styles.canvas, { transform: [{ scale: zoom }] }]}>
              <View style={styles.canvasPanSurface} {...canvasPanResponder.panHandlers} />
              {edges.map((edge) => {
                const source = nodePositions.get(edge.source);
                const target = nodePositions.get(edge.target);
                return source && target ? (
                  <WorkflowEdge
                    key={edge.id || `${edge.source}-${edge.target}`}
                    edge={edge}
                    sourceX={source.x}
                    sourceY={source.y}
                    targetX={target.x}
                    targetY={target.y}
                  />
                ) : null;
              })}
              {nodes.map((node, index) => (
                <WorkflowNodeCard
                  key={node.id}
                  node={node}
                  fallbackIndex={index}
                  zoomRef={zoomRef}
                  onUpdate={updateNode}
                  onDelete={deleteNode}
                  connectMode={connectMode}
                  selectedForConnection={connectSource === node.id}
                  onLink={handleNodeLink}
                  agentRun={agentRuns[node.id]}
                  terminalRun={terminalRuns[node.id]}
                  setTerminalRun={(run) => setTerminalRuns((current) => ({ ...current, [node.id]: run }))}
                  desktopOnline={desktopOnline}
                  hasFileInput={edges.some((edge) => edge.target === node.id && edge.targetHandle === 'files')}
                  hasFileOutput={edges.some((edge) => edge.source === node.id && ['output', 'bottom'].includes(edge.sourceHandle))}
                  onRunAgent={runAgent}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(0.15)} accessibilityLabel="Aumentar zoom"><Feather name="plus" size={19} color={colors.text} /></TouchableOpacity>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(-0.15)} accessibilityLabel="Diminuir zoom"><Feather name="minus" size={19} color={colors.text} /></TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={() => frameCanvas()} accessibilityLabel="Enquadrar workflow"><Feather name="maximize-2" size={15} color={colors.text} /></TouchableOpacity>
        </View>
        <Text style={styles.gestureHint}>Arraste o fundo para mover · pinça para zoom · cabeçalho para mover nós</Text>
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

function ToolButton({ Icon, label, onPress, active = false }) {
  return (
    <TouchableOpacity style={[styles.toolButton, active && styles.toolButtonActive]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={18} color={active ? '#a78bfa' : '#e4e4e7'} strokeWidth={2} />
    </TouchableOpacity>
  );
}

function WorkflowEdge({ sourceX, sourceY, targetX, targetY }) {
  const startX = sourceX + 250;
  const startY = sourceY + 150;
  const endX = targetX + 250;
  const endY = targetY + 150;
  const padding = 12;
  const left = Math.min(startX, endX) - padding;
  const top = Math.min(startY, endY) - padding;
  const width = Math.max(24, Math.abs(endX - startX) + padding * 2);
  const height = Math.max(24, Math.abs(endY - startY) + padding * 2);
  const sx = startX - left;
  const sy = startY - top;
  const tx = endX - left;
  const ty = endY - top;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left, top }} pointerEvents="none">
      <Path d={`M ${sx} ${sy} C ${sx + (tx - sx) * 0.4} ${sy}, ${tx - (tx - sx) * 0.4} ${ty}, ${tx} ${ty}`} stroke="#8b5cf6" strokeWidth={5} fill="none" />
    </Svg>
  );
}

const WorkflowNodeCard = React.memo(function WorkflowNodeCard({ node, fallbackIndex, zoomRef, onUpdate, onDelete, connectMode, selectedForConnection, onLink, agentRun, terminalRun, setTerminalRun, desktopOnline, hasFileInput, hasFileOutput, onRunAgent }) {
  const start = useRef(node.position || { x: 0, y: 0 });
  const currentPosition = useRef(node.position || { x: 0, y: 0 });
  const nodePosition = node.position || { x: 100, y: 100 + fallbackIndex * 340 };
  currentPosition.current = nodePosition;
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { start.current = currentPosition.current; },
    onPanResponderMove: (_, gesture) => onUpdate(node.id, {
      position: { x: start.current.x + gesture.dx / zoomRef.current, y: start.current.y + gesture.dy / zoomRef.current },
    }),
  }), [node.id, onUpdate, zoomRef]);

  const type = String(node.type || '').toLowerCase();
  const label = nodeDisplayName(node);
  const textStyle = type === 'terminal' ? styles.terminalText : styles.nodeText;
  const files = Array.isArray(node.data?.files) ? node.data.files : [];
  const agentOutput = node.data?.output || agentRun?.output || '';
  const agentError = node.data?.runError || agentRun?.error || '';
  const agentStatus = node.data?.runStatus || agentRun?.status || 'idle';
  const modelValue = node.data?.model || AGENT_MODELS[0].value;
  const modelLabel = AGENT_MODELS.find((item) => item.value === modelValue)?.label || modelValue;
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  function updateFile(index, patch) {
    onUpdate(node.id, {
      data: { files: files.map((file, fileIndex) => fileIndex === index ? { ...file, ...patch } : file) },
    });
  }

  function formatFileSize(bytes = 0) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled) return;
      const selectedFiles = await Promise.all((result.assets || []).map(async (asset) => {
        let fileContent = '';
        try {
          fileContent = await FileSystem.readAsStringAsync(asset.uri);
        } catch {
          fileContent = '[Arquivo não textual ou não foi possível ler o conteúdo.]';
        }
        return {
          fileName: asset.name || 'sem-nome',
          fileContent,
          fileSize: asset.size || 0,
          fileType: asset.mimeType || 'text/plain',
        };
      }));
      onUpdate(node.id, { data: { files: [...files, ...selectedFiles], fileError: '' } });
    } catch (pickError) {
      onUpdate(node.id, { data: { fileError: pickError?.message || 'Não foi possível selecionar o arquivo.' } });
    }
  }

  async function executeTerminalCommand() {
    const command = node.data?.terminalCommand?.trim();
    if (!command || terminalRun?.running) return;
    setTerminalRun({ running: true, error: '' });
    onUpdate(node.id, { data: { terminalCommand: '', terminalStatus: 'running' } });
    try {
      const response = await sheets.executeCommand(command, 30000);
      const result = response?.data || {};
      const output = [result.stdout, result.stderr && `ERRO:\n${result.stderr}`, `\n[exit ${result.exit_code ?? '?'}]`].filter(Boolean).join('\n');
      const previous = node.data?.terminalContent || '';
      onUpdate(node.id, { data: { terminalContent: `${previous}${previous ? '\n' : ''}> ${command}\n${output}`, terminalStatus: 'idle' } });
      setTerminalRun({ running: false, error: '' });
    } catch (runError) {
      onUpdate(node.id, { data: { terminalStatus: 'error' } });
      setTerminalRun({ running: false, error: runError?.response?.data?.error?.message || runError.message || 'Falha ao executar comando.' });
    }
  }

  return (
    <View style={[styles.nodeCard, type === 'agent' && styles.agentNodeCard, type === 'file' && styles.fileNodeCard, type === 'text' && styles.textNodeCard, { left: CANVAS_PADDING + nodePosition.x, top: CANVAS_PADDING + nodePosition.y }]}>
      {type !== 'text' ? (
      <View style={[styles.nodeHeader, type === 'agent' && styles.agentNodeHeader, type === 'file' && styles.fileNodeHeader]} {...panResponder.panHandlers}>
        {type === 'agent' ? (
          <>
            <Bot size={15} color="#71717a" />
            <TextInput
              value={node.data?.label || 'Agent'}
              onChangeText={(labelText) => onUpdate(node.id, { data: { label: labelText } })}
              style={styles.agentTitleInput}
              selectTextOnFocus
              accessibilityLabel="Nome do agente"
            />
            <View style={styles.agentStatus}>
              <View style={[styles.agentStatusDot, { backgroundColor: agentStatus === 'running' ? '#f59e0b' : agentStatus === 'error' || !desktopOnline ? '#ef4444' : '#10b981' }]} />
              <Text style={[styles.agentStatusText, agentStatus === 'running' && styles.agentRunningText]}>
                {agentStatus === 'running' ? 'executando...' : agentStatus === 'error' ? 'erro' : desktopOnline ? 'online' : 'offline'}
              </Text>
            </View>
            {hasFileInput ? <Text style={styles.agentFileBadge}>lendo arquivos</Text> : null}
            {hasFileOutput ? <Text style={styles.agentOutputBadge}>pode editar arquivos</Text> : null}
          </>
        ) : type === 'file' ? (
          <>
            <View style={styles.fileNodeHeading}>
              <Feather name="file-text" size={15} color="#71717a" />
              <Text style={styles.fileNodeTitle}>{label || 'Arquivos'}</Text>
              {files.length > 0 ? (
                <View style={styles.fileCountBadge}><Text style={styles.fileCountText}>{files.length}</Text></View>
              ) : null}
            </View>
            <Feather name="more-vertical" size={15} color="#52525b" />
          </>
        ) : (
          <>
            <View style={styles.windowDots}>
              <View style={[styles.dot, { backgroundColor: '#ff6259' }]} />
              <View style={[styles.dot, { backgroundColor: '#ffbd2e' }]} />
              <View style={[styles.dot, { backgroundColor: '#28c840' }]} />
            </View>
            <Text style={styles.nodeTitle} numberOfLines={1}>{label}</Text>
          </>
        )}
        {connectMode ? (
          <TouchableOpacity style={styles.linkButton} onPress={() => onLink(node.id)} accessibilityLabel={`Selecionar conexão de ${label}`}>
            <Feather name="link-2" size={15} color={selectedForConnection ? colors.purple : '#77737c'} />
          </TouchableOpacity>
        ) : null}
        {type !== 'file' ? (
          <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(node.id)} accessibilityLabel={`Excluir ${label}`}>
            <Feather name="x" size={16} color="#77737c" />
          </TouchableOpacity>
        ) : null}
      </View>
      ) : null}
      {type === 'file' ? (
        <>
          <View style={[styles.filePortDot, styles.filePortLeft]} />
          <View style={[styles.filePortDot, styles.filePortRight]} />
        </>
      ) : null}
      {type === 'text' ? (
        <View style={styles.textNodeBody} {...panResponder.panHandlers}>
          <TextInput
            value={node.data?.text || ''}
            onChangeText={(text) => onUpdate(node.id, { data: { text } })}
            placeholder="Digite..."
            placeholderTextColor="#71717a"
            multiline
            style={styles.workflowTextInput}
            textAlign="center"
            textAlignVertical="center"
          />
        </View>
      ) : type === 'terminal' ? (
        <View style={styles.terminalBody}>
          <TextInput
            value={node.data?.label || ''}
            onChangeText={(labelText) => onUpdate(node.id, { data: { label: labelText } })}
            placeholder="Nome do terminal"
            placeholderTextColor="#71717a"
            style={styles.terminalLabelInput}
          />
          <TextInput
            value={node.data?.terminalContent || ''}
            onChangeText={(terminalContent) => onUpdate(node.id, { data: { terminalContent } })}
            placeholder="A saída do terminal aparecerá aqui..."
            placeholderTextColor="#52525b"
            multiline
            style={styles.terminalEditor}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {terminalRun?.error ? <Text style={styles.agentError}>{terminalRun.error}</Text> : null}
          <View style={styles.terminalCommandRow}>
            <TextInput
              value={node.data?.terminalCommand || ''}
              onChangeText={(terminalCommand) => onUpdate(node.id, { data: { terminalCommand } })}
              placeholder="Digite um comando..."
              placeholderTextColor="#71717a"
              style={styles.terminalCommandInput}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={executeTerminalCommand}
              returnKeyType="go"
            />
            <TouchableOpacity style={styles.terminalRunButton} onPress={executeTerminalCommand} disabled={terminalRun?.running}>
              {terminalRun?.running ? <ActivityIndicator size="small" color="#c4b5fd" /> : <Feather name="play" size={15} color="#c4b5fd" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.terminalSafetyHint}>Executado no desktop conectado · limite de segurança da API</Text>
        </View>
      ) : type === 'agent' ? (
        <View style={styles.agentNodeBody}>
          <TextInput
            value={node.data?.prompt || ''}
            onChangeText={(prompt) => onUpdate(node.id, { data: { prompt } })}
            placeholder="Descreva o que este agente deve fazer..."
            placeholderTextColor="#52525b"
            multiline
            style={styles.agentPromptInput}
            textAlignVertical="top"
          />
          {agentError ? <Text style={styles.agentError}>{agentError}</Text> : null}
          {(agentOutput || agentStatus === 'running') ? (
            <View style={styles.agentOutputPanel}>
              {agentStatus === 'running' && !agentOutput ? (
                <View style={styles.agentWaiting}><ActivityIndicator size="small" color={colors.purple} /><Text style={styles.agentWaitingText}>Aguardando resposta...</Text></View>
              ) : <Text style={styles.agentOutputText} selectable>{agentOutput}</Text>}
            </View>
          ) : null}
          <View style={styles.agentFooter}>
            <View style={styles.agentModelGroup}>
              <Text style={styles.agentModelLabel}>modelo</Text>
              <TouchableOpacity style={styles.agentModelButton} onPress={() => setModelPickerOpen(true)} disabled={agentStatus === 'running'}>
                <Text style={styles.agentModelButtonText} numberOfLines={1}>{modelLabel}</Text>
                <Feather name="chevron-down" size={14} color="#d4d4d8" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.runButton, agentStatus === 'running' && styles.stopButton]}
              onPress={() => onRunAgent(node.id)}
              accessibilityLabel={agentStatus === 'running' ? 'Parar agente' : 'Executar agente'}
            >
              <Feather name={agentStatus === 'running' ? 'square' : 'play'} size={12} color={agentStatus === 'running' ? '#f87171' : '#c4b5fd'} />
              <Text style={[styles.runButtonText, agentStatus === 'running' && styles.stopButtonText]}>{agentStatus === 'running' ? 'Parar' : 'Run'}</Text>
            </TouchableOpacity>
          </View>
          <Modal visible={modelPickerOpen} transparent animationType="fade" onRequestClose={() => setModelPickerOpen(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.workflowPicker}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Selecionar modelo</Text>
                  <TouchableOpacity onPress={() => setModelPickerOpen(false)}><Feather name="x" size={20} color={colors.muted} /></TouchableOpacity>
                </View>
                {AGENT_MODELS.map((model) => (
                  <TouchableOpacity
                    key={model.value}
                    style={styles.workflowOption}
                    onPress={() => { onUpdate(node.id, { data: { model: model.value } }); setModelPickerOpen(false); }}
                  >
                    <Text style={styles.optionText}>{model.label}</Text>
                    {model.value === modelValue ? <Feather name="check" size={17} color={colors.purple} /> : null}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Modal>
        </View>
      ) : (
      <View style={[styles.nodeBody, type === 'file' && styles.fileNodeBody]}>
        {type !== 'file' ? (
          <TextInput
            value={node.data?.label || ''}
            onChangeText={(labelText) => onUpdate(node.id, { data: { label: labelText } })}
            placeholder="Nome do nó"
            placeholderTextColor={colors.muted}
            style={styles.labelInput}
            selectTextOnFocus
          />
        ) : null}
        {type === 'file' ? (
          <View style={styles.fileNodeContent}>
            <TouchableOpacity style={styles.fileDropzone} onPress={pickFiles} activeOpacity={0.75}>
              <Feather name="upload" size={20} color="#52525b" />
              <Text style={styles.fileDropzoneText}>Clique para selecionar arquivo</Text>
            </TouchableOpacity>
            {node.data?.fileError ? <Text style={styles.agentError}>{node.data.fileError}</Text> : null}
            {files.map((file, index) => (
              <View key={`${file.fileName}-${index}`} style={styles.fileCard}>
                <View style={styles.fileCardHeader}>
                  <Feather name="file-text" size={13} color="#71717a" />
                  <TextInput
                    value={file.fileName || ''}
                    onChangeText={(fileName) => updateFile(index, { fileName })}
                    placeholder="Nome do arquivo"
                    placeholderTextColor={colors.muted}
                    style={styles.fileNameInput}
                    autoCapitalize="none"
                    numberOfLines={1}
                  />
                  <Text style={styles.fileSizeText}>{formatFileSize(file.fileSize)}</Text>
                  <TouchableOpacity
                    style={styles.removeFileButton}
                    onPress={() => onUpdate(node.id, { data: { files: files.filter((_, fileIndex) => fileIndex !== index) } })}
                    accessibilityLabel={`Remover ${file.fileName || 'arquivo'}`}
                  >
                    <Feather name="x" size={13} color="#71717a" />
                  </TouchableOpacity>
                </View>
                <View style={styles.fileContentPreview}>
                  <TextInput
                    value={file.fileContent || ''}
                    onChangeText={(fileContent) => updateFile(index, { fileContent, fileSize: fileContent.length })}
                    placeholder="Arquivo vazio"
                    placeholderTextColor="#71717a"
                    multiline
                    style={styles.fileContentInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textAlignVertical="top"
                  />
                </View>
              </View>
            ))}
            <View style={styles.fileNodeFooter}>
              <Text style={styles.fileFooterCount}>{files.length} arquivo{files.length !== 1 ? 's' : ''}</Text>
              <Text style={styles.fileFooterDot}>•</Text>
              <Text style={styles.fileFooterPort}>files →</Text>
            </View>
          </View>
        ) : (
          <Text style={textStyle} selectable>{node.data?.text || node.data?.content || ''}</Text>
        )}
      </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerIcon: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  workflowSelect: { flex: 1, paddingHorizontal: 6 },
  eyebrow: { color: colors.muted, fontSize: 9, letterSpacing: 1.1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', maxWidth: '90%' },
  toolbar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, alignSelf: 'center', paddingHorizontal: 10, marginTop: 9, borderRadius: 28, borderWidth: 1, borderColor: '#303036', backgroundColor: '#141414', elevation: 8 },
  toolButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  toolButtonActive: { backgroundColor: '#8b5cf622' },
  errorText: { color: '#fca5a5', fontSize: 11, paddingHorizontal: 14, paddingTop: 6 },
  connectHint: { color: colors.purple, fontSize: 11, textAlign: 'center', paddingVertical: 5 },
  viewport: { flex: 1, marginTop: 8, overflow: 'hidden', backgroundColor: '#171619' },
  panLayer: { position: 'absolute', left: 0, top: 0, width: 6000, height: 6000 },
  canvas: { position: 'absolute', left: 0, top: 0, width: 6000, height: 6000, transformOrigin: 'top left' },
  canvasPanSurface: { ...StyleSheet.absoluteFillObject, width: 6000, height: 6000 },
  emptyState: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  nodeCard: { position: 'absolute', width: CARD_WIDTH, minHeight: CARD_HEIGHT, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#38363b', backgroundColor: colors.panel, elevation: 8 },
  agentNodeCard: { width: 520, backgroundColor: '#151515', borderRadius: 24, borderColor: '#27272a' },
  fileNodeCard: { width: 360, minHeight: 0, backgroundColor: '#151515', borderRadius: 22, borderColor: '#27272a' },
  textNodeCard: { width: 180, minHeight: 90, overflow: 'visible', borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', elevation: 0 },
  nodeHeader: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: '#f3f3f3' },
  agentNodeHeader: { height: 62, justifyContent: 'flex-start', gap: 10, paddingHorizontal: 18, backgroundColor: '#151515', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  fileNodeHeader: { height: 58, paddingHorizontal: 17, backgroundColor: '#151515', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  filePortDot: { position: 'absolute', zIndex: 2, top: '50%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#8b5cf6' },
  filePortLeft: { left: -4 },
  filePortRight: { right: -4 },
  fileNodeHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileNodeTitle: { color: '#e4e4e7', fontSize: 13, fontWeight: '600' },
  fileCountBadge: { minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#8b5cf633', paddingHorizontal: 7 },
  fileCountText: { color: '#a78bfa', fontSize: 10, fontWeight: '600' },
  windowDots: { width: 55, flexDirection: 'row', gap: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  nodeTitle: { flex: 1, color: '#4b4b4b', textAlign: 'center', fontSize: 15, fontWeight: '600' },
  agentTitleInput: { color: '#e4e4e7', fontSize: 14, fontWeight: '600', minWidth: 44, maxWidth: 90, padding: 0 },
  agentStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agentStatusDot: { width: 8, height: 8, borderRadius: 4 },
  agentStatusText: { color: '#71717a', fontSize: 11 },
  agentRunningText: { color: '#fbbf24' },
  agentFileBadge: { color: '#a78bfa', fontSize: 9, backgroundColor: '#8b5cf622', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  agentOutputBadge: { color: '#34d399', fontSize: 9, backgroundColor: '#10b9811a', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8 },
  linkButton: { width: 26, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  nodeBody: { minHeight: 250, padding: 18, backgroundColor: '#242326' },
  fileNodeBody: { minHeight: 0, padding: 0, backgroundColor: '#151515' },
  textNodeBody: { width: 180, height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  workflowTextInput: { width: 180, height: 90, color: '#e4e4e7', fontSize: 13, lineHeight: 19, padding: 0, backgroundColor: 'transparent' },
  fileNodeContent: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 11 },
  fileDropzone: { height: 108, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#303036', borderRadius: 15, backgroundColor: '#161617' },
  fileDropzoneText: { color: '#71717a', fontSize: 12 },
  fileCard: { overflow: 'hidden', marginTop: 15, borderWidth: 1, borderColor: '#303036', borderRadius: 17, backgroundColor: '#111112' },
  fileCardHeader: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12 },
  fileNameInput: { flex: 1, minWidth: 0, color: '#d4d4d8', fontSize: 12, paddingVertical: 5 },
  fileSizeText: { color: '#52525b', fontSize: 10 },
  removeFileButton: { width: 23, height: 28, alignItems: 'center', justifyContent: 'center' },
  fileContentPreview: { borderTopWidth: 1, borderTopColor: '#27272a', paddingHorizontal: 12, paddingVertical: 9 },
  fileNodeFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 18, paddingBottom: 1 },
  fileFooterCount: { color: '#52525b', fontSize: 10 },
  fileFooterDot: { color: '#3f3f46', fontSize: 10 },
  fileFooterPort: { color: '#8b5cf6', fontSize: 10 },
  agentNodeBody: { minHeight: 188, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 12, backgroundColor: '#151515' },
  agentPromptInput: { minHeight: 82, color: '#e4e4e7', fontSize: 14, lineHeight: 21, padding: 0 },
  agentError: { color: '#f87171', fontSize: 11, lineHeight: 16, marginTop: 8 },
  agentOutputPanel: { maxHeight: 190, borderTopWidth: 1, borderTopColor: '#27272a', marginTop: 8, paddingTop: 10 },
  agentOutputText: { color: '#d4d4d8', fontSize: 11, lineHeight: 16, fontFamily: 'monospace' },
  agentWaiting: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  agentWaitingText: { color: '#71717a', fontSize: 11 },
  agentFooter: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  agentModelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 },
  agentModelLabel: { color: '#71717a', fontSize: 10 },
  agentModelButton: { maxWidth: 220, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#303036', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#1b1b1e' },
  agentModelButtonText: { color: '#e4e4e7', fontSize: 11, flexShrink: 1 },
  runButton: { minWidth: 72, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginLeft: 10, borderRadius: 13, paddingHorizontal: 12, backgroundColor: '#8b5cf633' },
  runButtonText: { color: '#c4b5fd', fontSize: 12, fontWeight: '600' },
  stopButton: { backgroundColor: '#ef444422' },
  stopButtonText: { color: '#f87171' },
  terminalText: { color: '#f0eff2', fontSize: 15, lineHeight: 22, fontFamily: 'monospace' },
  terminalBody: { minHeight: 270, padding: 14, backgroundColor: '#0c0c0e' },
  terminalLabelInput: { minHeight: 34, color: '#e4e4e7', fontSize: 12, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: '#27272a', marginBottom: 8, paddingVertical: 4 },
  terminalEditor: { minHeight: 130, maxHeight: 220, color: '#d4d4d8', fontSize: 11, lineHeight: 16, fontFamily: 'monospace', textAlignVertical: 'top', padding: 8, backgroundColor: '#101012', borderRadius: 8 },
  terminalCommandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  terminalCommandInput: { flex: 1, minHeight: 40, color: '#e4e4e7', fontSize: 12, fontFamily: 'monospace', borderWidth: 1, borderColor: '#303036', borderRadius: 8, paddingHorizontal: 10 },
  terminalRunButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#8b5cf633' },
  terminalSafetyHint: { color: '#52525b', fontSize: 9, marginTop: 7 },
  nodeText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  labelInput: { minHeight: 38, color: colors.text, fontSize: 14, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12, paddingVertical: 6 },
  modelInput: { minHeight: 38, color: colors.text, fontSize: 13, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12, paddingVertical: 6 },
  fileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileNameInput: { flex: 1, minWidth: 0, color: '#d4d4d8', fontSize: 12, paddingVertical: 5 },
  fileContentInput: { minHeight: 34, maxHeight: 170, color: '#a1a1aa', fontSize: 11, lineHeight: 17, fontFamily: 'monospace', padding: 0 },
  addFileButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addFileText: { color: colors.purple, fontSize: 12 },
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
