// browserService.js — sessões do Navegador na API: histórico, navegação e cliques de cada usuário.
// Ao navegar, lê a página real e lista os elementos dela; não inventa elementos nem roda scripts.
const crypto = require("crypto");
const { BadRequestError, NotFoundError, ForbiddenError } = require("../errors");
const BrowserProxyService = require("./browserProxyService");
const { extrairElementosDaPagina } = require("./elementosPagina");

class BrowserService {
  static sessions = new Map();
  static SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes inactivity TTL
  static MAX_SESSIONS = 50;

  static cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      const lastActive = new Date(session.updated_at || session.created_at).getTime();
      if (now - lastActive > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  static createSession(userId, initialUrl = "about:blank") {
    this.cleanupExpiredSessions();

    if (this.sessions.size >= this.MAX_SESSIONS) {
      // Evict oldest session
      const oldestId = this.sessions.keys().next().value;
      this.sessions.delete(oldestId);
    }

    const sessionId = crypto.randomUUID();
    const session = {
      id_session: sessionId,
      fk_id_user: userId,
      status: "active",
      current_url: initialUrl,
      title: initialUrl === "about:blank" ? "Blank Page" : "Web Page",
      history: [{ url: initialUrl, timestamp: new Date().toISOString() }],
      // Os elementos reais só aparecem depois de navegar (a página é lida em navigate).
      dom_tree: {
        title: initialUrl === "about:blank" ? "Blank Page" : "Web Page",
        elements: [],
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  static listUserSessions(userId) {
    this.cleanupExpiredSessions();
    const userSessions = [];
    for (const session of this.sessions.values()) {
      if (session.fk_id_user === userId && session.status === "active") {
        userSessions.push({
          id_session: session.id_session,
          current_url: session.current_url,
          title: session.title,
          status: session.status,
          history_length: session.history ? session.history.length : 1,
          elements_count: session.dom_tree?.elements?.length || 0,
          created_at: session.created_at,
          updated_at: session.updated_at,
        });
      }
    }
    return userSessions;
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

    // Lê a página de verdade (com a mesma checagem de destino do proxy) e lista os elementos reais.
    let domTree;
    try {
      const pagina = await BrowserProxyService.buscarPaginaPublica(targetUrl);
      const ehHtml = /text\/html|application\/xhtml/i.test(pagina.contentType);
      domTree = ehHtml
        ? extrairElementosDaPagina(BrowserProxyService.decodificar(pagina.buffer, pagina.contentType), pagina.urlFinal)
        : { title: null, elements: [] };
    } catch (error) {
      domTree = { title: null, elements: [], aviso: `Não foi possível ler a página: ${error.message}` };
    }

    const title = domTree.title || parsed.hostname;
    domTree.title = title;
    session.current_url = targetUrl;
    session.title = title;
    session.updated_at = new Date().toISOString();
    session.history.push({ url: targetUrl, timestamp: session.updated_at });
    session.dom_tree = domTree;

    return {
      id_session: sessionId,
      status: "navigated",
      current_url: targetUrl,
      title,
      history_length: session.history.length,
      elements_count: session.dom_tree.elements.length,
      dom_tree: session.dom_tree,
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
      if (targetElement.disabled) {
        throw new BadRequestError(`Element matching selector '${selector}' is disabled.`);
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

    // A API não roda os scripts da página: só links mudam de página. Outros cliques são apenas registrados.
    return {
      id_session: sessionId,
      clicked_element: {
        selector: targetElement.selector,
        text: targetElement.text,
      },
      aviso: navigationTriggered ? null : "Clique registrado; scripts da página não são executados pelo servidor.",
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
