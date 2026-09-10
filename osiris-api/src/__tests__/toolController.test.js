jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("ToolController", () => {
  const tool = { id_tool: 3, name: "Search", description: null, type: "http", active: 1 };

  it("creates and lists tools", async () => {
    mockQueries([{ insertId: 3 }], [[tool]]);

    const created = await request(app).post("/api/osiris/tool").set(auth()).send({ name: "Search", type: "http" });
    const listed = await request(app).get("/api/osiris/tool?active=true").set(auth());

    expect(created.status).toBe(201);
    expect(listed.body.tools).toEqual([tool]);
  });

  it("fetches and updates a tool", async () => {
    mockQueries([[tool]], [[{ id_tool: 3 }]], [{ affectedRows: 1 }], [[{ ...tool, name: "Lookup" }]]);

    const fetched = await request(app).get("/api/osiris/tool/3").set(auth());
    const updated = await request(app).put("/api/osiris/tool/3").set(auth()).send({ name: "Lookup" });

    expect(fetched.status).toBe(200);
    expect(updated.body.tool.name).toBe("Lookup");
  });

  it("deletes an existing tool", async () => {
    mockQueries([[{ id_tool: 3 }]], [{ affectedRows: 1 }]);

    const response = await request(app).delete("/api/osiris/tool/3").set(auth());

    expect(response.status).toBe(200);
  });
});
