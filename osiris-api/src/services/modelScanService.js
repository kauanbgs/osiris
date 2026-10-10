const fs = require("fs");
const path = require("path");

class ModelScanService {
  static getModelsDirectory() {
    const defaultDir = path.resolve(__dirname, "../../models");
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    return defaultDir;
  }

  static scanDirectory(customDir) {
    const targetDir = customDir && fs.existsSync(customDir)
      ? customDir
      : this.getModelsDirectory();

    const results = [];
    const files = fs.readdirSync(targetDir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (ext === ".gguf" || ext === ".bin") {
        const filePath = path.join(targetDir, file);
        const stats = fs.statSync(filePath);
        results.push({
          filename: file,
          path: filePath,
          size_mb: Math.round(stats.size / (1024 * 1024)),
          extension: ext.slice(1),
          modified_at: stats.mtime.toISOString(),
        });
      }
    }

    return results;
  }
}

module.exports = ModelScanService;
