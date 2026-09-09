const assert = require("node:assert/strict");
const { afterEach, describe, it } = require("node:test");

const pool = {};
const connectPath = require.resolve("../db/connect");

require.cache[connectPath] = {
  id: connectPath,
  filename: connectPath,
  loaded: true,
  exports: pool,
};

const ChatController = require("../controllers/chatController");

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createNext() {
  const calls = [];
  return {
    calls,
    next(error) {
      calls.push(error);
    },
  };
}

afterEach(() => {
  delete pool.promise;
});

describe("ChatController.update", () => {
  it("updates a chat owned by the authenticated user", async () => {
    const executions = [];
    pool.promise = () => ({
      async execute(query, params) {
        executions.push({ query, params });
        return [{ affectedRows: 1 }];
      },
    });

    const req = {
      params: { id_chat: "10" },
      body: { title: "  Updated chat  " },
      userId: "7",
    };
    const res = createResponse();
    const next = createNext();

    await ChatController.update(req, res, next.next.bind(next));

    assert.equal(next.calls.length, 0);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.chat, {
      id_chat: 10,
      title: "Updated chat",
      fk_id_user: 7,
    });
    assert.deepEqual(executions[0].params, ["Updated chat", "10", "7"]);
    assert.match(executions[0].query, /fk_id_user = \?/);
  });

  it("rejects an empty title before accessing the database", async () => {
    pool.promise = () => ({
      async execute() {
        throw new Error("Database should not be accessed.");
      },
    });

    const req = {
      params: { id_chat: "10" },
      body: { title: "   " },
      userId: "7",
    };
    const res = createResponse();
    const next = createNext();

    await ChatController.update(req, res, next.next.bind(next));

    assert.equal(next.calls.length, 1);
    assert.equal(next.calls[0].statusCode, 400);
    assert.equal(res.statusCode, null);
  });

  it("does not update a chat owned by another user", async () => {
    pool.promise = () => ({
      async execute() {
        return [{ affectedRows: 0 }];
      },
    });

    const req = {
      params: { id_chat: "10" },
      body: { title: "Updated chat" },
      userId: "7",
    };
    const res = createResponse();
    const next = createNext();

    await ChatController.update(req, res, next.next.bind(next));

    assert.equal(next.calls.length, 1);
    assert.equal(next.calls[0].statusCode, 404);
    assert.equal(res.statusCode, null);
  });
});

describe("ChatController.delete", () => {
  it("deletes the owned chat and its dependent records in a transaction", async () => {
    const executions = [];
    let committed = false;
    let rolledBack = false;
    let released = false;

    const connection = {
      async beginTransaction() {},
      async execute(query, params) {
        executions.push({ query, params });

        if (/SELECT id_chat/.test(query)) {
          return [[{ id_chat: 10 }]];
        }

        return [{ affectedRows: 1 }];
      },
      async commit() {
        committed = true;
      },
      async rollback() {
        rolledBack = true;
      },
      release() {
        released = true;
      },
    };

    pool.promise = () => ({
      async getConnection() {
        return connection;
      },
    });

    const req = { params: { id_chat: "10" }, userId: "7" };
    const res = createResponse();
    const next = createNext();

    await ChatController.delete(req, res, next.next.bind(next));

    assert.equal(next.calls.length, 0);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Chat deleted successfully.");
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    assert.equal(released, true);
    assert.equal(executions.length, 4);
    assert.match(executions[1].query, /DELETE FROM messages/);
    assert.match(executions[2].query, /DELETE FROM file_chat/);
    assert.match(executions[3].query, /DELETE FROM chat/);
    assert.deepEqual(executions[3].params, ["10", "7"]);
  });

  it("rolls back when the chat does not belong to the user", async () => {
    let rolledBack = false;
    let released = false;

    const connection = {
      async beginTransaction() {},
      async execute(query) {
        assert.match(query, /SELECT id_chat/);
        return [[]];
      },
      async commit() {
        throw new Error("Transaction should not be committed.");
      },
      async rollback() {
        rolledBack = true;
      },
      release() {
        released = true;
      },
    };

    pool.promise = () => ({
      async getConnection() {
        return connection;
      },
    });

    const req = { params: { id_chat: "10" }, userId: "7" };
    const res = createResponse();
    const next = createNext();

    await ChatController.delete(req, res, next.next.bind(next));

    assert.equal(next.calls.length, 1);
    assert.equal(next.calls[0].statusCode, 404);
    assert.equal(rolledBack, true);
    assert.equal(released, true);
    assert.equal(res.statusCode, null);
  });
});
