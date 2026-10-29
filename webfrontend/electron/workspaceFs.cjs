const fs = require("fs");
const path = require("path");

const IGNORED = new Set(["node_modules", ".git", "dist", "build", ".next", ".venv", "__pycache__", ".idea", ".vscode"]);
const MAX_FILE_BYTES = 200 * 1024;
const MAX_FILES = 300;
const MAX_DEPTH = 8;

function toRelative(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Caminho vazio.");
  const clean = value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.\//, "");
  if (clean.includes("\0")) throw new Error("Caminho invalido.");
  if (clean.startsWith("/") || /^[a-zA-Z]:/.test(clean)) throw new Error(`Caminho absoluto nao permitido: ${value}`);
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "..")) throw new Error(`Caminho fora da pasta do projeto: ${value}`);
  return parts.join("/");
}

// Resolves `relPath` inside `rootPath`, refusing anything that escapes it,
// including through a symlink in an already existing ancestor.
function resolveInside(rootPath, relPath) {
  if (typeof rootPath !== "string" || !rootPath) throw new Error("Pasta do projeto nao definida.");
  const root = path.resolve(rootPath);
  const target = path.resolve(root, toRelative(relPath));
  const inside = (base, candidate) => {
    const rel = path.relative(base, candidate);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
  };
  if (!inside(root, target)) throw new Error(`Caminho fora da pasta do projeto: ${relPath}`);
  let ancestor = path.dirname(target);
  while (!fs.existsSync(ancestor) && ancestor !== root) ancestor = path.dirname(ancestor);
  const realRoot = fs.realpathSync(root);
  const realAncestor = fs.realpathSync(ancestor);
  if (realAncestor !== realRoot && !inside(realRoot, realAncestor)) throw new Error(`Caminho fora da pasta do projeto: ${relPath}`);
  return target;
}

async function writeIn(rootPath, relPath, content) {
  const target = resolveInside(rootPath, relPath);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, String(content ?? ""), "utf-8");
  return target;
}

async function mkdirIn(rootPath, relPath) {
  const target = resolveInside(rootPath, relPath);
  await fs.promises.mkdir(target, { recursive: true });
  return target;
}

async function deleteIn(rootPath, relPath) {
  const target = resolveInside(rootPath, relPath);
  const stat = await fs.promises.lstat(target).catch(() => null);
  if (!stat) return false;
  if (!stat.isFile()) throw new Error(`Somente arquivos podem ser apagados: ${relPath}`);
  await fs.promises.unlink(target);
  return true;
}

async function scanWorkspace(rootPath) {
  const root = path.resolve(rootPath);
  const files = [];
  const folders = [];
  let truncated = false;

  async function walk(directory, depth) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (IGNORED.has(entry.name) || entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      if (entry.isDirectory()) {
        folders.push(rel);
        if (depth < MAX_DEPTH) await walk(full, depth + 1);
        else truncated = true;
        continue;
      }
      if (!entry.isFile()) continue;
      if (files.length >= MAX_FILES) { truncated = true; continue; }
      const stat = await fs.promises.stat(full);
      if (stat.size > MAX_FILE_BYTES) { truncated = true; continue; }
      const buffer = await fs.promises.readFile(full);
      if (buffer.includes(0)) continue;
      files.push({
        fileName: rel,
        filePath: full,
        fileContent: buffer.toString("utf-8"),
        fileSize: stat.size,
        fileType: "text/plain",
      });
    }
  }

  await walk(root, 0);
  return { rootPath: root, rootName: path.basename(root), files, folders, truncated };
}

// Text content of a file, or null when it is too big or binary.
async function readTextFile(full) {
  const stat = await fs.promises.stat(full);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
  const buffer = await fs.promises.readFile(full);
  if (buffer.includes(0)) return null;
  return { fileContent: buffer.toString("utf-8"), fileSize: stat.size };
}

/**
 * Watches a project folder (recursively) or a list of single files and calls
 * `emit` with { kind: "update" | "delete" | "rescan", ... } after the change
 * settles (editors fire several events per save). Returns a close function.
 */
function createWatcher({ rootPath, filePaths = [] }, emit, delay = 120) {
  const closers = [];
  const timers = new Map();
  const schedule = (key, task) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      task().catch(() => {});
    }, delay));
  };
  const watch = (target, options, listener) => {
    // Long/real path: on Windows libuv aborts the whole process when a watched
    // path is in 8.3 short form (C:\Users\ABC~1) and events use the long names.
    const watcher = fs.watch(fs.realpathSync.native(target), options, listener);
    watcher.on("error", () => {});
    closers.push(() => watcher.close());
  };

  if (rootPath) {
    const root = fs.realpathSync.native(path.resolve(rootPath));
    watch(root, { recursive: true }, (_type, name) => {
      if (!name) return;
      const rel = String(name).split(path.sep).join("/");
      if (rel.split("/").some((part) => IGNORED.has(part))) return;
      const full = path.join(root, rel);
      schedule(rel, async () => {
        const stat = await fs.promises.lstat(full).catch(() => null);
        if (!stat) return emit({ kind: "delete", fileName: rel, filePath: full });
        if (stat.isSymbolicLink()) return;
        if (stat.isDirectory()) {
          // One rescan covers any burst of folder changes.
          schedule("\0rescan", async () => emit({ kind: "rescan" }));
          return;
        }
        if (!stat.isFile()) return;
        const content = await readTextFile(full).catch(() => null);
        if (content) emit({ kind: "update", fileName: rel, filePath: full, fileType: "text/plain", ...content });
        else emit({ kind: "delete", fileName: rel, filePath: full });
      });
    });
  } else {
    // Watch the parent folder rather than the file: editors that save by
    // replacing the file would otherwise drop a direct file watch.
    const byDir = new Map();
    for (const filePath of filePaths) {
      const dir = path.dirname(filePath);
      if (!byDir.has(dir)) byDir.set(dir, new Map());
      byDir.get(dir).set(path.basename(filePath).toLowerCase(), filePath);
    }
    for (const [dir, names] of byDir) {
      watch(dir, {}, (_type, name) => {
        const filePath = name && names.get(String(name).toLowerCase());
        if (!filePath) return;
        schedule(filePath, async () => {
          const content = await readTextFile(filePath).catch(() => null);
          if (content) emit({ kind: "update", filePath, ...content });
          else emit({ kind: "delete", filePath });
        });
      });
    }
  }

  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    closers.splice(0).forEach((close) => close());
  };
}

module.exports = { toRelative, resolveInside, writeIn, mkdirIn, deleteIn, scanWorkspace, createWatcher };
