import {
  Bot,
  Brain,
  CircleDot,
  FileText,
  Folder,
  House,
  MonitorCog,
  Plus,
  Settings,
  TerminalSquare,
} from 'lucide-react';

const workspaceItems = [
  { label: 'Home', icon: House },
  { label: 'Workflow', icon: Bot },
  { label: 'Terminal', icon: TerminalSquare },
  { label: 'Arquivos', icon: Folder },
];

const environmentItems = [
  { label: 'Modelos', icon: FileText },
  { label: 'Memória', icon: Brain },
  { label: 'Monitoramento', icon: MonitorCog },
  { label: 'Configurações', icon: Settings },
];

const projects = ['Projeto 1', 'Projeto 2', 'Projeto 3', 'Projeto 4', 'Projeto 5'];

function NavGroup({ title, items }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-500">
        {title}
      </h2>
      <nav className="space-y-0.5">
        {items.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="group flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            <Icon size={20} strokeWidth={1.8} className="text-zinc-400 group-hover:text-zinc-200" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </section>
  );
}

export default function Sidebar() {
  return (
    <aside className="flex h-dvh w-[218px] shrink-0 flex-col border-r border-zinc-900 bg-[#121212] px-2.5 pb-3 pt-2 font-sans text-zinc-200">
      <div className="mb-8 flex h-8 items-center gap-2 px-0.5">
        <div aria-hidden="true" className="relative h-7 w-6 text-white">
          <span className="absolute left-1/2 top-[1px] -translate-x-1/2 text-[29px] font-black leading-6">*</span>
          <span className="absolute bottom-0 left-1/2 h-[3px] w-[18px] -translate-x-1/2 bg-white" />
        </div>
        <span className="text-[24px] font-semibold tracking-tight text-zinc-200">LOGO</span>
      </div>

      <NavGroup title="Workspace" items={workspaceItems} />
      <NavGroup title="Ambiente" items={environmentItems} />

      <section>
        <div className="mb-2 flex items-center justify-between px-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-500">Projects</h2>
          <button type="button" aria-label="Novo projeto" className="text-zinc-500 transition-colors hover:text-white">
            <Plus size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-0.5">
          {projects.map((project, index) => (
            <button
              key={project}
              type="button"
              className="group flex h-[33px] w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-zinc-900"
            >
              <CircleDot
                size={8}
                fill={index === 0 ? '#34d399' : '#52525b'}
                stroke="none"
                className={index === 0 ? 'text-emerald-400' : 'text-zinc-600'}
              />
              <span className="h-6 w-6 shrink-0 rounded-sm bg-indigo-400" />
              <span className="flex-1 text-[12px] text-zinc-300">{project}</span>
              <span className="pb-1 text-[12px] tracking-widest text-zinc-600">...</span>
            </button>
          ))}
        </div>
      </section>

      <div className="mt-auto flex items-center gap-2 border-t border-transparent pt-3">
        <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-50" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] text-zinc-300">bgs</p>
          <p className="truncate text-[11px] text-zinc-600">local account · kauan</p>
        </div>
        <button type="button" aria-label="Configurações da conta" className="text-zinc-500 hover:text-zinc-200">
          <Settings size={16} />
        </button>
      </div>
    </aside>
  );
}
