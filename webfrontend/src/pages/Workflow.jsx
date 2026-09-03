import { ReactFlow, Background, Controls } from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";

import {
  MousePointer2,
  SquareTerminal,
  PaperclipIcon,
  FileTextIcon,
  CaseSensitiveIcon,
} from "lucide-react";

const initialNodes = [
  {
    id: "1",
    position: {
      x: 300,
      y: 200,
    },
    data: {
      label: "Meu node",
    },
  },
];

export default function Workflow() {
  return (
    <>
      {/* NAVBAR */}
      <section className="absolute top-10 left-1/2 z-50 -translate-x-1/2">
        {" "}
        <Menubar className="gap-5 rounded-full bg-background/30 p-5 shadow-sm">
          <MenubarMenu>
            <MenubarTrigger>
              <MousePointer2 size={20} />
            </MenubarTrigger>

            <MenubarTrigger>
              <SquareTerminal size={20} />
            </MenubarTrigger>

            <MenubarTrigger>
              <PaperclipIcon size={20} />
            </MenubarTrigger>

            <MenubarTrigger>
              <FileTextIcon size={20} />
            </MenubarTrigger>

            <MenubarTrigger>
              <CaseSensitiveIcon size={20} />
            </MenubarTrigger>
          </MenubarMenu>
        </Menubar>
      </section>

      {/* CANVAS */}
      <div className="h-screen w-screen">
        <ReactFlow nodes={initialNodes} edges={[]} minZoom={0.25} maxZoom={2.5}>
          <Background gap={30} />
        </ReactFlow>
      </div>
    </>
  );
}
