const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

function createWorkflowStore(root) {
  function filename(owner, chatId) {
    if (!owner || !chatId) throw new Error("Usuário e chat são obrigatórios.");
    const key = createHash("sha256").update(JSON.stringify([String(owner), String(chatId)])).digest("hex");
    return path.join(root, `${key}.json`);
  }
  return {
    load(owner, chatId) {
      try {
        return JSON.parse(fs.readFileSync(filename(owner, chatId), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return { nodes: [], edges: [] };
        throw error;
      }
    },
    save(owner, chatId, workflow) {
      if (!Array.isArray(workflow?.nodes) || !Array.isArray(workflow?.edges)) {
        throw new Error("Workflow inválido.");
      }
      const target = filename(owner, chatId);
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(`${target}.tmp`, JSON.stringify(workflow), "utf8");
      fs.renameSync(`${target}.tmp`, target);
    },
    remove(owner, chatId) {
      fs.rmSync(filename(owner, chatId), { force: true });
    },
  };
}

module.exports = { createWorkflowStore };
