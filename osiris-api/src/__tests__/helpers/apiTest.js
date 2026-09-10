const request = require("supertest");
const jwt = require("jsonwebtoken");
const pool = require("../../db/connect");
const app = require("../../index");

function auth(userId = 1) {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: "1h",
  });

  return { Authorization: `Bearer ${token}` };
}

function mockQueries(...responses) {
  const execute = jest.fn();
  responses.forEach((response) => execute.mockResolvedValueOnce(response));
  pool.promise.mockReturnValue({ execute });
  return execute;
}

function mockConnection(connection) {
  pool.promise.mockReturnValue({
    getConnection: jest.fn().mockResolvedValue(connection),
  });
}

function resetDatabaseMock() {
  pool.promise.mockReset();
}

module.exports = {
  app,
  auth,
  mockConnection,
  mockQueries,
  request,
  resetDatabaseMock,
};
