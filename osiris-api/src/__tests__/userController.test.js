// userController.test.js — testes de cadastro, login, logout e perfil do usuário.
// O login com Google é testado com respostas simuladas do Google (token válido, falso e de outro app).
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
    const bcrypt = require("bcryptjs");
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

  describe("login com Google", () => {
    const idCliente = "osiris-teste.apps.googleusercontent.com";
    let buscaGoogle;

    // Simula a resposta do Google para o token enviado.
    function googleResponde(status, dados) {
      buscaGoogle = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: status === 200,
        status,
        json: async () => dados,
      });
    }

    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = idCliente;
    });

    afterEach(() => {
      delete process.env.GOOGLE_CLIENT_ID;
      buscaGoogle?.mockRestore();
      buscaGoogle = undefined;
    });

    const tokenValido = {
      aud: idCliente,
      iss: "https://accounts.google.com",
      email: "Google@Example.com",
      email_verified: "true",
      name: "Google Dev",
    };

    it("entra numa conta existente com token confirmado pelo Google", async () => {
      googleResponde(200, tokenValido);
      mockQueries([[{ id_user: 3, name: "Google Dev", email: "google@example.com" }]]);

      const response = await request(app).post("/api/osiris/auth/google").send({ credential: "token-do-google" });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe("google@example.com");
      expect(buscaGoogle.mock.calls[0][0]).toContain("id_token=token-do-google");
    });

    it("cria a conta no primeiro login com Google", async () => {
      googleResponde(200, tokenValido);
      mockQueries([[]], [{ insertId: 10 }]);

      const response = await request(app).post("/api/osiris/auth/google").send({ credential: "token-do-google" });

      expect(response.status).toBe(201);
      expect(response.body.user.id_user).toBe(10);
    });

    it("não aceita só o e-mail, sem token do Google", async () => {
      const response = await request(app).post("/api/osiris/auth/google").send({ email: "vitima@example.com" });

      expect(response.status).toBe(400);
    });

    it("recusa token que o Google não confirma", async () => {
      googleResponde(400, { error: "invalid_token" });

      const response = await request(app).post("/api/osiris/auth/google").send({ credential: "falso" });

      expect(response.status).toBe(401);
    });

    it("recusa token emitido para outro aplicativo", async () => {
      googleResponde(200, { ...tokenValido, aud: "outro-app.apps.googleusercontent.com" });

      const response = await request(app).post("/api/osiris/auth/google").send({ credential: "token-de-outro-app" });

      expect(response.status).toBe(401);
    });

    it("recusa quando o login com Google não está configurado no servidor", async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      const response = await request(app).post("/api/osiris/auth/google").send({ credential: "qualquer" });

      expect(response.status).toBe(503);
    });
  });
});
