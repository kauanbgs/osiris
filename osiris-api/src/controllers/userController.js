const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/connect");
const env = require("../config/env");
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

      const nome = req.body.nome.trim();
      const email = req.body.email.trim().toLowerCase();

      if (await emailAlreadyExists(email)) {
        return res.status(409).json({ error: "E-mail já cadastrado." });
      }

      const passwordHash = await bcrypt.hash(req.body.senha, SALT_ROUNDS);
      const [result] = await pool.execute(
        "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
        [nome, email, passwordHash],
      );

      return res.status(201).json({
        message: "Usuário cadastrado com sucesso.",
        user: { id: result.insertId, nome, email },
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
      const [rows] = await pool.execute(
        "SELECT id, nome, email, senha FROM usuarios WHERE email = ? LIMIT 1",
        [email],
      );

      const user = rows[0];
      const validPassword = user
        ? await bcrypt.compare(req.body.senha, user.senha)
        : false;

      if (!validPassword) {
        return res.status(401).json({ error: "E-mail ou senha inválidos." });
      }

      const token = jwt.sign({}, env.jwtSecret, {
        subject: String(user.id),
        expiresIn: env.jwtExpiresIn,
      });

      return res.status(200).json({
        message: "Login realizado com sucesso.",
        user: { id: user.id, nome: user.nome, email: user.email },
        token,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async profile(req, res, next) {
    try {
      const [rows] = await pool.execute(
        "SELECT id, nome, email, criado_em FROM usuarios WHERE id = ? LIMIT 1",
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

