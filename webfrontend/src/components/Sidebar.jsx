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
import { useNavigate } from 'react-router-dom';

const workspaceItems = [
  { label: 'Home', icon: House, link: '/home' },
  { label: 'Workflow', icon: Bot, link: '/workflow' },
  { label: 'Terminal', icon: TerminalSquare, link: '/terminal' },
  { label: 'Arquivos', icon: Folder, link: '/arquivos' },
];

const environmentItems = [
  { label: 'Modelos', icon: FileText, link: '/modelos' },
  { label: 'Memória', icon: Brain },
  { label: 'Monitoramento', icon: MonitorCog },
  { label: 'Configurações', icon: Settings },
];

const projects = ['Projeto 1', 'Projeto 2', 'Projeto 3', 'Projeto 4', 'Projeto 5'];

function NavGroup({ title, items }) {
  const navigate = useNavigate();

  return (
    <section className="mb-5">
      <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-500">
        {title}
      </h2>
      <nav className="space-y-0.5">
        {items.map(({ label, icon: Icon, link }) => (
          <button
            key={label}
            type="button"
            onClick={() => navigate(link)}
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
    <aside className="flex h-full w-54 flex-col border-r border-zinc-900 bg-[#121212] px-2.5 pb-3 pt-2 font-sans text-zinc-200 z-10">
      {/* Header fixo */}
      <div className="mb-8 flex h-8 shrink-0 items-center gap-2 px-0.5">
        <span className="text-[24px] font-semibold text-zinc-200">LOGO</span>
      </div>

      {/* Área scrollável */}
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
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
                className="group flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-zinc-900"
              >
                <CircleDot
                  size={8}
                  fill={index === 0 ? '#34d399' : '#52525b'}
                  stroke="none"
                  className={index === 0 ? 'text-emerald-400' : 'text-zinc-600'}
                />
                <span className="h-6 w-6 rounded-sm bg-indigo-400" />
                <span className="flex-1 text-[12px] text-zinc-300">{project}</span>
                <span className="pb-1 text-[12px] text-zinc-600">...</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Footer fixo */}
      <div className="flex shrink-0 items-center gap-2 border-t border-transparent pt-3">
        <div className="h-8 w-8 rounded-full bg-zinc-50" />
        <div className="min-w-0 flex-1">
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
