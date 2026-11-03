import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionMode,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import TerminalNode from "@/components/terminalNode";
import AgentNode from "@/components/agentNode";
import FlowEdge from "@/components/FlowEdge";
import FileNode from "@/components/FileNode";
import { WorkflowExecutionProvider } from "@/contexts/WorkflowExecutionContext";
import WorkflowExecutionPanel from "@/components/WorkflowExecutionPanel";
import WorkflowText from "@/components/workflowText";
import sheets from "@/services/api";

import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  MousePointer2,
  SquareTerminal,
  PaperclipIcon,
  CaseSensitiveIcon,
  Bot,
  TerminalIcon,
} from "lucide-react";

const nodeTypes = {
  terminal: TerminalNode,
  agent: AgentNode,
  file: FileNode,
  text: WorkflowText,
};

const edgeTypes = {
  curved: FlowEdge,
};

export default function Workflow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [canvasReady, setCanvasReady] = useState(false);
  const dirtyRef = useRef(false);
  const changeVersionRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (id) return undefined;
    let cancelled = false;
    async function openOrCreate() {
      try {
        const { data } = await sheets.getWorkflows();
        let workflow = data.workflows?.[0];
        if (!workflow) {
          const result = await sheets.createWorkflow({ name: "Meu workflow", description: "Workflow criado pelo editor." });
          workflow = result.data.workflow;
        }
        if (!cancelled) navigate(`/workflows/${workflow.id_workflow}`, { replace: true });
      } catch (error) {
        console.error("Não foi possível abrir o workflow:", error);
      }
    }
    openOrCreate();
    return () => { cancelled = true; };
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setCanvasReady(false);
    dirtyRef.current = false;
    changeVersionRef.current = 0;
    async function loadCanvas() {
      try {
        const { data } = await sheets.getWorkflowCanvas(id);
        if (cancelled) return;
        setNodes(data.canvas?.nodes || []);
        setEdges(data.canvas?.edges || []);
        setCanvasReady(true);
      } catch (error) {
        console.error("Não foi possível carregar o workflow:", error);
        if (!cancelled) setCanvasReady(true);
      }
    }
    loadCanvas();
    const interval = setInterval(async () => {
      if (cancelled || dirtyRef.current || saveInFlightRef.current) return;
      try {
        const { data } = await sheets.getWorkflowCanvas(id);
        if (cancelled || dirtyRef.current) return;
        const remoteNodes = data.canvas?.nodes || [];
        const remoteEdges = data.canvas?.edges || [];
        setNodes((current) => JSON.stringify(current) === JSON.stringify(remoteNodes) ? current : remoteNodes);
        setEdges((current) => JSON.stringify(current) === JSON.stringify(remoteEdges) ? current : remoteEdges);
      } catch (error) {
        console.warn("Não foi possível atualizar o workflow:", error?.message);
      }
    }, 1500);
    return () => { cancelled = true; clearInterval(interval); };
  }, [id, setNodes, setEdges]);

  useEffect(() => {
    if (!id || !canvasReady || !dirtyRef.current) return undefined;
    const version = changeVersionRef.current;
    const timeout = setTimeout(async () => {
      saveInFlightRef.current = true;
      try {
        await sheets.saveWorkflowCanvas(id, { nodes, edges });
        if (changeVersionRef.current === version) dirtyRef.current = false;
      } catch (error) {
        console.error("Não foi possível salvar o workflow:", error);
      } finally {
        saveInFlightRef.current = false;
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [id, canvasReady, nodes, edges]);

  const handleNodesChange = useCallback((changes) => {
    dirtyRef.current = true;
    changeVersionRef.current += 1;
    onNodesChange(changes);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes) => {
    dirtyRef.current = true;
    changeVersionRef.current += 1;
    onEdgesChange(changes);
  }, [onEdgesChange]);

  const updateNodeData = useCallback((nodeId, patch) => {
    dirtyRef.current = true;
    changeVersionRef.current += 1;
    setNodes((current) => current.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, ...patch } }
      : node));
  }, [setNodes]);

  const renderNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    data: { ...node.data, onWorkflowDataChange: updateNodeData },
  })), [nodes, updateNodeData]);

  const onConnect = useCallback(
    (params) => {
      dirtyRef.current = true;
      changeVersionRef.current += 1;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "curved",
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addAgentNode = useCallback(
    (mode) => {
      const id = crypto.randomUUID();


      const newNode = {
        id,
        type: "agent",

        position: {
          x: 250 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },

        data: {
          label: "Agente",

          mode,
        },

        dragHandle: ".drag-handle",
      };

      dirtyRef.current = true;
      changeVersionRef.current += 1;
      setNodes((nodes) => [
        ...nodes,
        { ...newNode, data: { ...newNode.data, label: "Agente " + (nodes.filter((node) => node.type === "agent").length + 1) } },
      ]);
    },
    [setNodes]
  );

  const addTextNode = useCallback(
    () => {
      const id = crypto.randomUUID();

      const newNode = {
        id,
        type: "text",

        position: {
          x: 250 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },

        data: {
          label: "Text",
        },

        dragHandle: ".drag-handle",
      };

      dirtyRef.current = true;
      changeVersionRef.current += 1;
      setNodes((nodes) => [
        ...nodes,
        newNode,
      ]);
    },
    [setNodes]
  );

  const addFileNode = useCallback(
    () => {
      const id = crypto.randomUUID();

      const newNode = {
        id,
        type: "file",

        position: {
          x: 250 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },

        data: {
          label: "File",
          files: [{
            fileName: "Exemplo.txt",
            fileContent: "Hello World"
          }]

          
        },

        dragHandle: ".drag-handle",
      };

      dirtyRef.current = true;
      changeVersionRef.current += 1;
      setNodes((nodes) => [
        ...nodes,
        newNode,
      ]);
    },
    [setNodes]
  );

  const addTerminalNode = useCallback(
    (mode) => {
      const id = crypto.randomUUID();

      const isClaude = mode === "claude";

      const newNode = {
        id,
        type: "terminal",

        position: {
          x: 250 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },

        data: {
          label: isClaude
            ? "Claude Code"
            : "Terminal",

          mode,
        },

        dragHandle: ".drag-handle",
      };

      dirtyRef.current = true;
      changeVersionRef.current += 1;
      setNodes((nodes) => [
        ...nodes,
        newNode,
      ]);
    },
    [setNodes]
  );

  return (
    <ReactFlowProvider>
    <WorkflowExecutionProvider>
    <div className="relative h-full w-full overflow-hidden bg-[#141414]">
      <WorkflowExecutionPanel />
      {/* NAVBAR */}
      <section className="absolute top-6 left-1/2 z-50 -translate-x-1/2">
        <Menubar className="gap-5 rounded-full border border-zinc-800/80 bg-background/40 p-3 shadow-lg backdrop-blur-md">
          <MenubarMenu>
            <MenubarTrigger className="cursor-pointer rounded-full p-2 hover:bg-zinc-800/60">
              <MousePointer2 size={18} />
            </MenubarTrigger>

            {/* TERMINAL */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-zinc-800/60"
                >
                  <SquareTerminal size={18} />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="center"
                className="w-52"
              >
                <DropdownMenuItem
                  onClick={() =>
                    addTerminalNode("empty")
                  }
                  className="cursor-pointer gap-2"
                >
                  <TerminalIcon size={16} />

                  Terminal vazio
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() =>
                    addTerminalNode("claude")
                  }
                  className="cursor-pointer gap-2"
                >
                  <Bot size={16} />

                  Claude Code
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <MenubarTrigger className="cursor-pointer rounded-full p-2 hover:bg-zinc-800/60">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-zinc-800/60"
                  >
                    <Bot size={18} />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="center"
                  className="w-52"
                >
                  <DropdownMenuItem
                    onClick={() =>
                      addAgentNode("Agent")
                    }
                    className="cursor-pointer gap-2"
                  >
                    <Bot size={16} />

                    Agent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </MenubarTrigger>

            <MenubarTrigger className="cursor-pointer rounded-full p-2 hover:bg-zinc-800/60">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-zinc-800/60"
                  >
                    <PaperclipIcon size={18} />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="center"
                  className="w-52"
                >
                  <DropdownMenuItem
                    onClick={() =>
                      addFileNode()
                    }
                    className="cursor-pointer gap-2"
                  >
                    <PaperclipIcon size={16} />

                    File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </MenubarTrigger>

            <MenubarTrigger className="cursor-pointer rounded-full p-2 hover:bg-zinc-800/60">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex cursor-pointer items-center justify-center rounded-full p-2 hover:bg-zinc-800/60"
                  >
                    <CaseSensitiveIcon size={18} />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="center"
                  className="w-52"
                >
                  <DropdownMenuItem
                    onClick={() =>
                      addTextNode()
                    }
                    className="cursor-pointer gap-2"
                  >
                    <CaseSensitiveIcon size={16} />

                    Text
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </MenubarTrigger>
          </MenubarMenu>
        </Menubar>
      </section>

      {/* CANVAS */}
      <div className="h-full w-full">
        <ReactFlow
          nodes={renderNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{ type: "curved", markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView
          minZoom={0.1}
          maxZoom={4}
          connectionRadius={40}
        >
          <Background
            gap={30}
            color="#27272a"
          />

          <Controls className="border-zinc-800 bg-zinc-900 text-zinc-300" />
        </ReactFlow>
      </div>
    </div>
    </WorkflowExecutionProvider>
    </ReactFlowProvider>
  );
}
