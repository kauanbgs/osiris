const router = require("express").Router();

const UserController = require("../controllers/userController");
const ChatController = require("../controllers/chatController");
const MessageController = require("../controllers/messageController");
const AiModelController = require("../controllers/aiModelController");
const AgentController = require("../controllers/agentController");
const ToolController = require("../controllers/toolController");
const MemoryIAController = require("../controllers/memoryIAController");

const verifyJWT = require("../middlewares/verifyJWT");

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.post("/auth/register", UserController.register);
router.post("/auth/login", UserController.login);
router.post("/auth/logout", verifyJWT, UserController.logout);
router.get("/auth/me", verifyJWT, UserController.profile);

router.post("/chat", verifyJWT, ChatController.create);
router.get("/chat", verifyJWT, ChatController.list);
router.get("/chat/:id_chat", verifyJWT, ChatController.getById);
router.put("/chat/:id_chat", verifyJWT, ChatController.update);
router.delete("/chat/:id_chat", verifyJWT, ChatController.delete);

router.get("/chat/:id_chat/messages", verifyJWT, MessageController.listByChat,);
router.post("/chat/:id_chat/messages", verifyJWT, MessageController.create,);

router.post("/ai-model", verifyJWT, AiModelController.create);
router.get("/ai-model", verifyJWT, AiModelController.list);
router.get("/ai-model/:id_model", verifyJWT, AiModelController.getById);
router.get("/ai-model/:id_model/download", verifyJWT, AiModelController.download);

// Agent routes
router.post("/agent", verifyJWT, AgentController.create);
router.get("/agent", verifyJWT, AgentController.list);
router.get("/agent/:id_agent", verifyJWT, AgentController.getById);
router.put("/agent/:id_agent", verifyJWT, AgentController.update);
router.delete("/agent/:id_agent", verifyJWT, AgentController.delete);

// Agent tools management
router.post("/agent/:id_agent/tool", verifyJWT, AgentController.addTool);
router.delete("/agent/:id_agent/tool/:id_tool", verifyJWT, AgentController.removeTool);

// Agent execution
router.post("/agent/:id_agent/execute", verifyJWT, AgentController.execute);

// Agent memory management
router.post("/agent/:id_agent/memory", verifyJWT, MemoryIAController.create);
router.get("/agent/:id_agent/memory", verifyJWT, MemoryIAController.list);
router.get("/agent/:id_agent/memory/context", verifyJWT, MemoryIAController.getContext);
router.get("/agent/:id_agent/memory/:id_memory", verifyJWT, MemoryIAController.getById);
router.put("/agent/:id_agent/memory/:id_memory", verifyJWT, MemoryIAController.update);
router.delete("/agent/:id_agent/memory/:id_memory", verifyJWT, MemoryIAController.delete);

// Tool routes
router.post("/tool", verifyJWT, ToolController.create);
router.get("/tool", verifyJWT, ToolController.list);
router.get("/tool/:id_tool", verifyJWT, ToolController.getById);
router.put("/tool/:id_tool", verifyJWT, ToolController.update);
router.delete("/tool/:id_tool", verifyJWT, ToolController.delete);

module.exports = router;
