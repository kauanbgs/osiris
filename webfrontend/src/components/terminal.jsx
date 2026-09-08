import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

export default function Terminal({ terminalId, mode }) {
  const terminalRef = useRef(null);
  

  useEffect(() => {
    if (!terminalRef.current || !terminalId) return;

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

    xterm.open(terminalRef.current);

    // Ensure layout dimensions are computed before initial fit
    const fitTimer = setTimeout(() => {
      try {
        fitAddon.fit();
        if (window.electronAPI?.terminalResize) {
          window.electronAPI.terminalResize(terminalId, xterm.cols, xterm.rows);
        }
      } catch (e) {
        console.error(e);
      }
    }, 60);

    if (window.electronAPI?.terminalCreate) {
      window.electronAPI.terminalCreate(terminalId, mode);
    }

    const inputDisposable = xterm.onData((data) => {
      if (window.electronAPI?.terminalWrite) {
        window.electronAPI.terminalWrite(terminalId, data);
      }
    });

    const removeDataListener = window.electronAPI?.onTerminalData
      ? window.electronAPI.onTerminalData((targetId, data) => {
          if (targetId === terminalId) {
            xterm.write(data);
          }
        })
      : null;

    const resize = () => {
      try {
        fitAddon.fit();
        if (window.electronAPI?.terminalResize) {
          window.electronAPI.terminalResize(terminalId, xterm.cols, xterm.rows);
        }
      } catch (e) {
        // ignore
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });

    resizeObserver.observe(terminalRef.current);

    xterm.focus();

    return () => {
      clearTimeout(fitTimer);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      removeDataListener?.();
      if (window.electronAPI?.terminalClose) {
        window.electronAPI.terminalClose(terminalId);
      }
      xterm.dispose();
    };
  }, [terminalId, mode]);

  return <div ref={terminalRef} className="h-full w-full overflow-hidden" />;
}
