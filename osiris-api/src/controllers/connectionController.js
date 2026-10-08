const pool = require("../db/connect");
const { BadRequestError, NotFoundError } = require("../errors");

class ConnectionController {
  static async create(req, res, next) {
    try {
      const { fk_id_node_origin, fk_id_node_destination } = req.body;

      const userId = req.userId;

      if (!fk_id_node_origin) {
        throw new BadRequestError("Origin node is required.");
      }

      if (!fk_id_node_destination) {
        throw new BadRequestError("Destination node is required.");
      }

      if (Number(fk_id_node_origin) === Number(fk_id_node_destination)) {
        throw new BadRequestError(
          "Origin and destination nodes must be different.",
        );
      }

      const [originRows] = await pool.promise().execute(
        `SELECT n.id_node
         FROM node n
         INNER JOIN workflows w
           ON n.fk_id_workflow = w.id_workflow
         WHERE n.id_node = ?
           AND w.fk_id_user = ?
         LIMIT 1`,
        [fk_id_node_origin, userId],
      );

      if (!originRows[0]) {
        throw new NotFoundError("Origin node not found.");
      }

      const [destinationRows] = await pool.promise().execute(
        `SELECT n.id_node
           FROM node n
           INNER JOIN workflows w
             ON n.fk_id_workflow = w.id_workflow
           WHERE n.id_node = ?
             AND w.fk_id_user = ?
           LIMIT 1`,
        [fk_id_node_destination, userId],
      );

      if (!destinationRows[0]) {
        throw new NotFoundError("Destination node not found.");
      }

      const [existingRows] = await pool.promise().execute(
        `SELECT id_connection
           FROM connection
           WHERE fk_id_node_origin = ?
             AND fk_id_node_destination = ?
           LIMIT 1`,
        [fk_id_node_origin, fk_id_node_destination],
      );

      if (existingRows[0]) {
        throw new BadRequestError("This connection already exists.");
      }

      const [result] = await pool.promise().execute(
        `INSERT INTO connection
          (
            fk_id_node_origin,
            fk_id_node_destination
          )
         VALUES (?, ?)`,
        [fk_id_node_origin, fk_id_node_destination],
      );

      return res.status(201).json({
        message: "Connection created successfully.",
        connection: {
          id_connection: result.insertId,
          fk_id_node_origin: Number(fk_id_node_origin),
          fk_id_node_destination: Number(fk_id_node_destination),
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
            c.id_connection,
            c.fk_id_node_origin,
            c.fk_id_node_destination
         FROM connection c
         INNER JOIN node origin
           ON c.fk_id_node_origin = origin.id_node
         INNER JOIN workflows w
           ON origin.fk_id_workflow = w.id_workflow
         INNER JOIN node destination
           ON c.fk_id_node_destination =
              destination.id_node
         WHERE w.fk_id_user = ?
         ORDER BY c.id_connection ASC`,
        [userId],
      );

      return res.status(200).json({
        connections: rows,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id_connection } = req.params;
      const userId = req.userId;

      const [rows] = await pool.promise().execute(
        `SELECT
            c.id_connection,
            c.fk_id_node_origin,
            c.fk_id_node_destination
         FROM connection c
         INNER JOIN node origin
           ON c.fk_id_node_origin =
              origin.id_node
         INNER JOIN workflows w
           ON origin.fk_id_workflow =
              w.id_workflow
         INNER JOIN node destination
           ON c.fk_id_node_destination =
              destination.id_node
         WHERE c.id_connection = ?
           AND w.fk_id_user = ?
         LIMIT 1`,
        [id_connection, userId],
      );

      if (!rows[0]) {
        throw new NotFoundError("Connection not found.");
      }

      return res.status(200).json({
        connection: rows[0],
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id_connection } = req.params;
      const userId = req.userId;

      const [result] = await pool.promise().execute(
        `DELETE c
         FROM connection c
         INNER JOIN node origin
           ON c.fk_id_node_origin =
              origin.id_node
         INNER JOIN workflows w
           ON origin.fk_id_workflow =
              w.id_workflow
         WHERE c.id_connection = ?
           AND w.fk_id_user = ?`,
        [id_connection, userId],
      );

      if (result.affectedRows === 0) {
        throw new NotFoundError("Connection not found.");
      }

      return res.status(200).json({
        message: "Connection deleted successfully.",
      });
    } catch (error) {
      return next(error);
    }
  }
}

module.exports = ConnectionController;
