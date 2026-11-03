
import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export default function ElectronTerminalPanel({
  terminalId,
  clearTrigger = 0,
}) {
  const containerRef = useRef(null);
  const xtermRef = useRef(null);
  const resizeObserverRef = useRef(null);

  // Limpar terminal pelo botão da página
  useEffect(() => {
    if (clearTrigger > 0 && xtermRef.current) {
      xtermRef.current.clear();
    }
  }, [clearTrigger]);

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    // Criar o terminal visual
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily:
        '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
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
    xterm.open(containerRef.current);

    xtermRef.current = xterm;

    // Ajustar tamanho do terminal
    function ajustarTerminal() {
      if (disposed) return;

      try {
        fitAddon.fit();

        window.electronAPI?.terminalResize?.(
          terminalId,
          xterm.cols,
          xterm.rows
        );
      } catch (error) {
        console.error(
          "Erro ao redimensionar terminal:",
          error
        );
      }
    }

    // Receber resultado dos comandos
    const removerDados =
      window.electronAPI?.onTerminalData?.(
        (targetId, data) => {
          if (targetId === terminalId && !disposed) {
            xterm.write(data);
          }
        }
      );

    // Detectar encerramento do PowerShell
    const removerSaida =
      window.electronAPI?.onTerminalExit?.(
        (targetId, exitCode) => {
          if (targetId === terminalId && !disposed) {
            xterm.writeln(
              `\r\n\x1b[33mTerminal encerrado (código ${exitCode}).\x1b[0m`
            );
          }
        }
      );

    // Enviar cada tecla digitada para o PowerShell
    const onDataDisposable = xterm.onData((data) => {
      if (disposed) return;

      window.electronAPI?.terminalWrite?.(
        terminalId,
        data
      );
    });

    // Criar processo do PowerShell no Electron
    if (!window.electronAPI?.terminalCreate) {
      xterm.writeln(
        "\r\n\x1b[31mTerminal nativo indisponível.\x1b[0m"
      );
    } else {
      Promise.resolve(
        window.electronAPI.terminalCreate(
          terminalId,
          "default"
        )
      ).catch((error) => {
        if (!disposed) {
          xterm.writeln(
            `\r\n\x1b[31mErro ao iniciar terminal: ${String(
              error?.message || error
            )}\x1b[0m`
          );
        }
      });
    }

    // Observar alteração de tamanho da janela
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        ajustarTerminal();
      });

      observer.observe(containerRef.current);
      resizeObserverRef.current = observer;
    }

    // Ajustar e ativar o teclado
    const fitTimer = setTimeout(() => {
      ajustarTerminal();
      xterm.focus();
    }, 100);

    const focusFrame = requestAnimationFrame(() => {
      xterm.focus();
    });

    // Remover recursos ao sair da página
    return () => {
      disposed = true;

      clearTimeout(fitTimer);
      cancelAnimationFrame(focusFrame);

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (typeof removerDados === "function") {
        removerDados();
      }

      if (typeof removerSaida === "function") {
        removerSaida();
      }

      onDataDisposable.dispose();

      window.electronAPI?.terminalClose?.(terminalId);

      xterm.dispose();
      xtermRef.current = null;
    };
  }, [terminalId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full cursor-text p-1"
      role="region"
      aria-label="Terminal PowerShell interativo"
      tabIndex={0}
      onFocus={() => xtermRef.current?.focus()}
      onPointerDown={() => xtermRef.current?.focus()}
      onClick={() => xtermRef.current?.focus()}
    />
  );
}
