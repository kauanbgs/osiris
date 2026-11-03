jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");
const {
  validatePublicUrl,
  isPrivateIp,
} = require("../services/browserCaptureService");

beforeEach(() => {
  resetDatabaseMock();
});

describe("BrowserCapture - Validações Unitárias de Segurança", () => {
  it("identifica corretamente IPs privados e de loopback", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);

    // IP público (Cloudflare / Google DNS)
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("8.8.8.8")).toBe(false);
  });

  it("rejeita esquemas não permitidos e URLs malformadas", () => {
    expect(() => validatePublicUrl("ftp://inseguro.org")).toThrow(
      "Somente HTTP e HTTPS são permitidos."
    );
    expect(() => validatePublicUrl("javascript:alert(1)")).toThrow(
      "Somente HTTP e HTTPS são permitidos."
    );
    expect(() => validatePublicUrl("://url-invalida")).toThrow(
      "URL inválida."
    );
    expect(() => validatePublicUrl("")).toThrow("Informe uma URL válida.");
    expect(() => validatePublicUrl("   ")).toThrow("Informe uma URL válida.");
    expect(() => validatePublicUrl(null)).toThrow("Informe uma URL válida.");
    expect(() => validatePublicUrl(123)).toThrow("Informe uma URL válida.");
  });

  it("rejeita URLs com credenciais ou portas não padrão", () => {
    expect(() => validatePublicUrl("http://user:pass@example.com")).toThrow(
      "URLs com usuário e senha não são permitidas."
    );
    expect(() => validatePublicUrl("http://example.com:8080")).toThrow(
      "Somente as portas 80 e 443 são permitidas."
    );
  });

  it("bloqueia endereços locais e de infraestrutura interna", () => {
    expect(() => validatePublicUrl("http://localhost")).toThrow(
      "Endereços locais ou privados não são permitidos."
    );
    expect(() => validatePublicUrl("http://meu-host.local")).toThrow(
      "Endereços locais ou privados não são permitidos."
    );
    expect(() => validatePublicUrl("http://127.0.0.1")).toThrow(
      "Endereços locais ou privados não são permitidos."
    );
    expect(() => validatePublicUrl("http://192.168.1.100")).toThrow(
      "Endereços locais ou privados não são permitidos."
    );
  });
});

describe("POST /api/osiris/browser/capture - Integração e Endpoint", () => {
  it("rejeita requisições sem token JWT com status 401", async () => {
    const res = await request(app)
      .post("/api/osiris/browser/capture")
      .send({ url: "https://example.com" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain("Token not provided.");
  });

  it("rejeita requisições com token inválido com status 401", async () => {
    const res = await request(app)
      .post("/api/osiris/browser/capture")
      .set("Authorization", "Bearer token-invalido")
      .send({ url: "https://example.com" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it("rejeita URL vazia ou ausente com status 400", async () => {
    const res = await request(app)
      .post("/api/osiris/browser/capture")
      .set(auth(1))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Informe uma URL válida.");
  });

  it("rejeita URLs privadas e SSRF com status 400", async () => {
    const res = await request(app)
      .post("/api/osiris/browser/capture")
      .set(auth(1))
      .send({ url: "http://127.0.0.1" });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      "Endereços locais ou privados não são permitidos."
    );
  });

  it("rejeita domínios inexistentes sem derrubar a API", async () => {
    const res = await request(app)
      .post("/api/osiris/browser/capture")
      .set(auth(1))
      .send({
        url: "https://dominio-inexistente-que-nunca-vai-existir-osiris-teste.org",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toContain(
      "Não foi possível localizar o domínio."
    );
  });

  it(
    "executa captura real de página pública e retorna dados estruturados e screenshot JPEG",
    async () => {
      const res = await request(app)
        .post("/api/osiris/browser/capture")
        .set(auth(1))
        .send({ url: "https://example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Página capturada com sucesso.");
      expect(res.body.status_code).toBe(200);
      expect(res.body.url).toContain("example.com");
      expect(res.body.captured_at).toBeDefined();

      // Screenshot JPEG em base64
      expect(res.body.screenshot).toBeDefined();
      expect(res.body.screenshot.mime_type).toBe("image/jpeg");
      expect(typeof res.body.screenshot.base64).toBe("string");
      expect(res.body.screenshot.base64.length).toBeGreaterThan(1000);
      expect(typeof res.body.screenshot.full_page).toBe("boolean");

      // Dados estruturados
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toContain("Example Domain");
      expect(Array.isArray(res.body.data.headings)).toBe(true);
      expect(Array.isArray(res.body.data.links)).toBe(true);
      expect(Array.isArray(res.body.data.tables)).toBe(true);
      expect(typeof res.body.data.text).toBe("string");
      expect(res.body.data.text.length).toBeGreaterThan(0);
    },
    35000
  );
});
