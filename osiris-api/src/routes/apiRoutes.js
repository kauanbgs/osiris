const router = require("express").Router();
const UserController = require("../controllers/userController");
const verifyJWT = require("../middlewares/verifyJWT");

router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

router.post("/auth/register", UserController.register);
router.post("/auth/login", UserController.login);
router.get("/auth/me", verifyJWT, UserController.profile);

module.exports = router;

