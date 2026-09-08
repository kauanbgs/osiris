const router = require("express").Router();

const UserController = require("../controllers/userController");
const ChatController = require("../controllers/chatController");
const MessageController = require("../controllers/messageController");
const AiModelController = require("../controllers/aiModelController");

const verifyJWT = require("../middlewares/verifyJWT");

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.post("/auth/register", UserController.register);
router.post("/auth/login", UserController.login);
router.get("/auth/me", verifyJWT, UserController.profile);

router.post("/chat", verifyJWT, ChatController.create);
router.get("/chat", verifyJWT, ChatController.list);
router.get("/chat/:id_chat", verifyJWT, ChatController.getById);

router.get("/chat/:id_chat/messages", verifyJWT, MessageController.listByChat,);
router.post("/chat/:id_chat/messages", verifyJWT, MessageController.create,);

router.post("/ai-model", verifyJWT, AiModelController.create);
router.get("/ai-model", verifyJWT, AiModelController.list);
router.get("/ai-model/:id_model", verifyJWT, AiModelController.getById);

module.exports = router;