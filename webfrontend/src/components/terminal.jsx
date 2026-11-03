import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

function stripTerminalControlSequences(value) {
  return String(value)
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "");
}

export default function Terminal({ terminalId, mode, initialContent = "", onContentChange }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const savedContentRef = useRef(initialContent);
  

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
    if (initialContent) xterm.write(initialContent);
    xtermRef.current = xterm;
    savedContentRef.current = initialContent;

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
            savedContentRef.current = (savedContentRef.current + stripTerminalControlSequences(data)).slice(-4000);
            onContentChange?.(savedContentRef.current);
          }
        })
      : null;

    const removeExitListener = window.electronAPI?.onTerminalExit
      ? window.electronAPI.onTerminalExit((targetId, exitCode) => {
          if (targetId === terminalId) {
            xterm.write(String.fromCharCode(13, 10, 27) + "[90m[processo encerrado" + (exitCode ? " com codigo " + exitCode : "") + "]" + String.fromCharCode(27) + "[0m" + String.fromCharCode(13, 10));
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
      removeExitListener?.();
      xtermRef.current = null;
      if (window.electronAPI?.terminalClose) {
        window.electronAPI.terminalClose(terminalId);
      }
      xterm.dispose();
    };
  }, [terminalId, mode]);

  useEffect(() => {
    const xterm = xtermRef.current;
    if (!xterm || initialContent === savedContentRef.current) return;

    savedContentRef.current = initialContent;
    xterm.reset();
    if (initialContent) xterm.write(initialContent);
  }, [initialContent]);

  return <div ref={terminalRef} className="h-full w-full overflow-hidden" />;
}
