import { useState, useId } from "react";
import {
  TerminalSquare,
  Eraser,
  Plus,
  X,
  Laptop,
  Globe,
} from "lucide-react";
import { hasElectronTerminal } from "@/utils/isElectron";
import ElectronTerminalPanel from "@/components/terminal/ElectronTerminalPanel";
import WebTerminalPanel from "@/components/terminal/WebTerminalPanel";

export default function TerminalPage() {
  const isElectronMode = hasElectronTerminal();
  const [tabs, setTabs] = useState([
    { id: "term-1", label: "Terminal 1" },
  ]);
  const [activeTabId, setActiveTabId] = useState("term-1");
  const [clearTrigger, setClearTrigger] = useState(0);

  const addTab = () => {
    if (tabs.length >= 8) return;
    const nextIdx = tabs.length + 1;
    const newId = `term-${Date.now()}`;
    setTabs((prev) => [...prev, { id: newId, label: `Terminal ${nextIdx}` }]);
    setActiveTabId(newId);
  };

  const removeTab = (tabIdToRemove, e) => {
    e.stopPropagation();
    if (tabs.length <= 1) return; // Keep at least one tab
    const nextTabs = tabs.filter((t) => t.id !== tabIdToRemove);
    setTabs(nextTabs);
    if (activeTabId === tabIdToRemove) {
      setActiveTabId(nextTabs[nextTabs.length - 1].id);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0c0e]">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-[#121214] px-4">
        <div className="flex items-center gap-2.5">
          <TerminalSquare size={18} className="text-violet-400" />
          <h1 className="font-mono text-sm font-semibold text-zinc-100">
            Terminal
          </h1>
          {/* Mode Badge */}
          {isElectronMode ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
              <Laptop size={11} />
              PTY Nativo (Electron)
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-violet-300">
              <Globe size={11} />
              REST API (Web)
            </span>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setClearTrigger((prev) => prev + 1)}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Eraser size={13} />
            <span>Limpar</span>
          </button>
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800/40 bg-[#0f0f12] px-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`group flex h-7 items-center gap-2 rounded-md px-2.5 text-xs font-mono transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive ? "bg-violet-400" : "bg-zinc-600"
                  }`}
                />
                <span>{tab.label}</span>
                {tabs.length > 1 && (
                  <X
                    size={12}
                    onClick={(e) => removeTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  />
                )}
              </button>
            );
          })}
        </div>

        {tabs.length < 8 && (
          <button
            type="button"
            onClick={addTab}
            title="Abrir novo terminal"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Main Terminal Viewport */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isElectronMode ? (
          <ElectronTerminalPanel
            key={activeTabId}
            terminalId={activeTabId}
            clearTrigger={clearTrigger}
          />
        ) : (
          <WebTerminalPanel
            key={activeTabId}
            terminalId={activeTabId}
            clearTrigger={clearTrigger}
          />
        )}
      </div>
    </div>
  );
}
