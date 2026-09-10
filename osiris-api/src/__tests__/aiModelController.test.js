jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("AiModelController", () => {
  it("creates an AI model", async () => {
    mockQueries([{ insertId: 4 }]);

    const response = await request(app).post("/api/osiris/ai-model").set(auth()).send({
      name: "GPT",
      provider: "OpenAI",
      model_name: "gpt-test",
      size: 10,
      status: "available",
    });

    expect(response.status).toBe(201);
    expect(response.body.ai_model.id_model).toBe(4);
  });

  it("lists models", async () => {
    mockQueries([[]]);

    const response = await request(app).get("/api/osiris/ai-model").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_models).toEqual([]);
  });

  it("fetches a model by id", async () => {
    mockQueries([[{ id_model: 4, name: "GPT", model_name: "gpt-test", status: "available" }]]);

    const response = await request(app).get("/api/osiris/ai-model/4").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_model.id_model).toBe(4);
  });
});
