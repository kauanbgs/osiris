const pool = require("../db/connect");
const { BadRequestError } = require("../errors");

const THEME_CONFIG_KEY = "desktop_theme_colors";
const COLOR_KEYS = [
  "background",
  "card",
  "input",
  "border",
  "foreground",
  "mutedForeground",
  "primary",
  "secondary",
  "destructive",
  "accent",
  "accentForeground",
];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

async function findThemeRow(userId) {
  const [rows] = await pool.promise().execute(
    `SELECT id_configuration, value
     FROM configuration
     WHERE fk_id_user = ? AND \`key\` = ?
     ORDER BY id_configuration DESC
     LIMIT 1`,
    [userId, THEME_CONFIG_KEY],
  );
  return rows[0];
}

class ThemeController {
  static async get(req, res, next) {
    try {
      const row = await findThemeRow(req.userId);
      let colors = null;
      try {
        colors = row?.value ? JSON.parse(row.value) : null;
      } catch {
        colors = null;
      }

      // O celular consulta esta rota repetidamente e precisa sempre da versão atual.
      res.set("Cache-Control", "no-store");
      return res.status(200).json({ colors });
    } catch (error) {
      return next(error);
    }
  }

  static async save(req, res, next) {
    try {
      const received = req.body?.colors;
      const valid =
        received &&
        typeof received === "object" &&
        COLOR_KEYS.every((key) => typeof received[key] === "string" && HEX_COLOR.test(received[key]));
      if (!valid) {
        throw new BadRequestError(`colors must contain ${COLOR_KEYS.join(", ")} as #rrggbb values.`);
      }

      const colors = Object.fromEntries(COLOR_KEYS.map((key) => [key, received[key].toLowerCase()]));
      const value = JSON.stringify(colors);
      const row = await findThemeRow(req.userId);

      if (row) {
        await pool.promise().execute(
          "UPDATE configuration SET value = ? WHERE id_configuration = ? AND fk_id_user = ?",
          [value, row.id_configuration, req.userId],
        );
      } else {
        await pool.promise().execute(
          "INSERT INTO configuration (fk_id_user, `key`, value) VALUES (?, ?, ?)",
          [req.userId, THEME_CONFIG_KEY, value],
        );
      }

      return res.status(200).json({ colors });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = ThemeController;
