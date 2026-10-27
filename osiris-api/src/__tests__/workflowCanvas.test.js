jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const { app, auth, mockQueries, request, resetDatabaseMock } = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("Workflow canvas API", () => {
  it("returns the saved canvas for the workflow owner", async () => {
    mockQueries(
      [[{ id_workflow: 7, name: "Research" }]],
      [[{ value: JSON.stringify({ nodes: [{ id: "node-1" }], edges: [] }) }]],
    );
    const response = await request(app).get("/api/osiris/workflow/7/canvas").set(auth());
    expect(response.status).toBe(200);
    expect(response.body.canvas.nodes).toEqual([{ id: "node-1" }]);
  });

  it("saves canvas state to the user's configuration", async () => {
    const execute = mockQueries([[{ id_workflow: 7 }]], [[]], [{ insertId: 19 }]);
    const canvas = { nodes: [{ id: "node-1", position: { x: 100, y: 80 } }], edges: [] };
    const response = await request(app)
      .put("/api/osiris/workflow/7/canvas")
      .set(auth())
      .send(canvas);
    expect(response.status).toBe(200);
    expect(execute).toHaveBeenLastCalledWith(
      "INSERT INTO configuration (fk_id_user, `key`, value) VALUES (?, ?, ?)",
      ["1", "workflow_canvas_7", JSON.stringify(canvas)],
    );
  });

  it("does not expose another user's canvas", async () => {
    mockQueries([[]]);
    const response = await request(app).get("/api/osiris/workflow/7/canvas").set(auth(2));
    expect(response.status).toBe(404);
  });
});
