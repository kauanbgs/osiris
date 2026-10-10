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
  it("creates an AI model with optimized fields", async () => {
    mockQueries([{ insertId: 4 }]);

    const response = await request(app).post("/api/osiris/ai-model").set(auth()).send({
      name: "Llama 3.2 1B Instruct",
      provider: "Meta",
      size: 800,
      status: "available",
      download_url: "https://huggingface.co/example/model.gguf",
      description: "Compact model for local inference",
      ram_requirement: 4096,
      tags: "chat,lightweight",
    });

    expect(response.status).toBe(201);
    expect(response.body.ai_model.id_model).toBe(4);
    expect(response.body.ai_model.download_url).toBe("https://huggingface.co/example/model.gguf");
    expect(response.body.ai_model.ram_requirement).toBe(4096);
  });

  it("lists models with optimized fields", async () => {
    mockQueries([[
      {
        id_model: 1,
        name: "SmolLM2",
        provider: "HuggingFace",
        size: 1200,
        status: "available",
        download_url: "https://huggingface.co/example.gguf",
        description: "Lightweight model",
        ram_requirement: 4096,
        tags: "lightweight,chat",
        created_at: "2026-09-01T00:00:00.000Z",
      },
    ]]);

    const response = await request(app).get("/api/osiris/ai-model").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_models).toHaveLength(1);
    expect(response.body.ai_models[0].download_url).toBe("https://huggingface.co/example.gguf");
    expect(response.body.ai_models[0].ram_requirement).toBe(4096);
  });

  it("filters local models by download_url presence", async () => {
    mockQueries([[
      { id_model: 1, name: "Local Model", download_url: "https://huggingface.co/model.gguf" },
    ]]);

    const response = await request(app)
      .get("/api/osiris/ai-model?type=local")
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_models).toHaveLength(1);
  });

  it("fetches a model by id with optimized fields", async () => {
    mockQueries([[{
      id_model: 4,
      name: "Llama 3.2 1B",
      status: "available",
      download_url: "https://huggingface.co/example.gguf",
      description: "Compact model",
      ram_requirement: 4096,
      tags: "chat",
    }]]);

    const response = await request(app).get("/api/osiris/ai-model/4").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.ai_model.id_model).toBe(4);
    expect(response.body.ai_model.ram_requirement).toBe(4096);
  });

  it("redirects to download URL with HTTP 302", async () => {
    mockQueries([[{
      id_model: 1,
      name: "SmolLM2",
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

  it("returns JSON with derived filename when redirect=false", async () => {
    mockQueries([[{
      id_model: 1,
      name: "SmolLM2",
      download_url: "https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf",
      size: 1200,
    }]]);

    const response = await request(app)
      .get("/api/osiris/ai-model/1/download?redirect=false")
      .set(auth());

    expect(response.status).toBe(200);
    expect(response.body.download_url).toBe("https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf");
    expect(response.body.filename).toBe("SmolLM2-1.7B-Instruct-Q4_K_M.gguf");
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

  it("scans models directory and matches installed files", async () => {
    const fs = require("fs");
    const path = require("path");
    const modelsDir = path.resolve(__dirname, "../../models");
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    const dummyGguf = path.join(modelsDir, "Llama-3.2-1B-Instruct-Q4_K_M.gguf");
    fs.writeFileSync(dummyGguf, "dummy binary");

    mockQueries(
      [[{
        id_model: 4,
        name: "Llama 3.2 1B Instruct",
        download_url: "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf",
      }]],
      [[]], // check if in model_installation
      [{ insertId: 1 }], // insert into model_installation
    );

    const res = await request(app)
      .post("/api/osiris/ai-model/scan")
      .set(auth())
      .send({});

    fs.unlinkSync(dummyGguf);

    expect(res.status).toBe(200);
    expect(res.body.scanned_files_count).toBeGreaterThanOrEqual(1);
    expect(res.body.matched_models_count).toBe(1);
    expect(res.body.installed[0].id_model).toBe(4);
  });

  it("lists all installed models from model_installation", async () => {
    mockQueries([[
      {
        id_installation: 1,
        installation_status: "installed",
        local_path: "/models/llama.gguf",
        fk_id_model: 4,
        name: "Llama 3.2 1B",
        provider: "Meta",
        ram_requirement: 4096,
      },
    ]]);

    const res = await request(app)
      .get("/api/osiris/ai-model/installed")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.installed_models).toHaveLength(1);
    expect(res.body.installed_models[0].name).toBe("Llama 3.2 1B");
  });
});
