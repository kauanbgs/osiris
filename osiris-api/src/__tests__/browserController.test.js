// browserController.test.js — testes das rotas do Navegador: sessões, cliques e proxy do modo web.
// O proxy é testado com ticket válido, sem ticket, com destinos internos e com redirecionamento para a rede interna.
jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");
const BrowserService = require("../services/browserService");

// Página falsa usada nos testes: o Navegador lê os elementos reais do HTML.
const PAGINA_EXEMPLO = `<html><head><title>Exemplo</title></head><body>
  <h1>Olá</h1>
  <a class="link" href="/docs">Documentation</a>
  <button id="submit">Submit</button>
  <button id="desligado" disabled>Desligado</button>
  <input name="q" placeholder="Buscar">
</body></html>`;

let consultaDnsGeral;
let buscaGeral;

beforeEach(() => {
  resetDatabaseMock();
  BrowserService.clearAllSessions();
  // Os testes não dependem de internet.
  consultaDnsGeral = jest.spyOn(require("node:dns").promises, "lookup")
    .mockResolvedValue([{ address: "93.184.215.14", family: 4 }]);
  buscaGeral = jest.spyOn(global, "fetch").mockImplementation(async (url) => ({
    status: 200,
    url,
    headers: { get: (h) => (h === "content-type" ? "text/html; charset=utf-8" : null) },
    arrayBuffer: async () => Buffer.from(PAGINA_EXEMPLO),
  }));
});

afterEach(() => {
  consultaDnsGeral.mockRestore();
  buscaGeral.mockRestore();
});

// Cria uma sessão e abre a página de exemplo, como o Navegador faz.
async function abrirPaginaExemplo() {
  const createRes = await request(app)
    .post("/api/osiris/browser/session")
    .set(auth(1))
    .send({});
  const sessionId = createRes.body.session.id_session;
  await request(app)
    .post("/api/osiris/browser/navigate")
    .set(auth(1))
    .send({ id_session: sessionId, url: "https://example.com" });
  return sessionId;
}

