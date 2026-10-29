const sameFile = (file, event) =>
  (event.filePath && file.filePath === event.filePath) ||
  (event.fileName && file.fileName === event.fileName);

function parentFolders(relPath) {
  const parts = relPath.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

/**
 * Applies a disk change (file saved, created or deleted outside Osiris) to a
 * FileNode's data. Returns the patch for updateNodeData, or null when nothing
 * would change - which also swallows the echo of Osiris' own writes.
 */
export function applyDiskChange(data, event) {
  const files = Array.isArray(data?.files) ? data.files : [];
  const rootMode = Boolean(data?.rootPath);

  if (event.kind === "update") {
    const index = files.findIndex((file) => sameFile(file, event));
    if (index === -1) {
      // A single watched file is only ever updated; new files appear with a folder.
      if (!rootMode || !event.fileName) return null;
      const added = {
        fileName: event.fileName,
        filePath: event.filePath ?? null,
        fileContent: event.fileContent ?? "",
        fileSize: event.fileSize ?? new Blob([event.fileContent ?? ""]).size,
        fileType: event.fileType ?? "text/plain",
      };
      const folders = new Set([...(data.folders || []), ...parentFolders(event.fileName)]);
      return { files: [...files, added], folders: [...folders].sort() };
    }
    if (files[index].fileContent === event.fileContent) return null;
    const next = [...files];
    next[index] = {
      ...files[index],
      fileContent: event.fileContent,
      fileSize: event.fileSize ?? new Blob([event.fileContent]).size,
    };
    return { files: next };
  }

  if (event.kind === "delete") {
    const prefix = event.fileName ? event.fileName + "/" : null;
    const next = files.filter((file) => !sameFile(file, event) && !(rootMode && prefix && file.fileName.startsWith(prefix)));
    const folders = (data.folders || []).filter((folder) => folder !== event.fileName && !(prefix && folder.startsWith(prefix)));
    if (next.length === files.length && folders.length === (data.folders || []).length) return null;
    return { files: next, folders };
  }

  return null;
}
