import { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Sparkles } from 'lucide-react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  useEffect(() => {
    if (!isElectron) return;
    const checkMaximized = async () => {
      try {
        const max = await window.electronAPI.isMaximized();
        setIsMaximized(max);
      } catch (err) {
        console.error(err);
      }
    };
    checkMaximized();
  }, [isElectron]);

  const handleMinimize = () => {
    if (isElectron) window.electronAPI.minimize();
  };

  const handleMaximize = async () => {
    if (isElectron) {
      window.electronAPI.maximize();
      const max = await window.electronAPI.isMaximized();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    if (isElectron) window.electronAPI.close();
  };

  return (
    <header
      className="flex h-9 w-full shrink-0 select-none items-center justify-between border-b border-zinc-800/80 bg-[#121212] px-3 font-sans text-zinc-300 z-50"
      style={{ WebkitAppRegion: 'drag' }}
    >

      {/* Middle Drag Area / Workspace Title */}
      <div className="flex flex-1 items-center justify-center px-4">
        <span className="font-mono text-[11px] text-zinc-500 opacity-80">
          Osiris Environment
        </span>
      </div>

      {/* Window Controls */}
      {isElectron ? (
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <button
            type="button"
            onClick={handleMinimize}
            aria-label="Minimizar"
            className="flex h-6 w-8 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Minus size={13} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            aria-label="Maximizar / Restaurar"
            className="flex h-6 w-8 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            {isMaximized ? (
              <Copy size={11} strokeWidth={2} className="rotate-180" />
            ) : (
              <Square size={11} strokeWidth={2} />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="flex h-6 w-8 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-red-600 hover:text-white"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-1.5"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        </div>
      )}
    </header>
  );
}
