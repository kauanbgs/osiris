import { useState } from 'react';
import { ChevronDown, FolderClosed, Mic, Paperclip, Send, TerminalSquare } from 'lucide-react';
import DotField from '@/components/DotField';

function SelectButton({ children }) {
  return (
    <button type="button" className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-white/6 bg-[#181818] px-2.5 text-[10px] text-zinc-500 transition-colors hover:border-white/10 hover:text-zinc-300">
      <span className="flex min-w-0 items-center gap-1.5 truncate">{children}</span>
      <ChevronDown size={11} className="ml-auto" />
    </button>
  );
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const date = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(now).replace(',', ' ·');

  function handleSubmit(event) {
    event.preventDefault();
    if (!prompt.trim()) return;
  }

  return (
    <section className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6 py-12 text-white">

      <div className="relative z-10 -mt-14 w-full max-w-180 font-mono">
        <header className="mb-10 text-center">
          <h1 className="text-[clamp(26px,3vw,38px)] font-semibold tracking-tight text-zinc-200">
            {greeting}, <span className="font-bold text-violet-500">Kauan</span>!
          </h1>
          <p className="mt-2 text-[11px] font-semibold text-zinc-300">{date}</p>
        </header>

        <div className="overflow-hidden rounded-xl border border-white/4 bg-[#171717]/95 shadow-2xl shadow-black/20 backdrop-blur-sm">
          <div className="flex h-12 items-center gap-1.5 border-b border-white/[0.035] bg-black/20 px-5">
            <TerminalSquare size={14} className="text-zinc-200" />
            <span className="text-[10px] font-semibold text-zinc-300">user/kauan:</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="flex min-h-18 items-center gap-3 px-5">
              <span className="text-sm font-semibold text-emerald-400">›</span>
              <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="O que você quer construir?" className="min-w-0 flex-1 bg-transparent text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600" />
              <button type="button" aria-label="Gravar mensagem" className="text-zinc-300 transition-colors hover:text-white"><Mic size={16} /></button>
            </div>

            <div className="flex min-h-12 items-center gap-3 border-t border-white/[0.035] bg-black/20 px-5 py-2">
              <button type="button" aria-label="Anexar arquivo" className="shrink-0 text-zinc-300 transition-colors hover:text-white"><Paperclip size={17} /></button>
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(130px,1fr)_150px_115px] gap-3 max-md:grid-cols-1">
                <SelectButton><FolderClosed size={11} className="shrink-0" />Path: /user/kauan/projetos/osiris</SelectButton>
                <SelectButton>Agent · No agent</SelectButton>
                <SelectButton>Model: Qwen 3 3.5B</SelectButton>
              </div>
              <button type="submit" aria-label="Enviar" className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md bg-violet-600 text-white transition-colors hover:bg-violet-500">
                <Send size={15} fill="currentColor" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
