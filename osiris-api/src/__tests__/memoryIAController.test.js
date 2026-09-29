jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("MemoryIAController", () => {
  const memory = {
    id_memory: 7,
    content: "The user prefers concise answers.",
    importance: 8,
    fk_id_agent: 5,
  };

  it("saves memory only for an agent owned by the authenticated user", async () => {
    const execute = mockQueries([[{ id_agent: 5 }]], [{ insertId: 7 }]);

    const response = await request(app)
      .post("/api/osiris/agent/5/memory")
      .set(auth())
      .send({ content: `  ${memory.content}  `, importance: 8 });

    expect(response.status).toBe(201);
    expect(response.body.memory).toEqual(memory);
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO agent_memory"),
      [memory.content, 8, 5],
    );
  });

  it("lists and searches memories with pagination", async () => {
    mockQueries([[{ id_agent: 5 }]], [[{ total: 1 }]], [[memory]]);

    const response = await request(app)
      .get("/api/osiris/agent/5/memory?search=concise&min_importance=5&limit=10&offset=0")
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body.memories).toEqual([memory]);
    expect(response.body.pagination).toEqual({ total: 1, limit: 10, offset: 0 });
  });

  it("returns a context ready to be consumed by the AI", async () => {
    mockQueries([[{ id_agent: 5 }]], [[memory, { ...memory, id_memory: 8, content: "Second fact." }]]);

    const response = await request(app)
      .get("/api/osiris/agent/5/memory/context")
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body.context).toBe(`${memory.content}\nSecond fact.`);
    expect(response.body.memories).toHaveLength(2);
  });

  it("gets, updates and deletes an owned memory", async () => {
    mockQueries(
      [[{ id_agent: 5 }]],
      [[memory]],
      [[{ id_agent: 5 }]],
      [{ affectedRows: 1 }],
      [[{ ...memory, content: "Updated fact." }]],
      [[{ id_agent: 5 }]],
      [{ affectedRows: 1 }],
    );

    const fetched = await request(app)
      .get("/api/osiris/agent/5/memory/7")
      .set(auth());
    const updated = await request(app)
      .put("/api/osiris/agent/5/memory/7")
      .set(auth())
      .send({ content: "Updated fact." });
    const deleted = await request(app)
      .delete("/api/osiris/agent/5/memory/7")
      .set(auth());

    expect(fetched.status).toBe(200);
    expect(updated.status).toBe(200);
    expect(updated.body.memory.content).toBe("Updated fact.");
    expect(deleted.status).toBe(200);
  });

  it("rejects invalid content, importance and pagination", async () => {
    const emptyContent = await request(app)
      .post("/api/osiris/agent/5/memory")
      .set(auth())
      .send({ content: " " });
    const invalidImportance = await request(app)
      .post("/api/osiris/agent/5/memory")
      .set(auth())
      .send({ content: "Fact", importance: 11 });
    const invalidLimit = await request(app)
      .get("/api/osiris/agent/5/memory?limit=101")
      .set(auth());

    expect(emptyContent.status).toBe(400);
    expect(invalidImportance.status).toBe(400);
    expect(invalidLimit.status).toBe(400);
  });

  it("does not expose memories from an agent owned by another user", async () => {
    mockQueries([[]]);

    const response = await request(app)
      .get("/api/osiris/agent/5/memory")
      .set(auth());

    expect(response.status).toBe(404);
  });
});
