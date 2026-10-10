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
});
