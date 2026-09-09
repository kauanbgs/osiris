const request = require("supertest");
const app = require("../index");

describe("Error Handler Tests", () => {
  describe("400 - Bad Request", () => {
    it("should return 400 when registering without required fields", async () => {
      const response = await request(app)
        .post("/api/osiris/auth/register")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.statusCode).toBe(400);
      expect(response.body.error.message).toBeDefined();
    });

    it("should return 400 when creating chat without title", async () => {
      // First, get a valid token
      const loginResponse = await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Test User",
          email: `test${Date.now()}@example.com`,
          password: "Test@123",
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .post("/api/osiris/chat")
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("Chat title is required.");
    });

    it("should return 400 when creating message with invalid type", async () => {
      const registerResponse = await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Test User",
          email: `test${Date.now()}@example.com`,
          password: "Test@123",
        });

      const token = registerResponse.body.token;

      const chatResponse = await request(app)
        .post("/api/osiris/chat")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Test Chat" });

      const chatId = chatResponse.body.chat.id_chat;

      const response = await request(app)
        .post(`/api/osiris/chat/${chatId}/messages`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          type: "invalid_type",
          content: "Test message",
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("Invalid message type.");
    });
  });

  describe("401 - Unauthorized", () => {
    it("should return 401 when accessing protected route without token", async () => {
      const response = await request(app)
        .get("/api/osiris/auth/me");

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.statusCode).toBe(401);
      expect(response.body.error.message).toBe("Token not provided.");
    });

    it("should return 401 with invalid token", async () => {
      const response = await request(app)
        .get("/api/osiris/auth/me")
        .set("Authorization", "Bearer invalid_token_here");

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("Invalid token.");
    });

    it("should return 401 with wrong credentials", async () => {
      await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Test User",
          email: `test${Date.now()}@example.com`,
          password: "Test@123",
        });

      const response = await request(app)
        .post("/api/osiris/auth/login")
        .send({
          email: "test@example.com",
          password: "WrongPassword",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("Invalid email or password.");
    });
  });

  describe("404 - Not Found", () => {
    it("should return 404 for non-existent route", async () => {
      const response = await request(app)
        .get("/api/osiris/non-existent-route");

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.statusCode).toBe(404);
      expect(response.body.error.message).toBe("Route not found.");
    });

    it("should return 404 when accessing non-existent chat", async () => {
      const registerResponse = await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Test User",
          email: `test${Date.now()}@example.com`,
          password: "Test@123",
        });

      const token = registerResponse.body.token;

      const response = await request(app)
        .get("/api/osiris/chat/999999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("Chat not found.");
    });

    it("should return 404 when accessing non-existent AI model", async () => {
      const registerResponse = await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Test User",
          email: `test${Date.now()}@example.com`,
          password: "Test@123",
        });

      const token = registerResponse.body.token;

      const response = await request(app)
        .get("/api/osiris/ai-model/999999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBe("AI model not found.");
    });
  });

  describe("409 - Conflict", () => {
    it("should return 409 when registering with existing email", async () => {
      const email = `test${Date.now()}@example.com`;

      await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Test User",
          email,
          password: "Test@123",
        });

      const response = await request(app)
        .post("/api/osiris/auth/register")
        .send({
          name: "Another User",
          email,
          password: "Test@456",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.statusCode).toBe(409);
      expect(response.body.error.message).toBe("Email already registered.");
    });
  });

  describe("Error Response Format", () => {
    it("should have standardized error format", async () => {
      const response = await request(app)
        .get("/api/osiris/auth/me");

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toHaveProperty("message");
      expect(response.body.error).toHaveProperty("statusCode");
      expect(response.body.error).toHaveProperty("timestamp");
      expect(typeof response.body.error.message).toBe("string");
      expect(typeof response.body.error.statusCode).toBe("number");
      expect(typeof response.body.error.timestamp).toBe("string");
    });

    it("should not expose stack trace in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const response = await request(app)
        .get("/api/osiris/auth/me");

      expect(response.body.error).not.toHaveProperty("stack");

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Health Check", () => {
    it("should return 200 for health check", async () => {
      const response = await request(app)
        .get("/api/osiris/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });
});
