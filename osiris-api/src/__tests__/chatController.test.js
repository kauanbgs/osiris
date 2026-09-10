jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockConnection,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("ChatController", () => {
  it("creates, lists and fetches chats owned by the user", async () => {
    mockQueries([{ insertId: 8 }], [[{ id_chat: 8, title: "Plan", fk_id_user: 1 }]], [[{ id_chat: 8, title: "Plan", fk_id_user: 1 }]]);

    const created = await request(app).post("/api/osiris/chat").set(auth()).send({ title: "Plan" });
    const listed = await request(app).get("/api/osiris/chat").set(auth());
    const fetched = await request(app).get("/api/osiris/chat/8").set(auth());

    expect(created.status).toBe(201);
    expect(listed.body.chats).toHaveLength(1);
    expect(fetched.body.chat.id_chat).toBe(8);
  });

  it("updates an owned chat and rejects an empty title", async () => {
    mockQueries([{ affectedRows: 1 }]);

    const updated = await request(app).put("/api/osiris/chat/8").set(auth()).send({ title: "Updated" });
    const invalid = await request(app).put("/api/osiris/chat/8").set(auth()).send({ title: " " });

    expect(updated.status).toBe(200);
    expect(updated.body.chat.title).toBe("Updated");
    expect(invalid.status).toBe(400);
  });

  it("deletes an owned chat in a transaction", async () => {
    const connection = {
      beginTransaction: jest.fn(),
      execute: jest.fn()
        .mockResolvedValueOnce([[{ id_chat: 8 }]])
        .mockResolvedValue([{ affectedRows: 1 }]),
      commit: jest.fn(),
      rollback: jest.fn(),
      release: jest.fn(),
    };
    mockConnection(connection);

    const response = await request(app).delete("/api/osiris/chat/8").set(auth());

    expect(response.status).toBe(200);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.execute).toHaveBeenCalledTimes(4);
  });
});
