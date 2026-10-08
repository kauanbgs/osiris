import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Workflow,
  Plus,
  MoreHorizontal,
  Clock3,
  Bot,
  ChevronRight,
  X,
} from "lucide-react";

const initialWorkflows = [
  {
    id: "1",
    name: "Research Agent",
    description:
      "Pesquisa informações, processa arquivos e gera relatórios automaticamente.",
    nodes: 6,
    updatedAt: "Há 5 minutos",
  },
  {
    id: "2",
    name: "Code Review",
    description:
      "Analisa arquivos do projeto e envia o código para revisão de um agente.",
    nodes: 4,
    updatedAt: "Há 2 horas",
  },
  {
    id: "3",
    name: "Content Generator",
    description:
      "Gera conteúdo automaticamente utilizando múltiplos agentes.",
    nodes: 8,
    updatedAt: "Ontem",
  },
  {
    id: "4",
    name: "File Analyzer",
    description:
      "Recebe arquivos, processa o conteúdo e extrai informações importantes.",
    nodes: 5,
    updatedAt: "Há 2 dias",
  },
];

export default function Workflows() {
  const navigate = useNavigate();

  const [workflows, setWorkflows] =
    useState(initialWorkflows);

  const [createOpen, setCreateOpen] =
    useState(false);

  function openWorkflow(id) {
    navigate(`/workflows/${id}`);
  }

  function createWorkflow(data) {
    const newWorkflow = {
      id: crypto.randomUUID(),

      name: data.name,

      description:
        data.description ||
        "Workflow sem descrição.",

      nodes: 0,

      updatedAt: "Agora",
    };

    setWorkflows((current) => [
      newWorkflow,
      ...current,
    ]);

    setCreateOpen(false);

    // Se quiser entrar automaticamente:
    // navigate(`/workflows/${newWorkflow.id}`);
  }

  return (
    <div className="min-h-screen bg-[#141414] text-white">

      {/* HEADER */}
      <header className="border-b border-zinc-800/70">
        <div
          className="
            mx-auto
            flex h-16
            max-w-7xl
            items-center
            justify-between
            px-6
          "
        >
          <div className="flex items-center gap-2">
            <Workflow
              size={20}
              className="text-zinc-400"
            />

            <span className="text-sm font-medium">
              Workflows
            </span>
          </div>

          <button
            onClick={() => setCreateOpen(true)}
            className="
              flex h-9
              items-center gap-2
              rounded-lg
              bg-white
              px-4
              text-sm font-medium
              text-black
              transition
              hover:bg-zinc-200
            "
          >
            <Plus size={16} />

            Novo workflow
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <main className="mx-auto max-w-7xl px-6 py-10">

        {/* TITLE */}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Workflows
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Crie e gerencie seus workflows.
          </p>
        </div>

        {/* COUNTER */}
        <div className="mt-10">
          <span className="text-xs text-zinc-600">
            {workflows.length}{" "}
            {workflows.length === 1
              ? "workflow"
              : "workflows"}
          </span>
        </div>

        {/* WORKFLOWS */}
        {workflows.length > 0 ? (
          <div
            className="
              mt-4
              grid grid-cols-1
              gap-4
              md:grid-cols-2
              xl:grid-cols-3
            "
          >
            {workflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onOpen={() =>
                  openWorkflow(workflow.id)
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            onCreate={() =>
              setCreateOpen(true)
            }
          />
        )}

      </main>

      {/* CREATE MODAL */}
      <CreateWorkflowModal
        open={createOpen}
        onClose={() =>
          setCreateOpen(false)
        }
        onCreate={createWorkflow}
      />

    </div>
  );
}

/* ----------------------------------
   WORKFLOW CARD
----------------------------------- */

function WorkflowCard({
  workflow,
  onOpen,
}) {
  return (
    <div
      onClick={onOpen}
      className="
        group
        cursor-pointer
        rounded-xl
        border border-zinc-800/80
        bg-zinc-900/20
        p-5
        transition-all
        duration-200

        hover:-translate-y-0.5
        hover:border-zinc-700
        hover:bg-zinc-900/50
      "
    >

      <div className="flex items-start justify-between">

        <div
          className="
            flex h-10 w-10
            items-center justify-center
            rounded-lg
            border border-zinc-800
            bg-zinc-900
          "
        >
          <Workflow
            size={18}
            className="text-zinc-400"
          />
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();

            console.log(
              "Workflow:",
              workflow.id
            );
          }}
          className="
            rounded-md
            p-1.5
            text-zinc-600
            opacity-0
            transition

            hover:bg-zinc-800
            hover:text-zinc-300

            group-hover:opacity-100
          "
        >
          <MoreHorizontal size={18} />
        </button>

      </div>

      {/* INFO */}
      <div className="mt-5">

        <h2
          className="
            truncate
            text-[15px]
            font-medium
            text-zinc-200
            transition
            group-hover:text-white
          "
        >
          {workflow.name}
        </h2>

        <p
          className="
            mt-2
            line-clamp-2
            min-h-[40px]
            text-sm
            leading-5
            text-zinc-600
          "
        >
          {workflow.description}
        </p>

      </div>

      {/* FOOTER */}
      <div
        className="
          mt-6
          flex items-center
          justify-between
          border-t border-zinc-800/70
          pt-4
        "
      >

        <div className="flex items-center gap-4">

          <span
            className="
              flex items-center gap-1.5
              text-xs text-zinc-600
            "
          >
            <Bot size={13} />

            {workflow.nodes} nodes
          </span>

          <span
            className="
              flex items-center gap-1.5
              text-xs text-zinc-600
            "
          >
            <Clock3 size={13} />

            {workflow.updatedAt}
          </span>

        </div>

        <ChevronRight
          size={16}
          className="
            text-zinc-700
            transition-all

            group-hover:translate-x-0.5
            group-hover:text-zinc-400
          "
        />

      </div>

    </div>
  );
}

