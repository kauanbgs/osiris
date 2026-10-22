jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");
const BrowserService = require("../services/browserService");

beforeEach(() => {
  resetDatabaseMock();
  BrowserService.clearAllSessions();
});

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
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

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
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

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
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

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
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

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
    const createRes = await request(app)
      .post("/api/osiris/browser/session")
      .set(auth(1))
      .send({});
    const sessionId = createRes.body.session.id_session;

    // Add disabled element to session
    const session = BrowserService.getSession(sessionId, 1);
    session.dom_tree.elements.push({ selector: "button#disabled-btn", disabled: true, text: "Disabled" });

    const clickRes = await request(app)
      .post("/api/osiris/browser/click")
      .set(auth(1))
      .send({
        id_session: sessionId,
        selector: "button#disabled-btn",
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
    expect(navRes.body.elements_count).toBeGreaterThan(0);
    expect(navRes.body.dom_tree).toBeDefined();
    expect(Array.isArray(navRes.body.dom_tree.elements)).toBe(true);
    expect(navRes.body.dom_tree.elements[0]).toHaveProperty("selector");
    expect(navRes.body.dom_tree.elements[0]).toHaveProperty("tag");
  });
});
