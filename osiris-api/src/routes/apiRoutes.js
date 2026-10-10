const router = require("express").Router();

const UserController = require("../controllers/userController");
const ChatController = require("../controllers/chatController");
const MessageController = require("../controllers/messageController");
const AiModelController = require("../controllers/aiModelController");
const AgentController = require("../controllers/agentController");
const ToolController = require("../controllers/toolController");
const MemoryController = require("../controllers/memoryController");
const MemoryIAController = require("../controllers/memoryIAController");
const WorkflowController = require("../controllers/workflowController");
const NodeController = require("../controllers/nodeController");
const ConnectionController = require("../controllers/connectionController");
const FileController = require("../controllers/fileController");
const SystemController = require("../controllers/systemController");

const verifyJWT = require("../middlewares/verifyJWT");
const upload = require("../middlewares/upload");

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// User routes
router.post("/auth/register", UserController.register);
router.post("/auth/login", UserController.login);
router.post("/auth/google", UserController.googleAuth);
router.post("/auth/logout", verifyJWT, UserController.logout);
router.get("/auth/me", verifyJWT, UserController.profile);

// Chat routes
router.post("/chat", verifyJWT, ChatController.create);
router.get("/chat", verifyJWT, ChatController.list);
router.get("/chat/:id_chat", verifyJWT, ChatController.getById);
router.put("/chat/:id_chat", verifyJWT, ChatController.update);
router.delete("/chat/:id_chat", verifyJWT, ChatController.delete);

// Message routes
router.get("/chat/:id_chat/messages", verifyJWT, MessageController.listByChat);
router.post("/chat/:id_chat/messages", verifyJWT, MessageController.create);

// AI model routes
router.post("/ai-model", verifyJWT, AiModelController.create);
router.get("/ai-model", verifyJWT, AiModelController.list);
router.get("/ai-model/:id_model", verifyJWT, AiModelController.getById);
router.get(
  "/ai-model/:id_model/download",
  verifyJWT,
  AiModelController.download,
);

// Agent routes
router.post("/agent", verifyJWT, AgentController.create);
router.get("/agent", verifyJWT, AgentController.list);
router.get("/agent/:id_agent", verifyJWT, AgentController.getById);
router.put("/agent/:id_agent", verifyJWT, AgentController.update);
router.delete("/agent/:id_agent", verifyJWT, AgentController.delete);

// Agent tools management
router.post("/agent/:id_agent/tool", verifyJWT, AgentController.addTool);
router.delete(
  "/agent/:id_agent/tool/:id_tool",
  verifyJWT,
  AgentController.removeTool,
);

// Agent execution
router.post("/agent/:id_agent/execute", verifyJWT, AgentController.execute);

// Agent memory management
router.post("/agent/:id_agent/memory", verifyJWT, MemoryIAController.create);
router.get("/agent/:id_agent/memory", verifyJWT, MemoryIAController.list);
router.get(
  "/agent/:id_agent/memory/context",
  verifyJWT,
  MemoryIAController.getContext,
);
router.get(
  "/agent/:id_agent/memory/:id_memory",
  verifyJWT,
  MemoryIAController.getById,
);
router.put(
  "/agent/:id_agent/memory/:id_memory",
  verifyJWT,
  MemoryIAController.update,
);
router.delete(
  "/agent/:id_agent/memory/:id_memory",
  verifyJWT,
  MemoryIAController.delete,
);

// Tool routes
router.post("/tool", verifyJWT, ToolController.create);
router.get("/tool", verifyJWT, ToolController.list);
router.get("/tool/:id_tool", verifyJWT, ToolController.getById);
router.put("/tool/:id_tool", verifyJWT, ToolController.update);
router.delete("/tool/:id_tool", verifyJWT, ToolController.delete);

// Memory routes
router.post("/memory", verifyJWT, MemoryController.create);
router.get("/memory", verifyJWT, MemoryController.list);
router.get("/memory/:id_memory", verifyJWT, MemoryController.getById);
router.put("/memory/:id_memory", verifyJWT, MemoryController.update);
router.delete("/memory/:id_memory", verifyJWT, MemoryController.delete);

// Workflow routes
router.post("/workflow", verifyJWT, WorkflowController.create);
router.get("/workflow", verifyJWT, WorkflowController.list);
router.get("/workflow/:id_workflow", verifyJWT, WorkflowController.getById);
router.put("/workflow/:id_workflow", verifyJWT, WorkflowController.update);
router.delete("/workflow/:id_workflow", verifyJWT, WorkflowController.delete);

// Node routes
router.post("/node", verifyJWT, NodeController.create);
router.get("/node", verifyJWT, NodeController.list);
router.get("/node/:id_node", verifyJWT, NodeController.getById);
router.put("/node/:id_node", verifyJWT, NodeController.update);
router.delete("/node/:id_node", verifyJWT, NodeController.delete);
router.get(
  "/workflow/:id_workflow/nodes",
  verifyJWT,
  NodeController.listByWorkflow,
);

// Connection routes
router.post("/connection", verifyJWT, ConnectionController.create);
router.get("/connection", verifyJWT, ConnectionController.list);
router.get(
  "/connection/:id_connection",
  verifyJWT,
  ConnectionController.getById,
);
router.delete(
  "/connection/:id_connection",
  verifyJWT,
  ConnectionController.delete,
);

// File routes (standard & Notion CT18/RF10 aliases)
router.post(
  "/file",
  verifyJWT,
  upload.single("file"),
  FileController.upload,
);
router.post(
  "/arquivos",
  verifyJWT,
  upload.single("arquivo"),
  FileController.upload,
);
router.get("/file", verifyJWT, FileController.list);
router.get("/file/:id_file", verifyJWT, FileController.getById);
router.get("/file/:id_file/download", verifyJWT, FileController.download);
router.delete("/file/:id_file", verifyJWT, FileController.delete);

// System telemetry & metrics collection
router.get("/system/info", verifyJWT, SystemController.getInfo);
router.post("/system/metrics", verifyJWT, SystemController.recordMetric);
router.get("/system/metrics", verifyJWT, SystemController.listMetrics);
router.get("/system/metrics/dashboard", verifyJWT, SystemController.getDashboard);

module.exports = router;
