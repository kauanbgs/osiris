import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useActiveProject } from "@/contexts/useActiveProject";

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

function SavedWorkflow({ owner, chatId }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    window.electronAPI.loadWorkflow(owner, chatId).then((workflow) => {
      if (!Array.isArray(workflow?.nodes) || !Array.isArray(workflow?.edges)) throw new Error("Workflow inválido");
      if (!cancelled) setLoaded(workflow);
    }).catch(() => { if (!cancelled) setError("Não foi possível abrir o workflow salvo."); });
    return () => { cancelled = true; };
  }, [owner, chatId]);
  if (error) return <p role="alert" className="p-8 text-red-400">{error}</p>;
  if (!loaded) return <p className="p-8">Carregando workflow...</p>;
  return <WorkflowCanvas owner={owner} chatId={chatId} initialWorkflow={loaded} />;
}

export default function Workflow() {
  const { id } = useParams();
  const { owner, activeId } = useActiveProject();
  if (!window.electronAPI?.loadWorkflow) return <WorkflowCanvas initialWorkflow={{ nodes: [], edges: [] }} />;
  if (!id && activeId) return <Navigate to={"/workflow/" + encodeURIComponent(activeId)} replace />;
  if (!id) return <p className="p-8 text-zinc-200">Crie um projeto pelo + na barra lateral para iniciar o chat e seu workflow.</p>;
  if (!owner) return <p role="alert" className="p-8">Usuário não identificado.</p>;
  return <SavedWorkflow key={JSON.stringify([owner, id])} owner={owner} chatId={id} />;
}

function WorkflowCanvas({ owner, chatId, initialWorkflow }) {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialWorkflow.nodes.map((node, index) => node.type === "agent" && (!node.data?.label || node.data.label === "Agent")
      ? { ...node, data: { ...node.data, label: "Agente " + (index + 1) } } : node));

  const [edges, setEdges, onEdgesChange] =
    useEdgesState(initialWorkflow.edges.map((edge) => ({ ...edge, markerEnd: { type: MarkerType.ArrowClosed } })));
  const [executionEvents, setExecutionEvents] = useState(initialWorkflow.executionEvents || []);
  const [viewport, setViewport] = useState(initialWorkflow.viewport);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const [saveStatus, setSaveStatus] = useState("Salvando...");
  useEffect(() => {
    if (!window.electronAPI?.saveWorkflow || !owner || !chatId) return;
    let active = true;
    window.electronAPI.saveWorkflow(owner, chatId, { nodes, edges, viewport, executionEvents }).then(() => {
      if (active) setSaveStatus("Salvo neste computador");
    }).catch(() => {
      if (active) setSaveStatus("Erro ao salvar. Tente novamente.");
    });
    return () => { active = false; };
  }, [owner, chatId, nodes, edges, viewport, saveAttempt, executionEvents]);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "curved",
            markerEnd: { type: MarkerType.ArrowClosed },
          },
          eds
        )
      ),
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

      setNodes((nodes) => [
        ...nodes,
        newNode,
      ]);
    },
    [setNodes]
  );

  return (
    <ReactFlowProvider>
    <WorkflowExecutionProvider initialEvents={initialWorkflow.executionEvents} onEventsChange={setExecutionEvents}>
    <div className="relative h-full w-full overflow-hidden bg-[#141414]">
      {chatId && <div className="absolute bottom-4 left-16 z-50 flex items-center gap-4 rounded bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
        <Link to={"/home/" + chatId}>Abrir chat do projeto</Link>
        <span role="status">{saveStatus}</span>
        <button type="button" onClick={() => { setSaveStatus("Salvando..."); setSaveAttempt((value) => value + 1); }}>Salvar</button>
      </div>}
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
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{ type: "curved", markerEnd: { type: MarkerType.ArrowClosed } }}
          defaultViewport={initialWorkflow.viewport}
          onMoveEnd={(_event, nextViewport) => setViewport(nextViewport)}
          fitView={!initialWorkflow.viewport}
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