/* ----------------------------------
   CREATE WORKFLOW MODAL
----------------------------------- */

function CreateWorkflowModal({
  open,
  onClose,
  onCreate,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");

  if (!open) {
    return null;
  }

  function handleClose() {
    setName("");
    setDescription("");

    onClose();
  }

  function handleSubmit(event) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      return;
    }

    onCreate({
      name: cleanName,
      description: description.trim(),
    });

    setName("");
    setDescription("");
  }

  return (
    <div
      className="
        fixed inset-0
        z-[100]
        flex items-center
        justify-center
        bg-black/60
        p-4
        backdrop-blur-sm
      "
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          handleClose();
        }
      }}
    >

      <div
        className="
          w-full max-w-md
          overflow-hidden
          rounded-xl
          border border-zinc-800
          bg-[#181818]
          shadow-2xl
        "
      >

        {/* HEADER */}
        <div
          className="
            flex items-start
            justify-between
            border-b border-zinc-800
            px-5 py-4
          "
        >

          <div>
            <h2 className="text-base font-medium">
              Novo workflow
            </h2>

            <p className="mt-1 text-xs text-zinc-500">
              Crie um novo workflow para começar.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="
              rounded-md
              p-1.5
              text-zinc-500
              transition

              hover:bg-zinc-800
              hover:text-white
            "
          >
            <X size={17} />
          </button>

        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit}>

          <div className="space-y-5 p-5">

            {/* NAME */}
            <div>
              <label
                htmlFor="workflow-name"
                className="
                  mb-2
                  block
                  text-xs font-medium
                  text-zinc-400
                "
              >
                Nome
              </label>

              <input
                id="workflow-name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Ex: Research Agent"
                autoFocus
                className="
                  h-10 w-full
                  rounded-lg
                  border border-zinc-800
                  bg-zinc-900/70
                  px-3
                  text-sm text-white
                  outline-none
                  transition

                  placeholder:text-zinc-600

                  focus:border-zinc-600
                  focus:ring-1
                  focus:ring-zinc-700
                "
              />
            </div>

            {/* DESCRIPTION */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="workflow-description"
                  className="
                    text-xs font-medium
                    text-zinc-400
                  "
                >
                  Descrição
                </label>

                <span className="text-[10px] text-zinc-600">
                  Opcional
                </span>
              </div>

              <textarea
                id="workflow-description"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                placeholder="Descreva o objetivo deste workflow..."
                rows={4}
                maxLength={250}
                className="
                  w-full
                  resize-none
                  rounded-lg
                  border border-zinc-800
                  bg-zinc-900/70
                  px-3 py-2.5
                  text-sm
                  leading-5
                  text-white
                  outline-none
                  transition

                  placeholder:text-zinc-600

                  focus:border-zinc-600
                  focus:ring-1
                  focus:ring-zinc-700
                "
              />

              <div className="mt-1.5 text-right">
                <span className="text-[10px] text-zinc-600">
                  {description.length}/250
                </span>
              </div>
            </div>

          </div>

          {/* FOOTER */}
          <div
            className="
              flex items-center
              justify-end
              gap-2
              border-t border-zinc-800
              px-5 py-4
            "
          >

            <button
              type="button"
              onClick={handleClose}
              className="
                h-9
                rounded-lg
                px-4
                text-sm
                text-zinc-400
                transition

                hover:bg-zinc-800
                hover:text-white
              "
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!name.trim()}
              className="
                flex h-9
                items-center gap-2
                rounded-lg
                bg-white
                px-4
                text-sm font-medium
                text-black
                transition

                hover:bg-zinc-200

                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Plus size={15} />

              Criar workflow
            </button>

          </div>

        </form>

      </div>

    </div>
  );
}

/* ----------------------------------
   EMPTY STATE
----------------------------------- */

function EmptyState({
  onCreate,
}) {
  return (
    <div
      className="
        mt-24
        flex flex-col
        items-center
        justify-center
        text-center
      "
    >

      <div
        className="
          flex h-12 w-12
          items-center justify-center
          rounded-xl
          border border-zinc-800
          bg-zinc-900
        "
      >
        <Workflow
          size={20}
          className="text-zinc-600"
        />
      </div>

      <h3 className="mt-4 text-sm font-medium">
        Nenhum workflow
      </h3>

      <p
        className="
          mt-2
          max-w-xs
          text-xs
          leading-5
          text-zinc-600
        "
      >
        Crie seu primeiro workflow para começar.
      </p>

      <button
        onClick={onCreate}
        className="
          mt-5
          flex items-center gap-2
          rounded-lg
          bg-white
          px-4 py-2
          text-xs font-medium
          text-black
          transition
          hover:bg-zinc-200
        "
      >
        <Plus size={14} />

        Novo workflow
      </button>

    </div>
  );
}