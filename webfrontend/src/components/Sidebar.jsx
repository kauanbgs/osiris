import {
  Bot,
  Brain,
  CircleDot,
  FileText,
  Folder,
  House,
  LogOut,
  MonitorCog,
  Plus,
  Settings,
  TerminalSquare,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import sheets from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const workspaceItems = [
  { label: "Home", icon: House, link: "/home" },
  { label: "Workflow", icon: Bot, link: "/workflow" },
  { label: "Terminal", icon: TerminalSquare, link: "/terminal" },
  { label: "Arquivos", icon: Folder, link: "/arquivos" },
];

const environmentItems = [
  { label: "Modelos", icon: FileText, link: "/modelos" },
  { label: "Memória", icon: Brain },
  { label: "Monitoramento", icon: MonitorCog },
  { label: "Configurações", icon: Settings },
];

function NavGroup({ title, items }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <section className="mb-5">
      <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-500">
        {title}
      </h2>

      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.link && location.pathname === item.link;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => item.link && navigate(item.link)}
              className={`group flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors ${
                isActive
                  ? "bg-zinc-800/90 text-zinc-100 font-medium"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={1.8}
                className={`transition-colors ${
                  isActive
                    ? "text-violet-400"
                    : "text-zinc-400 group-hover:text-zinc-200"
                }`}
              />

              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [chats, setChats] = useState([]);

  async function loadChats() {
    try {
      const response = await sheets.getChats();
      const list = response.data?.chats || response.data || [];
      setChats(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Erro ao buscar chats:", error);
    }
  }

  useEffect(() => {
    loadChats();

    const handleChatsUpdated = () => {
      loadChats();
    };

    window.addEventListener("osiris:chats-updated", handleChatsUpdated);
    return () => {
      window.removeEventListener("osiris:chats-updated", handleChatsUpdated);
    };
  }, []);

  async function handleCreateChat() {
    try {
      const response = await sheets.postChat({
        title: "Novo chat",
      });

      const newChat = response.data?.chat || response.data;
      if (newChat?.id_chat) {
        setChats((prev) => [newChat, ...prev]);
        navigate(`/home/${newChat.id_chat}`);
        window.dispatchEvent(new CustomEvent("osiris:chats-updated"));
      }
    } catch (error) {
      console.error("Erro ao criar chat:", error);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const userInitial = user?.name
    ? user.name.trim().charAt(0).toUpperCase()
    : null;

  return (
    <aside className="flex h-full w-56 flex-col border-r border-zinc-900 bg-[#121212] px-2.5 pb-3 pt-2 font-sans text-zinc-200 z-10 select-none">
      {/* Brand Header */}
      <div className="mb-6 flex h-8 shrink-0 items-center gap-2 px-1">
        <span className="font-mono text-xl font-bold tracking-tight text-zinc-100">
          OSIRIS
        </span>
      </div>

      {/* Navigation & Chat lists */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <NavGroup title="Workspace" items={workspaceItems} />
        <NavGroup title="Ambiente" items={environmentItems} />

        <section>
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.04em] text-zinc-500">
              Chats
            </h2>

            <button
              type="button"
              aria-label="Novo chat"
              onClick={handleCreateChat}
              title="Novo chat"
              className="text-zinc-500 transition-colors hover:text-white"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="space-y-0.5">
            {chats.map((chat) => {
              const chatId = chat.id_chat ?? chat.id;
              const chatTitle = chat.title ?? chat.name ?? "Chat sem título";
              const isActive = location.pathname === `/home/${chatId}`;

              return (
                <button
                  key={chatId}
                  type="button"
                  onClick={() => navigate(`/home/${chatId}`)}
                  className={`group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors ${
                    isActive
                      ? "bg-zinc-800/80 text-zinc-100 font-medium"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <CircleDot
                    size={8}
                    className={isActive ? "text-violet-400" : "text-zinc-600"}
                  />

                  <span className="truncate text-[12px]">
                    {chatTitle}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* User profile footer */}
      <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-zinc-900/80 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600/20 font-mono text-xs font-bold text-violet-300 ring-1 ring-violet-500/30">
            {userInitial ? userInitial : <User size={15} className="text-zinc-400" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-zinc-200" title={user?.name || "Usuário"}>
              {user?.name || "Usuário"}
            </p>
            <p className="truncate text-[10px] text-zinc-500" title={user?.email || "Local"}>
              {user?.email || "Local"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair da conta"
          title="Sair"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}