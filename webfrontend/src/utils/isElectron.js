/**
 * Utilitário centralizado de detecção de ambiente Electron.
 */

export function hasElectronTerminal() {
  return (
    typeof window !== "undefined" &&
    typeof window.electronAPI?.terminalCreate === "function"
  );
}

export function isElectron() {
  return (
    typeof window !== "undefined" &&
    typeof window.electronAPI !== "undefined"
  );
}
