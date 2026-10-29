const fs = require("fs/promises");
const path = require("path");

const UPLOAD_DIR = path.resolve(__dirname, "../../uploads");
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 100_000;

const SUPPORTED_EXTENSIONS = [".txt", ".md", ".json", ".csv"];

function getExtension(file) {
  const extension = path.extname(file.name || "").toLowerCase();

  if (extension) {
    return extension;
  }

  const storedExtension = String(file.extension || "").toLowerCase();

  return storedExtension.startsWith(".")
    ? storedExtension
    : `.${storedExtension}`;
}

function isSupported(file) {
  return SUPPORTED_EXTENSIONS.includes(getExtension(file));
}

async function readAgentFile(file) {
  if (!file || !file.path || !file.name) {
    throw new Error("Invalid file information.");
  }

  const extension = getExtension(file);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    throw new Error(`Unsupported file format: ${extension}`);
  }

  const candidatePath = path.isAbsolute(file.path)
    ? path.resolve(file.path)
    : path.resolve(UPLOAD_DIR, file.path);

  let realPath;
  let realUploadDir;

  try {
    [realPath, realUploadDir] = await Promise.all([
      fs.realpath(candidatePath),
      fs.realpath(UPLOAD_DIR),
    ]);
  } catch {
    throw new Error(`Could not locate file: ${file.name}`);
  }

  const relativePath = path.relative(realUploadDir, realPath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error("Access outside the uploads directory is not allowed.");
  }

  const stats = await fs.stat(realPath);

  if (!stats.isFile()) {
    throw new Error(`Not a regular file: ${file.name}`);
  }

  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds the 50 MB limit: ${file.name}`);
  }

  let content = await fs.readFile(realPath, "utf8");

  if (extension === ".json") {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      throw new Error(`Invalid JSON file: ${file.name}`);
    }
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    content =
      content.slice(0, MAX_CONTENT_LENGTH) +
      "\n[Content truncated due to the reading limit.]";
  }

  return {
    name: file.name,
    content: content.trim() || "(Empty file)",
  };
}

module.exports = {
  readAgentFile,
  isSupported,
};
