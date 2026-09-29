import { useState } from "react";
import {
  Brain,
  Plus,
  Search,
  Trash2,
  Sparkles,
  Pencil,
} from "lucide-react";

export default function MemoryPage() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  // Mock inicial — depois você troca pela API
  const [memories, setMemories] = useState([]);

  function handleSave() {
    const value = input.trim();

    if (!value) return;

    setMemories((prev) => [
      {
        id: crypto.randomUUID(),
        content: value,
        createdAt: new Date(),
      },
      ...prev,
    ]);

    setInput("");
  }

  function handleDelete(id) {
    setMemories((prev) => prev.filter((memory) => memory.id !== id));
  }

  const filteredMemories = memories.filter((memory) =>
    memory.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="h-full overflow-y-auto text-white">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">

        {/* Header */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
              <Brain className="size-5 text-violet-400" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Memória
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                Informações que o Osiris pode lembrar entre conversas.
              </p>
            </div>
          </div>
        </header>

        {/* Nova memória */}
        <div className="mb-8 rounded-2xl border border-white/8 bg-zinc-900/50 p-5 shadow-xl shadow-black/10 backdrop-blur">

          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="size-4 text-violet-400" />

            <h2 className="text-sm font-medium text-zinc-200">
              Adicionar nova memória
            </h2>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSave();
                  }
                }}
                placeholder="Ex: Prefiro respostas curtas e objetivas..."
                className="
                  h-11 w-full rounded-xl
                  border border-white/10
                  bg-black/20
                  px-4 text-sm text-zinc-200
                  outline-none
                  placeholder:text-zinc-600
                  transition
                  hover:border-white/15
                  focus:border-violet-500/50
                  focus:ring-2
                  focus:ring-violet-500/10
                "
              />
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={!input.trim()}
              className="
                inline-flex h-11 items-center gap-2
                rounded-xl
                bg-violet-600
                px-5
                text-sm font-medium text-white
                transition
                hover:bg-violet-500
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Plus className="size-4" />
              Salvar
            </button>
          </div>

          <p className="mt-3 text-xs text-zinc-600">
            Salve preferências, informações pessoais ou contextos que você
            queira manter entre chats.
          </p>
        </div>

        {/* Lista */}
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-zinc-300">
                Memórias salvas
              </h2>

              <p className="mt-0.5 text-xs text-zinc-600">
                {memories.length}{" "}
                {memories.length === 1 ? "memória salva" : "memórias salvas"}
              </p>
            </div>

            {memories.length > 0 && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar memória..."
                  className="
                    h-9 w-full rounded-lg
                    border border-white/8
                    bg-zinc-900/40
                    pl-9 pr-3
                    text-xs text-zinc-300
                    outline-none
                    placeholder:text-zinc-600
                    focus:border-violet-500/40
                  "
                />
              </div>
            )}
          </div>

          {/* Empty state */}
          {memories.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/20 px-6 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-zinc-800/50 ring-1 ring-white/5">
                <Brain className="size-6 text-zinc-500" />
              </div>

              <h3 className="text-sm font-medium text-zinc-300">
                Nenhuma memória ainda
              </h3>

              <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-600">
                Adicione informações importantes para que o Osiris possa usar
                esse contexto em futuras conversas.
              </p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-2xl border border-white/8 bg-zinc-900/20">
              <p className="text-sm text-zinc-600">
                Nenhuma memória encontrada.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredMemories.map((memory) => (
                <article
                  key={memory.id}
                  className="
                    group
                    rounded-xl
                    border border-white/8
                    bg-zinc-900/40
                    p-4
                    transition-all
                    hover:border-violet-500/20
                    hover:bg-zinc-900/70
                  "
                >
                  <div className="flex gap-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <Brain className="size-4 text-violet-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-6 text-zinc-300">
                        {memory.content}
                      </p>

                      <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-600">
                        <span>
                          {memory.createdAt.toLocaleDateString("pt-BR")}
                        </span>

                        <span>•</span>

                        <span>
                          {memory.createdAt.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
                      >
                        <Pencil className="size-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(memory.id)}
                        className="flex size-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}