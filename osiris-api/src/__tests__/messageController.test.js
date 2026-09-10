jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("MessageController", () => {
  it("creates a valid message in an owned chat", async () => {
    mockQueries([[{ id_chat: 2 }]], [{ insertId: 3 }]);

    const response = await request(app)
      .post("/api/osiris/chat/2/messages")
      .set(auth())
      .send({ type: "user", content: "Hello" });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({ id_message: 3, type: "user", fk_id_chat: 2 });
  });

  it("rejects an invalid message type", async () => {
    const response = await request(app)
      .post("/api/osiris/chat/2/messages")
      .set(auth())
      .send({ type: "invalid", content: "Hello" });

    expect(response.status).toBe(400);
  });

  it("lists messages only after confirming chat ownership", async () => {
    mockQueries([[{ id_chat: 2 }]], [[{ id_message: 3, type: "user", content: "Hello" }]]);

    const response = await request(app).get("/api/osiris/chat/2/messages").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
  });
});
