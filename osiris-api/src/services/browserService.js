const crypto = require("crypto");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");

class BrowserService {
  static sessions = new Map();

  static createSession(userId, initialUrl = "about:blank") {
    const sessionId = crypto.randomUUID();
    const session = {
      id_session: sessionId,
      fk_id_user: userId,
      status: "active",
      current_url: initialUrl,
      title: initialUrl === "about:blank" ? "Blank Page" : "Web Page",
      history: [{ url: initialUrl, timestamp: new Date().toISOString() }],
      dom_tree: {
        title: initialUrl === "about:blank" ? "Blank Page" : "Web Page",
        elements: [
          { selector: "body", text: "Page Content", clickable: false },
          { selector: "button#submit", text: "Submit", clickable: true },
          { selector: "a.link", text: "Documentation", clickable: true, href: "https://example.com/docs" },
        ],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  static getSession(sessionId, userId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundError("Browser session not found.");
    }
    if (session.fk_id_user !== userId) {
      throw new ForbiddenError("You do not have access to this browser session.");
    }
    return session;
  }

  static closeSession(sessionId, userId) {
    const session = this.getSession(sessionId, userId);
    session.status = "closed";
    session.updated_at = new Date().toISOString();
    this.sessions.delete(sessionId);
    return { id_session: sessionId, status: "closed" };
  }

  static async navigate(sessionId, targetUrl, userId) {
    const session = this.getSession(sessionId, userId);

    if (!targetUrl || typeof targetUrl !== "string") {
      throw new BadRequestError("Target URL is required.");
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new BadRequestError("Invalid URL format.");
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new BadRequestError("Only HTTP and HTTPS protocols are allowed.");
    }

    const title = `Page - ${parsed.hostname}`;
    session.current_url = targetUrl;
    session.title = title;
    session.updated_at = new Date().toISOString();
    session.history.push({ url: targetUrl, timestamp: session.updated_at });
    session.dom_tree = {
      title,
      elements: [
        { selector: "h1", text: `Welcome to ${parsed.hostname}`, clickable: false },
        { selector: "button#login-btn", text: "Login", clickable: true },
        { selector: "a#nav-docs", text: "Docs", clickable: true, href: `${targetUrl}/docs` },
        { selector: "input#search", text: "", clickable: true },
      ],
    };

    return {
      id_session: sessionId,
      status: "navigated",
      current_url: targetUrl,
      title,
      history_length: session.history.length,
    };
  }

  static async click(sessionId, { selector, x, y }, userId) {
    const session = this.getSession(sessionId, userId);

    if (!selector && (x === undefined || y === undefined)) {
      throw new BadRequestError("Either a CSS selector or (x, y) coordinates must be provided for click.");
    }

    let targetElement = null;
    if (selector) {
      targetElement = session.dom_tree.elements.find((el) => el.selector === selector);
      if (!targetElement) {
        throw new NotFoundError(`Element matching selector '${selector}' was not found.`);
      }
    } else {
      targetElement = {
        selector: `point(${x},${y})`,
        text: "Coordinate target",
        clickable: true,
      };
    }

    session.updated_at = new Date().toISOString();

    let navigationTriggered = false;
    let nextUrl = session.current_url;

    if (targetElement.href) {
      navigationTriggered = true;
      nextUrl = targetElement.href;
      session.current_url = nextUrl;
      session.history.push({ url: nextUrl, timestamp: session.updated_at });
    }

    return {
      id_session: sessionId,
      clicked_element: {
        selector: targetElement.selector,
        text: targetElement.text,
      },
      coordinates: x !== undefined && y !== undefined ? { x, y } : null,
      navigation_triggered: navigationTriggered,
      current_url: session.current_url,
      timestamp: session.updated_at,
    };
  }

  static clearAllSessions() {
    this.sessions.clear();
  }
}

module.exports = BrowserService;
