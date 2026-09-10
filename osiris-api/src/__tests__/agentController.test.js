jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("AgentController", () => {
  const agent = {
    id_agent: 5,
    name: "Researcher",
    objective: "Research a subject thoroughly",
    execution_log: "idle",
    system_prompt: "You are a careful research assistant.",
    fk_id_user: 1,
    fk_id_model: null,
  };

  it("creates and lists agents belonging to the user", async () => {
    mockQueries([{ insertId: 5 }], [[agent]]);
    const body = {
      name: agent.name,
      objective: agent.objective,
      system_prompt: agent.system_prompt,
    };

    const created = await request(app).post("/api/osiris/agent").set(auth()).send(body);
    const listed = await request(app).get("/api/osiris/agent").set(auth());

    expect(created.status).toBe(201);
    expect(listed.body.agents).toEqual([agent]);
  });

  it("fetches an agent with its tools and files", async () => {
    mockQueries([[agent]], [[{ id_tool: 2, name: "Search", active: 1 }]], [[{ id_file: 9, name: "notes.txt" }]]);

    const response = await request(app).get("/api/osiris/agent/5").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.agent.tools).toHaveLength(1);
    expect(response.body.agent.files).toHaveLength(1);
  });

  it("updates and deletes an owned agent", async () => {
    mockQueries(
      [[{ id_agent: 5 }]],
      [{ affectedRows: 1 }],
      [[agent]],
      [[{ id_agent: 5 }]],
      [{ affectedRows: 1 }],
    );

    const updated = await request(app).put("/api/osiris/agent/5").set(auth()).send({ name: "Updated" });
    const deleted = await request(app).delete("/api/osiris/agent/5").set(auth());

    expect(updated.status).toBe(200);
    expect(deleted.status).toBe(200);
  });

  it("adds and removes a tool from an owned agent", async () => {
    mockQueries(
      [[{ id_agent: 5 }]],
      [[{ id_tool: 2 }]],
      [[]],
      [{ insertId: 1 }],
      [[{ id_agent: 5 }]],
      [{ affectedRows: 1 }],
    );

    const added = await request(app).post("/api/osiris/agent/5/tool").set(auth()).send({ fk_id_tool: 2 });
    const removed = await request(app).delete("/api/osiris/agent/5/tool/2").set(auth());

    expect(added.status).toBe(201);
    expect(removed.status).toBe(200);
  });

  it("executes an owned agent", async () => {
    mockQueries([[agent]], [{ affectedRows: 1 }], [{ affectedRows: 1 }]);

    const response = await request(app).post("/api/osiris/agent/5/execute").set(auth()).send({ input: "Summarize this" });

    expect(response.status).toBe(200);
    expect(response.body.execution.output).toContain("Mock response");
  });
});
