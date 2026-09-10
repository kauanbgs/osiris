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

  it("returns the authenticated profile and confirms logout", async () => {
    mockQueries([[
      { id_user: 1, name: "Ada", email: "ada@example.com" },
    ]]);

    const profile = await request(app).get("/api/osiris/auth/me").set(auth());
    expect(profile.status).toBe(200);
    expect(profile.body.user.id_user).toBe(1);

    const logout = await request(app).post("/api/osiris/auth/logout").set(auth());
    expect(logout.status).toBe(200);
  });
});
