import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Bot, CaseSensitive, GripVertical, MousePointer2, Paperclip, Play, Square, SquareTerminal, Workflow } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readTextFile } from '../services/attachments';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Marker, Path } from 'react-native-svg';
import { useNavbarSpace } from '../components/Navbar';
import sheets from '../services/api';
import { executeDesktopCommand } from '../services/desktopModels';
import { aiUrl, loadIP } from '../services/serverConfig';
import { createThemedStyles, useThemeColor, ACCENTS } from '../theme';
import { runWorkflow } from '../workflow/runWorkflow';
import { getAgentFileNodes } from '../workflow/nodeContext';
import { runAgentRounds } from '../workflow/runAgentRounds';
import { formatAgentOutput } from '../workflow/agentFiles';

const colors = {
  background: '#0d0d0d',
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

function newId() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nodeDisplayName(node) {
  return node.data?.label || node.name || node.type || 'Node';
}

export default function WorkflowScreen({ navigation, route }) {
  const navbarSpace = useNavbarSpace();
  const styles = useStyles();
  const themeColor = useThemeColor();
  const [workflows, setWorkflows] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [nodeSizes, setNodeSizes] = useState({});
  const [agentRuns, setAgentRuns] = useState({});
  const [terminalRuns, setTerminalRuns] = useState({});
  const [desktopOnline, setDesktopOnline] = useState(false);
  const [desktopModels, setDesktopModels] = useState([]);
  const [activeModelName, setActiveModelName] = useState(null);
  const [chainRunning, setChainRunning] = useState(false);
  const [chainEvents, setChainEvents] = useState([]);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
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
  const chainAbortRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const saveRetryTimerRef = useRef(null);

  // Quando o teclado cobre o campo em foco (nome de agente, texto de um nó),
  // desliza o canvas para cima e devolve ao lugar quando o teclado fecha.
  useEffect(() => {
    let keyboardShift = 0;

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      if (!navigation.isFocused()) return;
      const input = TextInput.State.currentlyFocusedInput();
      if (!input?.measureInWindow) return;
      input.measureInWindow((x, y, width, height) => {
        const overlap = y + height + 16 - event.endCoordinates.screenY;
        if (overlap <= 0) return;
        keyboardShift = overlap;
        const nextPan = { x: panRef.current.x, y: panRef.current.y - overlap };
        panRef.current = nextPan;
        setPan(nextPan);
      });
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      if (!keyboardShift) return;
      const nextPan = { x: panRef.current.x, y: panRef.current.y + keyboardShift };
      keyboardShift = 0;
      panRef.current = nextPan;
      setPan(nextPan);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
      if (!status?.online) {
        setDesktopModels([]);
        setActiveModelName(null);
        return;
      }
      if (status?.activeModelName) setActiveModelName(status.activeModelName);
      const modelsResponse = await fetch(`${aiUrl()}/api/models`);
      if (!modelsResponse.ok) return;
      const modelsBody = await modelsResponse.json();
      if (Array.isArray(modelsBody?.installed)) setDesktopModels(modelsBody.installed);
      if (modelsBody?.activeModelName) setActiveModelName(modelsBody.activeModelName);
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
    const agentToAgent = sourceNode?.type === 'agent' && targetNode?.type === 'agent';
    const sourceHandle = sourceNode?.type === 'file'
      ? 'files'
      : agentToAgent ? 'agent-out' : sourceNode?.type === 'agent' ? 'output' : undefined;
    const targetHandle = targetNode?.type === 'agent'
      ? agentToAgent ? 'agent-in' : 'files'
      : 'input';
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

  const patchNodeData = useCallback((nodeId, partialData) => {
    const next = nodesRef.current.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, ...partialData } }
      : node);
    markCanvasChanged(next);
  }, [markCanvasChanged]);

  // Devolve o status visual dos nós quando uma execução é interrompida.
  const setNodeStatusesIdle = useCallback(() => {
    if (!nodesRef.current.some((node) => node.data?.runStatus === 'running')) return;
    const next = nodesRef.current.map((node) => node.data?.runStatus === 'running'
      ? { ...node, data: { ...node.data, runStatus: 'idle', notice: '' } }
      : node);
    markCanvasChanged(next);
  }, [markCanvasChanged]);

  const chainExecuteAgent = useCallback(async (agentId, context, signal) => {
    return runAgentRounds({
      agentId,
      getNodes: () => nodesRef.current,
      edges: edgesRef.current,
      context,
      signal,
      onUpdate: (nodeId, partialData) => {
        try { patchNodeData(nodeId, partialData); } catch {}
      },
      emit: (event) => setChainEvents((current) => [...current.slice(-49), {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toLocaleTimeString(),
        type: event.type || 'info',
        text: event.text || event.title || '',
      }]),
    });
  }, [patchNodeData]);

  // Executa "Só este" (onlyAgentId) ou o workflow inteiro a partir do primeiro
  // agente, com handoff entre agentes, igual ao desktop.
  const runChain = useCallback(async ({ onlyAgentId, startAgentId } = {}) => {
    if (chainAbortRef.current) {
      chainAbortRef.current.abort();
      return;
    }
    if (!nodesRef.current.some((node) => node.type === 'agent')) {
      setAgentRuns((current) => ({ ...current, [onlyAgentId || 'global']: { status: 'error', error: 'Adicione um agente ao workflow.' } }));
      setChainEvents([{ id: '1', time: '', type: 'error', text: 'Adicione um agente ao workflow.' }]);
      return;
    }
    try { await loadIP(); } catch {}
    if (!desktopOnline) {
      setChainEvents([{ id: '1', time: '', type: 'error', text: 'Desktop offline: abra o aplicativo no computador para executar o modelo.' }]);
      return;
    }
    const controller = new AbortController();
    chainAbortRef.current = controller;
    setChainRunning(true);
    setChainEvents([]);
    if (!onlyAgentId) {
      setAgentRuns((current) => (Object.keys(current).length
        ? Object.fromEntries(Object.entries(current).map(([id, run]) => [id, { ...run, status: run.status === 'error' ? 'idle' : run.status }]))
        : current));
      setTerminalRuns((current) => (Object.keys(current).length
        ? Object.fromEntries(Object.entries(current).map(([id, run]) => [id, { ...run, status: run.status === 'error' ? 'idle' : run.status }]))
        : current));
    }
    const push = (type, text) => setChainEvents((current) => [...current.slice(-49), {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: new Date().toLocaleTimeString(), type, text,
    }]);
    try {
      await runWorkflow({
        nodes: nodesRef.current,
        edges: edgesRef.current,
        onlyAgentId,
        startAgentId,
        executeAgent: (agentId, context, signal) => chainExecuteAgent(agentId, context, signal),
        onPlan: (ordered) => {
          push('run', onlyAgentId
            ? 'Executando agente individual.'
            : 'Plano de execucao: ' + ordered.map((node) => node.data?.label || node.id).join(' -> '));
          if (!onlyAgentId) {
            const orderedIds = ordered.map((node) => node.id);
            setAgentRuns((current) => {
              const next = { ...current };
              nodesRef.current.forEach((node) => {
                if (node.type !== 'agent') return;
                const orderIndex = orderedIds.indexOf(node.id);
                next[node.id] = orderIndex >= 0
                  ? { status: orderIndex > 0 ? 'waiting' : 'idle', output: next[node.id]?.output || '', error: '' }
                  : { status: 'skipped', output: next[node.id]?.output || '', error: '' };
              });
              return next;
            });
          }
        },
        onAgentStart: (agentId, label, index, total, received) => {
          push('start', 'Executando ' + label + (onlyAgentId ? '' : '...'));
          setAgentRuns((current) => ({ ...current, [agentId]: { status: 'running', output: current[agentId]?.output || '', error: '' } }));
          patchNodeData(agentId, { received: received || [], runError: '' });
        },
        onAgentDone: (agentId, label, result) => {
          const handoff = String(result).includes('### PARA O PROXIMO AGENTE') ? ' (handoff extraido)' : '';
          push('done', label + ' concluido' + handoff);
          patchNodeData(agentId, { runStatus: 'idle', notice: '' });
          setAgentRuns((current) => ({ ...current, [agentId]: { status: 'done', output: (result || '').slice(0, 400), error: '' } }));
        },
        onAgentError: (agentId, label, runError) => {
          push('error', label + ': ' + (runError?.message || 'falha'));
          patchNodeData(agentId, { runStatus: 'error', notice: '' });
          setAgentRuns((current) => ({ ...current, [agentId]: { status: 'error', error: runError?.message || 'Falha ao executar o agente.' } }));
        },
        signal: controller.signal,
      });
      push('complete', onlyAgentId ? 'Agente concluido.' : 'Workflow concluido.');
    } catch (runError) {
      if (runError?.name === 'AbortError' || controller.signal.aborted) {
        push('cancelled', 'Execucao interrompida.');
        setAgentRuns((current) => Object.fromEntries(Object.entries(current).map(([id, run]) => [id, run.status === 'running' || run.status === 'waiting' ? { ...run, status: 'cancelled' } : run])));
      } else if (!onlyAgentId || runError?.message !== 'Agente removido durante a execucao.') {
        push('error', runError?.message || 'Falha ao executar o workflow.');
      }
    } finally {
      chainAbortRef.current = null;
      setChainRunning(false);
      setNodeStatusesIdle();
    }
  }, [chainExecuteAgent, desktopOnline, patchNodeData, setNodeStatusesIdle]);

  const runSingleAgent = useCallback((nodeId) => {
    if (chainAbortRef.current) { chainAbortRef.current.abort(); return; }
    if (nodesRef.current.find((node) => node.id === nodeId)?.type !== 'agent') return;
    setAgentRuns((current) => ({ ...current, [nodeId]: { status: 'running', output: '', error: '' } }));
    runChain({ onlyAgentId: nodeId });
  }, [runChain]);

  const stopChain = useCallback(() => {
    chainAbortRef.current?.abort();
  }, []);

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

  const createWorkflow = useCallback(async () => {
    const name = newWorkflowName.trim();
    if (!name) return;
    try {
      const { data } = await sheets.createWorkflow({ name, description: newWorkflowDescription.trim() || name });
      const created = data?.workflow || data?.osiris || data;
      setNewWorkflowName('');
      setNewWorkflowDescription('');
      setCreatingWorkflow(false);
      setPickerOpen(false);
      if (created?.id_workflow) {
        await chooseWorkflow({ id_workflow: created.id_workflow, name: created.name });
      } else {
        await loadWorkflows();
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.error?.message || requestError.message || 'Falha ao criar o workflow.');
    }
  }, [chooseWorkflow, loadWorkflows, newWorkflowDescription, newWorkflowName]);

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

  const nodeWidths = { agent: 520, file: 360, terminal: 560, text: 180 };
  const nodeHeights = { agent: 360, file: 300, terminal: 380, text: 90 };
  const nodePositions = useMemo(() => new Map(nodes.map((node, index) => {
    const position = node.position || { x: 100, y: 100 + index * 340 };
    return [node.id, {
      x: CANVAS_PADDING + position.x,
      y: CANVAS_PADDING + position.y,
      width: nodeWidths[node.type] || 500,
      height: nodeSizes[node.id] || nodeHeights[node.type] || 300,
    }];
  })), [nodes, nodeSizes]);

  const handleNodeSize = useCallback((nodeId, height) => {
    setNodeSizes((current) => (Math.abs((current[nodeId] || 0) - height) < 2 ? current : { ...current, [nodeId]: height }));
  }, []);

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon} accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={22} color={themeColor(colors.text)} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.workflowSelect} onPress={() => setPickerOpen(true)}>
          <Text style={styles.eyebrow}>WORKFLOW · {nodes.length} NÓ(S)</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{workflow?.name || 'Workflows'}</Text>
            <Feather name="chevron-down" size={15} color={themeColor(colors.muted)} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => refreshCanvas(false)} style={styles.headerIcon} accessibilityLabel="Atualizar">
          <Feather name="refresh-cw" size={16} color={themeColor(colors.muted)} />
        </TouchableOpacity>
      </View>

      <View style={styles.toolbar}>
        <ToolButton Icon={MousePointer2} label={connectMode ? 'Cancelar conexão' : 'Selecionar / conectar'} active={connectMode} onPress={() => { setConnectMode((current) => !current); setConnectSource(null); }} />
        <ToolButton Icon={SquareTerminal} label="Terminal" color={ACCENTS.green} onPress={() => addNode('terminal')} />
        <ToolButton Icon={Bot} label="Agent" color="#a78bfa" onPress={() => addNode('agent')} />
        <ToolButton Icon={Paperclip} label="File" color={ACCENTS.blue} onPress={() => addNode('file')} />
        <ToolButton Icon={CaseSensitive} label="Text" color={ACCENTS.amber} onPress={() => addNode('text')} />
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
        {workflow && (
          <View style={[styles.execPanel, { top: 8 }]}>
            <View style={styles.execButtonsRow}>
              <TouchableOpacity
                style={[styles.execRunButton, chainRunning && styles.execButtonDisabled]}
                onPress={() => runChain()}
                disabled={chainRunning}
                accessibilityRole="button"
                accessibilityLabel="Executar workflow"
              >
                <Text style={styles.execRunButtonText}>Executar workflow</Text>
              </TouchableOpacity>
              {chainRunning && (
                <TouchableOpacity style={styles.execStopButton} onPress={stopChain} accessibilityRole="button" accessibilityLabel="Parar">
                  <Text style={styles.execStopButtonText}>Parar</Text>
                </TouchableOpacity>
              )}
              {chainEvents.length > 0 && (
                <TouchableOpacity style={styles.execToggle} onPress={() => setEventsOpen((current) => !current)} accessibilityRole="button" accessibilityLabel="Execucao">
                  <Text style={styles.execToggleText}>Execucao{eventsOpen ? '' : ` (${chainEvents.length})`}</Text>
                </TouchableOpacity>
              )}
            </View>
            {eventsOpen ? (
              <View style={styles.execEventsList}>
                {chainEvents.length === 0 ? (
                  <Text style={styles.emptyText}>Nenhuma execucao nesta sessao.</Text>
                ) : [...chainEvents].reverse().map((item) => (
                  <View key={item.id} style={styles.eventRow}>
                    {item.time ? <Text style={styles.eventTime}>{item.time}</Text> : null}
                    <Text style={[styles.eventText, item.type === 'error' || item.type === 'cancelled' ? styles.eventTextError : null, item.type === 'done' || item.type === 'complete' ? styles.eventTextDone : null]}>{item.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
        {loading ? (
          <View style={styles.emptyState}><ActivityIndicator color={themeColor(colors.purple)} /></View>
        ) : !workflow ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhum workflow ainda.</Text>
            <TouchableOpacity style={styles.emptyCreateButton} onPress={() => { setPickerOpen(true); setCreatingWorkflow(true); }}>
              <Text style={styles.emptyCreateButtonText}>Criar workflow</Text>
            </TouchableOpacity>
          </View>
        ) : nodes.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>Este workflow ainda não tem nós.</Text></View>
        ) : (
          <View style={[styles.panLayer, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}>
            <View style={[styles.canvas, { transform: [{ scale: zoom }] }]}>
              <View style={styles.canvasPanSurface} {...canvasPanResponder.panHandlers} />
              {edges.map((edge) => {
                const source = nodePositions.get(edge.source);
                const target = nodePositions.get(edge.target);
                const sourceNode = nodes.find((node) => node.id === edge.source);
                const targetNode = nodes.find((node) => node.id === edge.target);
                return source && target ? (
                  <WorkflowEdge
                    key={edge.id || `${edge.source}-${edge.target}`}
                    edge={edge}
                    sourceType={sourceNode?.type}
                    targetType={targetNode?.type}
                    sourceHandle={edge.sourceHandle}
                    targetHandle={edge.targetHandle}
                    source={source}
                    target={target}
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
                  onMeasure={handleNodeSize}
                  agentRun={agentRuns[node.id]}
                  terminalRun={terminalRuns[node.id]}
                  setTerminalRun={(run) => setTerminalRuns((current) => ({ ...current, [node.id]: run }))}
                  desktopOnline={desktopOnline}
                  desktopModels={desktopModels}
                  activeModelName={activeModelName}
                  chainRunning={chainRunning}
                  hasFileInput={getAgentFileNodes(node.id, nodes, edges).inputs.length > 0}
                  hasFileOutput={getAgentFileNodes(node.id, nodes, edges).outputs.length > 0}
                  hasTerminal={nodes.some((candidate) => candidate.type === 'terminal' && edges.some((edge) => (edge.source === node.id && edge.target === candidate.id) || (edge.target === node.id && edge.source === candidate.id)))}
                  hasAgentInput={edges.some((edge) => edge.target === node.id && nodes.some((candidate) => candidate.id === edge.source && candidate.type === 'agent'))}
                  hasAgentOutput={edges.some((edge) => edge.source === node.id && nodes.some((candidate) => candidate.id === edge.target && candidate.type === 'agent'))}
                  onStartChain={() => runChain({ startAgentId: node.id })}
                  onRunAgent={runSingleAgent}
                />
              ))}
            </View>
          </View>
        )}

        <View style={[styles.zoomControls, { bottom: 20 + navbarSpace }]}>
          <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(0.15)} accessibilityLabel="Aumentar zoom"><Feather name="plus" size={19} color={themeColor(colors.text)} /></TouchableOpacity>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(-0.15)} accessibilityLabel="Diminuir zoom"><Feather name="minus" size={19} color={themeColor(colors.text)} /></TouchableOpacity>
          <TouchableOpacity style={styles.zoomButton} onPress={() => frameCanvas()} accessibilityLabel="Enquadrar workflow"><Feather name="maximize-2" size={15} color={themeColor(colors.text)} /></TouchableOpacity>
        </View>
        <Text style={[styles.gestureHint, { bottom: 30 + navbarSpace }]}>Arraste o fundo para mover · pinça para zoom · cabeçalho para mover nós</Text>
      </View>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => { setPickerOpen(false); setCreatingWorkflow(false); setNewWorkflowName(''); setNewWorkflowDescription(''); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.workflowPicker}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{creatingWorkflow ? 'Criar workflow' : 'Selecionar workflow'}</Text>
              <TouchableOpacity onPress={() => { setPickerOpen(false); setCreatingWorkflow(false); setNewWorkflowName(''); setNewWorkflowDescription(''); }}><Feather name="x" size={20} color={themeColor(colors.muted)} /></TouchableOpacity>
            </View>
            {creatingWorkflow ? (
              <View>
                <TextInput value={newWorkflowName} onChangeText={setNewWorkflowName} placeholder="Nome do workflow" placeholderTextColor={themeColor(colors.muted)} style={styles.createNameInput} selectTextOnFocus />
                <TextInput value={newWorkflowDescription} onChangeText={setNewWorkflowDescription} placeholder="Descricao (obrigatoria no desktop)" placeholderTextColor={themeColor(colors.muted)} style={styles.createDescriptionInput} multiline selectTextOnFocus />
                <TouchableOpacity style={styles.createWorkflowButton} onPress={createWorkflow} disabled={!newWorkflowName.trim()}>
                  <Text style={[styles.emptyCreateButtonText, !newWorkflowName.trim() && styles.createWorkflowDisabled]}>Criar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backToListButton} onPress={() => setCreatingWorkflow(false)}>
                  <Text style={styles.backToListText}>Ver lista</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
              data={workflows}
              keyExtractor={(item) => String(item.id_workflow)}
              ListEmptyComponent={<Text style={styles.emptyText}>Nenhum workflow encontrado.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.workflowOption} onPress={() => chooseWorkflow(item)}>
                  <Feather name="git-branch" size={17} color={themeColor(colors.purple)} />
                  <Text style={styles.optionText} numberOfLines={1}>{item.name}</Text>
                  {String(item.id_workflow) === String(workflow?.id_workflow) ? <Feather name="check" size={17} color={themeColor(colors.purple)} /> : null}
                </TouchableOpacity>
              )}
            />
            )}
            {!creatingWorkflow ? (
              <TouchableOpacity style={styles.createWorkflowEntry} onPress={() => setCreatingWorkflow(true)}>
                <Feather name="plus" size={16} color={themeColor(colors.purple)} />
                <Text style={styles.createWorkflowEntryText}>Criar novo workflow</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ToolButton({ Icon, label, onPress, active = false, color = '#e4e4e7' }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
  return (
    <TouchableOpacity style={[styles.toolButton, active && styles.toolButtonActive]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={18} color={active ? themeColor('#a78bfa') : themeColor(color)} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// Ancla no ponto do no que corresponde ao Handle visual do desktop,
// espelhando os Handles: agente sai da base / entra no topo (cadeia),
// file e terminal ligam pelas laterais. Handles 'side-*' do canvas novo
// do desktop valem pelo proprio lado.
function workflowAnchor(nodeType, handle, rect, role) {
  const named = ['left', 'right', 'top', 'bottom'].includes(String(handle || '').replace(/^side-/, ''))
    ? String(handle).replace(/^side-/, '')
    : null;
  if (nodeType === 'agent') {
    if (role === 'source') {
      const side = named || (handle === 'agent-out' ? 'bottom' : 'right');
      return anchorAt(side, rect, 5);
    }
    const side = named || (handle === 'agent-in' ? 'top' : 'left');
    return anchorAt(side, rect, 5);
  }
  if (nodeType === 'file') {
    return anchorAt(named || (role === 'source' ? 'right' : 'left'), rect, 5);
  }
  if (nodeType === 'text') {
    return anchorAt(named || (role === 'source' ? 'right' : 'left'), rect, 0);
  }
  if (nodeType === 'terminal') {
    return anchorAt(named || (role === 'source' ? 'right' : 'left'), rect, 6);
  }
  return anchorAt(named || (role === 'source' ? 'right' : 'left'), rect, 0);
}

function anchorAt(side, rect, outset) {
  if (side === 'left') return { x: rect.x - outset, y: rect.y + rect.height / 2, side };
  if (side === 'right') return { x: rect.x + rect.width + outset, y: rect.y + rect.height / 2, side };
  if (side === 'top') return { x: rect.x + rect.width / 2, y: rect.y - outset, side };
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height + outset, side: 'bottom' };
}

// Bezier na direcao do handle: lateral expande na horizontal, top/bottom na
// vertical (mesma formula do getBezierPath do react-flow usado no desktop).
const edgeDashOffset = new Animated.Value(0);
let edgeDashLoop = null;
function ensureEdgeDashLoop() {
  if (edgeDashLoop) return;
  edgeDashLoop = Animated.loop(
    Animated.timing(edgeDashOffset, { toValue: -22, duration: 900, useNativeDriver: false }),
  );
  edgeDashLoop.start();
}
const AnimatedEdgePath = Animated.createAnimatedComponent(Path);

function WorkflowEdge({ edge, sourceType, targetType, sourceHandle, targetHandle, source, target }) {
  const themeColor = useThemeColor();
  useEffect(() => { ensureEdgeDashLoop(); }, []);
  const start = workflowAnchor(sourceType, sourceHandle, source, 'source');
  const end = workflowAnchor(targetType, targetHandle, target, 'target');
  const curvature = 0.4;
  const curveX = Math.max(60, Math.abs(end.x - start.x) * curvature);
  const curveY = Math.max(60, Math.abs(end.y - start.y) * curvature);
  const control = (point, forward) => {
    if (point.side === 'right') return { x: point.x + (forward ? curveX : -curveX), y: point.y };
    if (point.side === 'left') return { x: point.x + (forward ? -curveX : curveX), y: point.y };
    if (point.side === 'bottom') return { x: point.x, y: point.y + (forward ? curveY : -curveY) };
    return { x: point.x, y: point.y + (forward ? -curveY : curveY) };
  };
  const c1 = control(start, true);
  const c2 = control(end, false);
  const padding = 24;
  const left = Math.min(start.x, end.x, c1.x, c2.x) - padding;
  const top = Math.min(start.y, end.y, c1.y, c2.y) - padding;
  const width = Math.max(24, Math.max(start.x, end.x, c1.x, c2.x) - left + padding);
  const height = Math.max(24, Math.max(start.y, end.y, c1.y, c2.y) - top + padding);
  const sx = start.x - left;
  const sy = start.y - top;
  const tx = end.x - left;
  const ty = end.y - top;
  const c1x = c1.x - left;
  const c1y = c1.y - top;
  const c2x = c2.x - left;
  const c2y = c2.y - top;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', left, top }} pointerEvents="none">
      <Defs>
        <Marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" orient="auto" markerWidth="7" markerHeight="7">
          <Path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
        </Marker>
      </Defs>
      <AnimatedEdgePath
        d={`M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`}
        stroke={themeColor("#8b5cf6")}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={[6, 5]}
        markerEnd="url(#edge-arrow)"
        strokeDashoffset={edgeDashOffset}
      />
    </Svg>
  );
}

const WorkflowNodeCard = React.memo(function WorkflowNodeCard({ node, fallbackIndex, zoomRef, onUpdate, onDelete, connectMode, selectedForConnection, onLink, onMeasure, agentRun, terminalRun, setTerminalRun, desktopOnline, desktopModels, activeModelName, chainRunning, hasFileInput, hasFileOutput, hasTerminal, hasAgentInput, hasAgentOutput, onStartChain, onRunAgent }) {
  const styles = useStyles();
  const themeColor = useThemeColor();
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
  const agentOutput = node.data?.output ?? agentRun?.output ?? '';
  const agentError = node.data?.runError || agentRun?.error || '';
  const rawAgentStatus = node.data?.runStatus || agentRun?.status || 'idle';
  const agentStatus = rawAgentStatus === 'running' || rawAgentStatus === 'waiting' ? 'running' : rawAgentStatus;
  const chainStatus = agentRun ? ({ waiting: 'Aguardando agentes anteriores', done: 'Concluido', cancelled: 'Interrompido', skipped: 'Nao executado' }[agentRun.status] || '') : '';
  const received = Array.isArray(node.data?.received) ? node.data.received : [];
  const [receivedOpen, setReceivedOpen] = useState(false);
  const modelValue = node.data?.model || activeModelName || '';
  const modelLabel = modelValue ? String(modelValue).replace(/\.gguf$/i, '') : 'sem modelo';
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);

  async function selectModel(filename) {
    if (modelLoading) return;
    setModelPickerOpen(false);
    onUpdate(node.id, { data: { model: filename } });
    if (filename !== activeModelName) {
      setModelLoading(true);
      try {
        const response = await fetch(`${aiUrl()}/api/models/load`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error || 'Falha ao carregar o modelo no desktop.');
        }
      } catch (selectError) {
        onUpdate(node.id, { data: { runError: selectError?.message || 'Falha ao carregar o modelo.' } });
      } finally {
        setModelLoading(false);
      }
    }
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
        const fileContent =
          (await readTextFile(asset.uri)) ?? '[Arquivo não textual ou não foi possível ler o conteúdo.]';
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
      const result = (await executeDesktopCommand(command, 30000)) || {};
      const output = [result.stdout, result.stderr && `ERRO:\n${result.stderr}`, `\n[exit ${result.exit_code ?? '?'}]`].filter(Boolean).join('\n');
      const previous = node.data?.terminalContent || '';
      onUpdate(node.id, { data: { terminalContent: `${previous}${previous ? '\n' : ''}> ${command}\n${output}`, terminalStatus: 'idle' } });
      setTerminalRun({ running: false, error: '' });
    } catch (runError) {
      onUpdate(node.id, { data: { terminalStatus: 'error' } });
      setTerminalRun({ running: false, error: runError.message || 'Falha ao executar comando.' });
    }
  }

  return (
    <View
      style={[styles.nodeCard, type === 'agent' && styles.agentNodeCard, type === 'file' && styles.fileNodeCard, type === 'terminal' && styles.terminalNodeCard, type === 'text' && styles.textNodeCard, { left: CANVAS_PADDING + nodePosition.x, top: CANVAS_PADDING + nodePosition.y }]}
      onLayout={(layoutEvent) => onMeasure?.(node.id, layoutEvent.nativeEvent.layout.height)}
    >
      {type !== 'text' ? (
      <View style={[styles.nodeHeader, type === 'agent' && styles.agentNodeHeader, type === 'file' && styles.fileNodeHeader, type === 'terminal' && styles.terminalNodeHeader]} {...panResponder.panHandlers}>
        {type === 'agent' ? (
          <>
            <Bot size={14} color={themeColor('#71717a')} />
            <TextInput
              value={node.data?.label || 'Agent'}
              onChangeText={(labelText) => onUpdate(node.id, { data: { label: labelText } })}
              editable={!chainRunning}
              style={styles.agentTitleInput}
              selectTextOnFocus
              accessibilityLabel="Nome do agente"
            />
            {hasFileInput ? <Text style={styles.agentBadgeRead}>lendo arquivos</Text> : null}
            {hasFileOutput ? <Text style={styles.agentBadgeEdit}>pode editar arquivos</Text> : null}
            {hasTerminal ? <Text style={styles.agentBadgeTerminal}>usa terminal</Text> : null}
            {hasAgentInput ? <Text style={styles.agentBadgeReceive}>recebe task</Text> : null}
            {hasAgentOutput ? <Text style={styles.agentBadgeSend}>passa task</Text> : null}
            {agentStatus === 'running' ? (
              <View style={styles.agentStatus}>
                <ActivityIndicator size="small" color="#fbbf24" style={styles.agentSpinner} />
                <Text style={[styles.agentStatusText, styles.agentRunningText]}>executando...</Text>
              </View>
            ) : agentStatus === 'error' ? (
              <View style={styles.agentStatus}>
                <View style={[styles.agentStatusDot, styles.agentStatusDotError]} />
                <Text style={[styles.agentStatusText, styles.agentStatusErrorText]}>erro</Text>
              </View>
            ) : !hasFileInput && !hasFileOutput && !hasTerminal && !hasAgentInput && !hasAgentOutput ? (
              <View style={styles.agentStatus}>
                <View style={[styles.agentStatusDot, styles.agentStatusDotOnline]} />
                <Text style={styles.agentStatusText}>online</Text>
              </View>
            ) : null}
          </>
        ) : type === 'file' ? (
          <>
            <View style={styles.fileNodeHeading}>
              <Feather name="file-text" size={14} color={themeColor("#71717a")} />
              <Text style={styles.fileNodeTitle}>{node.data?.label || 'Arquivos'}</Text>
              {files.length > 0 ? (
                <View style={styles.fileCountBadge}><Text style={styles.fileCountText}>{files.length}</Text></View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.terminalDotsRow}>
              <View style={styles.terminalDot} />
              <Text style={styles.terminalHeaderText} numberOfLines={1}>{node.data?.label || 'Terminal'}</Text>
              {node.data?.terminalStatus === 'running' || terminalRun?.running ? <Text style={styles.terminalStatusRunning}>executando...</Text> : null}
              {node.data?.terminalStatus === 'error' ? <Text style={styles.terminalStatusError}>erro</Text> : null}
            </View>
          </>
        )}
          {connectMode ? (
          <TouchableOpacity style={styles.linkButton} onPress={() => onLink(node.id)} accessibilityLabel={`Selecionar conexão de ${label}`}>
            <Feather name="link-2" size={15} color={selectedForConnection ? themeColor(colors.purple) : themeColor('#77737c')} />
          </TouchableOpacity>
        ) : type === 'agent' || type === 'file' ? <GripVertical size={13} color={themeColor('#3f3f46')} /> : type === 'terminal' ? <Text style={styles.terminalDragHint}>⠿ Drag</Text> : null}
        <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(node.id)} accessibilityLabel={`Excluir ${label}`}>
          <Feather name="x" size={16} color={themeColor("#77737c")} />
        </TouchableOpacity>
      </View>
      ) : null}
      {type === 'file' ? (
        <>
          <View style={[styles.filePortDot, styles.filePortLeft]} />
          <View style={[styles.filePortDot, styles.filePortRight]} />
          <View style={[styles.filePortDot, styles.filePortTopPos]} />
          <View style={[styles.filePortDot, styles.filePortBottomPos]} />
        </>
      ) : null}
      {type === 'agent' ? (
        <>
          <View style={[styles.agentPortDot, styles.agentPortLeft]} />
          <View style={[styles.agentPortDot, styles.agentPortRight]} />
          <View style={[styles.agentPortDot, styles.agentPortTopPos]} />
          <View style={[styles.agentPortDot, styles.agentPortBottomPos]} />
        </>
      ) : null}
      {type === 'terminal' ? (
        <>
          <View style={[styles.terminalPortDot, styles.terminalPortLeft]} />
          <View style={[styles.terminalPortDot, styles.terminalPortRight]} />
          <View style={[styles.terminalPortDot, styles.terminalPortTop]} />
          <View style={[styles.terminalPortDot, styles.terminalPortBottom]} />
        </>
      ) : null}
      {type === 'text' ? (
        <View style={styles.textNodeBody} {...panResponder.panHandlers}>
          <TextInput
            value={node.data?.text || ''}
            onChangeText={(text) => onUpdate(node.id, { data: { text } })}
            placeholder="Digite..."
            placeholderTextColor={themeColor("#71717a")}
            multiline
            style={styles.workflowTextInput}
            textAlign="center"
            textAlignVertical="center"
          />
        </View>
      ) : type === 'terminal' ? (
        <View style={styles.terminalBody}>
          <TextInput
            value={node.data?.terminalContent || ''}
            onChangeText={(terminalContent) => onUpdate(node.id, { data: { terminalContent } })}
            placeholder="A saída do terminal aparecerá aqui..."
            placeholderTextColor={themeColor("#52525b")}
            multiline
            style={styles.terminalEditor}
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {terminalRun?.error ? <Text style={styles.agentError}>{terminalRun.error}</Text> : null}
          <View style={styles.terminalCommandRow}>
            <Text style={styles.terminalPromptSign} selectable>&gt;</Text>
            <TextInput
              value={node.data?.terminalCommand || ''}
              onChangeText={(terminalCommand) => onUpdate(node.id, { data: { terminalCommand } })}
              placeholder="Digite um comando..."
              placeholderTextColor={themeColor("#52525b")}
              style={styles.terminalCommandInput}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={executeTerminalCommand}
              returnKeyType="go"
            />
            <TouchableOpacity style={styles.terminalRunButton} onPress={executeTerminalCommand} disabled={terminalRun?.running}>
              {terminalRun?.running ? <ActivityIndicator size="small" color="#a78bfa" /> : <Feather name="play" size={15} color="#c4b5fd" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.terminalSafetyHint}>Executado no desktop conectado · limite de segurança do desktop</Text>
        </View>
      ) : type === 'agent' ? (
        <View style={styles.agentNodeBody}>
          {chainStatus ? (
            <View style={styles.agentChainStatus}>
              <ActivityIndicator size="small" color="#fbbf24" />
              <Text style={styles.agentChainStatusText}>{chainStatus}</Text>
            </View>
          ) : null}
          <TextInput
            value={node.data?.prompt || ''}
            onChangeText={(prompt) => onUpdate(node.id, { data: { prompt } })}
            editable={!chainRunning}
            placeholder="Descreva o que este agente deve fazer..."
            placeholderTextColor={themeColor("#52525b")}
            multiline
            style={styles.agentPromptInput}
            textAlignVertical="top"
          />
          {hasAgentOutput ? (
            <View style={styles.agentHandoff}>
              <Text style={styles.agentHandoffLabel}>Instrucoes para o proximo agente</Text>
              <TextInput
                value={node.data?.handoffPrompt || ''}
                onChangeText={(handoffPrompt) => onUpdate(node.id, { data: { handoffPrompt } })}
                editable={!chainRunning}
                placeholder="Ex.: use o plano gerado para implementar e testar os arquivos."
                placeholderTextColor={themeColor("#52525b")}
                multiline
                style={styles.agentHandoffInput}
                textAlignVertical="top"
              />
            </View>
          ) : null}
          {received.length > 0 ? (
            <View style={styles.agentReceivedBox}>
              <TouchableOpacity onPress={() => setReceivedOpen((current) => !current)} accessibilityRole="button" accessibilityLabel="Instrucoes recebidas">
                <Text style={styles.agentReceivedToggle}>Instrucoes recebidas ({received.length}){receivedOpen ? '' : ' ▸'}</Text>
              </TouchableOpacity>
              {receivedOpen ? received.map((message) => (
                <View key={message.agentId} style={styles.agentReceivedItem}>
                  <Text style={styles.agentReceivedFrom}>{message.label}</Text>
                  <Text style={styles.agentReceivedText} selectable>{message.instruction ? message.instruction + '\n' : ''}{message.output}</Text>
                </View>
              )) : null}
            </View>
          ) : null}
          {agentError ? (
            <View style={styles.agentErrorRow}>
              <Text style={styles.agentErrorIcon}>⚠</Text>
              <Text style={styles.agentError}>{agentError}</Text>
            </View>
          ) : null}
          {node.data?.notice ? <Text style={styles.agentNotice}>{node.data.notice}</Text> : null}
          {(agentOutput || agentStatus === 'running') ? (
            <View style={styles.agentOutputPanel}>
              {agentOutput ? (
                <Text style={styles.agentOutputText} selectable>{formatAgentOutput(agentOutput)}</Text>
              ) : (
                <View style={styles.agentWaiting}><ActivityIndicator size="small" color="#a78bfa" /><Text style={styles.agentWaitingText}>Aguardando resposta...</Text></View>
              )}
            </View>
          ) : null}
          <View style={styles.agentFooter}>
            <View style={styles.agentModelGroup}>
              <Text style={styles.agentModelLabel}>modelo</Text>
              <TouchableOpacity style={styles.agentModelButton} onPress={() => setModelPickerOpen(true)} disabled={agentStatus === 'running' || modelLoading}>
                <Text style={styles.agentModelButtonText} numberOfLines={1}>{modelLoading ? 'carregando...' : modelLabel}</Text>
                <Feather name="chevron-down" size={14} color={themeColor("#d4d4d8")} />
              </TouchableOpacity>
            </View>
            <View style={styles.agentRunGroup}>
              {hasAgentOutput ? (
                <TouchableOpacity style={[styles.agentChainButton, chainRunning && styles.agentButtonsDisabled]} onPress={onStartChain} disabled={chainRunning} accessibilityRole="button" accessibilityLabel="Executar cadeia">
                  <Workflow size={10} color="#fcd34d" />
                  <Text style={styles.agentChainButtonText}>Executar cadeia</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[agentStatus === 'running' ? styles.agentStopButton : styles.agentRunButton, chainRunning && agentStatus !== 'running' && styles.agentButtonsDisabled]}
                onPress={() => onRunAgent(node.id)}
                accessibilityRole="button"
                accessibilityLabel={agentStatus === 'running' ? 'Parar execucao' : 'Executar agente'}
              >
                {agentStatus === 'running' ? <Square size={10} color="#a1a1aa" /> : <Play size={10} color="#c4b5fd" />}
                <Text style={agentStatus === 'running' ? styles.agentStopButtonText : styles.agentRunButtonText}>{agentStatus === 'running' ? 'Parar' : 'So este'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Modal visible={modelPickerOpen} transparent animationType="fade" onRequestClose={() => setModelPickerOpen(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.workflowPicker}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Selecionar modelo</Text>
                  <TouchableOpacity onPress={() => setModelPickerOpen(false)}><Feather name="x" size={20} color={themeColor(colors.muted)} /></TouchableOpacity>
                </View>
                {desktopModels.length ? desktopModels.map((model) => {
                  const filename = model.filename;
                  return (
                  <TouchableOpacity key={filename} style={styles.workflowOption} onPress={() => selectModel(filename)}>
                    <Text style={styles.optionText}>{String(filename).replace(/\.gguf$/i, '')}</Text>
                    <Text style={styles.optionSizeText}>{model.sizeMB ? model.sizeMB + ' MB' : ''}</Text>
                    {filename === activeModelName ? <Feather name="check" size={17} color={themeColor(colors.purple)} /> : null}
                  </TouchableOpacity>
                  );
                }) : (
                  <Text style={styles.emptyText}>Conecte ao desktop para listar os modelos instalados.</Text>
                )}
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
            placeholderTextColor={themeColor(colors.muted)}
            style={styles.labelInput}
            selectTextOnFocus
          />
        ) : null}
        {type === 'file' ? (
          <View style={styles.fileNodeContent}>
            <TouchableOpacity style={styles.fileDropzone} onPress={pickFiles} activeOpacity={0.75}>
              <Feather name="upload" size={18} color={themeColor("#52525b")} />
              <Text style={styles.fileDropzoneText}>Clique para selecionar arquivo</Text>
            </TouchableOpacity>
            {node.data?.fileError ? <Text style={styles.agentError}>{node.data.fileError}</Text> : null}
            {files.map((file, index) => (
              <View key={`${file.filePath || file.fileName}-${index}`} style={styles.fileCard}>
                <View style={styles.fileCardHeader}>
                  <View style={styles.fileCardTitle}>
                    <Feather name="file-text" size={12} color="#71717a" />
                    <View style={styles.fileCardTextGroup}>
                      <Text style={styles.fileCardName} numberOfLines={1}>{file.fileName || 'Arquivo'}</Text>
                      {file.filePath ? <Text style={styles.fileCardPath} numberOfLines={1}>{file.filePath}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.fileCardActions}>
                    <Text style={styles.fileSizeText}>{formatFileSize(file.fileSize)}</Text>
                    <TouchableOpacity
                      style={styles.removeFileButton}
                      onPress={() => onUpdate(node.id, { data: { files: files.filter((_, fileIndex) => fileIndex !== index) } })}
                      accessibilityLabel={`Remover ${file.fileName || 'arquivo'}`}
                    >
                      <Feather name="x" size={11} color="#71717a" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.fileContentPreview}>
                  <Text style={styles.fileContentPreviewText} selectable>{file.fileContent || 'Arquivo vazio'}</Text>
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

const useStyles = createThemedStyles({
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
  viewport: { flex: 1, marginTop: 8, overflow: 'hidden', backgroundColor: colors.background },
  panLayer: { position: 'absolute', left: 0, top: 0, width: 6000, height: 6000 },
  canvas: { position: 'absolute', left: 0, top: 0, width: 6000, height: 6000, transformOrigin: 'top left' },
  canvasPanSurface: { ...StyleSheet.absoluteFillObject, width: 6000, height: 6000 },
  emptyState: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  nodeCard: { position: 'absolute', width: CARD_WIDTH, minHeight: CARD_HEIGHT, overflow: 'hidden', borderRadius: 22, borderWidth: 1, borderColor: '#38363b', backgroundColor: colors.panel, elevation: 8 },
  agentNodeCard: { width: 520, backgroundColor: '#181818', borderRadius: 16, borderColor: '#27272a' },
  fileNodeCard: { width: 360, minHeight: 0, backgroundColor: '#181818', borderRadius: 16, borderColor: '#27272a' },
  terminalNodeCard: { width: 560, minHeight: 0, backgroundColor: '#09090b', borderRadius: 12, borderColor: '#3f3f46CC' },
  textNodeCard: { width: 180, minHeight: 90, overflow: 'visible', borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent', elevation: 0 },
  nodeHeader: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: '#f3f3f3' },
  agentNodeHeader: { height: 44, justifyContent: 'flex-start', gap: 10, paddingHorizontal: 16, backgroundColor: '#181818', borderBottomWidth: 1, borderBottomColor: '#27272aCC' },
  fileNodeHeader: { height: 44, paddingHorizontal: 16, backgroundColor: '#181818', borderBottomWidth: 1, borderBottomColor: '#27272aCC' },
  terminalNodeHeader: { height: 40, paddingHorizontal: 14, backgroundColor: '#18181bE6', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  filePortDot: { position: 'absolute', zIndex: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#8b5cf6', borderWidth: 2, borderColor: '#181818' },
  filePortLeft: { top: '50%', marginTop: -5, left: -5 },
  filePortRight: { top: '50%', marginTop: -5, right: -5 },
  filePortTopPos: { top: -5, left: '50%', marginLeft: -5 },
  filePortBottomPos: { bottom: -5, left: '50%', marginLeft: -5 },
  agentPortDot: { position: 'absolute', zIndex: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#8b5cf6', borderWidth: 2, borderColor: '#181818' },
  agentPortLeft: { top: '50%', marginTop: -5, left: -5 },
  agentPortRight: { top: '50%', marginTop: -5, right: -5 },
  agentPortTopPos: { top: -5, left: '50%', marginLeft: -5 },
  agentPortBottomPos: { bottom: -5, left: '50%', marginLeft: -5 },
  terminalPortDot: { position: 'absolute', zIndex: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#8b5cf6', borderWidth: 2, borderColor: '#18181b' },
  terminalPortLeft: { top: '50%', marginTop: -6, left: -6 },
  terminalPortRight: { top: '50%', marginTop: -6, right: -6 },
  terminalPortTop: { top: -6, left: '50%', marginLeft: -6 },
  terminalPortBottom: { bottom: -6, left: '50%', marginLeft: -6 },
  fileNodeHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileNodeTitle: { color: '#e4e4e7', fontSize: 12, fontWeight: '500' },
  fileCountBadge: { minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#8b5cf626', paddingHorizontal: 6 },
  fileCountText: { color: '#a78bfa', fontSize: 9, fontWeight: '500' },
  agentTitleInput: { color: '#e4e4e7', fontSize: 12, fontWeight: '500', minWidth: 44, maxWidth: 112, padding: 0 },
  agentStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agentStatusDot: { width: 6, height: 6, borderRadius: 3 },
  agentStatusDotOnline: { backgroundColor: '#10b981' },
  agentStatusDotError: { backgroundColor: '#ef4444' },
  agentStatusText: { color: '#52525b', fontSize: 9 },
  agentRunningText: { color: '#fbbf24' },
  agentStatusErrorText: { color: '#f87171' },
  agentSpinner: { transform: [{ scale: 0.55 }], marginRight: -4 },
  agentBadgeRead: { color: '#a78bfa', fontSize: 9, fontWeight: '500', backgroundColor: '#8b5cf626', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  agentBadgeEdit: { color: '#34d399', fontSize: 9, fontWeight: '500', backgroundColor: '#10b98119', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  agentBadgeTerminal: { color: '#7dd3fc', fontSize: 9, fontWeight: '500', backgroundColor: '#0ea5e926', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  agentBadgeReceive: { color: '#fbbf24', fontSize: 9, fontWeight: '500', backgroundColor: '#f59e0b19', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  agentBadgeSend: { color: '#fcd34d', fontSize: 9, fontWeight: '500', backgroundColor: '#f59e0b26', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
  terminalDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981CC' },
  terminalHeaderText: { flex: 1, color: '#e4e4e7', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' },
  terminalStatusRunning: { color: '#fbbf24', fontSize: 10, fontFamily: 'monospace' },
  terminalStatusError: { color: '#f87171', fontSize: 10, fontFamily: 'monospace' },
  terminalDragHint: { color: '#71717a', fontSize: 10, fontFamily: 'monospace' },
  linkButton: { width: 26, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  nodeBody: { minHeight: 250, padding: 18, backgroundColor: '#242326' },
  fileNodeBody: { minHeight: 0, padding: 0, backgroundColor: '#181818' },
  textNodeBody: { width: 180, height: 90, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  workflowTextInput: { width: 180, height: 90, color: '#e4e4e7', fontSize: 13, lineHeight: 19, padding: 0, backgroundColor: 'transparent' },
  fileNodeContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  fileDropzone: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: '#27272a', borderRadius: 12, paddingVertical: 20 },
  fileDropzoneText: { color: '#71717a', fontSize: 11 },
  fileCard: { overflow: 'hidden', marginTop: 12, borderWidth: 1, borderColor: '#27272a', borderRadius: 12, backgroundColor: '#09090b66' },
  fileCardHeader: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  fileCardTitle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileCardTextGroup: { flex: 1, minWidth: 0 },
  fileCardName: { color: '#d4d4d8', fontSize: 11 },
  fileCardPath: { color: '#3f3f46', fontSize: 8, marginTop: 1 },
  fileCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileSizeText: { color: '#52525b', fontSize: 10 },
  removeFileButton: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  fileContentPreview: { borderTopWidth: 1, borderTopColor: '#27272a', padding: 12 },
  fileContentPreviewText: { maxHeight: 208, color: '#a1a1aa', fontSize: 10, lineHeight: 16, fontFamily: 'monospace' },
  fileNodeFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 12 },
  fileFooterCount: { color: '#52525b', fontSize: 9 },
  fileFooterDot: { color: '#27272a', fontSize: 9 },
  fileFooterPort: { color: '#8b5cf699', fontSize: 9 },
  agentNodeBody: { minHeight: 188, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, backgroundColor: '#181818' },
  agentChainStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#27272aCC', marginBottom: 6 },
  agentChainStatusText: { color: '#fbbf24', fontSize: 10 },
  agentPromptInput: { minHeight: 60, color: '#e4e4e7', fontSize: 13, lineHeight: 20, padding: 0 },
  agentHandoff: { marginTop: 12, marginBottom: 12 },
  agentHandoffLabel: { color: '#fbbf24', fontSize: 10, marginBottom: 4 },
  agentHandoffInput: { borderWidth: 1, borderColor: '#3e2414', borderRadius: 4, backgroundColor: '#09090b', padding: 8, color: '#e4e4e7', fontSize: 12, minHeight: 48, textAlignVertical: 'top' },
  agentReceivedBox: { borderWidth: 1, borderColor: '#3e2414', borderRadius: 4, padding: 8, marginBottom: 12 },
  agentReceivedToggle: { color: '#fcd34d', fontSize: 12 },
  agentReceivedItem: { marginTop: 8, maxWidth: 192 },
  agentReceivedFrom: { color: '#e4e4e7', fontSize: 12, fontWeight: '600' },
  agentReceivedText: { color: '#d4d4d8', fontSize: 12, lineHeight: 17, marginTop: 2 },
  agentErrorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: '#27272aCC', paddingTop: 12 },
  agentErrorIcon: { color: '#f87171', fontSize: 10, marginTop: 2 },
  agentError: { flex: 1, color: '#f87171', fontSize: 11, lineHeight: 16 },
  agentNotice: { color: '#fcd34d', fontSize: 12, marginTop: 8 },
  agentOutputPanel: { maxHeight: 320, borderTopWidth: 1, borderTopColor: '#27272aCC', marginTop: 12, paddingTop: 12 },
  agentOutputText: { color: '#d4d4d8', fontSize: 11, lineHeight: 18, fontFamily: 'monospace' },
  agentWaiting: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  agentWaitingText: { color: '#52525b', fontSize: 11 },
  agentFooter: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  agentModelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 },
  agentModelLabel: { color: '#52525b', fontSize: 9 },
  agentModelButton: { maxWidth: 220, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#303036', borderRadius: 8, paddingHorizontal: 12, backgroundColor: '#1b1b1e' },
  agentModelButtonText: { color: '#e4e4e7', fontSize: 11, flexShrink: 1 },
  agentRunGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentChainButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#f59e0b26' },
  agentChainButtonText: { color: '#fcd34d', fontSize: 11, fontWeight: '500' },
  agentRunButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#8b5cf626' },
  agentRunButtonText: { color: '#c4b5fd', fontSize: 11, fontWeight: '500' },
  agentStopButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#ef444419' },
  agentStopButtonText: { color: '#f87171', fontSize: 11, fontWeight: '500' },
  agentButtonsDisabled: { opacity: 0.5 },
  terminalText: { color: '#f0eff2', fontSize: 15, lineHeight: 22, fontFamily: 'monospace' },
  terminalBody: { minHeight: 0, padding: 8, backgroundColor: '#101012' },
  terminalEditor: { height: 320, color: '#a1a1aa', fontSize: 11, lineHeight: 16, fontFamily: 'monospace', textAlignVertical: 'top', padding: 0 },
  terminalPromptSign: { color: '#34d399', fontSize: 12, fontFamily: 'monospace' },
  terminalCommandRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#27272a' },
  terminalCommandInput: { flex: 1, minHeight: 38, color: '#e4e4e7', fontSize: 12, fontFamily: 'monospace', backgroundColor: '#111113', borderRadius: 6, paddingHorizontal: 10 },
  terminalRunButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#8b5cf633' },
  terminalSafetyHint: { color: '#52525b', fontSize: 9, marginTop: 7 },
  nodeText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  labelInput: { minHeight: 38, color: colors.text, fontSize: 14, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12, paddingVertical: 6 },
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
  optionSizeText: { color: colors.muted, fontSize: 10 },
  createNameInput: { color: colors.text, fontSize: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 44, marginBottom: 10 },
  createDescriptionInput: { color: colors.text, fontSize: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, minHeight: 64, marginBottom: 10, textAlignVertical: 'top' },
  createWorkflowButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#8b5cf633' },
  createWorkflowDisabled: { color: '#71717a' },
  backToListButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  backToListText: { color: colors.muted, fontSize: 12 },
  createWorkflowEntry: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  createWorkflowEntryText: { color: colors.purple, fontSize: 13, fontWeight: '600' },
  execPanel: { position: 'absolute', left: 16, top: 16, zIndex: 5, alignSelf: 'flex-start', maxWidth: 448, borderWidth: 1, borderColor: '#3f3f46', borderRadius: 8, backgroundColor: '#09090b', padding: 8, gap: 8, elevation: 8 },
  execButtonsRow: { flexDirection: 'row', gap: 8 },
  execRunButton: { borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#7c3aed' },
  execButtonDisabled: { opacity: 0.4 },
  execRunButtonText: { color: '#e4e4e7', fontSize: 12 },
  execStopButton: { borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#450a0a' },
  execStopButtonText: { color: '#fca5a5', fontSize: 12 },
  execToggle: { borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#18181b' },
  execToggleText: { color: '#e4e4e7', fontSize: 12 },
  execEventsList: { maxHeight: 288, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#27272a' },
  eventRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#27272a99' },
  eventTime: { color: '#52525b', fontSize: 10, paddingVertical: 2 },
  eventText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
  eventTextError: { color: '#f87171' },
  eventTextDone: { color: '#34d399' },
  emptyCreateButton: { marginTop: 14, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#8b5cf633', paddingHorizontal: 18 },
  emptyCreateButtonText: { color: '#c4b5fd', fontSize: 13, fontWeight: '600' },
});
