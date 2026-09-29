const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

let ai = null;
try {
  ai = require("../services/ai");
} catch {
  // Service ai.js is optional / not used for local memory mode
}

class MemoryController {
  static async create(req, res, next) {
    try {
      const { content, importance } = req.body;
      const userId = req.userId;

      if (!content || !content.trim()) {
        throw new BadRequestError("Memory content is required.");
      }

      const normalizedImportance =
        importance !== undefined && importance !== null
          ? Number(importance)
          : null;

      const [result] = await pool.promise().execute(
        `INSERT INTO user_memory
          (content, importance, fk_id_user)
         VALUES (?, ?, ?)`,
        [content.trim(), normalizedImportance, userId],
      );

      return res.status(201).json({
        message: "Memory created successfully.",
        memory: {
          id_memory: result.insertId,
          content: content.trim(),
          importance: normalizedImportance,
          fk_id_user: userId,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
          id_memory,
          content,
          importance,
          created_at,
          updated_at,
          fk_id_user
         FROM user_memory
         WHERE fk_id_user = ?
         ORDER BY importance DESC, created_at DESC`,
        [userId],
      );

      return res.status(200).json({
        memories: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_memory } = req.params;
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
          id_memory,
          content,
          importance,
          created_at,
          updated_at,
          fk_id_user
         FROM user_memory
         WHERE id_memory = ?
           AND fk_id_user = ?
         LIMIT 1`,
        [id_memory, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Memory not found.");
      }

      return res.status(200).json({
        memory: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const { id_memory } = req.params;
      const { content, importance } = req.body;
      const userId = req.userId;

      if (content === undefined && importance === undefined) {
        throw new BadRequestError(
          "At least one field must be provided.",
        );
      }

      const [rows] = await pool.promise().execute(
        `SELECT id_memory, content, importance
         FROM user_memory
         WHERE id_memory = ?
           AND fk_id_user = ?
         LIMIT 1`,
        [id_memory, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Memory not found.");
      }

      const currentMemory = rows[0];

      const newContent =
        content !== undefined
          ? content.trim()
          : currentMemory.content;

      const newImportance =
        importance !== undefined
          ? importance === null
            ? null
            : Number(importance)
          : currentMemory.importance;

      await pool.promise().execute(
        `UPDATE user_memory
         SET content = ?, importance = ?
         WHERE id_memory = ?
           AND fk_id_user = ?`,
        [
          newContent,
          newImportance,
          id_memory,
          userId,
        ],
      );

      return res.status(200).json({
        message: "Memory updated successfully.",
        memory: {
          id_memory: Number(id_memory),
          content: newContent,
          importance: newImportance,
          fk_id_user: Number(userId),
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id_memory } = req.params;
      const userId = req.userId;

      const [result] = await pool.promise().execute(
        `DELETE FROM user_memory
         WHERE id_memory = ?
           AND fk_id_user = ?`,
        [id_memory, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Memory not found.");
      }

      return res.status(200).json({
        message: "Memory deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }

  // =====================================================
  // MEMÓRIA AUTOMÁTICA DA IA
  // =====================================================

  static async analyzeAndSave(userId, userMessage) {
    try {
      if (!ai || !ai.chat || !userId || !userMessage?.trim()) {
        return [];
      }

      // Busca as memórias atuais para a IA evitar duplicatas
      // e detectar informações que devem ser atualizadas.
      const [currentMemories] = await pool.promise().execute(
        `SELECT
          id_memory,
          content,
          importance
         FROM user_memory
         WHERE fk_id_user = ?
         ORDER BY importance DESC, updated_at DESC`,
        [userId],
      );

      const memoriesText =
        currentMemories.length > 0
          ? currentMemories
              .map(
                (memory) =>
                  `[${memory.id_memory}] ${memory.content}`,
              )
              .join("\n")
          : "Nenhuma memória salva.";

      const prompt = `
Você é responsável pela memória de longo prazo de um assistente.

Analise a mensagem mais recente do usuário e decida se ela contém
alguma informação que será útil em conversas futuras.

MEMÓRIAS JÁ EXISTENTES:

${memoriesText}

NOVA MENSAGEM DO USUÁRIO:

${userMessage}

Salve apenas informações relativamente duradouras, como:
- nomes
- preferências do usuário;
- gostos e interesses;
- profissão;
- área de estudo;
- projetos em andamento;
- objetivos;
- tecnologias que utiliza;
- preferências sobre como o assistente deve responder;
- informações pessoais explicitamente fornecidas que sejam úteis no futuro.

NÃO salve:

- perguntas;
- pedidos momentâneos;
- cumprimentos;
- informações temporárias;
- informações sem utilidade futura;
- respostas do assistente;
- informações já existentes sem nenhuma mudança.

Também analise se a nova mensagem contradiz ou atualiza
uma memória existente.

Exemplo:

Memória:
[5] O usuário prefere respostas curtas.

Mensagem:
"Na verdade prefiro respostas detalhadas."

Nesse caso você deve atualizar a memória 5, e não criar
uma memória nova.

Responda APENAS JSON válido.

Formato:

{
  "actions": [
    {
      "action": "create",
      "content": "informação curta e objetiva",
      "importance": 1
    },
    {
      "action": "update",
      "id_memory": 5,
      "content": "nova informação",
      "importance": 8
    }
  ]
}

importance deve ser um inteiro de 1 a 10.

Se não houver nada relevante:

{
  "actions": []
}
`;

      const completion = await ai.chat.completions.create({
        model: "SEU_MODELO",
        messages: [
          {
            role: "system",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
      });

      const raw =
        completion.choices[0]?.message?.content;

      if (!raw) {
        return [];
      }

      const result = JSON.parse(raw);

      if (!Array.isArray(result.actions)) {
        return [];
      }

      const savedMemories = [];

      for (const action of result.actions) {
        if (action.action === "create") {
          if (
            typeof action.content !== "string" ||
            !action.content.trim()
          ) {
            continue;
          }

          const importance = Math.min(
            10,
            Math.max(1, Number(action.importance) || 5),
          );

          // Evita duplicata exata
          const [duplicates] =
            await pool.promise().execute(
              `SELECT id_memory
               FROM user_memory
               WHERE fk_id_user = ?
                 AND LOWER(content) = LOWER(?)
               LIMIT 1`,
              [userId, action.content.trim()],
            );

          if (duplicates[0]) {
            continue;
          }

          const [insertResult] =
            await pool.promise().execute(
              `INSERT INTO user_memory
                (content, importance, fk_id_user)
               VALUES (?, ?, ?)`,
              [
                action.content.trim(),
                importance,
                userId,
              ],
            );

          savedMemories.push({
            action: "create",
            id_memory: insertResult.insertId,
            content: action.content.trim(),
            importance,
          });
        }

        if (action.action === "update") {
          const idMemory = Number(action.id_memory);

          if (
            !idMemory ||
            typeof action.content !== "string" ||
            !action.content.trim()
          ) {
            continue;
          }

          // Segurança:
          // só deixa atualizar memória pertencente ao usuário.
          const [existing] =
            await pool.promise().execute(
              `SELECT id_memory
               FROM user_memory
               WHERE id_memory = ?
                 AND fk_id_user = ?
               LIMIT 1`,
              [idMemory, userId],
            );

          if (!existing[0]) {
            continue;
          }

          const importance = Math.min(
            10,
            Math.max(1, Number(action.importance) || 5),
          );

          await pool.promise().execute(
            `UPDATE user_memory
             SET content = ?, importance = ?
             WHERE id_memory = ?
               AND fk_id_user = ?`,
            [
              action.content.trim(),
              importance,
              idMemory,
              userId,
            ],
          );

          savedMemories.push({
            action: "update",
            id_memory: idMemory,
            content: action.content.trim(),
            importance,
          });
        }
      }

      return savedMemories;
    } catch (error) {
      console.error(
        "Erro ao analisar memória automática:",
        error,
      );

      // Importante:
      // erro na memória não deve derrubar o chat inteiro.
      return [];
    }
  }

  // =====================================================
  // BUSCAR MEMÓRIAS PARA USAR NO PROMPT DO CHAT
  // =====================================================

  static async getMemoryContext(userId) {
    try {
      const [rows] = await pool.promise().execute(
        `SELECT content, importance
         FROM user_memory
         WHERE fk_id_user = ?
         ORDER BY importance DESC, updated_at DESC
         LIMIT 50`,
        [userId],
      );

      if (rows.length === 0) {
        return "";
      }

      return rows
        .map((memory) => `- ${memory.content}`)
        .join("\n");
    } catch (error) {
      console.error(
        "Erro ao buscar contexto de memória:",
        error,
      );

      return "";
    }
  }
}

module.exports = MemoryController;