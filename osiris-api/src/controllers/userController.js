const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/connect");
const emailAlreadyExists = require("../services/validateEmail");
const {
  validateRegistration,
  validateLogin,
} = require("../services/validateUser");

const SALT_ROUNDS = 12;

class UserController {
  static async register(req, res, next) {
    try {
      const validationError = validateRegistration(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const name = req.body.name.trim();
      const email = req.body.email.trim().toLowerCase();

      if (await emailAlreadyExists(email)) {
        return res.status(409).json({ error: "E-mail já cadastrado." });
      }

      const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      const [result] = await pool.promise().execute(
        "INSERT INTO user (name, email, password) VALUES (?, ?, ?)",
        [name, email, passwordHash],
      );

      return res.status(201).json({
        message: "Usuário cadastrado com sucesso.",
        user: { id_user: result.insertId, name, email },
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ error: "E-mail já cadastrado." });
      }
      return next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const validationError = validateLogin(req.body);
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const email = req.body.email.trim().toLowerCase();
      const [rows] = await pool.promise().execute(
        "SELECT id_user, name, email, password FROM user WHERE email = ? LIMIT 1",
        [email],
      );

      const user = rows[0];
      const validPassword = user
        ? await bcrypt.compare(req.body.password, user.password)
        : false;

      if (!validPassword) {
        return res.status(401).json({ error: "E-mail ou senha inválidos." });
      }

      const token = jwt.sign({}, process.env.JWT_SECRET, {
        subject: String(user.id_user),
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      });

      return res.status(200).json({
        message: "Login realizado com sucesso.",
        user: { id_user: user.id_user, name: user.name, email: user.email },
        token,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async profile(req, res, next) {
    try {
      const [rows] = await pool.promise().execute(
        "SELECT id_user, name, email FROM user WHERE id_user = ? LIMIT 1",
        [req.userId],
      );

      if (!rows[0]) {
        return res.status(404).json({ error: "Usuário não encontrado." });
      }

      return res.status(200).json({ user: rows[0] });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = UserController;
