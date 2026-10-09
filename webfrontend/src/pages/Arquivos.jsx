import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FolderSearch,
  Save,
  X,
} from "lucide-react";

export default function Arquivos() {
  const [workspace, setWorkspace] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [openFiles, setOpenFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [saving, setSaving] = useState(false);

  const activeFile =
    openFiles.find((file) => file.filePath === activePath) || null;

  // =========================================================
  // ESCOLHER PASTA
  // =========================================================

  async function handleSelectFolder() {
    try {
      const result = await window.electronAPI.selectFolder();

      if (!result) return;

      setWorkspace(result);

      setOpenFiles([]);
      setActivePath(null);

      setExpanded({
        [result.folderPath]: true,
      });
    } catch (error) {
      console.error("Erro ao abrir pasta:", error);
    }
  }

  // =========================================================
  // ABRIR ARQUIVO
  // =========================================================

  async function handleOpenFile(item) {
    const alreadyOpen = openFiles.find(
      (file) => file.filePath === item.path,
    );

    if (alreadyOpen) {
      setActivePath(alreadyOpen.filePath);
      return;
    }

    try {
      const result = await window.electronAPI.readFile(item.path);

      if (!result) return;

      const file = {
        ...result,
        originalContent: result.fileContent,
        dirty: false,
      };

      setOpenFiles((current) => [...current, file]);

      setActivePath(file.filePath);
    } catch (error) {
      console.error("Erro ao abrir arquivo:", error);
    }
  }

  // =========================================================
  // EDITAR
  // =========================================================

  function handleChange(value) {
    if (!activeFile) return;

    setOpenFiles((current) =>
      current.map((file) => {
        if (file.filePath !== activeFile.filePath) {
          return file;
        }

        return {
          ...file,
          fileContent: value,
          dirty: value !== file.originalContent,
        };
      }),
    );
  }

  // =========================================================
  // SALVAR
  // =========================================================

  async function handleSave() {
    if (!activeFile || !activeFile.dirty || saving) {
      return;
    }

    try {
      setSaving(true);

      await window.electronAPI.writeFile(
        activeFile.filePath,
        activeFile.fileContent,
      );

      setOpenFiles((current) =>
        current.map((file) =>
          file.filePath === activeFile.filePath
            ? {
                ...file,
                originalContent: file.fileContent,
                dirty: false,
              }
            : file,
        ),
      );
    } catch (error) {
      console.error("Erro ao salvar arquivo:", error);
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // CTRL + S
  // =========================================================

  useEffect(() => {
    function keyboard(event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();

        handleSave();
      }
    }

    window.addEventListener("keydown", keyboard);

    return () => {
      window.removeEventListener("keydown", keyboard);
    };
  }, [activeFile, saving]);

  // =========================================================
  // FECHAR ABA
  // =========================================================

  function handleClose(event, file) {
    event.stopPropagation();

    if (file.dirty) {
      const close = window.confirm(
        `${file.fileName} possui alterações não salvas. Fechar mesmo assim?`,
      );

      if (!close) return;
    }

    const index = openFiles.findIndex(
      (item) => item.filePath === file.filePath,
    );

    const remaining = openFiles.filter(
      (item) => item.filePath !== file.filePath,
    );

    setOpenFiles(remaining);

    if (activePath === file.filePath) {
      const next =
        remaining[index] ||
        remaining[index - 1] ||
        null;

      setActivePath(next?.filePath || null);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden text-white">
      {/* HEADER */}

      <header className="shrink-0 border-b border-white/8 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
              Arquivos
            </h1>

            <p className="mt-1 text-xs text-zinc-500">
              Explore e edite os arquivos locais.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSelectFolder}
            className="
              inline-flex h-9 items-center gap-2
              rounded-lg bg-violet-600 px-4
              text-xs font-medium text-white
              transition hover:bg-violet-500
              active:scale-[0.98]
            "
          >
            <FolderSearch className="size-4" />

            Abrir pasta
          </button>
        </div>
      </header>

      {/* WORKSPACE */}

      <div className="flex min-h-0 flex-1">
        {/* EXPLORER */}

        <aside className="flex w-72 shrink-0 flex-col border-r border-white/8 bg-zinc-950/40">
          <div className="flex h-10 shrink-0 items-center border-b border-white/5 px-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Explorer
            </span>
          </div>

          {workspace ? (
            <>
              {/* ROOT */}

              <div
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    [workspace.folderPath]:
                      !current[workspace.folderPath],
                  }))
                }
                className="
                  flex h-8 shrink-0 cursor-pointer
                  items-center gap-1 border-b border-white/5
                  px-2 text-xs font-semibold
                  uppercase tracking-wide text-zinc-300
                  hover:bg-white/5
                "
              >
                {expanded[workspace.folderPath] ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}

                {expanded[workspace.folderPath] ? (
                  <FolderOpen className="size-4 text-violet-400" />
                ) : (
                  <Folder className="size-4 text-violet-400" />
                )}

                <span className="truncate">
                  {workspace.folderName}
                </span>
              </div>

              {/* TREE */}

              <div className="min-h-0 flex-1 overflow-auto py-1">
                {expanded[workspace.folderPath] && (
                  <FileTree
                    items={workspace.tree}
                    expanded={expanded}
                    setExpanded={setExpanded}
                    activePath={activePath}
                    onOpenFile={handleOpenFile}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-white/5">
                <Folder className="size-5 text-zinc-600" />
              </div>

              <p className="text-xs text-zinc-500">
                Nenhuma pasta aberta.
              </p>

              <button
                type="button"
                onClick={handleSelectFolder}
                className="mt-3 text-xs text-violet-400 hover:text-violet-300"
              >
                Abrir uma pasta
              </button>
            </div>
          )}
        </aside>

        {/* EDITOR */}

        <main className="flex min-w-0 flex-1 flex-col bg-zinc-950/20">
          {/* TABS */}

          {openFiles.length > 0 && (
            <div className="flex h-10 shrink-0 overflow-x-auto border-b border-white/8">
              {openFiles.map((file) => {
                const active =
                  file.filePath === activePath;

                return (
                  <button
                    key={file.filePath}
                    type="button"
                    onClick={() =>
                      setActivePath(file.filePath)
                    }
                    className={`
                      group flex h-10 min-w-36 max-w-56
                      shrink-0 items-center gap-2
                      border-r border-white/5 px-3 text-xs
                      ${
                        active
                          ? "border-t border-t-violet-500 bg-zinc-900 text-zinc-200"
                          : "bg-zinc-950/30 text-zinc-500 hover:bg-zinc-900/50"
                      }
                    `}
                  >
                    <FileTypeIcon name={file.fileName} />

                    <span className="min-w-0 flex-1 truncate text-left">
                      {file.fileName}
                    </span>

                    {file.dirty ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-zinc-300"
                        title="Alterações não salvas"
                      />
                    ) : (
                      <X
                        onClick={(event) =>
                          handleClose(event, file)
                        }
                        className="
                          size-3.5 shrink-0
                          opacity-0 transition
                          hover:text-white
                          group-hover:opacity-100
                        "
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* BARRA DO ARQUIVO */}

          {activeFile && (
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/5 px-4">
              <div className="min-w-0 truncate text-xs text-zinc-500">
                {activeFile.filePath}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!activeFile.dirty || saving}
                className="
                  ml-4 inline-flex h-8 shrink-0
                  items-center gap-2 rounded-lg
                  bg-violet-600 px-3
                  text-xs font-medium text-white
                  transition hover:bg-violet-500
                  disabled:cursor-not-allowed
                  disabled:opacity-30
                "
              >
                <Save className="size-3.5" />

                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          )}

          {/* CONTEÚDO */}

          <div className="relative min-h-0 flex-1">
            {activeFile ? (
              <textarea
                value={activeFile.fileContent}
                onChange={(event) =>
                  handleChange(event.target.value)
                }
                spellCheck={false}
                className="
                  absolute inset-0
                  h-full w-full resize-none
                  border-0 bg-[#09090b]
                  p-5
                  font-mono text-[13px]
                  leading-6 text-zinc-300
                  outline-none
                  selection:bg-violet-500/30
                "
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileCode2 className="mb-4 size-14 text-zinc-800" />

                <p className="text-sm text-zinc-500">
                  Selecione um arquivo
                </p>

                <p className="mt-1 text-xs text-zinc-700">
                  O conteúdo será aberto aqui.
                </p>
              </div>
            )}
          </div>

          {/* STATUS */}

          {activeFile && (
            <div className="flex h-7 shrink-0 items-center justify-between border-t border-white/5 px-4 text-[10px] text-zinc-600">
              <span>
                {activeFile.dirty
                  ? "Alterações não salvas"
                  : "Salvo"}
              </span>

              <div className="flex gap-4">
                <span>
                  {getLanguage(activeFile.fileName)}
                </span>

                <span>UTF-8</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

// =============================================================
// TREE
// =============================================================

function FileTree({
  items,
  expanded,
  setExpanded,
  activePath,
  onOpenFile,
  level = 0,
}) {
  return items.map((item) => {
    const folder = item.type === "folder";
    const opened = expanded[item.path];

    return (
      <div key={item.path}>
        <button
          type="button"
          onClick={() => {
            if (folder) {
              setExpanded((current) => ({
                ...current,
                [item.path]: !current[item.path],
              }));

              return;
            }

            onOpenFile(item);
          }}
          className={`
            flex h-7 w-full items-center
            pr-3 text-left text-xs transition
            ${
              activePath === item.path
                ? "bg-violet-500/10 text-zinc-100"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }
          `}
          style={{
            paddingLeft: `${8 + level * 14}px`,
          }}
        >
          <span className="mr-1 flex size-4 shrink-0 items-center justify-center">
            {folder &&
              (opened ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              ))}
          </span>

          {folder ? (
            opened ? (
              <FolderOpen className="mr-2 size-4 shrink-0 text-violet-400" />
            ) : (
              <Folder className="mr-2 size-4 shrink-0 text-violet-400" />
            )
          ) : (
            <span className="mr-2">
              <FileTypeIcon name={item.name} />
            </span>
          )}

          <span className="truncate">
            {item.name}
          </span>
        </button>

        {folder && opened && item.children?.length > 0 && (
          <FileTree
            items={item.children}
            expanded={expanded}
            setExpanded={setExpanded}
            activePath={activePath}
            onOpenFile={onOpenFile}
            level={level + 1}
          />
        )}
      </div>
    );
  });
}

// =============================================================
// ÍCONE DO ARQUIVO
// =============================================================

function FileTypeIcon({ name }) {
  const extension =
    name?.split(".").pop()?.toLowerCase() || "";

  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "java",
      "c",
      "cpp",
      "html",
      "css",
    ].includes(extension)
  ) {
    return (
      <FileCode2 className="size-3.5 shrink-0 text-violet-400" />
    );
  }

  if (extension === "json") {
    return (
      <FileJson className="size-3.5 shrink-0 text-yellow-500" />
    );
  }

  if (
    ["md", "txt", "log"].includes(extension)
  ) {
    return (
      <FileText className="size-3.5 shrink-0 text-zinc-500" />
    );
  }

  return (
    <File className="size-3.5 shrink-0 text-zinc-500" />
  );
}

// =============================================================
// LINGUAGEM
// =============================================================

function getLanguage(name) {
  const extension =
    name?.split(".").pop()?.toLowerCase();

  const languages = {
    js: "JavaScript",
    jsx: "JavaScript React",
    ts: "TypeScript",
    tsx: "TypeScript React",
    json: "JSON",
    css: "CSS",
    html: "HTML",
    md: "Markdown",
    py: "Python",
    txt: "Plain Text",
  };

  return languages[extension] || extension?.toUpperCase() || "Texto";
}