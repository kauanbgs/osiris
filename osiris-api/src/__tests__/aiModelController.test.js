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
  it("creates an AI model with extended metadata", async () => {
    mockQueries([{ insertId: 4 }]);

    const response = await request(app).post("/api/osiris/ai-model").set(auth()).send({
      name: "Llama 3.2 1B Instruct",
      provider: "Meta",
      model_name: "llama-3.2-1b-instruct",
      size: 800,
      status: "available",
      download_url: "https://huggingface.co/example/model.gguf",
      filename: "model-Q4_K_M.gguf",
      description: "Compact model for local inference",
      ram_requirement: "4GB",
      tags: "chat,lightweight",
      is_local: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.ai_model.id_model).toBe(4);
    expect(response.body.ai_model.download_url).toBe("https://huggingface.co/example/model.gguf");
    expect(response.body.ai_model.is_local).toBe(true);
  });

  it("lists models with extended fields", async () => {
    mockQueries([[
      {
        id_model: 1,
        name: "SmolLM2",
        provider: "HuggingFace",
        model_name: "smollm2-1.7b",
        size: 1200,
        status: "available",
        download_url: "https://huggingface.co/example.gguf",
        filename: "SmolLM2-Q4_K_M.gguf",
        description: "Lightweight model",
        ram_requirement: "4GB",
        tags: "lightweight,chat",
        is_local: 1,
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ]]);

    const response = await request(app).get("/api/osiris/ai-model").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_models).toHaveLength(1);
    expect(response.body.ai_models[0].download_url).toBe("https://huggingface.co/example.gguf");
  });

  it("filters models by type=local", async () => {
    mockQueries([[
      { id_model: 1, name: "Local Model", is_local: 1 },
    ]]);

    const response = await request(app)
      .get("/api/osiris/ai-model?type=local")
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_models).toHaveLength(1);
  });

  it("fetches a model by id with extended metadata", async () => {
    mockQueries([[{
      id_model: 4,
      name: "Llama 3.2 1B",
      model_name: "llama-3.2-1b",
      status: "available",
      download_url: "https://huggingface.co/example.gguf",
      filename: "model.gguf",
      description: "Compact model",
      ram_requirement: "4GB",
      tags: "chat",
      is_local: 1,
    }]]);

    const response = await request(app).get("/api/osiris/ai-model/4").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_model.id_model).toBe(4);
    expect(response.body.ai_model.download_url).toBe("https://huggingface.co/example.gguf");
  });

  it("redirects to download URL with HTTP 302", async () => {
    mockQueries([[{
      id_model: 1,
      name: "SmolLM2",
      filename: "SmolLM2-Q4_K_M.gguf",
      download_url: "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
      size: 1200,
    }]]);

    const response = await request(app)
      .get("/api/osiris/ai-model/1/download")
      .set(auth());

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
    );
  });

  it("returns JSON download info when redirect=false", async () => {
    mockQueries([[{
      id_model: 1,
      name: "SmolLM2",
      filename: "SmolLM2-Q4_K_M.gguf",
      download_url: "https://huggingface.co/example.gguf",
      size: 1200,
    }]]);

    const response = await request(app)
      .get("/api/osiris/ai-model/1/download?redirect=false")
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body.download_url).toBe("https://huggingface.co/example.gguf");
    expect(response.body.filename).toBe("SmolLM2-Q4_K_M.gguf");
    expect(response.body.id_model).toBe(1);
  });

  it("returns 404 when downloading a non-existent model", async () => {
    mockQueries([[]]);

    const response = await request(app)
      .get("/api/osiris/ai-model/999/download")
      .set(auth());

    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe("AI model not found.");
  });

  it("returns 400 when model has no download URL", async () => {
    mockQueries([[{
      id_model: 2,
      name: "Cloud Model",
      filename: null,
      download_url: null,
      size: 0,
    }]]);

    const response = await request(app)
      .get("/api/osiris/ai-model/2/download")
      .set(auth());

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      "This model does not have a download URL configured.",
    );
  });
});
