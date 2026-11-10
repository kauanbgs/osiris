import {
  Bot,
  Brain,
  Check,
  CircleDot,
  Compass,
  FileText,
  Folder,
  Globe,
  House,
  LogOut,
  Pencil,
  Plus,
  Settings,
  TerminalSquare,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import sheets from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { activeProjectKey, useActiveProject } from "@/contexts/useActiveProject";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { OsirisBrand } from "@/components/OsirisLogo";

const workspaceItems = [
  { label: "Home", icon: House, link: "/home" },
  { label: "Navegador", icon: Globe, link: "/navegador" },
  { label: "Workflow", icon: Bot, link: "/workflow" },
  { label: "Terminal", icon: TerminalSquare, link: "/terminal" },
  { label: "Navegador", icon: Compass, link: "/navegador" },
  { label: "Arquivos", icon: Folder, link: "/arquivos" },
];

const environmentItems = [
  { label: "Modelos", icon: FileText, link: "/modelos" },
  { label: "Memória", icon: Brain, link: "/memoria" },
  { label: "Configurações", icon: Settings, link: "/configuracoes" },
];

function NavGroup({ title, items }) {
  const { activeId } = useActiveProject();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <section className="mb-5">
      <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {title}
      </h2>

      <nav className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const target = activeId && (item.link === "/home" || item.link === "/workflow")
            ? item.link + "/" + encodeURIComponent(activeId) : item.link;
          const isActive = item.link && (location.pathname === item.link || location.pathname.startsWith(item.link + "/"));

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => target && navigate(target)}
              className={`group flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={1.8}
                className={`transition-colors ${
                  isActive
                    ? "text-sidebar-primary"
                    : "text-sidebar-foreground group-hover:text-sidebar-accent-foreground"
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

function ChatItem({ chat, isActive, onDeleted, onRenamed }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("idle");
  const [renameValue, setRenameValue] = useState(chat.title ?? "");
  const inputRef = useRef(null);

  const { user } = useAuth();
  const chatId = chat.id_chat ?? chat.id;

  useEffect(() => {
    if (mode === "rename") {
      inputRef.current?.select();
    }
  }, [mode]);

  async function handleRename() {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === (chat.title ?? "")) {
      setMode("idle");
      return;
    }
    try {
      await sheets.updateChat(chatId, { title: trimmed });
      onRenamed(chatId, trimmed);
    } catch (e) {
      console.error("Erro ao renomear chat:", e);
    }
    setMode("idle");
  }

  async function handleDelete() {
    try {
      await sheets.deleteChat(chatId);
      if (window.electronAPI?.deleteWorkflow) {
        try {
          await window.electronAPI.deleteWorkflow(user?.id_user ?? user?.id ?? user?.email, chatId);
        } catch (error) { console.error("Erro ao remover workflow local:", error); }
      }
      onDeleted(chatId);
    } catch (e) {
      console.error("Erro ao deletar chat:", e);
    }
    setMode("idle");
  }

  if (mode === "rename") {
    return (
      <div className="flex h-8 w-full items-center gap-1 rounded-md bg-sidebar-accent px-2">
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename();
            if (e.key === "Escape") setMode("idle");
          }}
          onBlur={handleRename}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-sidebar-accent-foreground outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); handleRename(); }}
          className="text-sidebar-primary hover:opacity-80"
        >
          <Check size={13} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); setMode("idle"); }}
          className="text-muted-foreground hover:text-sidebar-accent-foreground"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`group flex h-8 w-full items-center gap-2 rounded-md px-2 transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => navigate(`/home/${chatId}`)}
        >
          <CircleDot
            size={8}
            className={`shrink-0 ${isActive ? "text-sidebar-primary" : "text-muted-foreground"}`}
          />
          <span className="truncate text-[12px]">{chat.title ?? "Chat sem título"}</span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {window.electronAPI?.loadWorkflow && <button type="button" title="Abrir workflow do projeto" aria-label="Abrir workflow do projeto" onClick={() => navigate('/workflow/' + chatId)} className="flex h-5 w-5 items-center justify-center rounded text-sidebar-primary hover:bg-sidebar-accent"><Bot size={12} /></button>}
          <button
            type="button"
            title="Renomear"
            onClick={(e) => {
              e.stopPropagation();
              setRenameValue(chat.title ?? "");
              setMode("rename");
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            title="Deletar"
            onClick={(e) => {
              e.stopPropagation();
              setMode("confirmDelete");
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-sidebar-accent hover:text-red-400"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {mode === "confirmDelete" && (
        <ConfirmDeleteModal
          title={chat.title ?? "Chat sem título"}
          onConfirm={handleDelete}
          onCancel={() => setMode("idle")}
        />
      )}
    </>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { owner, activeId } = useActiveProject();

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
    const handleChatsUpdated = () => loadChats();
    window.addEventListener("osiris:chats-updated", handleChatsUpdated);
    return () => window.removeEventListener("osiris:chats-updated", handleChatsUpdated);
  }, []);

  async function handleCreateChat() {
    try {
      const response = await sheets.postChat({ title: "Novo chat" });
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

  function handleChatDeleted(chatId) {
    if (String(activeId) === String(chatId) && owner) localStorage.removeItem(activeProjectKey(owner));
    setChats((prev) => prev.filter((c) => (c.id_chat ?? c.id) !== chatId));
    if (location.pathname === `/home/${chatId}` || location.pathname === `/workflow/${chatId}`) {
      navigate("/home");
    }
    window.dispatchEvent(new CustomEvent("osiris:chats-updated"));
  }

  function handleChatRenamed(chatId, newTitle) {
    setChats((prev) =>
      prev.map((c) =>
        (c.id_chat ?? c.id) === chatId ? { ...c, title: newTitle } : c
      )
    );
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const userInitial = user?.name ? user.name.trim().charAt(0).toUpperCase() : null;

  return (
    <aside id="osiris-sidebar" className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar px-2.5 pb-3 pt-2 font-sans text-sidebar-accent-foreground z-10 select-none">
      <div className="mb-6 flex h-10 shrink-0 items-center px-1">
        <OsirisBrand
          text="Osiris"
          textClassName="font-claude font-medium tracking-tight"
          textSizeClassName="text-lg"
          markClassName="h-9"
          className="text-sidebar-accent-foreground"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <NavGroup title="Workspace" items={workspaceItems} />
        <NavGroup title="Ambiente" items={environmentItems} />

        <section>
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              Projetos
            </h2>
            <button
              type="button"
              aria-label="Novo chat"
              onClick={handleCreateChat}
              title="Novo chat"
              className="text-muted-foreground transition-colors hover:text-sidebar-accent-foreground"
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>

          <div className="space-y-0.5">
            {chats.map((chat) => {
              const chatId = chat.id_chat ?? chat.id;
              const isActive = location.pathname === `/home/${chatId}` || location.pathname === `/workflow/${chatId}`;
              return (
                <ChatItem
                  key={chatId}
                  chat={chat}
                  isActive={isActive}
                  onDeleted={handleChatDeleted}
                  onRenamed={handleChatRenamed}
                />
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t border-sidebar-border pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 font-mono text-xs font-bold text-sidebar-primary ring-1 ring-sidebar-primary/30">
            {userInitial ? userInitial : <User size={15} className="text-sidebar-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-sidebar-accent-foreground" title={user?.name || "Usuário"}>
              {user?.name || "Usuário"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground" title={user?.email || "Local"}>
              {user?.email || "Local"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          aria-label="Sair da conta"
          title="Sair"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-red-400"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
