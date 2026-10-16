import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

/**
 * ElectronTerminalPanel
 * Wrapper do xterm.js para uso na página Terminal em modo Electron (PTY nativo).
 */
export default function ElectronTerminalPanel({ terminalId, clearTrigger = 0 }) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const dataListenerRef = useRef(null);

  // Clear disparado externamente
  useEffect(() => {
    if (clearTrigger > 0 && xtermRef.current) {
      xtermRef.current.clear();
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Instância do XTerm com tema escuro do Osíris
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      scrollback: 10000,
      theme: {
        background: "#0c0c0e",
        foreground: "#e4e4e7",
        cursor: "#a855f7",
        selectionBackground: "#581c87",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // 2. Montar no container DOM
    xterm.open(containerRef.current);

    const fitTimer = setTimeout(() => {
      try {
        fitAddon.fit();
        if (window.electronAPI?.terminalResize) {
          window.electronAPI.terminalResize(terminalId, xterm.cols, xterm.rows);
        }
      } catch (_) {}
    }, 60);

    // 3. Criar terminal no Electron
    if (window.electronAPI?.terminalCreate) {
      window.electronAPI.terminalCreate(terminalId, "default");
    }

    // 4. Input do usuário -> PTY
    const onDataDisposable = xterm.onData((data) => {
      if (window.electronAPI?.terminalWrite) {
        window.electronAPI.terminalWrite(terminalId, data);
      }
    });

    // 5. Output do PTY -> xterm
    const handleTerminalData = (targetId, data) => {
      if (targetId === terminalId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    if (window.electronAPI?.onTerminalData) {
      const cleanup = window.electronAPI.onTerminalData(handleTerminalData);
      dataListenerRef.current = cleanup;
    }

    // 6. Redimensionamento responsivo
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (window.electronAPI?.terminalResize) {
          window.electronAPI.terminalResize(terminalId, xterm.cols, xterm.rows);
        }
      } catch (_) {}
    });

    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    xterm.focus();

    // 7. Cleanup
    return () => {
      clearTimeout(fitTimer);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (typeof dataListenerRef.current === "function") {
        dataListenerRef.current();
      }
      onDataDisposable.dispose();
      if (window.electronAPI?.terminalClose) {
        window.electronAPI.terminalClose(terminalId);
      }
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full p-1"
      onClick={() => xtermRef.current?.focus()}
    />
  );
}
