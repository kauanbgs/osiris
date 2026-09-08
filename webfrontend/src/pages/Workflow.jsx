import { useCallback } from "react";

import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import TerminalNode from "@/components/terminalNode";

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
  FileTextIcon,
  CaseSensitiveIcon,
  Bot,
  TerminalIcon,
} from "lucide-react";

const nodeTypes = {
  terminal: TerminalNode,
};

const initialNodes = [];

export default function Workflow() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState(initialNodes);

  const [edges, setEdges, onEdgesChange] =
    useEdgesState([]);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(params, eds)
      ),
    [setEdges]
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
    <div className="relative h-full w-full overflow-hidden bg-[#141414]">
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
              <PaperclipIcon size={18} />
            </MenubarTrigger>

            <MenubarTrigger className="cursor-pointer rounded-full p-2 hover:bg-zinc-800/60">
              <FileTextIcon size={18} />
            </MenubarTrigger>

            <MenubarTrigger className="cursor-pointer rounded-full p-2 hover:bg-zinc-800/60">
              <CaseSensitiveIcon size={18} />
            </MenubarTrigger>
          </MenubarMenu>
        </Menubar>
      </section>

      {/* CANVAS */}
      <div className="h-full w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={
            onNodesChange
          }
          onEdgesChange={
            onEdgesChange
          }
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background
            gap={30}
            color="#27272a"
          />

          <Controls className="border-zinc-800 bg-zinc-900 text-zinc-300" />
        </ReactFlow>
      </div>
    </div>
  );
}