describe("BrowserController", () => {
  it("creates, retrieves and closes a browser session", async () => {
    // 1. Create session
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({ initial_url: "https://osiris.local" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.session.id_session).toBeDefined();
    expect(createRes.body.session.current_url).toBe("https://osiris.local");

    const sessionId = createRes.body.session.id_session;

    // 2. Get session
    const getRes = await request(app)
      .get(`/api/osiris/browser/session/${sessionId}`)
      .set(auth(1));

    expect(getRes.status).toBe(200);
    expect(getRes.body.session.id_session).toBe(sessionId);

    // 3. Close session
    const closeRes = await request(app)
      .delete(`/api/osiris/browser/session/${sessionId}`)
      .set(auth(1));

    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe("closed");
  });

  it("navigates to a new web page and appends to session history", async () => {
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

    const navRes = await request(app)
      .post("/api/osiris/browser/navigate")
      .set(auth(1))
      .send({
        id_session: sessionId,
        url: "https://example.com/dashboard",
      });

    expect(navRes.status).toBe(200);
    expect(navRes.body.status).toBe("navigated");
    expect(navRes.body.current_url).toBe("https://example.com/dashboard");
    expect(navRes.body.history_length).toBe(2);
  });

  it("rejects invalid or unsupported URL schemes", async () => {
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

    const navRes = await request(app)
      .post("/api/osiris/browser/navigate")
      .set(auth(1))
      .send({
        id_session: sessionId,
        url: "ftp://unsafe-link.org",
      });

    expect(navRes.status).toBe(400);
    expect(navRes.body.error.message).toContain("Only HTTP and HTTPS");
  });

  it("clicks on an element selector and handles link navigation", async () => {
    const sessionId = await abrirPaginaExemplo();

    const clickRes = await request(app)
      .post("/api/osiris/browser/click")
      .set(auth(1))
      .send({
        id_session: sessionId,
        selector: "a.link",
      });

    expect(clickRes.status).toBe(200);
    expect(clickRes.body.clicked_element.selector).toBe("a.link");
    expect(clickRes.body.navigation_triggered).toBe(true);
    expect(clickRes.body.current_url).toBe("https://example.com/docs");
  });

  it("clicks by screen coordinates", async () => {
    const sessionId = await abrirPaginaExemplo();

    const clickRes = await request(app)
      .post("/api/osiris/browser/click")
      .set(auth(1))
      .send({
        id_session: sessionId,
        x: 150,
        y: 320,
      });

    expect(clickRes.status).toBe(200);
    expect(clickRes.body.coordinates).toEqual({ x: 150, y: 320 });
  });

  it("returns 404 when clicking a non-existent element selector", async () => {
    const sessionId = await abrirPaginaExemplo();

    const clickRes = await request(app)
      .post("/api/osiris/browser/click")
      .set(auth(1))
      .send({
        id_session: sessionId,
        selector: "#non-existent-button",
      });

    expect(clickRes.status).toBe(404);
    expect(clickRes.body.error.message).toContain("was not found");
  });

  it("clicks on interactive button without redirect and returns event confirmation", async () => {
    const sessionId = await abrirPaginaExemplo();

    const clickRes = await request(app)
      .post("/api/osiris/browser/click")
      .set(auth(1))
      .send({
        id_session: sessionId,
        selector: "button#submit",
      });

    expect(clickRes.status).toBe(200);
    expect(clickRes.body.clicked_element.selector).toBe("button#submit");
    expect(clickRes.body.navigation_triggered).toBe(false);
  });

  it("rejects clicking disabled element with 400", async () => {
    const sessionId = await abrirPaginaExemplo();

    const clickRes = await request(app)
      .post("/api/osiris/browser/click")
      .set(auth(1))
      .send({
        id_session: sessionId,
        selector: "button#desligado",
      });

    expect(clickRes.status).toBe(400);
    expect(clickRes.body.error.message).toContain("is disabled");
  });

  it("lists all active browser sessions for the authenticated user with isolation", async () => {
    // 1. User 1 creates 2 sessions
    await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({ initial_url: "https://site-a.com" });

    await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({ initial_url: "https://site-b.com" });

    // 2. User 2 creates 1 session
    const u2Session = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(2))
      .send({ initial_url: "https://user2-site.com" });

    // 3. User 1 lists sessions -> should only see 2
    const listUser1 = await request(app)
      .get("/api/osiris/browser/sessions")
      .set(auth(1));

    expect(listUser1.status).toBe(200);
    expect(listUser1.body.sessions).toHaveLength(2);
    expect(listUser1.body.sessions.every((s) => s.status === "active")).toBe(true);

    // 4. User 2 lists sessions -> should only see 1
    const listUser2 = await request(app)
      .get("/api/osiris/browser/sessions")
      .set(auth(2));

    expect(listUser2.status).toBe(200);
    expect(listUser2.body.sessions).toHaveLength(1);
    expect(listUser2.body.sessions[0].current_url).toBe("https://user2-site.com");

    // 5. User 1 tries to access User 2 session -> 403 Forbidden
    const forbiddenRes = await request(app)
      .get(`/api/osiris/browser/session/${u2Session.body.session.id_session}`)
      .set(auth(1));

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.message).toContain("do not have access");
  });

  it("returns rich DOM tree and element count on navigate", async () => {
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

    const navRes = await request(app)
      .post("/api/osiris/browser/navigate")
      .set(auth(1))
      .send({
        id_session: sessionId,
        url: "https://huggingface.co/models",
      });

    expect(navRes.status).toBe(200);
    expect(navRes.body.title).toBe("Exemplo");
    expect(navRes.body.dom_tree.elements.map((el) => el.selector)).toEqual(
      expect.arrayContaining(["h1:nth-of-type(1)", "a.link", "button#submit", "input:nth-of-type(1)"]),
    );
    expect(navRes.body.elements_count).toBeGreaterThan(0);
    expect(navRes.body.dom_tree).toBeDefined();
    expect(Array.isArray(navRes.body.dom_tree.elements)).toBe(true);
    expect(navRes.body.dom_tree.elements[0]).toHaveProperty("selector");
    expect(navRes.body.dom_tree.elements[0]).toHaveProperty("tag");
  });

  describe("GET /api/osiris/browser/proxy", () => {
    const dns = require("node:dns").promises;
    const { gerarTicketProxy } = require("../services/ticketProxy");
    const ticket = () => gerarTicketProxy(1);
    let consultaDns;

    beforeEach(() => {
      // Os testes não dependem de internet: example.com "resolve" para um IP público.
      consultaDns = jest.spyOn(dns, "lookup").mockResolvedValue([{ address: "93.184.215.14", family: 4 }]);
    });

    afterEach(() => {
      consultaDns.mockRestore();
    });

    it("gera o ticket do proxy só para quem está logado", async () => {
      const semLogin = await request(app).post("/api/osiris/browser/proxy/ticket");
      expect(semLogin.status).toBe(401);

      const res = await request(app).post("/api/osiris/browser/proxy/ticket").set(auth());
      expect(res.status).toBe(200);
      expect(typeof res.body.ticket).toBe("string");
    });

    it("recusa o proxy sem ticket", async () => {
      const res = await request(app).get("/api/osiris/browser/proxy?url=https://example.com");
      expect(res.status).toBe(401);
    });

    it("não aceita o ticket do proxy como login nas outras rotas", async () => {
      const res = await request(app).get("/api/osiris/auth/me").set({ Authorization: `Bearer ${ticket()}` });
      expect(res.status).toBe(401);
    });

    it("rejects request without url query parameter", async () => {
      const res = await request(app).get(`/api/osiris/browser/proxy?ticket=${ticket()}`);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("url");
    });

    it("rejects request with invalid url", async () => {
      const res = await request(app).get(`/api/osiris/browser/proxy?ticket=${ticket()}&url=invalid-url`);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("URL");
    });

    it("rejects request to localhost or private network (SSRF protection)", async () => {
      const res = await request(app).get(`/api/osiris/browser/proxy?ticket=${ticket()}&url=http://127.0.0.1:8080`);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain("Endereços locais");
    });

    it("recusa domínio que aponta para a rede interna", async () => {
      consultaDns.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
      const res = await request(app).get(`/api/osiris/browser/proxy?ticket=${ticket()}&url=https://metadados.exemplo.com`);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain("bloqueado");
    });

    it("não segue redirecionamento para a rede interna", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        status: 302,
        headers: { get: (h) => (h === "location" ? "http://169.254.169.254/latest" : null) },
      });

      try {
        const res = await request(app).get(`/api/osiris/browser/proxy?ticket=${ticket()}&url=https://example.com`);
        expect(res.status).toBe(403);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("proxies and rewrites HTML content from valid upstream", async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        url: "https://example.com",
        headers: {
          get: (h) => (h === "content-type" ? "text/html; charset=utf-8" : null),
        },
        arrayBuffer: async () => Buffer.from("<html><head><meta http-equiv=\"x-frame-options\" content=\"deny\"><title>Example</title></head><body><h1>Hello</h1></body></html>"),
      });

      try {
        const res = await request(app).get(`/api/osiris/browser/proxy?ticket=${ticket()}&url=https://example.com`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toContain("text/html");
        expect(res.headers["referrer-policy"]).toBe("no-referrer");
        expect(res.text).toContain("<base href=\"https://example.com/\">");
        expect(res.text).toContain("__osiris");
        expect(res.text).not.toContain("x-frame-options");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
