const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db/connect");
const emailAlreadyExists = require("../services/validateEmail");
const { revokeToken } = require("../services/tokenService");
const {
  validateRegistration,
  validateLogin,
} = require("../services/validateUser");
const {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
} = require("../errors");

const SALT_ROUNDS = 12;

class UserController {
  static async register(req, res, next) {
    try {
      const validationError = validateRegistration(req.body);
      if (validationError) {
        throw new BadRequestError(validationError);
      }

      const name = req.body.name.trim();
      const email = req.body.email.trim().toLowerCase();

      if (await emailAlreadyExists(email)) {
        throw new ConflictError("Email already registered.");
      }

      const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
      const [result] = await pool.promise().execute(
        "INSERT INTO user (name, email, password) VALUES (?, ?, ?)",
        [name, email, passwordHash],
      );

      return res.status(201).json({
        message: "User registered successfully.",
        user: { id_user: result.insertId, name, email },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async login(req, res, next) {
    try {
      const validationError = validateLogin(req.body);
      if (validationError) {
        throw new BadRequestError(validationError);
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
        throw new UnauthorizedError("Invalid email or password.");
      }

      const jti = crypto.randomUUID();
      const token = jwt.sign({ jti }, process.env.JWT_SECRET, {
        subject: String(user.id_user),
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      });

      return res.status(200).json({
        message: "Login successful.",
        user: { id_user: user.id_user, name: user.name, email: user.email },
        token,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async googleAuth(req, res, next) {
    try {
      const { credential, email: bodyEmail, name: bodyName } = req.body;

      let email = bodyEmail;
      let name = bodyName;

      if (credential) {
        try {
          const decoded = jwt.decode(credential);
          if (decoded && decoded.email) {
            email = decoded.email;
            name = name || decoded.name || decoded.given_name || "Google User";
          }
        } catch {
          // fallback to body fields
        }
      }

      if (!email || typeof email !== "string" || !email.trim()) {
        throw new BadRequestError("Google email is required.");
      }

      email = email.trim().toLowerCase();
      name = (name || email.split("@")[0] || "User").trim();

      const [rows] = await pool.promise().execute(
        "SELECT id_user, name, email FROM user WHERE email = ? LIMIT 1",
        [email],
      );

      let user = rows[0];
      let isNew = false;

      if (!user) {
        const randomPassword = crypto.randomBytes(16).toString("hex");
        const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

        const [insertResult] = await pool.promise().execute(
          "INSERT INTO user (name, email, password) VALUES (?, ?, ?)",
          [name, email, passwordHash],
        );

        user = {
          id_user: insertResult.insertId,
          name,
          email,
        };
        isNew = true;
      }

      const jti = crypto.randomUUID();
      const token = jwt.sign({ jti }, process.env.JWT_SECRET, {
        subject: String(user.id_user),
        expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      });

      return res.status(isNew ? 201 : 200).json({
        message: isNew
          ? "User registered and logged in via Google successfully."
          : "Google login successful.",
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
        throw new NotFoundError("User not found.");
      }

      return res.status(200).json({ user: rows[0] });
    } catch (error) {
      return next(error);
    }
  }

  static async logout(req, res, next) {
    try {
      const token = req.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
      const payload = req.tokenPayload || (token ? jwt.decode(token) : null);

      if (token) {
        await revokeToken(token, payload?.exp, req.userId);
      }

      return res.status(200).json({
        message: "Logout successful. Token revoked.",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = UserController;
