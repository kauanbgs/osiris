import {
  Menubar,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { MousePointer2, SquareTerminal, PaperclipIcon, FileTextIcon, CaseSensitiveIcon } from "lucide-react";

export default function Workflow() {
  return (
    <div className="flex h-screen justify-center mt-10">
    <Menubar className="p-5 gap-5 rounded-full">
      <MenubarMenu>
        <MenubarTrigger><MousePointer2 size={20} /></MenubarTrigger>
        <MenubarTrigger><SquareTerminal size={20} /></MenubarTrigger>
        <MenubarTrigger><PaperclipIcon size={20} /></MenubarTrigger>
        <MenubarTrigger><FileTextIcon size={20} /></MenubarTrigger>
        <MenubarTrigger><CaseSensitiveIcon size={20} /></MenubarTrigger>
      </MenubarMenu>
    </Menubar>
    </div>
  );
}
