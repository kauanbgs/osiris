jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const { app, auth, mockQueries, request, resetDatabaseMock } = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("MemoryController", () => {
  it("lists and creates memories for the authenticated user", async () => {
    mockQueries(
      [[{ id_memory: 3, content: "Gosta de café", importance: null }]],
      [{ insertId: 4 }],
    );

    const listed = await request(app).get("/api/osiris/memory").set(auth());
    const created = await request(app).post("/api/osiris/memory").set(auth()).send({ content: "  Novo item  " });

    expect(listed.status).toBe(200);
    expect(listed.body.memories[0].content).toBe("Gosta de café");
    expect(created.status).toBe(201);
    expect(created.body.memory.content).toBe("Novo item");
  });

  it("rejects empty content and deletes only an owned memory", async () => {
    mockQueries([{ affectedRows: 1 }]);

    const invalid = await request(app).post("/api/osiris/memory").set(auth()).send({ content: " " });
    const deleted = await request(app).delete("/api/osiris/memory/4").set(auth());

    expect(invalid.status).toBe(400);
    expect(deleted.status).toBe(200);
  });
});
