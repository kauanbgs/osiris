import { useRef, useState } from "react";
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
  const nextTerminalNumber = useRef(2);
  const [tabs, setTabs] = useState([{ id: "term-1", label: "Terminal 1" }]);
  const [activeTabId, setActiveTabId] = useState("term-1");
  const [clearTrigger, setClearTrigger] = useState(0);

  function addTab() {
    if (tabs.length >= 8) return;

    const number = nextTerminalNumber.current++;
    const newTab = { id: `term-${number}`, label: `Terminal ${number}` };

    setTabs((previous) => [...previous, newTab]);
    setActiveTabId(newTab.id);
  }

  function removeTab(tabId) {
    if (tabs.length <= 1) return;

    const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(remainingTabs);

    if (activeTabId === tabId) {
      setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0c0c0e]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800/60 bg-[#121214] px-4">
        <div className="flex items-center gap-2.5">
          <TerminalSquare size={18} className="text-violet-400" />
          <h1 className="font-mono text-sm font-semibold text-zinc-100">
            Terminal
          </h1>

          {isElectronMode ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
              <Laptop size={11} />
              PTY Nativo (Electron)
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-violet-300">
              <Globe size={11} />
              REST API (Web)
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setClearTrigger((previous) => previous + 1)}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Limpar a saída do terminal ativo"
        >
          <Eraser size={13} />
          <span>Limpar</span>
        </button>
      </header>

      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-zinc-800/40 bg-[#0f0f12] px-3">
        <div className="flex items-center gap-1 overflow-x-auto" aria-label="Terminais abertos">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;

            return (
              <div
                key={tab.id}
                className={`group flex h-7 items-center gap-1 rounded-md px-1 text-xs font-mono transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  aria-current={isActive ? "page" : undefined}
                  className="flex items-center gap-2 rounded px-1.5 py-1"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-violet-400" : "bg-zinc-600"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>

                {tabs.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Fechar ${tab.label}`}
                    title={`Fechar ${tab.label}`}
                    onClick={() => removeTab(tab.id)}
                    className="rounded p-0.5 text-zinc-500 hover:text-red-400 focus-visible:text-red-400"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {tabs.length < 8 && (
          <button
            type="button"
            onClick={addTab}
            title="Abrir novo terminal"
            aria-label="Abrir novo terminal"
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
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
