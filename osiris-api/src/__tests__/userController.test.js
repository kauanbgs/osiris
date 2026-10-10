jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("UserController", () => {
  it("registers a valid user", async () => {
    mockQueries([[]], [{ insertId: 7 }]);

    const response = await request(app).post("/api/osiris/auth/register").send({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "StrongPass1",
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({ id_user: 7, name: "Ada Lovelace", email: "ada@example.com" });
  });

  it("rejects invalid registration before querying the database", async () => {
    const response = await request(app).post("/api/osiris/auth/register").send({});

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Nome, e-mail e senha são obrigatórios.");
  });

  it("logs in with valid credentials", async () => {
    const bcrypt = require("bcrypt");
    const password = "StrongPass1";
    const hash = await bcrypt.hash(password, 12);
    mockQueries([[
      { id_user: 7, name: "Ada", email: "ada@example.com", password: hash },
    ]]);

    const response = await request(app).post("/api/osiris/auth/login").send({
      email: "ada@example.com",
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("returns the authenticated profile and confirms logout with token revocation", async () => {
    mockQueries(
      [[{ id_user: 1, name: "Ada", email: "ada@example.com" }]],
      [{ insertId: 1 }], // insert into revoked_token
    );

    const userAuth = auth(1);
    const profile = await request(app).get("/api/osiris/auth/me").set(userAuth);
    expect(profile.status).toBe(200);
    expect(profile.body.user.id_user).toBe(1);

    const logout = await request(app).post("/api/osiris/auth/logout").set(userAuth);
    expect(logout.status).toBe(200);
    expect(logout.body.message).toContain("Token revoked");

    // Subsequent call with the revoked token must be rejected with 401
    const secondCall = await request(app).get("/api/osiris/auth/me").set(userAuth);
    expect(secondCall.status).toBe(401);
    expect(secondCall.body.error.message).toBe("Token has been revoked.");
  });

  it("rejects token without Bearer prefix", async () => {
    const res = await request(app).get("/api/osiris/auth/me").set({ Authorization: "InvalidToken" });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Token not provided.");
  });

  it("logs in an existing user via Google Auth", async () => {
    mockQueries([[
      { id_user: 3, name: "Google Dev", email: "google@example.com" },
    ]]);

    const response = await request(app)
      .post("/api/osiris/auth/google")
      .send({ email: "google@example.com", name: "Google Dev" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe("google@example.com");
  });

  it("auto-provisions a new user via Google Auth", async () => {
    mockQueries([[]], [{ insertId: 10 }]);

    const response = await request(app)
      .post("/api/osiris/auth/google")
      .send({ email: "newuser@example.com", name: "New Google User" });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.id_user).toBe(10);
    expect(response.body.user.email).toBe("newuser@example.com");
  });

  it("rejects Google auth when email is missing", async () => {
    const response = await request(app)
      .post("/api/osiris/auth/google")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Google email is required.");
  });
});
