jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("SystemController", () => {
  it("returns system hardware information and live telemetry", async () => {
    const res = await request(app)
      .get("/api/osiris/system/info")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.system.platform).toBeDefined();
    expect(res.body.system.cpu.cores).toBeGreaterThan(0);
    expect(res.body.system.memory.total_mb).toBeGreaterThan(0);
    expect(res.body.system.memory.usage_percent).toBeGreaterThanOrEqual(0);
  });

  it("records a system usage metric", async () => {
    mockQueries([{ insertId: 1 }]);

    const res = await request(app)
      .post("/api/osiris/system/metrics")
      .set(auth(1))
      .send({
        fk_id_model: 2,
        input_tokens: 150,
        output_tokens: 300,
        response_time: 420,
      });

    expect(res.status).toBe(201);
    expect(res.body.metric.id_metric).toBe(1);
    expect(res.body.metric.fk_id_model).toBe(2);
    expect(res.body.metric.fk_id_user).toBe(1);
    expect(res.body.metric.input_tokens).toBe(150);
  });

  it("rejects recording metric without model ID", async () => {
    const res = await request(app)
      .post("/api/osiris/system/metrics")
      .set(auth(1))
      .send({
        input_tokens: 150,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Model ID is required to record metric.");
  });

  it("lists recorded metrics for authenticated user", async () => {
    const mockMetric = {
      id_metric: 1,
      input_tokens: 150,
      output_tokens: 300,
      response_time: 420,
      cpu_usage: 15.5,
      ram_usage: 45.2,
      model_name: "Llama 3.2",
    };
    mockQueries([[mockMetric]]);

    const res = await request(app)
      .get("/api/osiris/system/metrics")
      .set(auth(1));

    expect(res.status).toBe(200);
    expect(res.body.metrics).toHaveLength(1);
    expect(res.body.metrics[0].id_metric).toBe(1);
  });

  it("returns aggregated dashboard metrics for charts and analytics", async () => {
    const mockSummary = {
      total_requests: 12,
      total_input_tokens: 1500,
      total_output_tokens: 3000,
      avg_response_time_ms: 350.5,
      avg_cpu_usage: 22.4,
      avg_ram_usage: 55.1,
    };
    const mockTimeline = [
      { date: "2026-10-09", requests: 12, input_tokens: 1500, output_tokens: 3000 },
    ];
    const mockModels = [
      { id_model: 2, model_name: "Llama 3.2", requests: 12, total_tokens: 4500 },
    ];

    mockQueries([[mockSummary]], [mockTimeline], [mockModels]);

    const res = await request(app)
      .get("/api/osiris/system/metrics/dashboard")
      .set(auth(1));

    expect(res.status).toBe(200);
    expect(res.body.summary.total_requests).toBe(12);
    expect(res.body.timeline).toHaveLength(1);
    expect(res.body.models).toHaveLength(1);
    expect(res.body.live_hardware.memory).toBeDefined();
  });
});
